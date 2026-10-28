"""services/connection_service.py — Test SQL Server connectivity."""
from __future__ import annotations

import logging
from typing import Optional

import pyodbc

from app.db.connection import ConnectionParams, get_connection, rows_to_dicts
from app.schemas.connections import ConnectionTestRequest, ConnectionTestResponse, ServerInfo

logger = logging.getLogger(__name__)


def test_connection(req: ConnectionTestRequest) -> ConnectionTestResponse:
    """Attempt to connect and retrieve server properties.

    Never logs the password.
    """
    params = ConnectionParams(
        server=req.server,
        database=req.database,
        driver=req.driver,
        username=req.username,
        password=req.password,
        trusted_connection=req.trusted_connection,
        timeout=req.timeout,
    )

    try:
        conn = get_connection(params)
    except Exception as exc:
        return ConnectionTestResponse(success=False, message=str(exc), server_info=None)

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                CAST(SERVERPROPERTY('ServerName')      AS NVARCHAR(256)) AS server_name,
                CAST(SERVERPROPERTY('ProductVersion')  AS NVARCHAR(128)) AS product_version,
                CAST(SERVERPROPERTY('ProductLevel')    AS NVARCHAR(128)) AS product_level,
                CAST(SERVERPROPERTY('Edition')         AS NVARCHAR(256)) AS edition,
                CAST(SERVERPROPERTY('Collation')       AS NVARCHAR(256)) AS collation,
                @@VERSION                                                AS version
            """
        )
        rows = rows_to_dicts(cursor)
        row = rows[0] if rows else {}
        server_info = ServerInfo(
            version=row.get("version"),
            edition=row.get("edition"),
            product_level=row.get("product_level"),
            product_version=row.get("product_version"),
            server_name=row.get("server_name"),
            collation=row.get("collation"),
        )
        return ConnectionTestResponse(
            success=True,
            message=f"Successfully connected to {req.server}/{req.database}",
            server_info=server_info,
        )
    except pyodbc.Error as exc:
        logger.error("Error querying server properties on '%s': %s", req.server, exc.args)
        return ConnectionTestResponse(success=False, message=f"Connected but query failed: {exc.args}", server_info=None)
    finally:
        try:
            conn.close()
        except Exception:
            pass
