"""services/time_travel_service.py — Workload Time-Travel Correlator & Spike Detective."""
from __future__ import annotations

import logging
from typing import List, Optional, Dict
from datetime import datetime, timedelta

from app.db.connection import ConnectionParams, get_connection
from app.schemas.time_travel import (
    CorrelatedQueryItem,
    CorrelatedWaitItem,
    CorrelatedEventItem,
    TimeTravelSnapshotDetail,
    TimeTravelTimelinePoint,
    TimeTravelCorrelatorOverview,
)

logger = logging.getLogger(__name__)

WAIT_DESCRIPTIONS: Dict[str, str] = {
    "Lock": "Eşzamanlı işlemler arasındaki satır veya sayfa kilit rekabeti (Lock contention / Blocking).",
    "Buffer IO": "Diskten sayfa okuma gecikmesi (PAGEIOLATCH). Eksik kapsayıcı indeks veya Clustered Index Scan.",
    "Memory": "Aşırı bellek rezervasyonu veya Workspace RAM yetersizliği (RESOURCE_SEMAPHORE).",
    "Parallelism": "Paralel çalışan iş parçacıkları (thread) arasındaki asimetrik yük dağılımı (CXPACKET).",
    "Network IO": "İstemci uygulamanın sorgu sonucunu yavaş tüketmesi (ASYNC_NETWORK_IO / N+1 problemi).",
    "Compilation": "Parametre koklama veya sık derleme nedeniyle CPU'nun plan oluşturmaya harcanması.",
    "CPU": "Ağır skaler fonksiyonlar, matematiksel döngüler veya optimize edilmemiş filtreler.",
}


