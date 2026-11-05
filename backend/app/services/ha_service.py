"""services/ha_service.py — Always On Availability Group status."""
from __future__ import annotations

import logging
from typing import List

import pyodbc

from app.core.exceptions import FeatureUnavailableError
from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.high_availability import (
    AGDatabase,
    AGReplica,
    AvailabilityGroup,
    HAStatusResponse,
    AGReplicaLagMetric,
    AGTelemetrySummary,
    AGLagAnalysisResponse,
)

logger = logging.getLogger(__name__)


def get_ha_status(params: ConnectionParams) -> HAStatusResponse:
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()

            # Check if Always On is supported on this instance
            cursor.execute(
                "SELECT CAST(SERVERPROPERTY('IsHadrEnabled') AS INT) AS hadr_enabled"
            )
            row = cursor.fetchone()
            if row is None or row[0] is None or row[0] == 0:
                return HAStatusResponse(
                    available=False,
                    reason="Bu SQL Server örneğinde Always On Availability Groups (HADR) özelliği etkinleştirilmemiştir (SERVERPROPERTY('IsHadrEnabled') = 0). Tek sunuculu (standalone) ortamlarda bu durum olağandır.",
                )

            # Fetch AG overview
            cursor.execute(
                """
                SELECT
                    ag.name                                         AS ag_name,
                    ags.primary_replica,
                    ags.synchronization_health_desc                 AS sync_health,
                    ar_primary.operational_state_desc               AS health_state
                FROM sys.availability_groups ag
                JOIN sys.dm_hadr_availability_group_states ags
                    ON ags.group_id = ag.group_id
                LEFT JOIN sys.dm_hadr_availability_replica_states ar_primary
                    ON ar_primary.group_id = ag.group_id
                    AND ar_primary.is_local = 1
                ORDER BY ag.name
                """
            )
            ag_rows = rows_to_dicts(cursor)

            if not ag_rows:
                return HAStatusResponse(
                    available=True,
                    reason="Always On is enabled but no Availability Groups are configured.",
                    groups=[],
                )

            groups: List[AvailabilityGroup] = []
            for ag_row in ag_rows:
                ag_name = ag_row["ag_name"]

                # Replicas
                cursor.execute(
                    """
                    SELECT
                        ar.replica_server_name                      AS name,
                        ars.role_desc                               AS role,
                        ar.availability_mode_desc                   AS availability_mode,
                        ar.failover_mode_desc                       AS failover_mode,
                        ars.operational_state_desc                  AS operational_state,
                        ars.synchronization_health_desc             AS synchronization_health
                    FROM sys.availability_replicas ar
                    JOIN sys.availability_groups ag ON ag.group_id = ar.group_id
                    JOIN sys.dm_hadr_availability_replica_states ars ON ars.replica_id = ar.replica_id
                    WHERE ag.name = ?
                    ORDER BY ars.role_desc
                    """,
                    (ag_name,),
                )
                replica_rows = rows_to_dicts(cursor)
                replicas = [
                    AGReplica(
                        name=r["name"],
                        role=r.get("role"),
                        availability_mode=r.get("availability_mode"),
                        failover_mode=r.get("failover_mode"),
                        operational_state=r.get("operational_state"),
                        synchronization_health=r.get("synchronization_health"),
                    )
                    for r in replica_rows
                ]

                # Databases
                cursor.execute(
                    """
                    SELECT
                        drs.database_id,
                        DB_NAME(drs.database_id)                        AS name,
                        drs.synchronization_state_desc                  AS sync_state,
                        drs.is_suspended,
                        drs.redo_queue_size                             AS redo_queue_size_kb
                    FROM sys.dm_hadr_database_replica_states drs
                    JOIN sys.availability_replicas ar ON ar.replica_id = drs.replica_id
                    JOIN sys.availability_groups ag ON ag.group_id = ar.group_id
                    WHERE ag.name = ?
                      AND drs.is_local = 1
                    ORDER BY name
                    """,
                    (ag_name,),
                )
                db_rows = rows_to_dicts(cursor)
                databases = [
                    AGDatabase(
                        name=r["name"] or str(r.get("database_id")),
                        sync_state=r.get("sync_state"),
                        is_suspended=bool(r.get("is_suspended")),
                        redo_queue_size_kb=r.get("redo_queue_size_kb"),
                    )
                    for r in db_rows
                ]

                groups.append(
                    AvailabilityGroup(
                        ag_name=ag_name,
                        primary_replica=ag_row.get("primary_replica"),
                        health_state=ag_row.get("health_state"),
                        sync_health=ag_row.get("sync_health"),
                        replicas=replicas,
                        databases=databases,
                    )
                )

            return HAStatusResponse(available=True, groups=groups)

    except pyodbc.Error as exc:
        err_str = str(exc)
        if "208" in err_str:
            return HAStatusResponse(
                available=False,
                reason="Always On DMVs are not available on this SQL Server edition.",
            )
        if "229" in err_str or "permission" in err_str.lower():
            return HAStatusResponse(
                available=False,
                reason="Insufficient permissions to query Always On DMVs. Requires VIEW SERVER STATE.",
            )
        logger.error("HA status query error: %s", exc.args)
        return HAStatusResponse(available=False, reason=f"Error querying HA status: {exc.args}")


