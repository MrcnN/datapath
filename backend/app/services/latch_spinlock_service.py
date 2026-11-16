"""services/latch_spinlock_service.py — Latch and Spinlock Contention Service."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from app.db.connection import get_connection, ConnectionParams, rows_to_dicts
from app.schemas.latch_spinlock import (
    LatchStatItem,
    SpinlockStatItem,
    LatchSpinlockSummary,
    LatchSpinlockResponse,
)

logger = logging.getLogger(__name__)

LATCH_DESCRIPTIONS = {
    "BUFFER": (
        "Buffer Pool bellek sayfaları (PAGELATCH) için senkronizasyon mandalı. "
        "Aynı veri veya indeks sayfasına eşzamanlı okuma/yazma erişimlerinde oluşur.",
        "Yoğun ekleme yapılan tablolarda OPTIMIZE_FOR_SEQUENTIAL_KEY etkinleştirin veya TempDB dosya sayısını kontrol edin."
    ),
    "LOG_MANAGER": (
        "Transaction Log yazma mekanizması ve LDF tampon koruma mandalı.",
        "Transaction log diskinin yazma gecikmesini ve sık commit yapan küçük işlemleri kontrol edin."
    ),
    "ACCESS_METHODS_DATA_PAGE": (
        "Veri sayfalarının ayrılması (page allocation) ve indeks sayfa bölünmesi (page split) işlemlerini korur.",
        "İndeks fill factor değerini %80-90 seviyesine çekerek sayfa bölünmelerini azaltın."
    ),
    "ACCESS_METHODS_HOBT_VIRTUAL_ROOT": (
        "İndeks B-Tree sanal kök sayfası güncellemelerini koruyan mandal.",
        "İndeks parçalanmasını denetleyin ve paralel rebuild işlemlerini gözden geçirin."
    ),
    "TRACE_CONTROLLER": (
        "SQL Server Extended Events (XE) ve Default Trace olay toplama denetleyicisi mandalı.",
        "Çok yoğun olay üreten özel Extended Events oturumlarını filtreleyin veya durdurun."
    ),
}

SPINLOCK_DESCRIPTIONS = {
    "LOCK_HASH": (
        "Kilit hash tablosu kovalarını (lock hash buckets) koruyan spinlock. "
        "Aşırı eşzamanlı kilit alım ve bırakma döngülerinde CPU'nun boşa dönmesine (spin) sebep olur.",
        "Aşırı kilit alan sorguları optimize edin; satır kilitlerini azaltmak için uygun indeksler tanımlayın."
    ),
    "SOS_OBJECT_STORE": (
        "SQL Server dahili bellek nesneleri havuz senkronizasyon spinlock'u.",
        "Plan cache şişkinliğini veya optimize_for_adhoc ayarını kontrol edin."
    ),
    "MUTEX": (
        "Genel SQL Server çekirdek senkronizasyon nesnesi.",
        "Çok sayıda eşzamanlı bağlantının aynı sistem kaynağını talep etmesini önlemek için bağlantı havuzlamayı gözden geçirin."
    ),
    "QUERY_EXEC_MEMORY_RESOURCE": (
        "Sorgu çalışma belleği (Workspace Memory) tahsis koruma spinlock'u.",
        "Büyük SORT ve HASH JOIN sorgularının bellek taleplerini OPTION (MAX_GRANT_PERCENT) ile denetleyin."
    ),
    "RESQUEUE": (
        "Kaynak yöneticisi ve dahili scheduler kuyrukları koruma spinlock'u.",
        "İş parçacığı (worker thread) tükenmesi ve CPU paralellik parametrelerini (MAXDOP) denetleyin."
    ),
    "SOS_SCHEDULER": (
        "CPU zamanlayıcı iş parçacığı kuyruklarını koruyan spinlock.",
        "CPU bağlama (CPU affinity) ve NUMA düğümü dengesini kontrol edin."
    ),
}


def get_latch_spinlock_analysis(params: ConnectionParams) -> LatchSpinlockResponse:
    """Queries sys.dm_os_latch_stats and sys.dm_os_spinlock_stats to uncover
    kernel-level memory synchronization contention and hidden spinlock CPU pressure.
    """
    latches: List[LatchStatItem] = []
    spinlocks: List[SpinlockStatItem] = []

    try:
        with get_connection(params) as conn:
            cursor = conn.cursor()

            # 1. Latch Statistics
            cursor.execute("""
            SELECT TOP 30
                latch_class,
                waiting_requests_count,
                wait_time_ms,
                ROUND(CAST(wait_time_ms AS FLOAT) / CASE WHEN waiting_requests_count = 0 THEN 1 ELSE waiting_requests_count END, 2) AS avg_wait_ms,
                max_wait_time_ms
            FROM sys.dm_os_latch_stats
            WHERE waiting_requests_count > 0
            ORDER BY wait_time_ms DESC;
            """)
            raw_latches = rows_to_dicts(cursor)
            for lt in raw_latches:
                l_class = str(lt.get("latch_class") or "")
                w_time = int(lt.get("wait_time_ms") or 0)
                desc, hint = LATCH_DESCRIPTIONS.get(
                    l_class,
                    (f"{l_class} sınıfı dahili SQL Server çekirdek mandalı.", "İlgili alt sistemin kaynak kullanımını izleyin.")
                )

                if w_time > 15000:
                    sev = "CRITICAL"
                elif w_time > 1000:
                    sev = "WARNING"
                else:
                    sev = "NORMAL"

                latches.append(
                    LatchStatItem(
                        latch_class=l_class,
                        waiting_requests_count=int(lt.get("waiting_requests_count") or 0),
                        wait_time_ms=w_time,
                        avg_wait_ms=float(lt.get("avg_wait_ms") or 0.0),
                        max_wait_time_ms=int(lt.get("max_wait_time_ms") or 0),
                        severity=sev,
                        description=desc,
                        remediation_hint=hint,
                    )
                )

            # 2. Spinlock Statistics
            cursor.execute("""
            SELECT TOP 35
                name,
                collisions,
                spins,
                ROUND(CAST(spins AS FLOAT) / CASE WHEN collisions = 0 THEN 1 ELSE collisions END, 1) AS spins_per_collision,
                sleep_time AS sleep_time_ms,
                backoffs
            FROM sys.dm_os_spinlock_stats
            WHERE collisions > 0
            ORDER BY collisions DESC;
            """)
            raw_spinlocks = rows_to_dicts(cursor)
            for sl in raw_spinlocks:
                s_name = str(sl.get("name") or "")
                spins_col = float(sl.get("spins_per_collision") or 0.0)
                cols = int(sl.get("collisions") or 0)
                desc, hint = SPINLOCK_DESCRIPTIONS.get(
                    s_name,
                    (f"{s_name} spinlock senkronizasyonu.", "İlgili çekirdek bileşeni üzerindeki eşzamanlı çağrıları denetleyin.")
                )

                if spins_col >= 50.0 and cols >= 5000:
                    sev = "CRITICAL"
                elif spins_col >= 20.0 or cols >= 25000:
                    sev = "WARNING"
                else:
                    sev = "NORMAL"

                spinlocks.append(
                    SpinlockStatItem(
                        name=s_name,
                        collisions=cols,
                        spins=int(sl.get("spins") or 0),
                        spins_per_collision=spins_col,
                        sleep_time_ms=int(sl.get("sleep_time_ms") or 0),
                        backoffs=int(sl.get("backoffs") or 0),
                        severity=sev,
                        description=desc,
                        remediation_hint=hint,
                    )
                )

    except Exception as e:
        logger.error("Error evaluating latches and spinlocks: %s", e)

    # Compute summary
    tot_latch_ms = sum(l.wait_time_ms for l in latches)
    top_latch = latches[0].latch_class if latches else None
    tot_spin_col = sum(s.collisions for s in spinlocks)
    top_spin = spinlocks[0].name if spinlocks else None

    high_spin_cnt = sum(1 for s in spinlocks if s.severity in ("CRITICAL", "WARNING"))
    has_spin_pressure = any(s.severity == "CRITICAL" for s in spinlocks)

    summary = LatchSpinlockSummary(
        total_latch_wait_ms=tot_latch_ms,
        top_latch_class=top_latch,
        total_spinlock_collisions=tot_spin_col,
        top_spinlock_name=top_spin,
        high_collision_spinlocks_count=high_spin_cnt,
        has_cpu_spinlock_pressure=has_spin_pressure,
        evaluated_at=datetime.utcnow().isoformat(),
    )

    return LatchSpinlockResponse(
        summary=summary,
        latches=latches,
        spinlocks=spinlocks,
    )
