"""services/ha_service.py — Always On Availability Group status."""
from __future__ import annotations

import logging
from typing import List

import pyodbc

from app.core.exceptions import FeatureUnavailableError
from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.high_availability import AGDatabase, AGReplica, AvailabilityGroup, HAStatusResponse

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
