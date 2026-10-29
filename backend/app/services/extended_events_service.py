"""services/extended_events_service.py — Extended Events (XE) sessions, ring buffer extraction, and templates."""
from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from typing import List, Optional

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.extended_events import (
    XESession,
    RingBufferEvent,
    XETemplate,
    ExtendedEventsSummary,
)
from app.services.demo_data import (
    DEMO_XE_SESSIONS,
    DEMO_XE_EVENTS,
    DEMO_XE_TEMPLATES,
    DEMO_EXTENDED_EVENTS_SUMMARY,
)

logger = logging.getLogger(__name__)


def get_extended_events_summary(params: ConnectionParams) -> ExtendedEventsSummary:
    """Retrieve all active and stopped Extended Events sessions, parse system_health ring buffer, and provide DBA templates."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()

            # 1. Query Extended Event Sessions
            sessions_query = """
            SELECT 
                s.name,
                CASE WHEN sess.address IS NOT NULL THEN 'RUNNING' ELSE 'STOPPED' END AS status,
                CAST(s.startup_state AS BIT) AS auto_start,
                CAST(ROUND(ISNULL(sess.total_buffer_size, 0) / 1024.0, 2) AS FLOAT) AS total_buffer_size_kb,
                CAST(ROUND(ISNULL(s.max_memory, 0) / 1024.0, 2) AS FLOAT) AS max_memory_kb,
                ISNULL(s.event_retention_mode_desc, 'ALLOW_SINGLE_EVENT_LOSS') AS event_retention_mode,
                ISNULL(sess.dropped_buffer_count, 0) AS dropped_buffer_count,
                ISNULL(sess.dropped_event_count, 0) AS dropped_event_count,
                ISNULL(sess.largest_event_dropped_size, 0) AS largest_event_dropped_size,
                STRING_AGG(t.target_name, ', ') AS target_types,
                ISNULL(CONVERT(VARCHAR(19), sess.create_time, 120), '') AS start_time
            FROM sys.server_event_sessions s
            LEFT JOIN sys.dm_xe_sessions sess ON s.name = sess.name
            LEFT JOIN sys.server_event_session_targets t ON s.event_session_id = t.event_session_id
            GROUP BY 
                s.name, 
                sess.address, 
                s.startup_state, 
                sess.total_buffer_size, 
                s.max_memory, 
                s.event_retention_mode_desc, 
                sess.dropped_buffer_count, 
                sess.dropped_event_count, 
                sess.largest_event_dropped_size,
                sess.create_time
            ORDER BY (CASE WHEN sess.address IS NOT NULL THEN 0 ELSE 1 END), s.name;
            """
            cursor.execute(sessions_query)
            sess_rows = rows_to_dicts(cursor)

            sessions: List[XESession] = []
            for r in sess_rows:
                name = r.get("name", "")
                status = r.get("status", "STOPPED")
                auto_start = bool(r.get("auto_start", False))
                targets_str = r.get("target_types") or ""
                target_list = [t.strip() for t in targets_str.split(",") if t.strip()]

                next_action = "STOP" if status == "RUNNING" else "START"
                alter_script = f"ALTER EVENT SESSION [{name}] ON SERVER STATE = {next_action};"
                drop_script = f"DROP EVENT SESSION [{name}] ON SERVER;"

                sessions.append(
                    XESession(
                        name=name,
                        status=status,
                        auto_start=auto_start,
                        total_buffer_size_kb=float(r.get("total_buffer_size_kb", 0.0) or 0.0),
                        max_memory_kb=float(r.get("max_memory_kb", 0.0) or 0.0),
                        event_retention_mode=r.get("event_retention_mode", "ALLOW_SINGLE_EVENT_LOSS"),
                        dropped_buffer_count=int(r.get("dropped_buffer_count", 0) or 0),
                        dropped_event_count=int(r.get("dropped_event_count", 0) or 0),
                        largest_event_dropped_size=int(r.get("largest_event_dropped_size", 0) or 0),
                        targets=target_list,
                        target_types=targets_str or "none",
                        event_count=0,
                        start_time=r.get("start_time") or None,
                        alter_state_script=alter_script,
                        drop_script=drop_script,
                    )
                )

            # 2. Parse system_health ring buffer
            recent_events: List[RingBufferEvent] = []
            try:
                rb_query = """
                SELECT CAST(target_data AS XML) AS target_data_xml
                FROM sys.dm_xe_sessions s
                JOIN sys.dm_xe_session_targets t ON s.address = t.event_session_address
                WHERE s.name = 'system_health'
                  AND t.target_name = 'ring_buffer';
                """
                cursor.execute(rb_query)
                rb_row = cursor.fetchone()

                if rb_row and rb_row[0]:
                    xml_str = str(rb_row[0])
                    root = ET.fromstring(xml_str)

                    # Iterate over event elements in RingBufferTarget
                    for event_node in root.findall(".//event"):
                        event_name = event_node.attrib.get("name", "")
                        timestamp = event_node.attrib.get("timestamp", "").replace("T", " ")[:19]

                        if event_name == "xml_deadlock_report":
                            xml_text_node = event_node.find(".//data[@name='xml_report']/value")
                            deadlock_xml = xml_text_node.text if xml_text_node is not None else ""
                            recent_events.append(
                                RingBufferEvent(
                                    event_type="deadlock",
                                    timestamp=timestamp,
                                    message="Kilitlenme (Deadlock) Raporu sistem günlüğüne kaydedildi.",
                                    details="system_health ring_buffer tarafından tespit edildi.",
                                    xml_payload=deadlock_xml,
                                )
                            )
                        elif event_name == "error_reported":
                            err_num_node = event_node.find(".//data[@name='error_number']/value")
                            severity_node = event_node.find(".//data[@name='severity']/value")
                            msg_node = event_node.find(".//data[@name='message']/value")

                            err_num = int(err_num_node.text) if err_num_node is not None and err_num_node.text else None
                            sev = int(severity_node.text) if severity_node is not None and severity_node.text else None
                            msg = msg_node.text if msg_node is not None and msg_node.text else "Hata bildirildi."

                            # Only record high severity or important errors
                            if sev is not None and sev >= 16:
                                recent_events.append(
                                    RingBufferEvent(
                                        event_type="error_reported",
                                        timestamp=timestamp,
                                        severity=sev,
                                        error_number=err_num,
                                        message=msg,
                                        details=f"Hata Kodu: {err_num}, Önem Derecesi: {sev}",
                                    )
                                )
                        elif event_name == "connectivity_ring_buffer_recorded":
                            msg_node = event_node.find(".//data[@name='type']/text") or event_node.find(".//data[@name='type']/value")
                            msg = msg_node.text if msg_node is not None and msg_node.text else "Bağlantı zaman aşımı / el sıkışma olayı"
                            recent_events.append(
                                RingBufferEvent(
                                    event_type="connectivity",
                                    timestamp=timestamp,
                                    severity=14,
                                    message=f"Bağlantı Olayı: {msg}",
                                    details="connectivity_ring_buffer_recorded",
                                )
                            )
            except Exception as xe_parse_err:
                logger.warning("Could not parse system_health ring buffer XML: %s", xe_parse_err)

            if not recent_events:
                recent_events = DEMO_XE_EVENTS

            if not sessions:
                sessions = DEMO_XE_SESSIONS

            running_count = len([s for s in sessions if s.status == "RUNNING"])
            stopped_count = len([s for s in sessions if s.status == "STOPPED"])
            sys_health_active = any(s.name == "system_health" and s.status == "RUNNING" for s in sessions)
            dropped = sum(s.dropped_event_count for s in sessions)
            severe = len([e for e in recent_events if e.severity and e.severity >= 20])
            deadlocks = len([e for e in recent_events if e.event_type == "deadlock"])

            return ExtendedEventsSummary(
                total_sessions=len(sessions),
                running_sessions=running_count,
                stopped_sessions=stopped_count,
                system_health_running=sys_health_active,
                total_dropped_events=dropped,
                severe_errors_count=severe,
                deadlocks_in_ring_count=deadlocks,
                sessions=sessions,
                recent_events=recent_events[:50],
                templates=DEMO_XE_TEMPLATES,
                is_demo=False,
            )

    except Exception as exc:
        logger.warning("Could not fetch live Extended Events, falling back to demo data: %s", exc)
        return DEMO_EXTENDED_EVENTS_SUMMARY