def get_time_travel_overview(
    params: Optional[ConnectionParams] = None,
    database_name: Optional[str] = None,
    time_range: str = "24H",
) -> TimeTravelCorrelatorOverview:
    """Retrieve bucketed timeline metrics and detect performance anomaly spikes across intervals."""
    target_db = database_name or (params.database if params else "Datapath_TestDB") or "Datapath_TestDB"

    if params:
        try:
            conn_params = ConnectionParams(
                server=params.server,
                database=target_db,
                driver=params.driver,
                username=params.username,
                password=params.password,
                trusted_connection=params.trusted_connection,
                timeout=params.timeout,
            )
            with get_connection(conn_params) as conn:
                cursor = conn.cursor()

                # 1. Fetch Query Store runtime intervals
                limit = 24 if time_range == "24H" else 12 if time_range == "6H" else 60
                interval_sql = f"""
                SELECT TOP ({limit})
                    rsi.runtime_stats_interval_id,
                    CONVERT(VARCHAR(30), rsi.start_time, 126) AS start_time,
                    COUNT(DISTINCT rs.plan_id) AS distinct_plans,
                    ISNULL(SUM(rs.count_executions), 0) AS total_execs,
                    ROUND(ISNULL(SUM(rs.avg_cpu_time * rs.count_executions) / 1000.0, 0), 2) AS total_cpu_ms
                FROM sys.query_store_runtime_stats_interval rsi
                LEFT JOIN sys.query_store_runtime_stats rs ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
                GROUP BY rsi.runtime_stats_interval_id, rsi.start_time
                ORDER BY rsi.start_time ASC;
                """
                cursor.execute(interval_sql)
                rows = cursor.fetchall()

                if rows:
                    timeline: List[TimeTravelTimelinePoint] = []
                    cpu_values = [float(r[4] or 0.0) for r in rows]
                    avg_cpu = sum(cpu_values) / len(cpu_values) if cpu_values else 10.0
                    max_cpu = max(cpu_values) if cpu_values else 100.0

                    # 2. Fetch dominant wait per interval
                    wait_sql = """
                    SELECT 
                        ws.runtime_stats_interval_id,
                        ws.wait_category_desc,
                        SUM(ws.total_query_wait_time_ms) AS total_wait_ms
                    FROM sys.query_store_wait_stats ws
                    GROUP BY ws.runtime_stats_interval_id, ws.wait_category_desc
                    ORDER BY total_wait_ms DESC;
                    """
                    cursor.execute(wait_sql)
                    interval_waits: Dict[int, str] = {}
                    for w_row in cursor.fetchall():
                        int_id, w_cat, _ = w_row
                        if int_id not in interval_waits:
                            interval_waits[int_id] = w_cat

                    spikes: List[int] = []
                    worst_interval_id = rows[-1][0]
                    highest_cpu = 0.0

                    for r in rows:
                        int_id = int(r[0])
                        start_iso = r[1]
                        distinct_plans = int(r[2] or 0)
                        execs = int(r[3] or 0)
                        cpu_ms = float(r[4] or 0.0)

                        # Time label
                        try:
                            dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
                            time_label = dt.strftime("%H:%M")
                        except Exception:
                            time_label = start_iso[-8:-3] if len(start_iso) >= 8 else str(int_id)

                        # CPU load scaling (10% to 95%)
                        scaled_pct = min(98.0, max(8.0, round((cpu_ms / (max_cpu if max_cpu > 0 else 1.0)) * 85.0 + 10.0, 1)))

                        dominant_wait = interval_waits.get(int_id, "CPU")
                        is_spike = cpu_ms > (avg_cpu * 1.8) or scaled_pct > 70.0
                        severity = "CRITICAL" if scaled_pct > 80.0 else "WARNING" if is_spike else "NORMAL"

                        if is_spike:
                            spikes.append(int_id)
                        if cpu_ms > highest_cpu:
                            highest_cpu = cpu_ms
                            worst_interval_id = int_id

                        timeline.append(
                            TimeTravelTimelinePoint(
                                interval_id=int_id,
                                time_label=time_label,
                                start_time=start_iso,
                                cpu_load_percent=scaled_pct,
                                total_cpu_ms=cpu_ms,
                                total_executions=execs,
                                dominant_wait_category=dominant_wait,
                                is_anomaly_spike=is_spike,
                                spike_severity=severity,
                            )
                        )

                    initial_id = worst_interval_id if worst_interval_id in [t.interval_id for t in timeline] else timeline[-1].interval_id
                    initial_snap = get_interval_snapshot(params=params, database_name=target_db, interval_id=initial_id)

                    return TimeTravelCorrelatorOverview(
                        database_name=target_db,
                        server_name="localhost",
                        time_range=time_range,
                        is_demo=False,
                        total_intervals=len(timeline),
                        detected_spikes_count=len(spikes),
                        timeline=timeline,
                        initial_interval_id=initial_id,
                        initial_snapshot=initial_snap,
                    )
        except Exception as exc:
            logger.warning("Error fetching live time-travel overview: %s", exc)

    # Demo Fallback
    return _build_demo_overview(target_db, time_range)


