"""api/alert_rules.py — Custom Alert Rules & Threshold Engine endpoints."""
from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Body, HTTPException, Query, status

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.alert_rules import (
    AlertEvaluationResult,
    AlertRule,
    AlertRuleCreate,
    AlertSimulationRequest,
    AlertSimulationResponse,
)
from app.services.alert_rules_service import (
    create_or_update_rule,
    delete_rule,
    evaluate_rules,
    get_all_rules,
    get_rule_by_id,
    simulate_alert,
    toggle_rule,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/alerts/rules", tags=["Alert Rules & Threshold Engine"])


def _get_connection_params() -> ConnectionParams:
    return ConnectionParams(
        server=settings.DB_SERVER,
        database=settings.DB_DATABASE,
        username=settings.DB_USERNAME or None,
        password=settings.DB_PASSWORD or None,
        trusted_connection=settings.DB_TRUSTED_CONNECTION,
        driver=settings.DB_DRIVER,
        timeout=settings.DB_TIMEOUT,
    )


@router.get("", response_model=List[AlertRule])
def list_alert_rules():
    """Kayıtlı tüm özel alarm ve eşik kurallarını listeler."""
    return get_all_rules()


@router.get("/{rule_id}", response_model=AlertRule)
def get_single_rule(rule_id: str):
    """Belirli bir alarm kuralının detayını getirir."""
    rule = get_rule_by_id(rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"'{rule_id}' kimlikli alarm kuralı bulunamadı.",
        )
    return rule


@router.post("", response_model=AlertRule, status_code=status.HTTP_201_CREATED)
def create_rule(rule_in: AlertRuleCreate):
    """Yeni bir özel alarm kuralı tanımlar."""
    try:
        return create_or_update_rule(rule_data=rule_in)
    except Exception as e:
        logger.error("Failed to create alert rule: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Alarm kuralı oluşturulamadı: {str(e)}",
        )


@router.put("/{rule_id}", response_model=AlertRule)
def update_rule(rule_id: str, rule_in: AlertRuleCreate):
    """Mevcut bir alarm kuralını günceller."""
    existing = get_rule_by_id(rule_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"'{rule_id}' kimlikli alarm kuralı bulunamadı.",
        )
    try:
        return create_or_update_rule(rule_data=rule_in, rule_id=rule_id)
    except Exception as e:
        logger.error("Failed to update alert rule: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Alarm kuralı güncellenemedi: {str(e)}",
        )


@router.delete("/{rule_id}")
def remove_rule(rule_id: str):
    """Bir alarm kuralını siler."""
    success = delete_rule(rule_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"'{rule_id}' kimlikli kural bulunamadı veya silinemedi.",
        )
    return {"success": True, "message": f"'{rule_id}' kuralı başarıyla silindi."}


@router.patch("/{rule_id}/toggle", response_model=AlertRule)
def toggle_rule_status(rule_id: str, is_enabled: bool = Query(..., description="Yeni aktiflik durumu")):
    """Alarm kuralını hızlıca etkinleştirir veya devre dışı bırakır."""
    updated = toggle_rule(rule_id, is_enabled)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"'{rule_id}' kimlikli kural bulunamadı.",
        )
    return updated


@router.post("/evaluate", response_model=AlertEvaluationResult)
def evaluate_all_rules(
    trigger_webhooks: bool = Query(
        False, description="Tetiklenen kritik kurallarda yapılandırılmış webhook'a bildirim gönderilsin mi?"
    )
):
    """Kayıtlı tüm aktif kuralları canlı telemetri değerleriyle karşılaştırıp ihlalleri raporlar."""
    params = _get_connection_params()
    try:
        return evaluate_rules(params=params, trigger_webhooks=trigger_webhooks)
    except Exception as exc:
        logger.warning("Live telemetry check failed (%s), falling back to offline snapshot", exc)
        return evaluate_rules(params=None, trigger_webhooks=trigger_webhooks)


@router.post("/simulate", response_model=AlertSimulationResponse)
def simulate_alert_trigger(req: AlertSimulationRequest):
    """Bir kural için özel simüle telemetri değeri test eder ve opsiyonel webhook gönderimini doğrular."""
    return simulate_alert(req)
