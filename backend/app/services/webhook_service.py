"""services/webhook_service.py — Crisis notification webhook dispatcher for Slack, Teams, Discord."""
from __future__ import annotations

import json
import logging
import os
import urllib.request
import urllib.error
from datetime import datetime
from typing import Any, Dict, Optional

from app.schemas.webhooks import WebhookConfig, WebhookTestResponse, WebhookServiceType

logger = logging.getLogger(__name__)

# File-backed persistence for webhook configuration
_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "webhook_config.json")

# In-memory default config
_DEFAULT_CONFIG = WebhookConfig(
    enabled=False,
    url="",
    service_type="slack",
    min_severity=17,
    notify_on_deadlocks=True,
    notify_on_suspect_pages=True,
    notify_on_high_severity_errors=True,
    channel_name=None,
)


def _ensure_dir():
    folder = os.path.dirname(_CONFIG_FILE)
    if folder and not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)


def load_webhook_config() -> WebhookConfig:
    _ensure_dir()
    if os.path.exists(_CONFIG_FILE):
        try:
            with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return WebhookConfig(**data)
        except Exception as e:
            logger.warning("Failed to load webhook config from %s: %s", _CONFIG_FILE, e)
    return _DEFAULT_CONFIG


def save_webhook_config(config: WebhookConfig) -> WebhookConfig:
    _ensure_dir()
    try:
        with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error("Failed to save webhook config to %s: %s", _CONFIG_FILE, e)
    return config


def format_payload(
    service_type: WebhookServiceType,
    title: str,
    description: str,
    server_name: str,
    severity: int,
    event_type: str,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if service_type == "slack":
        return {
            "text": f"🚨 *[DATAPATH KRİZ ALARMI]*: {title}",
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"🚨 Datapath Kriz Bildirimi: {title}"},
                },
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": description},
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Sunucu:*\n`{server_name}`"},
                        {"type": "mrkdwn", "text": f"*Kriz Seviyesi:*\nSev {severity}"},
                        {"type": "mrkdwn", "text": f"*Olay Türü:*\n{event_type}"},
                        {"type": "mrkdwn", "text": f"*Zaman:*\n{now_str}"},
                    ],
                },
            ],
        }

    elif service_type == "teams":
        return {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": "f43f5e" if severity >= 20 else "f59e0b",
            "summary": title,
            "title": f"🚨 [DATAPATH KRİZ ALARMI] {title}",
            "sections": [
                {
                    "activityTitle": f"SQL Server: {server_name}",
                    "activitySubtitle": f"Kriz Seviyesi: Sev {severity} | Zaman: {now_str}",
                    "text": description,
                    "facts": [
                        {"name": "Olay Türü", "value": event_type},
                        {"name": "Sunucu", "value": server_name},
                        {"name": "Tetiklenme", "value": now_str},
                    ],
                    "markdown": True,
                }
            ],
        }

    elif service_type == "discord":
        return {
            "content": f"🚨 **[DATAPATH KRİZ ALARMI]** `{server_name}`",
            "embeds": [
                {
                    "title": title,
                    "description": description,
                    "color": 16007006 if severity >= 20 else 16097035,
                    "fields": [
                        {"name": "Sunucu", "value": server_name, "inline": True},
                        {"name": "Seviye", "value": f"Sev {severity}", "inline": True},
                        {"name": "Olay Türü", "value": event_type, "inline": True},
                    ],
                    "footer": {"text": f"Datapath SQL Server Intelligence Platform • {now_str}"},
                }
            ],
        }

    else:
        # Generic JSON webhook
        return {
            "source": "Datapath",
            "alert": title,
            "description": description,
            "server_name": server_name,
            "severity": severity,
            "event_type": event_type,
            "timestamp": now_str,
            "details": details or {},
        }


def dispatch_webhook(
    url: str,
    service_type: WebhookServiceType,
    title: str,
    description: str,
    server_name: str = "SQL Server",
    severity: int = 20,
    event_type: str = "CRITICAL_ALERT",
    details: Optional[Dict[str, Any]] = None,
) -> WebhookTestResponse:
    if not url or not url.startswith("http"):
        return WebhookTestResponse(
            success=False,
            status_code=400,
            message="Geçersiz Webhook URL adresi; http:// veya https:// ile başlamalıdır.",
        )

    payload = format_payload(service_type, title, description, server_name, severity, event_type, details)
    data_bytes = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={"Content-Type": "application/json", "User-Agent": "Datapath-Webhook-Engine/1.0"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            code = resp.status
            return WebhookTestResponse(
                success=200 <= code < 300,
                status_code=code,
                message=f"Webhook başarıyla iletildi (HTTP {code}).",
            )
    except urllib.error.HTTPError as e:
        logger.warning("Webhook dispatch HTTP error: %s", e)
        return WebhookTestResponse(
            success=False,
            status_code=e.code,
            message=f"Uzak webhook servisi hata döndürdü: HTTP {e.code} ({e.reason})",
        )
    except Exception as e:
        logger.error("Webhook dispatch failed: %s", e)
        return WebhookTestResponse(
            success=False,
            status_code=500,
            message=f"Webhook bağlantı hatası: {str(e)}",
        )