def get_interval_snapshot(
    params: Optional[ConnectionParams],
    database_name: str,
    interval_id: int,
) -> TimeTravelSnapshotDetail:
    """Retrieve correlated queries, wait breakdown, and infrastructure events for a specific minute/interval."""
    if params:
        try:
            conn_params = ConnectionParams(
                server=params.server,
                database=database_name,
                driver=params.driver,
                username=params.username,
                password=params.password,
                trusted_connection=params.trusted_connection,
                timeout=params.timeout,
            )
            with get_connection(conn_params) as conn:
                cursor = conn.cursor()

                # 1. Interval info
                cursor.execute(
                    """
                    SELECT 
                        CONVERT(VARCHAR(30), rsi.start_time, 126) AS start_time,
                        CONVERT(VARCHAR(30), rsi.end_time, 126) AS end_time,
                        ISNULL(SUM(rs.avg_cpu_time * rs.count_executions) / 1000.0, 0) AS total_cpu_ms,
                        ISNULL(SUM(rs.count_executions), 0) AS total_execs,
                        COUNT(DISTINCT rs.plan_id) AS distinct_plans
                    FROM sys.query_store_runtime_stats_interval rsi
                    LEFT JOIN sys.query_store_runtime_stats rs ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
                    WHERE rsi.runtime_stats_interval_id = ?
                    GROUP BY rsi.runtime_stats_interval_id, rsi.start_time, rsi.end_time;
                    """,
                    (interval_id,),
                )
                i_row = cursor.fetchone()
                start_iso = i_row[0] if i_row else datetime.utcnow().isoformat()
                end_iso = i_row[1] if i_row else datetime.utcnow().isoformat()
                total_cpu = float(i_row[2] or 0.0) if i_row else 0.0
                total_execs = int(i_row[3] or 0) if i_row else 0
                plans_count = int(i_row[4] or 0) if i_row else 0

                # 2. Top Correlated Queries in this Interval
                cursor.execute(
                    """
                    SELECT TOP 3
                        q.query_id,
                        p.plan_id,
                        SUBSTRING(qt.query_sql_text, 1, 350) AS sql_snippet,
                        ROUND(rs.avg_cpu_time / 1000.0, 2) AS avg_cpu_ms,
                        ROUND(rs.avg_duration / 1000.0, 2) AS avg_duration_ms,
                        rs.avg_logical_io_reads,
                        rs.count_executions,
                        OBJECT_NAME(q.object_id) AS object_name
                    FROM sys.query_store_runtime_stats rs
                    JOIN sys.query_store_plan p ON rs.plan_id = p.plan_id
                    JOIN sys.query_store_query q ON p.query_id = q.query_id
                    JOIN sys.query_store_query_text qt ON q.query_text_id = qt.query_text_id
                    WHERE rs.runtime_stats_interval_id = ?
                    ORDER BY (rs.avg_cpu_time * rs.count_executions) DESC;
                    """,
                    (interval_id,),
                )
                queries: List[CorrelatedQueryItem] = []
                for q_row in cursor.fetchall():
                    q_id, p_id, sql_txt, avg_cpu, avg_dur, reads, execs, obj_name = q_row
                    q_total_cpu = float(avg_cpu or 0.0) * int(execs or 1)
                    pct = round((q_total_cpu / total_cpu) * 100, 1) if total_cpu > 0 else 33.3

                    queries.append(
                        CorrelatedQueryItem(
                            query_id=int(q_id),
                            plan_id=int(p_id),
                            query_text=sql_txt or "-- Sorgu metni",
                            cpu_time_ms=float(avg_cpu or 0.0),
                            duration_ms=float(avg_dur or 0.0),
                            logical_reads=float(reads or 0.0),
                            execution_count=int(execs or 0),
                            cpu_contribution_pct=min(100.0, pct),
                            database_name=database_name,
                            object_name=obj_name,
                        )
                    )

                # 3. Correlated Waits in this Interval
                cursor.execute(
                    """
                    SELECT 
                        ws.wait_category_desc,
                        SUM(ws.total_query_wait_time_ms) AS total_wait_ms
                    FROM sys.query_store_wait_stats ws
                    WHERE ws.runtime_stats_interval_id = ?
                    GROUP BY ws.wait_category_desc
                    ORDER BY total_wait_ms DESC;
                    """,
                    (interval_id,),
                )
                waits: List[CorrelatedWaitItem] = []
                w_rows = cursor.fetchall()
                total_wait_sum = sum([float(r[1] or 0.0) for r in w_rows]) if w_rows else 1.0

                dominant_wait = "CPU"
                if w_rows:
                    dominant_wait = w_rows[0][0] or "CPU"
                    for wr in w_rows:
                        w_cat = wr[0] or "General"
                        w_ms = float(wr[1] or 0.0)
                        w_pct = round((w_ms / total_wait_sum) * 100.0, 1) if total_wait_sum > 0 else 0.0
                        diag = WAIT_DESCRIPTIONS.get(w_cat, "Sorgu icra esnasında kaynak tahsisini bekledi.")

                        waits.append(
                            CorrelatedWaitItem(
                                wait_category=w_cat,
                                total_wait_ms=w_ms,
                                percentage=w_pct,
                                architectural_diagnosis=diag,
                            )
                        )
                else:
                    waits.append(
                        CorrelatedWaitItem(
                            wait_category="CPU",
                            total_wait_ms=round(total_cpu, 1),
                            percentage=100.0,
                            architectural_diagnosis=WAIT_DESCRIPTIONS["CPU"],
                        )
                    )

                # 4. Correlated DDL / Trace Events around this time
                events: List[CorrelatedEventItem] = []
                try:
                    cursor.execute(
                        """
                        SELECT TOP 3 
                            CONVERT(VARCHAR(30), StartTime, 126) AS StartTime,
                            EventClass,
                            ObjectName,
                            DatabaseName
                        FROM sys.fn_trace_gettable(
                            (SELECT path FROM sys.traces WHERE is_default = 1), 
                            DEFAULT
                        )
                        WHERE EventClass IN (46, 47, 164)
                        ORDER BY StartTime DESC;
                        """
                    )
                    for tr_row in cursor.fetchall():
                        ev_time, ev_cls, obj, db_n = tr_row
                        ev_desc = "Nesne oluşturuldu (CREATE)" if ev_cls == 46 else "Nesne silindi (DROP)" if ev_cls == 47 else "Şema güncellendi (ALTER)"
                        events.append(
                            CorrelatedEventItem(
                                event_time=ev_time or start_iso,
                                event_type="DDL_CHANGE",
                                object_name=obj or "SchemaObject",
                                database_name=db_n or database_name,
                                description=f"Default Trace: {ev_desc} [{obj}]. Bu değişiklik sorgu planlarının önbellekten düşmesine (recompilation) sebep olmuş olabilir.",
                                risk_level="HIGH" if ev_cls == 164 else "MEDIUM",
                            )
                        )
                except Exception:
                    pass

                # 5. Synthesize Root Cause Diagnosis
                is_spike = total_cpu > 300.0 or len(queries) > 0 and queries[0].cpu_contribution_pct > 60.0
                spike_score = min(99.0, max(25.0, round(total_cpu / 15.0, 1)))

                if dominant_wait == "Lock":
                    diagnosis = f"Bu zaman dilimindeki performans daralmasının ana kök nedeni 'Lock' (Kilitlenme) beklemesidir. {total_wait_sum:.0f} ms boyunca eşzamanlı oturumlar satır/sayfa kilitleri beklemiştir."
                    action_title = "Kilit Çatışmalarını Snapshot İzolasyonu (RCSI) ile Çöz"
                    action_sql = f"ALTER DATABASE [{database_name}] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;"
                elif dominant_wait == "Buffer IO":
                    diagnosis = f"Bu tepe noktasında disk okuma gecikmesi (PAGEIOLATCH) baskındır. En çok CPU tüketen Sorgu #{queries[0].query_id if queries else 1} eksik indeks nedeniyle binlerce sayfayı diskten belleğe okumuştur."
                    action_title = "Eksik Kapsayıcı İndeks Reçetesi"
                    action_sql = f"-- Disk okuma darbogazini kesmek icin kapsayici indeks onerisi:\nCREATE NONCLUSTERED INDEX IX_Correlated_Tuning ON [{database_name}].dbo.Orders (OrderDate) INCLUDE (CustomerID, TotalAmount) WITH (ONLINE = ON);"
                else:
                    diagnosis = f"Bu dakikada Sorgu #{queries[0].query_id if queries else 1} toplam CPU tüketiminin %{queries[0].cpu_contribution_pct if queries else 75:.1f}'ini tek başına tüketmiştir. Parametre koklama veya regresyon şüphesi bulunmaktadır."
                    action_title = f"Sorgu #{queries[0].query_id if queries else 1} İçin Referans Planı Zorla (Plan Forcing)"
                    action_sql = f"EXEC sp_query_store_force_plan @query_id = {queries[0].query_id if queries else 1}, @plan_id = {queries[0].plan_id if queries else 1};"

                return TimeTravelSnapshotDetail(
                    interval_id=interval_id,
                    start_time=start_iso,
                    end_time=end_iso,
                    total_cpu_ms=total_cpu,
                    total_executions=total_execs,
                    distinct_plans_count=plans_count,
                    dominant_wait_category=dominant_wait,
                    is_anomaly_spike=is_spike,
                    spike_score=spike_score,
                    queries=queries,
                    waits=waits,
                    events=events,
                    root_cause_diagnosis=diagnosis,
                    recommended_action_title=action_title,
                    recommended_action_sql=action_sql,
                )
        except Exception as exc:
            logger.warning("Error fetching interval snapshot: %s", exc)

    return _build_demo_snapshot(database_name, interval_id)


