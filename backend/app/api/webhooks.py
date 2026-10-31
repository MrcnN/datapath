"""api/webhooks.py — Crisis alert webhook management endpoints."""
from __future__ import annotations

from fastapi import APIRouter
from app.schemas.webhooks import WebhookConfig, WebhookTestRequest, WebhookTestResponse
from app.services.webhook_service import (
    load_webhook_config,
    save_webhook_config,
    dispatch_webhook,
)

router = APIRouter(prefix="/alerts/webhook", tags=["Crisis Webhooks"])


@router.get("", response_model=WebhookConfig)
def get_webhook_config() -> WebhookConfig:
    """Retrieve saved webhook configuration."""
    return load_webhook_config()


@router.post("", response_model=WebhookConfig)
def update_webhook_config(config: WebhookConfig) -> WebhookConfig:
    """Save or update crisis webhook configuration."""
    return save_webhook_config(config)


@router.post("/test", response_model=WebhookTestResponse)
def test_webhook_connection(req: WebhookTestRequest) -> WebhookTestResponse:
    """Dispatch a test alert to the target webhook URL."""
    return dispatch_webhook(
        url=req.url,
        service_type=req.service_type,
        title="Test Bağlantı Doğrulaması",
        description="Datapath Veritabanı Zekası Platformu üzerinden gönderilen test kriz bildirimidir. Kanallarınız ve bildirim formatı başarıyla doğrulandı.",
        server_name="Test-SQL-Instance",
        severity=17,
        event_type="WEBHOOK_TEST",
    )
