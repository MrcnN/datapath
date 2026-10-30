"""core/exceptions.py — Custom exception types and FastAPI handlers."""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class DatapathError(Exception):
    """Base application exception."""

    def __init__(self, message: str, detail: Optional[str] = None) -> None:
        self.message = message
        self.detail = detail
        super().__init__(message)


# Backward-compatibility alias
TraceforgeError = DatapathError


class DatabaseConnectionError(DatapathError):
    """Raised when a SQL Server connection cannot be established."""


class FeatureUnavailableError(DatapathError):
    """Raised when a SQL Server feature (e.g., Query Store, AG) is unavailable."""


class PermissionDeniedError(DatapathError):
    """Raised when the SQL Server login lacks required permissions."""


class InvalidInputError(DatapathError):
    """Raised for invalid user-supplied input that passed Pydantic but failed business logic."""


# ---------------------------------------------------------------------------
# FastAPI exception handlers
# ---------------------------------------------------------------------------


def _error_body(error: str, detail: Optional[Any] = None) -> dict:
    body: dict = {"error": error}
    if detail is not None:
        body["detail"] = str(detail)
    return body


async def database_connection_handler(request: Request, exc: DatabaseConnectionError) -> JSONResponse:
    logger.error("Database connection error: %s", exc.message)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=_error_body(exc.message, exc.detail),
    )


async def feature_unavailable_handler(request: Request, exc: FeatureUnavailableError) -> JSONResponse:
    logger.warning("Feature unavailable: %s", exc.message)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"available": False, "reason": exc.message},
    )


async def permission_denied_handler(request: Request, exc: PermissionDeniedError) -> JSONResponse:
    logger.warning("Permission denied: %s", exc.message)
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content=_error_body(exc.message, exc.detail),
    )


async def invalid_input_handler(request: Request, exc: InvalidInputError) -> JSONResponse:
    logger.warning("Invalid input: %s", exc.message)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_body(exc.message, exc.detail),
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception for %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_body("An internal server error occurred."),
    )
