"""main.py — FastAPI application entrypoint for Datapath."""
from __future__ import annotations

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    agent_jobs,
    backups,
    connections,
    extended_events,
    health,
    health_score,
    high_availability,
    incidents,
    indexes,
    instances,
    permissions,
    query_performance,
    schema_diff,
    servers,
    storage,
    tempdb_memory,
    toolkit,
    wait_stats,
)
from app.core.config import settings
from app.core.exceptions import (
    DatabaseConnectionError,
    FeatureUnavailableError,
    PermissionDeniedError,
)

# Configure logging
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("datapath")

app = FastAPI(
    title="Datapath API",
    description="Veritabanı Zekası Platformu (Database Intelligence Platform) REST API",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
origins = settings.get_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API Routers under /api
app.include_router(health.router, prefix="/api")
app.include_router(health_score.router, prefix="/api")
app.include_router(servers.router, prefix="/api")
app.include_router(connections.router, prefix="/api")
app.include_router(instances.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(query_performance.router, prefix="/api")
app.include_router(backups.router, prefix="/api")
app.include_router(schema_diff.router, prefix="/api")
app.include_router(toolkit.router, prefix="/api")
app.include_router(permissions.router, prefix="/api")
app.include_router(high_availability.router, prefix="/api")
app.include_router(indexes.router, prefix="/api")
app.include_router(wait_stats.router, prefix="/api")
app.include_router(storage.router, prefix="/api")
app.include_router(tempdb_memory.router, prefix="/api")
app.include_router(agent_jobs.router, prefix="/api")
app.include_router(extended_events.router, prefix="/api")


# --- Custom Exception Handlers ---

@app.exception_handler(DatabaseConnectionError)
async def db_connection_error_handler(request: Request, exc: DatabaseConnectionError):
    logger.error("Database connection error: %s", exc.message)
    return JSONResponse(
        status_code=503,
        content={"detail": exc.message, "error_type": "DatabaseConnectionError"},
    )


@app.exception_handler(PermissionDeniedError)
async def permission_denied_handler(request: Request, exc: PermissionDeniedError):
    logger.warning("Permission denied: %s", exc.message)
    return JSONResponse(
        status_code=403,
        content={"detail": exc.message, "error_type": "PermissionDeniedError"},
    )


@app.exception_handler(FeatureUnavailableError)
async def feature_unavailable_handler(request: Request, exc: FeatureUnavailableError):
    return JSONResponse(
        status_code=400,
        content={"detail": exc.message, "error_type": "FeatureUnavailableError"},
    )


@app.get("/")
def root():
    return {
        "product": "Datapath",
        "description": "Veritabanı Zekası Platformu",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }
