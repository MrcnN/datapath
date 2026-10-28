"""services/agent_jobs_service.py — SQL Server Agent jobs, step execution history, and failure diagnostics."""
from __future__ import annotations

import logging
from typing import List, Optional

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.agent_jobs import (
    AgentJobDetail,
    AgentJobsSummary,
    JobStepHistory,
)
from app.services.demo_data import DEMO_AGENT_JOBS_SUMMARY

logger = logging.getLogger(__name__)


def _format_sql_datetime(dt_int: Optional[int], tm_int: Optional[int]) -> Optional[str]:
    """Convert SQL Agent integer date (YYYYMMDD) and time (HHMMSS) to ISO format string."""
    if not dt_int or dt_int <= 0:
        return None
    dt_str = str(dt_int).zfill(8)
    tm_str = str(tm_int or 0).zfill(6)
    try:
        year, month, day = dt_str[:4], dt_str[4:6], dt_str[6:8]
        hour, minute, second = tm_str[:2], tm_str[2:4], tm_str[4:6]
        return f"{year}-{month}-{day} {hour}:{minute}:{second}"
    except Exception:
        return None


def _format_duration_sec(dur_int: Optional[int]) -> int:
    """Convert SQL Agent integer duration (HHMMSS) to total seconds."""
    if not dur_int or dur_int <= 0:
        return 0
    dur_str = str(dur_int).zfill(6)
    try:
        hours = int(dur_str[:2])
        mins = int(dur_str[2:4])
        secs = int(dur_str[4:6])
        return (hours * 3600) + (mins * 60) + secs
    except Exception:
        return 0


def get_agent_jobs_summary(params: Optional[ConnectionParams] = None) -> AgentJobsSummary:
    """Retrieve all SQL Server Agent jobs with last run status, execution duration, and next run date."""
    conn = get_db_connection(params)
    if not conn:
        logger.info("AgentJobsService: No connection, returning demo jobs data.")
        return DEMO_AGENT_JOBS_SUMMARY

    try:
        cursor = conn.cursor()

        # Check if SQL Agent is running
        agent_running = True
        try:
            cursor.execute("SELECT status_desc FROM sys.dm_server_services WHERE servicename LIKE 'SQL Server Agent%';")
            srow = cursor.fetchone()
            if srow and "Running" not in str(srow[0]):
                agent_running = False
        except Exception:
            pass

        # Query all jobs with last execution from sysjobhistory (step_id = 0) and next schedule
        query = """
        SELECT 
            CAST(j.job_id AS VARCHAR(50)) AS job_id,
            j.name,
            j.enabled,
            ISNULL(c.name, 'Uncategorized') AS category,
            ISNULL(j.description, '') AS description,
            jh.run_status AS last_run_status_raw,
            jh.run_date AS last_run_date_raw,
            jh.run_time AS last_run_time_raw,
            jh.run_duration AS last_run_duration_raw,
            ISNULL(jh.message, '') AS last_message,
            js.next_run_date AS next_run_date_raw,
            js.next_run_time AS next_run_time_raw
        FROM msdb.dbo.sysjobs j
        LEFT JOIN msdb.dbo.syscategories c ON j.category_id = c.category_id
        OUTER APPLY (
            SELECT TOP 1 
                h.run_status, h.run_date, h.run_time, h.run_duration, h.message
            FROM msdb.dbo.sysjobhistory h
            WHERE h.job_id = j.job_id AND h.step_id = 0
            ORDER BY h.run_date DESC, h.run_time DESC
        ) jh
        OUTER APPLY (
            SELECT TOP 1 
                sjs.next_run_date, sjs.next_run_time
            FROM msdb.dbo.sysjobschedules sjs
            WHERE sjs.job_id = j.job_id AND sjs.next_run_date > 0
            ORDER BY sjs.next_run_date ASC, sjs.next_run_time ASC
        ) js
        ORDER BY j.name;
        """
        cursor.execute(query)
        rows = rows_to_dicts(cursor)

        jobs: List[AgentJobDetail] = []
        status_map = {0: "FAILED", 1: "SUCCESS", 2: "RETRY", 3: "CANCELLED", 4: "IN_PROGRESS"}

        for r in rows:
            raw_status = r.get("last_run_status_raw")
            status_val = status_map.get(raw_status, "NEVER_RUN") if raw_status is not None else "NEVER_RUN"
            last_run = _format_sql_datetime(r.get("last_run_date_raw"), r.get("last_run_time_raw"))
            next_run = _format_sql_datetime(r.get("next_run_date_raw"), r.get("next_run_time_raw"))
            duration_sec = _format_duration_sec(r.get("last_run_duration_raw"))

            failed_step = None
            failed_msg = None
            if status_val == "FAILED":
                # Find specific step that failed
                try:
                    cursor.execute("""
                    SELECT TOP 1 step_id, message
                    FROM msdb.dbo.sysjobhistory
                    WHERE job_id = CAST(? AS UNIQUEIDENTIFIER) AND run_status = 0 AND step_id > 0
                    ORDER BY run_date DESC, run_time DESC;
                    """, r.get("job_id"))
                    frow = cursor.fetchone()
                    if frow:
                        failed_step = int(frow[0])
                        failed_msg = str(frow[1])
                except Exception:
                    failed_msg = r.get("last_message")

            jobs.append(
                AgentJobDetail(
                    job_id=str(r.get("job_id", "")),
                    name=str(r.get("name", "")),
                    enabled=bool(r.get("enabled", 0)),
                    category=str(r.get("category", "General")),
                    description=str(r.get("description", "")),
                    last_run_status=status_val,
                    last_run_date=last_run,
                    last_run_duration_sec=duration_sec,
                    next_run_date=next_run,
                    last_failed_step_id=failed_step,
                    last_failed_message=failed_msg or (r.get("last_message") if status_val == "FAILED" else None),
                )
            )

        cursor.close()
        conn.close()

        total = len(jobs)
        enabled = sum(1 for j in jobs if j.enabled)
        disabled = total - enabled
        failed = sum(1 for j in jobs if j.last_run_status == "FAILED")
        running = sum(1 for j in jobs if j.last_run_status == "IN_PROGRESS")

        return AgentJobsSummary(
            agent_running=agent_running,
            total_jobs=total,
            enabled_jobs=enabled,
            disabled_jobs=disabled,
            failed_jobs_count=failed,
            running_jobs_count=running,
            jobs=jobs,
            is_demo=False,
        )

    except Exception as exc:
        logger.error("Failed to fetch SQL Agent jobs summary: %s", exc)
        return DEMO_AGENT_JOBS_SUMMARY


