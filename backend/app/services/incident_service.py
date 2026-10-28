"""services/incident_service.py — Deadlock parsing, Agent jobs, error log, timeline."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from xml.etree import ElementTree as ET

import pyodbc

from app.core.exceptions import FeatureUnavailableError, PermissionDeniedError
from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.incidents import (
    AgentJobResponse,
    AgentJobResult,
    DeadlockInfo,
    DeadlockProcess,
    DeadlockResource,
    ErrorLogEntry,
    TimelineEvent,
)

logger = logging.getLogger(__name__)

_JOB_STATUS_MAP = {1: "succeeded", 2: "retry", 3: "cancelled", 4: "failed", 0: "unknown"}


def parse_deadlock_xml(xml_content: str) -> DeadlockInfo:
    """Parse a SQL Server deadlock XML (xdl format) into a structured object."""
    try:
        # Strip BOM if present
        xml_content = xml_content.lstrip("\ufeff").strip()
        # Wrap in root if bare <deadlock> element
        if xml_content.startswith("<deadlock"):
            xml_content = f"<root>{xml_content}</root>"
        root = ET.fromstring(xml_content)
    except ET.ParseError as exc:
        raise ValueError(f"Invalid deadlock XML: {exc}") from exc

    deadlock_el = root.find(".//deadlock")
    if deadlock_el is None:
        raise ValueError("No <deadlock> element found in XML")

    # Victims
    victims: List[str] = []
    victim_list = deadlock_el.find("victim-list")
    if victim_list is not None:
        for v in victim_list.findall("victimProcess"):
            pid = v.get("id", "")
            if pid:
                victims.append(pid)

    # Processes
    processes: List[DeadlockProcess] = []
    process_list = deadlock_el.find("process-list")
    if process_list is not None:
        for p in process_list.findall("process"):
            input_buf = p.find("inputbuf")
            sql_text = input_buf.text.strip() if input_buf is not None and input_buf.text else None
            processes.append(
                DeadlockProcess(
                    process_id=p.get("id", ""),
                    login=p.get("loginname"),
                    hostname=p.get("hostname"),
                    db_name=p.get("currentdb"),
                    client_app=p.get("clientapp"),
                    wait_type=p.get("waittype"),
                    wait_resource=p.get("waitresource"),
                    sql_text=sql_text,
                )
            )

    # Resources
    resources: List[DeadlockResource] = []
    resource_list = deadlock_el.find("resource-list")
    if resource_list is not None:
        for res_el in resource_list:
            waiters: List[str] = []
            waiter_list = res_el.find("waiter-list")
            if waiter_list is not None:
                for w in waiter_list.findall("waiter"):
                    wid = w.get("id", "")
                    if wid:
                        waiters.append(wid)
            resources.append(
                DeadlockResource(
                    resource_type=res_el.tag,
                    db_name=res_el.get("dbid"),
                    object_name=res_el.get("objectname"),
                    mode=res_el.get("mode"),
                    waiters=waiters,
                )
            )

    # Timestamp from attribute or None
    ts_str = deadlock_el.get("timestamp")
    ts: Optional[datetime] = None
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except ValueError:
            pass

    return DeadlockInfo(
        deadlock_id=deadlock_el.get("id"),
        timestamp=ts,
        victims=victims,
        processes=processes,
        resources=resources,
    )


def _hhmmss_to_seconds(val: int) -> int:
    """Convert SQL Agent run_duration (HHMMSS integer) to total seconds."""
    h = val // 10000
    m = (val % 10000) // 100
    s = val % 100
    return h * 3600 + m * 60 + s


def _build_run_datetime(run_date: int, run_time: int) -> Optional[datetime]:
    """Combine SQL Agent run_date (YYYYMMDD) and run_time (HHMMSS) to datetime."""
    try:
        date_str = str(run_date)
        time_str = str(run_time).zfill(6)
        return datetime(
            int(date_str[:4]),
            int(date_str[4:6]),
            int(date_str[6:8]),
            int(time_str[:2]),
            int(time_str[2:4]),
            int(time_str[4:6]),
        )
    except Exception:
        return None


def get_agent_jobs(
    params: ConnectionParams,
    days_back: int = 7,
    include_successful: bool = False,
) -> AgentJobResponse:
    """Retrieve SQL Agent job history from msdb."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            # Check if msdb is accessible
            cursor.execute("SELECT HAS_DBACCESS('msdb') AS has_access")
            row = cursor.fetchone()
            if not row or row[0] == 0:
                return AgentJobResponse(
                    available=False,
                    reason="No access to msdb database. SQL Agent history unavailable.",
                )

            status_filter = "" if include_successful else "AND jh.run_status != 1"
            cursor.execute(
                f"""
                SELECT
                    j.name                         AS job_name,
                    LOWER(CONVERT(VARCHAR(36), j.job_id)) AS job_id,
                    js.step_name,
                    jh.run_date,
                    jh.run_time,
                    jh.run_duration,
                    jh.run_status,
                    jh.message                     AS outcome_message
                FROM msdb.dbo.sysjobhistory jh
                JOIN msdb.dbo.sysjobs j      ON j.job_id      = jh.job_id
                LEFT JOIN msdb.dbo.sysjobsteps js ON js.job_id = jh.job_id
                                                  AND js.step_id = jh.step_id
                WHERE jh.run_date >= CONVERT(INT, CONVERT(VARCHAR,
                        DATEADD(day, -?, GETDATE()), 112))
                {status_filter}
                ORDER BY jh.run_date DESC, jh.run_time DESC
                """,
                (days_back,),
            )
            rows = rows_to_dicts(cursor)
            jobs = [
                AgentJobResult(
                    job_name=r["job_name"],
                    job_id=str(r["job_id"]),
                    step_name=r.get("step_name"),
                    run_date=_build_run_datetime(r["run_date"], r["run_time"]),
                    run_time=str(r["run_time"]).zfill(6),
                    run_duration_seconds=_hhmmss_to_seconds(r["run_duration"]),
                    outcome_message=r.get("outcome_message"),
                    status=_JOB_STATUS_MAP.get(r["run_status"], "unknown"),
                )
                for r in rows
            ]
            return AgentJobResponse(available=True, jobs=jobs)

    except pyodbc.Error as exc:
        err_str = str(exc)
        if "229" in err_str or "permission" in err_str.lower():
            return AgentJobResponse(
                available=False,
                reason="Insufficient permissions to query SQL Agent history.",
            )
        return AgentJobResponse(
            available=False,
            reason=f"SQL Agent history unavailable: {exc.args}",
        )