def get_ag_lag_telemetry(params: ConnectionParams) -> AGLagAnalysisResponse:
    """Analyze AlwaysOn AG log send queue, redo lag, RPO (data loss) and RTO (recovery time) across all replicas."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT CAST(SERVERPROPERTY('IsHadrEnabled') AS INT) AS hadr_enabled")
            row = cursor.fetchone()
            if row is None or row[0] is None or row[0] == 0:
                return _get_demo_ag_telemetry(is_live_unavailable=True)

            query = """
            SELECT
                ag.name AS ag_name,
                ar.replica_server_name AS replica_name,
                ars.role_desc AS role,
                ar.availability_mode_desc AS availability_mode,
                DB_NAME(drs.database_id) AS database_name,
                drs.synchronization_state_desc AS sync_state,
                drs.is_suspended,
                drs.suspend_reason_desc,
                ISNULL(drs.log_send_queue_size, 0) AS log_send_queue_size_kb,
                ISNULL(drs.log_send_rate, 0) AS log_send_rate_kb_sec,
                ISNULL(drs.redo_queue_size, 0) AS redo_queue_size_kb,
                ISNULL(drs.redo_rate, 0) AS redo_rate_kb_sec,
                drs.last_commit_time
            FROM sys.dm_hadr_database_replica_states drs
            JOIN sys.availability_replicas ar ON drs.replica_id = ar.replica_id
            JOIN sys.availability_groups ag ON ar.group_id = ag.group_id
            JOIN sys.dm_hadr_availability_replica_states ars ON ars.replica_id = ar.replica_id
            ORDER BY ag.name, ar.replica_server_name, database_name;
            """
            cursor.execute(query)
            rows = rows_to_dicts(cursor)
            if not rows:
                return _get_demo_ag_telemetry(is_live_unavailable=True)

            groups_dict = {}
            for r in rows:
                ag_name = r["ag_name"]
                if ag_name not in groups_dict:
                    groups_dict[ag_name] = []
                groups_dict[ag_name].append(r)

            telemetry_groups = []
            for ag_name, items in groups_dict.items():
                primary_rep = "Unknown"
                sec_reps = set()
                metrics: List[AGReplicaLagMetric] = []
                total_send_kb = 0.0
                total_redo_kb = 0.0
                max_rpo = 0.0
                max_rto = 0.0

                for it in items:
                    role = it.get("role") or "SECONDARY"
                    rep_name = it.get("replica_name") or "Unknown"
                    if role == "PRIMARY":
                        primary_rep = rep_name
                    else:
                        sec_reps.add(rep_name)

                    send_kb = float(it.get("log_send_queue_size_kb") or 0.0)
                    send_rate = float(it.get("log_send_rate_kb_sec") or 0.0)
                    redo_kb = float(it.get("redo_queue_size_kb") or 0.0)
                    redo_rate = float(it.get("redo_rate_kb_sec") or 0.0)
                    is_susp = bool(it.get("is_suspended"))
                    sync_st = it.get("sync_state") or "UNKNOWN"
                    avail_mode = it.get("availability_mode") or "ASYNCHRONOUS_COMMIT"

                    total_send_kb += send_kb
                    total_redo_kb += redo_kb

                    # RPO estimation (how many seconds behind is secondary log queue)
                    rpo_sec = (send_kb / send_rate) if send_rate > 0 else (send_kb / 1024.0)
                    # RTO estimation (how many seconds needed to redo remaining log)
                    rto_sec = (redo_kb / redo_rate) if redo_rate > 0 else (redo_kb / 1024.0)

                    if role != "PRIMARY":
                        max_rpo = max(max_rpo, rpo_sec)
                        max_rto = max(max_rto, rto_sec)

                    if is_susp:
                        readiness = "NOT_READY_SUSPENDED"
                    elif avail_mode == "SYNCHRONOUS_COMMIT" and send_kb < 100:
                        readiness = "READY_NO_DATA_LOSS"
                    else:
                        readiness = "POTENTIAL_DATA_LOSS"

                    l_commit = it.get("last_commit_time")
                    l_commit_str = l_commit.isoformat() if hasattr(l_commit, "isoformat") else str(l_commit) if l_commit else None

                    metrics.append(
                        AGReplicaLagMetric(
                            replica_name=rep_name,
                            role=role,
                            database_name=it.get("database_name") or "tempdb",
                            synchronization_state=sync_st,
                            availability_mode=avail_mode,
                            is_suspended=is_susp,
                            suspend_reason_desc=it.get("suspend_reason_desc"),
                            log_send_queue_size_kb=round(send_kb, 1),
                            log_send_rate_kb_sec=round(send_rate, 1),
                            redo_queue_size_kb=round(redo_kb, 1),
                            redo_rate_kb_sec=round(redo_rate, 1),
                            estimated_data_loss_sec=round(rpo_sec, 1),
                            estimated_recovery_time_sec=round(rto_sec, 1),
                            last_commit_time=l_commit_str,
                            failover_readiness=readiness,
                        )
                    )

                health = "OPTIMAL"
                if any(m.is_suspended for m in metrics):
                    health = "CRITICAL_DESYNC"
                elif max_rpo > 10.0 or max_rto > 60.0 or (total_send_kb / 1024.0) > 50:
                    health = "LAG_WARNING"

                remed_sql = f"""-- ====================================================================
