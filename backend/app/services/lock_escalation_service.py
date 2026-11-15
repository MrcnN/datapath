"""services/lock_escalation_service.py — Lock Escalation and Contention Heatmap Service."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from app.db.connection import get_connection, ConnectionParams, rows_to_dicts
from app.schemas.lock_escalation import (
    LockContentionItem,
    LockEscalationSummary,
    LockEscalationResponse,
)

logger = logging.getLogger(__name__)


def get_lock_escalation_analysis(
    params: ConnectionParams,
    database_name: Optional[str] = None,
) -> LockEscalationResponse:
    """Queries sys.dm_db_index_operational_stats to identify tables and indexes
    suffering from severe row/page lock waits and catastrophic table lock escalations.
    """
    target_db = database_name or params.database or "master"
    conn_params = ConnectionParams(
        server=params.server,
        database=target_db,
        username=params.username,
        password=params.password,
        trusted_connection=params.trusted_connection,
        driver=params.driver,
        timeout=params.timeout,
    )
    items: List[LockContentionItem] = []

    sql_query = """
    SELECT TOP 50
        DB_NAME() AS database_name,
        s.name AS schema_name,
        t.name AS table_name,
        ISNULL(i.name, '(HEAP)') AS index_name,
        ISNULL(i.type_desc, 'HEAP') AS index_type,
        ios.partition_number,
        ios.row_lock_count,
        ios.row_lock_wait_count,
        ios.row_lock_wait_in_ms AS row_lock_wait_ms,
        ios.page_lock_count,
        ios.page_lock_wait_count,
        ios.page_lock_wait_in_ms AS page_lock_wait_ms,
        (ios.row_lock_wait_in_ms + ios.page_lock_wait_in_ms) AS total_lock_wait_ms,
        ios.index_lock_promotion_attempt_count AS escalation_attempt_count,
        ios.index_lock_promotion_count AS escalation_count,
        ios.page_latch_wait_in_ms AS page_latch_wait_ms,
        ios.page_io_latch_wait_in_ms AS page_io_latch_wait_ms,
        ISNULL(t.lock_escalation_desc, 'TABLE') AS lock_escalation_setting
    FROM sys.dm_db_index_operational_stats(DB_ID(), NULL, NULL, NULL) ios
    INNER JOIN sys.tables t ON ios.object_id = t.object_id
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    LEFT JOIN sys.indexes i ON ios.object_id = i.object_id AND ios.index_id = i.index_id
    WHERE t.is_ms_shipped = 0
    ORDER BY 
        (ios.index_lock_promotion_count * 50000 + (ios.row_lock_wait_in_ms + ios.page_lock_wait_in_ms)) DESC,
        (ios.row_lock_count + ios.page_lock_count) DESC;
    """

    try:
        with get_connection(conn_params) as conn:
            cursor = conn.cursor()
            cursor.execute(sql_query)
            rows = rows_to_dicts(cursor)

            for row in rows:
                row_lock_cnt = int(row.get("row_lock_count") or 0)
                row_wait_cnt = int(row.get("row_lock_wait_count") or 0)
                row_wait_ms = int(row.get("row_lock_wait_ms") or 0)

                page_lock_cnt = int(row.get("page_lock_count") or 0)
                page_wait_cnt = int(row.get("page_lock_wait_count") or 0)
                page_wait_ms = int(row.get("page_lock_wait_ms") or 0)

                total_wait_ms = row_wait_ms + page_wait_ms

                esc_attempts = int(row.get("escalation_attempt_count") or 0)
                esc_count = int(row.get("escalation_count") or 0)
                esc_rate = round((esc_count / max(1, esc_attempts)) * 100.0, 1) if esc_attempts > 0 else 0.0

                latch_wait_ms = int(row.get("page_latch_wait_ms") or 0)
                io_latch_wait_ms = int(row.get("page_io_latch_wait_ms") or 0)

                esc_setting = str(row.get("lock_escalation_setting") or "TABLE")
                schema_name = str(row.get("schema_name") or "dbo")
                table_name = str(row.get("table_name") or "")

                # Determine severity
                if esc_count > 0 or total_wait_ms > 2000:
                    severity = "CRITICAL"
                elif esc_attempts > 0 or total_wait_ms > 250:
                    severity = "WARNING"
                elif row_wait_cnt > 0 or page_wait_cnt > 0:
                    severity = "MODERATE"
                else:
                    severity = "HEALTHY"

                # Diagnostic verdict in Turkish
                if esc_count > 0:
                    verdict = (
                        f"Kritik Eskalasyon: Bu tabloda {esc_count} kez satır kilidinden tüm tabloyu kilitleyen "
                        f"Table Lock seviyesine yükseltme gerçekleşti ({esc_attempts} deneme). "
                        f"SQL Server 5.000 satır eşiğini aştığı için tablonun tamamı kilitlenmiş ve eşzamanlı sorgular bloklanmıştır."
                    )
                elif esc_attempts > 0:
                    verdict = (
                        f"Eskalasyon Riski: SQL Server {esc_attempts} defa kilit yükseltmeyi denedi ancak bellek veya "
                        f"diğer kilitler nedeniyle tablo kilidine geçiş yapamadı. Toplu DML işlemleri kilit havuzunu zorluyor."
                    )
                elif page_wait_ms > 100 and page_wait_ms >= row_wait_ms:
                    verdict = (
                        f"Sayfa Kilidi Darboğazı: Toplam {page_wait_ms} ms sayfa kilidi beklemesi ({page_wait_cnt} olay). "
                        f"Aynı veri sayfalarına yoğun eşzamanlı erişim veya indeks sayfa bölünmesi (page split) yaşanıyor."
                    )
                elif total_wait_ms > 0:
                    verdict = (
                        f"Satır Kilidi Çakışması: Toplam {total_wait_ms} ms satır kilidi beklemesi tespit edildi. "
                        f"Açık kalmış işlemler (uncommitted transactions) diğer kullanıcıları bekletiyor."
                    )
                else:
                    verdict = "Normal kilit döngüsü: Belirgin bir kilit yükseltmesi veya kilit kuyruğu tespit edilmedi."

                # Prescriptive remediation T-SQL
                remediation = f"""-- =========================================================================
