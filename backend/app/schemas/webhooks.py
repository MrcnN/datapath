"""schemas/webhooks.py — Schemas for crisis alert webhooks (Slack, Teams, Discord)."""
from __future__ import annotations

from typing import Optional, Literal
from pydantic import BaseModel, Field


WebhookServiceType = Literal["slack", "teams", "discord", "generic"]


class WebhookConfig(BaseModel):
    enabled: bool = False
    url: str = ""
    service_type: WebhookServiceType = "slack"
    min_severity: int = Field(default=17, ge=1, le=25)
    notify_on_deadlocks: bool = True
    notify_on_suspect_pages: bool = True
    notify_on_high_severity_errors: bool = True
    channel_name: Optional[str] = None


class WebhookTestRequest(BaseModel):
    url: str
    service_type: WebhookServiceType = "slack"


class WebhookTestResponse(BaseModel):
    success: bool
    status_code: int = 200
    message: str