-- [REVIEW-ONLY] AlwaysOn AG [{ag_name}] Yük Devretme (Failover) Reçetesi
-- Birincil Replika: {primary_rep}
-- ====================================================================
USE [master];

-- 1. Yük devretmeden önce replika durumlarını ve kuyrukları doğrulayın:
SELECT 
    ar.replica_server_name,
    ars.role_desc,
    drs.synchronization_state_desc,
    drs.log_send_queue_size,
    drs.redo_queue_size
FROM sys.dm_hadr_database_replica_states drs
JOIN sys.availability_replicas ar ON drs.replica_id = ar.replica_id
WHERE ar.group_id = (SELECT group_id FROM sys.availability_groups WHERE name = '{ag_name}');

-- 2. Senkronize replikaya veri kayıpsız planlı yük devretme (Hedef ikincil üzerinde çalıştırılmalıdır):
-- ALTER AVAILABILITY GROUP [{ag_name}] FAILOVER;
"""

                telemetry_groups.append(
                    AGTelemetrySummary(
                        ag_name=ag_name,
                        primary_replica=primary_rep,
                        secondary_replicas=list(sec_reps),
                        total_log_send_queue_mb=round(total_send_kb / 1024.0, 2),
                        total_redo_queue_mb=round(total_redo_kb / 1024.0, 2),
                        max_rpo_seconds=round(max_rpo, 1),
                        max_rto_seconds=round(max_rto, 1),
                        overall_health=health,
                        replica_metrics=metrics,
                        remediation_sql=remed_sql,
                        warnings=[
                            f"İkincil replikada toplam {round(total_send_kb / 1024.0, 1)} MB gönderilmeyi bekleyen log bulunmaktadır.",
                        ] if total_send_kb > 5000 else [],
                        is_demo=False,
                    )
                )

            return AGLagAnalysisResponse(available=True, groups=telemetry_groups)
    except Exception as exc:
        logger.warning("Could not query live AG lag telemetry: %s", exc)
        return _get_demo_ag_telemetry(is_live_unavailable=True)


def _get_demo_ag_telemetry(is_live_unavailable: bool = True) -> AGLagAnalysisResponse:
    """Generates realistic enterprise AlwaysOn telemetry demo data."""
    metrics = [
        AGReplicaLagMetric(
            replica_name="SQL-NODE-01",
            role="PRIMARY",
            database_name="FinansDB",
            synchronization_state="SYNCHRONIZED",
            availability_mode="SYNCHRONOUS_COMMIT",
            is_suspended=False,
            suspend_reason_desc=None,
            log_send_queue_size_kb=0.0,
            log_send_rate_kb_sec=4200.0,
            redo_queue_size_kb=0.0,
            redo_rate_kb_sec=5100.0,
            estimated_data_loss_sec=0.0,
            estimated_recovery_time_sec=0.0,
            last_commit_time="2026-11-06T00:15:00",
            failover_readiness="READY_NO_DATA_LOSS",
        ),
        AGReplicaLagMetric(
            replica_name="SQL-NODE-02-HA",
            role="SECONDARY",
            database_name="FinansDB",
            synchronization_state="SYNCHRONIZED",
            availability_mode="SYNCHRONOUS_COMMIT",
            is_suspended=False,
            suspend_reason_desc=None,
            log_send_queue_size_kb=0.0,
            log_send_rate_kb_sec=4150.0,
            redo_queue_size_kb=120.0,
            redo_rate_kb_sec=4900.0,
            estimated_data_loss_sec=0.0,
            estimated_recovery_time_sec=0.1,
            last_commit_time="2026-11-06T00:15:00",
            failover_readiness="READY_NO_DATA_LOSS",
        ),
        AGReplicaLagMetric(
            replica_name="SQL-NODE-03-DR",
            role="SECONDARY",
            database_name="FinansDB",
            synchronization_state="SYNCHRONIZING",
            availability_mode="ASYNCHRONOUS_COMMIT",
            is_suspended=False,
            suspend_reason_desc=None,
            log_send_queue_size_kb=48500.0,
            log_send_rate_kb_sec=1950.0,
            redo_queue_size_kb=14200.0,
            redo_rate_kb_sec=3200.0,
            estimated_data_loss_sec=24.8,
            estimated_recovery_time_sec=4.4,
            last_commit_time="2026-11-06T00:14:35",
            failover_readiness="POTENTIAL_DATA_LOSS",
        ),
        AGReplicaLagMetric(
            replica_name="SQL-NODE-01",
            role="PRIMARY",
            database_name="ECommerce_PROD",
            synchronization_state="SYNCHRONIZED",
            availability_mode="SYNCHRONOUS_COMMIT",
            is_suspended=False,
            suspend_reason_desc=None,
            log_send_queue_size_kb=0.0,
            log_send_rate_kb_sec=8400.0,
            redo_queue_size_kb=0.0,
            redo_rate_kb_sec=9200.0,
            estimated_data_loss_sec=0.0,
            estimated_recovery_time_sec=0.0,
            last_commit_time="2026-11-06T00:15:02",
            failover_readiness="READY_NO_DATA_LOSS",
        ),
        AGReplicaLagMetric(
            replica_name="SQL-NODE-02-HA",
            role="SECONDARY",
            database_name="ECommerce_PROD",
            synchronization_state="SYNCHRONIZED",
            availability_mode="SYNCHRONOUS_COMMIT",
            is_suspended=False,
            suspend_reason_desc=None,
            log_send_queue_size_kb=0.0,
            log_send_rate_kb_sec=8300.0,
            redo_queue_size_kb=340.0,
            redo_rate_kb_sec=8800.0,
            estimated_data_loss_sec=0.0,
            estimated_recovery_time_sec=0.2,
            last_commit_time="2026-11-06T00:15:02",
            failover_readiness="READY_NO_DATA_LOSS",
        ),
        AGReplicaLagMetric(
            replica_name="SQL-NODE-03-DR",
            role="SECONDARY",
            database_name="ECommerce_PROD",
            synchronization_state="SYNCHRONIZING",
            availability_mode="ASYNCHRONOUS_COMMIT",
            is_suspended=False,
            suspend_reason_desc=None,
            log_send_queue_size_kb=62400.0,
            log_send_rate_kb_sec=2100.0,
            redo_queue_size_kb=18900.0,
            redo_rate_kb_sec=3600.0,
            estimated_data_loss_sec=29.7,
            estimated_recovery_time_sec=5.2,
            last_commit_time="2026-11-06T00:14:32",
            failover_readiness="POTENTIAL_DATA_LOSS",
        ),
    ]

    remed_sql = """-- ====================================================================
