"""services/agent_jobs_service.py — SQL Server Agent jobs, step execution history, and failure diagnostics."""
from __future__ import annotations

import logging
from typing import List, Optional

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.agent_jobs import (
    AgentJobDetail,
    AgentJobsSummary,
    JobStepHistory,
    SQLAlertDetail,
    DatabaseMailItem,
    DatabaseMailStatus,
    AlertsAndMailSummary,
)
from app.services.demo_data import (
    DEMO_AGENT_JOBS_SUMMARY,
    DEMO_ALERTS_AND_MAIL_SUMMARY,
    CREATE_MISSING_ALERTS_SCRIPT,
)

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
        logger.info("AgentJobsService: No connection, returning empty jobs summary.")
        return AgentJobsSummary(total_jobs=0, running_jobs=0, failed_jobs=0, jobs=[], is_demo=False)

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
        return AgentJobsSummary(total_jobs=0, running_jobs=0, failed_jobs=0, jobs=[], is_demo=False)


def get_job_step_history(job_id: str, params: Optional[ConnectionParams] = None) -> List[JobStepHistory]:
    """Retrieve detailed execution history of steps for a given SQL Agent job."""
    conn = get_db_connection(params)
    if not conn:
        return []

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


def get_alerts_and_mail_summary(params: Optional[ConnectionParams] = None) -> AlertsAndMailSummary:
    """Retrieve SQL Server alerts, critical error definitions (Severity 17-25, 823-825),

    and Database Mail queue status and delivery failures."""
    conn = get_db_connection(params)
    if not conn:
        return AlertsAndMailSummary(
            total_alerts_configured=0,
            critical_alerts_count=0,
            missing_recommended_alerts_count=0,
            database_mail_status=DatabaseMailStatus(
                is_installed=False,
                is_enabled=False,
                service_status="STOPPED",
                unsent_items_count=0,
                failed_items_count=0,
                queue_empty=True,
                failed_recipients=[],
            ),
            alerts=[],
            create_missing_alerts_sql="",
            is_demo=False,
        )

    try:
        cursor = conn.cursor()

        # 1. Fetch configured alerts
        alerts_query = """
        SELECT 
            a.name,
            ISNULL(a.message_id, 0) AS message_id,
            ISNULL(a.severity, 0) AS severity,
            a.enabled,
            ISNULL(a.delay_between_responses, 0) AS delay_between_responses,
            a.last_occurrence_date,
            a.last_occurrence_time,
            ISNULL(a.occurrence_count, 0) AS occurrence_count,
            ISNULL(a.has_notification, 0) AS has_notification,
            ISNULL(o.name, '') AS operator_name
        FROM msdb.dbo.sysalerts a
        LEFT JOIN msdb.dbo.sysnotifications n ON a.id = n.alert_id
        LEFT JOIN msdb.dbo.sysoperators o ON n.operator_id = o.id
        ORDER BY a.severity DESC, a.message_id DESC, a.name ASC;
        """
        cursor.execute(alerts_query)
        alert_rows = rows_to_dicts(cursor)

        alerts_list: List[SQLAlertDetail] = []
        configured_sev_set = set()
        configured_msg_set = set()

        for ar in alert_rows:
            sev = int(ar.get("severity", 0))
            msg_id = int(ar.get("message_id", 0))
            if sev > 0:
                configured_sev_set.add(sev)
            if msg_id > 0:
                configured_msg_set.add(msg_id)

            has_notif = bool(ar.get("has_notification", 0))
            op_name = str(ar.get("operator_name", "")).strip() or None
            status_val = "CONFIGURED"
            if not has_notif or not op_name:
                status_val = "NO_OPERATOR"

            alerts_list.append(
                SQLAlertDetail(
                    name=str(ar.get("name", "")),
                    message_id=msg_id,
                    severity=sev,
                    enabled=bool(ar.get("enabled", True)),
                    delay_between_responses=int(ar.get("delay_between_responses", 0)),
                    last_occurrence=_format_sql_datetime(ar.get("last_occurrence_date"), ar.get("last_occurrence_time")),
                    occurrence_count=int(ar.get("occurrence_count", 0)),
                    has_notification=has_notif,
                    operator_name=op_name,
                    is_best_practice_missing=False,
                    status=status_val,
                )
            )

        # 2. Check missing best-practice alerts (823, 824, 825, Severity 17-25)
        critical_messages = {
            823: "Error 823: Hard I/O Failure",
            824: "Error 824: Logical Consistency Checksum Error",
            825: "Error 825: Read-Retry Warning",
        }
        for mid, mname in critical_messages.items():
            if mid not in configured_msg_set:
                alerts_list.append(
                    SQLAlertDetail(
                        name=mname,
                        message_id=mid,
                        severity=0,
                        enabled=False,
                        delay_between_responses=60,
                        last_occurrence=None,
                        occurrence_count=0,
                        has_notification=False,
                        operator_name=None,
                        is_best_practice_missing=True,
                        status="MISSING_CRITICAL",
                    )
                )

        for s in range(17, 26):
            if s not in configured_sev_set:
                alerts_list.append(
                    SQLAlertDetail(
                        name=f"Severity {str(s).zfill(3)} System Alert",
                        message_id=0,
                        severity=s,
                        enabled=False,
                        delay_between_responses=60,
                        last_occurrence=None,
                        occurrence_count=0,
                        has_notification=False,
                        operator_name=None,
                        is_best_practice_missing=True,
                        status="MISSING_CRITICAL",
                    )
                )

        # 3. Check Database Mail status & failures
        mail_queue_status = "STARTED"
        total_failed = 0
        total_unsent = 0
        total_sent = 0
        failed_mail_items: List[DatabaseMailItem] = []

        try:
            cursor.execute("""
            SELECT 
                COUNT(CASE WHEN sent_status = 'failed' THEN 1 END) AS total_failed,
                COUNT(CASE WHEN sent_status = 'unsent' THEN 1 END) AS total_unsent,
                COUNT(CASE WHEN sent_status = 'sent' THEN 1 END) AS total_sent
            FROM msdb.dbo.sysmail_mailitems;
            """)
            mrow = cursor.fetchone()
            if mrow:
                total_failed = int(mrow[0] or 0)
                total_unsent = int(mrow[1] or 0)
                total_sent = int(mrow[2] or 0)

            # Recent failed items
            failed_query = """
            SELECT TOP 20
                m.mailitem_id,
                ISNULL(m.recipients, '') AS recipients,
                ISNULL(m.subject, '') AS subject,
                CONVERT(VARCHAR(19), m.send_request_date, 120) AS send_request_date,
                ISNULL(m.send_request_user, '') AS send_request_user,
                m.sent_status,
                CONVERT(VARCHAR(19), m.last_mod_date, 120) AS last_mod_date,
                ISNULL(l.description, '') AS error_description
            FROM msdb.dbo.sysmail_mailitems m
            LEFT JOIN (
                SELECT mailitem_id, description,
                       ROW_NUMBER() OVER(PARTITION BY mailitem_id ORDER BY log_date DESC) as rn
                FROM msdb.dbo.sysmail_log
                WHERE event_type = 3
            ) l ON m.mailitem_id = l.mailitem_id AND l.rn = 1
            WHERE m.sent_status = 'failed'
            ORDER BY m.mailitem_id DESC;
            """
            cursor.execute(failed_query)
            frows = rows_to_dicts(cursor)
            for fr in frows:
                failed_mail_items.append(
                    DatabaseMailItem(
                        mailitem_id=int(fr.get("mailitem_id", 0)),
                        recipients=str(fr.get("recipients", "")),
                        subject=str(fr.get("subject", "")),
                        send_request_date=str(fr.get("send_request_date", "")),
                        send_request_user=str(fr.get("send_request_user", "")),
                        sent_status=str(fr.get("sent_status", "failed")),
                        last_mod_date=str(fr.get("last_mod_date", "")) or None,
                        error_description=str(fr.get("error_description", "")) or None,
                    )
                )
        except Exception as mail_err:
            logger.info("Database Mail tables not queryable: %s", mail_err)
            mail_queue_status = "INACTIVE"

        cursor.close()
        conn.close()

        missing_count = len([a for a in alerts_list if a.is_best_practice_missing])
        has_unnotified = len([a for a in alerts_list if not a.has_notification and a.enabled]) > 0

        return AlertsAndMailSummary(
            total_alerts=len(alerts_list),
            critical_alerts_missing_count=missing_count,
            has_unnotified_alerts=has_unnotified,
            mail_status=DatabaseMailStatus(
                mail_queue_status=mail_queue_status,
                total_failed_items=total_failed,
                total_unsent_items=total_unsent,
                total_sent_items=total_sent,
                recent_failed_items=failed_mail_items,
                restart_queue_sql="EXEC msdb.dbo.sysmail_stop_sp;\nWAITFOR DELAY '00:00:02';\nEXEC msdb.dbo.sysmail_start_sp;",
                cleanup_failed_sql="-- 30 günden eski başarısız mailleri temizleme:\nDECLARE @oldest_date DATETIME = DATEADD(dd, -30, GETDATE());\nEXEC msdb.dbo.sysmail_delete_mailitems_sp @sent_before = @oldest_date, @sent_status = 'failed';",
            ),
            alerts=alerts_list,
            create_missing_alerts_sql=CREATE_MISSING_ALERTS_SCRIPT,
            is_demo=False,
        )
    except Exception as exc:
        logger.error("Failed to query alerts and mail status: %s", exc)
        return AlertsAndMailSummary(
            total_alerts_configured=0,
            critical_alerts_count=0,
            missing_recommended_alerts_count=0,
            database_mail_status=DatabaseMailStatus(
                is_installed=False,
                is_enabled=False,
                service_status="STOPPED",
                unsent_items_count=0,
                failed_items_count=0,
                queue_empty=True,
                failed_recipients=[],
            ),
            alerts=[],
            create_missing_alerts_sql="",
            is_demo=False,
        )