def get_job_step_history(job_id: str, params: Optional[ConnectionParams] = None) -> List[JobStepHistory]:
    """Retrieve detailed execution history of steps for a given SQL Agent job."""
    conn = get_db_connection(params)
    if not conn:
        for j in DEMO_AGENT_JOBS_SUMMARY.jobs:
            if j.job_id == job_id:
                return j.steps
        return DEMO_AGENT_JOBS_SUMMARY.jobs[0].steps if DEMO_AGENT_JOBS_SUMMARY.jobs else []

    try:
        cursor = conn.cursor()
        query = """
        SELECT TOP 25
            step_id,
            step_name,
            run_status,
            run_date,
            run_time,
            run_duration,
            ISNULL(message, '') AS message
        FROM msdb.dbo.sysjobhistory
        WHERE job_id = CAST(? AS UNIQUEIDENTIFIER) AND step_id > 0
        ORDER BY run_date DESC, run_time DESC, step_id ASC;
        """
        cursor.execute(query, job_id)
        rows = rows_to_dicts(cursor)
        cursor.close()
        conn.close()

        status_map = {0: "FAILED", 1: "SUCCESS", 2: "RETRY", 3: "CANCELLED", 4: "IN_PROGRESS"}
        steps: List[JobStepHistory] = []
        for r in rows:
            steps.append(
                JobStepHistory(
                    step_id=int(r.get("step_id", 0)),
                    step_name=str(r.get("step_name", "")),
                    run_status=status_map.get(r.get("run_status"), "UNKNOWN"),
                    run_date=_format_sql_datetime(r.get("run_date"), r.get("run_time")) or "",
                    run_duration_sec=_format_duration_sec(r.get("run_duration")),
                    message=str(r.get("message", "")),
                )
            )
        return steps
    except Exception as exc:
        logger.warning("Failed to fetch job step history: %s", exc)
        return []