-- [REVIEW-ONLY] AlwaysOn AG [AG-PROD-CLUSTER] Planlı & Güvenli Failover Reçetesi
-- Birincil: SQL-NODE-01  -->  Hedef Eşit İkincil: SQL-NODE-02-HA
-- ====================================================================
USE [master];

-- 1. [SQL-NODE-02-HA] üzerinde senkronizasyon durumunu doğrulayın:
SELECT 
    ar.replica_server_name,
    ars.role_desc,
    drs.synchronization_state_desc,
    drs.log_send_queue_size,
    drs.redo_queue_size
FROM sys.dm_hadr_database_replica_states drs
JOIN sys.availability_replicas ar ON drs.replica_id = ar.replica_id
WHERE ar.replica_server_name = 'SQL-NODE-02-HA';

-- 2. Senkronize durumda (0 Veri Kaybı) planlı yük devretmeyi tetikleyin:
-- (NOT: Bu komut hedef ikincil SQL-NODE-02-HA sunucusunda çalıştırılmalıdır)
-- ALTER AVAILABILITY GROUP [AG-PROD-CLUSTER] FAILOVER;

-- 3. Felaket Senaryosu (SQL-NODE-03-DR Asenkron replikasına acil geçiş):
-- DİKKAT: 29 saniyelik kuyruktaki son işlemler kaybedilecektir!
-- ALTER AVAILABILITY GROUP [AG-PROD-CLUSTER] FORCE_FAILOVER_ALLOW_DATA_LOSS;
"""

    summary = AGTelemetrySummary(
        ag_name="AG-PROD-CLUSTER",
        primary_replica="SQL-NODE-01",
        secondary_replicas=["SQL-NODE-02-HA", "SQL-NODE-03-DR"],
        total_log_send_queue_mb=108.3,
        total_redo_queue_mb=32.8,
        max_rpo_seconds=29.7,
        max_rto_seconds=5.2,
        overall_health="LAG_WARNING",
        replica_metrics=metrics,
        remediation_sql=remed_sql,
        warnings=[
            "Afet Kurtarma (DR) replikası olan [SQL-NODE-03-DR] üzerinde 108.3 MB log kuyruğu birikmiştir.",
            "Şu anda birincil sunucu kapanırsa DR replikasına geçişte yaklaşık 29.7 saniyelik veri kaybı (RPO ihlali) meydana gelecektir.",
            "Şehirlerarası WAN hattında bant genişliği veya HADR akış denetimi (flow control) kontrol edilmelidir.",
        ],
        is_demo=True,
    )

    return AGLagAnalysisResponse(
        available=True,
        reason="Always On replikasyon ve RPO/RTO telemetri verileri aktif." if not is_live_unavailable else "Canlı AG bulunamadı, kurumsal AlwaysOn telemetri demo verisi gösteriliyor.",
        groups=[summary],
    )
