"""db/connection.py — pyodbc connection factory with context-manager support."""
from __future__ import annotations

import logging
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Generator, Optional

import pyodbc

from app.core.exceptions import DatabaseConnectionError

logger = logging.getLogger(__name__)


@dataclass
class ConnectionParams:
    """Holds parameters for a SQL Server connection.

    Credentials are never stored in module-level state.
    """

    server: str
    database: str
    driver: str = "ODBC Driver 17 for SQL Server"
    username: Optional[str] = None
    password: Optional[str] = None
    trusted_connection: bool = False
    timeout: int = 30

    def build_connection_string(self) -> str:
        """Build a pyodbc connection string.

        NOTE: The resulting string contains credentials — never log it.
        """
        parts = [
            f"DRIVER={{{self.driver}}}",
            f"SERVER={self.server}",
            f"DATABASE={self.database}",
            f"Connect Timeout={self.timeout}",
            "APP=Datapath",
        ]
        if self.trusted_connection:
            parts.append("Trusted_Connection=yes")
        else:
            parts.append(f"UID={self.username or ''}")
            parts.append(f"PWD={self.password or ''}")
        return ";".join(parts)


def get_connection(params: ConnectionParams) -> pyodbc.Connection:
    """Open and return a pyodbc connection.

    Raises DatabaseConnectionError on failure.
    Never logs credentials.
    """
    conn_str = params.build_connection_string()
    try:
        conn = pyodbc.connect(conn_str, timeout=params.timeout)
        conn.autocommit = True
        return conn
    except pyodbc.OperationalError as exc:
        # Strip the connection string from the error message before logging
        safe_msg = f"Cannot connect to '{params.server}/{params.database}'"
        logger.error("%s — pyodbc OperationalError: %s", safe_msg, exc.args)
        raise DatabaseConnectionError(safe_msg, detail=str(exc.args[1] if len(exc.args) > 1 else exc.args[0])) from exc
    except pyodbc.InterfaceError as exc:
        safe_msg = f"Driver/interface error connecting to '{params.server}'"
        logger.error("%s — pyodbc InterfaceError: %s", safe_msg, exc.args)
        raise DatabaseConnectionError(safe_msg, detail=str(exc.args)) from exc
    except pyodbc.Error as exc:
        safe_msg = f"Database error connecting to '{params.server}/{params.database}'"
        logger.error("%s — pyodbc Error: %s", safe_msg, exc.args)
        raise DatabaseConnectionError(safe_msg, detail=str(exc.args)) from exc


@contextmanager
def get_db_connection(params: ConnectionParams) -> Generator[pyodbc.Connection, None, None]:
    """Context manager that opens a pyodbc connection and ensures it is closed."""
    conn = get_connection(params)
    try:
        yield conn
    finally:
        try:
            conn.close()
        except Exception:
            pass


def params_from_settings() -> ConnectionParams:
    """Build ConnectionParams from application settings.

    Imported lazily inside the function to avoid circular imports.
    """
    from app.core.config import settings  # noqa: PLC0415

    return ConnectionParams(
        server=settings.DB_SERVER,
        database=settings.DB_DATABASE,
        driver=settings.DB_DRIVER,
        username=settings.DB_USERNAME or None,
        password=settings.DB_PASSWORD or None,
        trusted_connection=settings.DB_TRUSTED_CONNECTION,
        timeout=settings.DB_TIMEOUT,
    )


def rows_to_dicts(cursor: pyodbc.Cursor) -> list[dict]:
    """Convert all rows in a cursor to a list of dicts keyed by column name."""
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]