def get_error_log(
    params: ConnectionParams,
    search_text: str = "",
    severity_filter: Optional[int] = None,
    rows: int = 100,
) -> List[ErrorLogEntry]:
    """Read SQL Server error log via xp_readerrorlog."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            # xp_readerrorlog params: log_number, log_type, search1, search2, start, end, sort
            if search_text:
                cursor.execute("EXEC xp_readerrorlog 0, 1, ?", (search_text,))
            else:
                cursor.execute("EXEC xp_readerrorlog 0, 1")

            error_rows = rows_to_dicts(cursor)

            results: List[ErrorLogEntry] = []
            for r in error_rows[:rows]:
                text = r.get("Text") or r.get("message_text") or r.get("text") or ""
                process_info = r.get("ProcessInfo") or r.get("Source") or ""
                log_date = r.get("LogDate") or r.get("log_date")

                # Detect severity from text
                sev: Optional[int] = None
                is_error = False
                sev_match = re.search(r"Severity:\s*(\d+)", text, re.IGNORECASE)
                if sev_match:
                    sev = int(sev_match.group(1))
                    is_error = sev >= 16

                if "error" in text.lower() or "severity" in text.lower():
                    is_error = True

                if severity_filter is not None and sev != severity_filter:
                    continue

                results.append(
                    ErrorLogEntry(
                        log_date=log_date,
                        process_info=str(process_info),
                        message_text=str(text),
                        is_error=is_error,
                        severity=sev,
                    )
                )
            return results

    except pyodbc.Error as exc:
        err_str = str(exc)
        if "229" in err_str or "permission" in err_str.lower() or "xp_readerrorlog" in err_str.lower():
            raise PermissionDeniedError(
                "Cannot read error log. Requires VIEW SERVER STATE or sysadmin.",
                detail=str(exc.args),
            ) from exc
        raise


def get_incident_timeline(
    params: ConnectionParams,
    hours_back: int = 24,
) -> List[TimelineEvent]:
    """Aggregate incidents from multiple sources into a chronological list."""
    events: List[TimelineEvent] = []

    # --- Agent job failures ---
    try:
        agent_resp = get_agent_jobs(params, days_back=max(1, hours_back // 24 + 1), include_successful=False)
        if agent_resp.available:
            for job in agent_resp.jobs:
                if job.status == "failed":
                    events.append(
                        TimelineEvent(
                            event_time=job.run_date,
                            event_type="agent_failure",
                            severity="high",
                            source="SQL Agent",
                            title=f"Job Failed: {job.job_name}",
                            description=job.outcome_message,
                            metadata={"job_id": job.job_id, "step": job.step_name},
                        )
                    )
    except Exception as exc:
        logger.warning("Timeline: skipping agent jobs — %s", exc)

    # --- Error log ---
    try:
        error_entries = get_error_log(params, rows=200)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)
        for entry in error_entries:
            if entry.is_error:
                entry_time = entry.log_date
                # Skip entries outside window if we can determine the time
                if entry_time and hasattr(entry_time, "tzinfo"):
                    if entry_time.tzinfo is None:
                        # treat as local-ish, include anyway
                        pass
                sev_str = "high" if (entry.severity or 0) >= 20 else "medium"
                events.append(
                    TimelineEvent(
                        event_time=entry_time,
                        event_type="error_log",
                        severity=sev_str,
                        source="Error Log",
                        title="SQL Server Error",
                        description=entry.message_text[:500] if entry.message_text else None,
                        metadata={"process_info": entry.process_info, "severity": entry.severity},
                    )
                )
    except Exception as exc:
        logger.warning("Timeline: skipping error log — %s", exc)

    # Sort by event_time descending (None times go last)
    events.sort(key=lambda e: e.event_time or datetime.min, reverse=True)
    return events