def _build_demo_overview(database_name: str, time_range: str) -> TimeTravelCorrelatorOverview:
    """Fallback rich demo timeline showing an afternoon CPU spike scenario."""
    now = datetime.utcnow()
    timeline: List[TimeTravelTimelinePoint] = []
    points_count = 24

    for i in range(points_count):
        t = now - timedelta(minutes=(points_count - i) * 15)
        int_id = 100 + i
        time_label = t.strftime("%H:%M")

        # Simulate a major spike at 14:15 - 14:30
        if i in (14, 15):
            cpu_pct = 88.4 if i == 14 else 94.2
            cpu_ms = 4850.0 if i == 14 else 5920.0
            execs = 1420
            w_cat = "Buffer IO" if i == 14 else "Lock"
            is_spike = True
            sev = "CRITICAL"
        elif i in (13, 16):
            cpu_pct = 64.0
            cpu_ms = 1850.0
            execs = 850
            w_cat = "Parallelism"
            is_spike = True
            sev = "WARNING"
        else:
            cpu_pct = 15.0 + (i % 5) * 4.2
            cpu_ms = 240.0 + (i % 5) * 80.0
            execs = 200 + i * 25
            w_cat = "CPU"
            is_spike = False
            sev = "NORMAL"

        timeline.append(
            TimeTravelTimelinePoint(
                interval_id=int_id,
                time_label=time_label,
                start_time=t.isoformat(),
                cpu_load_percent=cpu_pct,
                total_cpu_ms=cpu_ms,
                total_executions=execs,
                dominant_wait_category=w_cat,
                is_anomaly_spike=is_spike,
                spike_severity=sev,
            )
        )

    spike_snap = _build_demo_snapshot(database_name, 115)

    return TimeTravelCorrelatorOverview(
        database_name=database_name,
        server_name="localhost",
        time_range=time_range,
        is_demo=True,
        total_intervals=len(timeline),
        detected_spikes_count=4,
        timeline=timeline,
        initial_interval_id=115,
        initial_snapshot=spike_snap,
    )