-- Datapath Lock Escalation & Contention Remediation Script
-- Hedef Nesne: [{schema_name}].[{table_name}]
-- Mevcut Eskalasyon Ayarı: {esc_setting}
-- =========================================================================

-- 1. Tablo Seviyesinde Kilit Yükseltmeyi Yönetme:
-- Eğer tablo bölümlenmişse (partitioned), tüm tablo yerine sadece ilgili bölümü kilitlemek için:
ALTER TABLE [{schema_name}].[{table_name}] SET (LOCK_ESCALATION = AUTO);
GO

-- 2. Eğer kilit yükseltme kritik bir tabloda sistemin durmasına yol açıyorsa eskalasyonu tamamen kapatın:
-- (DİKKAT: Bellekte çok sayıda satır kilidi tutulmasına yol açar, kontrollü uygulayın)
-- ALTER TABLE [{schema_name}].[{table_name}] SET (LOCK_ESCALATION = DISABLE);
-- GO

-- 3. Toplu Silme/Güncelleme İşlemlerinde 5.000 Kilit Sınırını Aşmamak İçin Toplu İşleme (Chunking) Kalıbı:
WHILE 1 = 1
BEGIN
    DELETE TOP (4000) FROM [{schema_name}].[{table_name}]
    WHERE [CreatedDate] < DATEADD(month, -6, GETDATE());

    IF @@ROWCOUNT = 0 BREAK;

    -- Transaction Log ve kilit havuzunun rahatlaması için kısa bekleme
    WAITFOR DELAY '00:00:00.250';
END
GO
"""

                items.append(
                    LockContentionItem(
                        database_name=target_db,
                        schema_name=schema_name,
                        table_name=table_name,
                        index_name=str(row.get("index_name") or "(HEAP)"),
                        index_type=str(row.get("index_type") or "HEAP"),
                        partition_number=int(row.get("partition_number") or 1),
                        row_lock_count=row_lock_cnt,
                        row_lock_wait_count=row_wait_cnt,
                        row_lock_wait_ms=row_wait_ms,
                        page_lock_count=page_lock_cnt,
                        page_lock_wait_count=page_wait_cnt,
                        page_lock_wait_ms=page_wait_ms,
                        total_lock_wait_ms=total_wait_ms,
                        escalation_attempt_count=esc_attempts,
                        escalation_count=esc_count,
                        escalation_rate_pct=esc_rate,
                        page_latch_wait_ms=latch_wait_ms,
                        page_io_latch_wait_ms=io_latch_wait_ms,
                        lock_escalation_setting=esc_setting,
                        contention_severity=severity,
                        diagnostic_verdict=verdict,
                        remediation_tsql=remediation.strip(),
                    )
                )

    except Exception as e:
        logger.error("Error executing lock escalation query: %s", e)

    # Compute aggregate summary
    total_objs = len(items)
    contended_objs = sum(1 for it in items if it.total_lock_wait_ms > 0 or it.escalation_attempt_count > 0)
    escalated_objs = sum(1 for it in items if it.escalation_count > 0)
    tot_esc = sum(it.escalation_count for it in items)
    tot_wait = sum(it.total_lock_wait_ms for it in items)
    top_obj = items[0].table_name if items else None

    summary = LockEscalationSummary(
        total_objects_analyzed=total_objs,
        contended_objects_count=contended_objs,
        escalated_objects_count=escalated_objs,
        total_escalation_count=tot_esc,
        total_lock_wait_ms=tot_wait,
        top_contended_object=top_obj,
        analyzed_at=datetime.utcnow().isoformat(),
    )

    return LockEscalationResponse(
        summary=summary,
        items=items,
        active_database=target_db,
    )