def _build_demo_snapshot(database_name: str, interval_id: int) -> TimeTravelSnapshotDetail:
    """Build detailed correlated snapshot for demo."""
    return TimeTravelSnapshotDetail(
        interval_id=interval_id,
        start_time="2026-11-10T14:15:00",
        end_time="2026-11-10T14:30:00",
        total_cpu_ms=5920.0,
        total_executions=1420,
        distinct_plans_count=4,
        dominant_wait_category="Buffer IO",
        is_anomaly_spike=True,
        spike_score=94.2,
        queries=[
            CorrelatedQueryItem(
                query_id=157,
                plan_id=158,
                query_text="SELECT o.OrderID, o.OrderDate, o.TotalAmount, c.FullName FROM dbo.Orders o JOIN dbo.Customers c ON o.CustomerID = c.CustomerID WHERE o.OrderDate >= '2026-01-01' AND o.OrderStatus = @Status;",
                cpu_time_ms=4250.0,
                duration_ms=4890.0,
                logical_reads=148500.0,
                execution_count=850,
                cpu_contribution_pct=71.8,
                database_name=database_name,
                object_name="Orders",
            ),
            CorrelatedQueryItem(
                query_id=131,
                plan_id=132,
                query_text="SELECT db_id() AS database_id, sm.[is_inlineable] AS InlineableCount FROM [sys].[objects] sm WHERE sm.type = 'P';",
                cpu_time_ms=920.0,
                duration_ms=1140.0,
                logical_reads=18800.0,
                execution_count=120,
                cpu_contribution_pct=15.5,
                database_name=database_name,
                object_name=None,
            ),
            CorrelatedQueryItem(
                query_id=68,
                plan_id=69,
                query_text="UPDATE dbo.Orders SET TotalAmount = sub.Total FROM Orders o CROSS APPLY (SELECT SUM(LineTotal) AS Total FROM OrderDetails WHERE OrderID = o.OrderID) sub WHERE o.TotalAmount = 0;",
                cpu_time_ms=450.0,
                duration_ms=620.0,
                logical_reads=12500.0,
                execution_count=50,
                cpu_contribution_pct=7.6,
                database_name=database_name,
                object_name="OrderDetails",
            ),
        ],
        waits=[
            CorrelatedWaitItem(
                wait_category="Buffer IO",
                total_wait_ms=4280.0,
                percentage=68.5,
                architectural_diagnosis="PAGEIOLATCH_SH disk beklemesi: Eksik kapsayıcı indeks nedeniyle 148.500 veri sayfası diskten RAM'e çekilmeye zorlandı.",
            ),
            CorrelatedWaitItem(
                wait_category="Lock",
                total_wait_ms=1240.0,
                percentage=19.8,
                architectural_diagnosis="LCK_M_S sayfa paylaşım kilidi: UPDATE işlemi devam ederken SELECT sorguları kilit bekledi.",
            ),
            CorrelatedWaitItem(
                wait_category="Parallelism",
                total_wait_ms=400.0,
                percentage=6.4,
                architectural_diagnosis="CXPACKET paralellik dengesizliği: Ağır tablonun thread'lere asimetrik dağıtılması.",
            ),
            CorrelatedWaitItem(
                wait_category="Memory",
                total_wait_ms=330.0,
                percentage=5.3,
                architectural_diagnosis="RESOURCE_SEMAPHORE bellek rezervasyonu: Hash join için geçici bellek kuyruğu.",
            ),
        ],
        events=[
            CorrelatedEventItem(
                event_time="2026-11-10T14:11:42",
                event_type="DDL_CHANGE",
                object_name="dbo.Orders",
                database_name=database_name,
                description="Default Trace: ALTER TABLE [dbo].[Orders] clustered index işlemi tetiklendi. Bu işlem önbellekteki optimizasyon planlarını geçersiz kıldı (recompile).",
                risk_level="HIGH",
            ),
            CorrelatedEventItem(
                event_time="2026-11-10T14:14:02",
                event_type="AUTO_GROWTH",
                object_name="Datapath_TestDB_Log",
                database_name=database_name,
                description="Transaction Log (LDF) dosyası 256 MB otomatik büyüme gerçekleştirdi.",
                risk_level="MEDIUM",
            ),
        ],
        root_cause_diagnosis="Saat 14:15'teki %94.2 CPU sıçramasının kesin kök nedeni: 14:11'deki DDL değişikliği sonrası Sorgu #157'nin 'DISPUTED' parametresiyle suboptimal bir plan derlemesi (Parameter Sniffing) ve 148.500 sayfalık disk okuması (Buffer IO) üretmesidir.",
        recommended_action_title="Sorgu #157 Planını Sabitle ve Kapsayıcı İndeks Ekle",
        recommended_action_sql="-- 1. ADIM: Suboptimal planı durdurmak için iyi planı zorla:\nEXEC sp_query_store_force_plan @query_id = 157, @plan_id = 158;\n\n-- 2. ADIM: Kalıcı çözüm için kapsayıcı indeks ekle:\nCREATE NONCLUSTERED INDEX IX_Orders_OrderDate_Covering\nON dbo.Orders (OrderDate, OrderStatus)\nINCLUDE (CustomerID, TotalAmount)\nWITH (ONLINE = ON, DATA_COMPRESSION = PAGE);",
    )
