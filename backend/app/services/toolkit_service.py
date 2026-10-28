"""services/toolkit_service.py — Hardcoded DBA script library (20+ scripts) in Turkish."""
from __future__ import annotations

from typing import List, Optional

from app.schemas.toolkit import DBAScript, ScriptCategory

_SCRIPTS: List[DBAScript] = [
    # ── Oturumlar ───────────────────────────────────────────────────────────
    DBAScript(
        id="sessions-001",
        name="Aktif Kullanıcı Oturumları",
        category="Oturumlar",
        description="Mevcut SQL metinleri ve bekleme bilgileriyle birlikte tüm aktif kullanıcı oturumlarını listeler.",
        risk_level="read_only",
        tags=["oturumlar", "aktif", "bekleme", "sessions", "active", "wait"],
        min_sql_version="2008",
        sql="""
SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.program_name,
    DB_NAME(s.database_id)  AS database_name,
    s.status,
    s.cpu_time,
    s.logical_reads,
    r.command,
    r.wait_type,
    r.wait_time             AS wait_ms,
    r.blocking_session_id,
    SUBSTRING(ISNULL(CAST(t.text AS NVARCHAR(MAX)),''), 1, 500) AS sql_text
FROM sys.dm_exec_sessions s
LEFT JOIN sys.dm_exec_requests r ON r.session_id = s.session_id
OUTER APPLY sys.dm_exec_sql_text(ISNULL(r.sql_handle, s.prev_error)) t
WHERE s.is_user_process = 1
ORDER BY s.cpu_time DESC;
""".strip(),
    ),
    DBAScript(
        id="sessions-002",
        name="Uzun Süren Sorgular (>30sn)",
        category="Oturumlar",
        description="30 saniyeden uzun süredir çalışan sorguları, bekleme türlerini ve yürütme planlarını gösterir.",
        risk_level="read_only",
        tags=["oturumlar", "uzun-suren", "performans", "long-running"],
        min_sql_version="2008",
        sql="""
SELECT
    r.session_id,
    r.start_time,
    DATEDIFF(SECOND, r.start_time, GETDATE()) AS elapsed_sec,
    r.status,
    r.command,
    r.wait_type,
    r.wait_time,
    r.blocking_session_id,
    DB_NAME(r.database_id)  AS database_name,
    SUBSTRING(CAST(t.text AS NVARCHAR(MAX)), 1, 500) AS sql_text,
    qp.query_plan
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
OUTER APPLY sys.dm_exec_query_plan(r.plan_handle) qp
WHERE DATEDIFF(SECOND, r.start_time, GETDATE()) > 30
ORDER BY elapsed_sec DESC;
""".strip(),
    ),
    DBAScript(
        id="sessions-003",
        name="Açık Kalan İşlemler (Transactions)",
        category="Oturumlar",
        description="Açık işlem (transaction) tutan oturumları, bekleme sürelerini ve son SQL komutlarını listeler.",
        risk_level="read_only",
        tags=["oturumlar", "islemler", "kilitler", "transactions"],
        min_sql_version="2008",
        sql="""
SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.open_transaction_count,
    DATEDIFF(MINUTE, s.last_request_start_time, GETDATE()) AS idle_min,
    DB_NAME(s.database_id) AS database_name,
    SUBSTRING(ISNULL(CAST(t.text AS NVARCHAR(MAX)),''), 1, 500) AS last_sql
FROM sys.dm_exec_sessions s
OUTER APPLY sys.dm_exec_sql_text(s.prev_error) t
WHERE s.open_transaction_count > 0
  AND s.is_user_process = 1
ORDER BY s.open_transaction_count DESC, idle_min DESC;
""".strip(),
    ),
    # ── Engellemeler ────────────────────────────────────────────────────────
    DBAScript(
        id="blocking-001",
        name="Canlı Engelleme Zincirleri (Blocking)",
        category="Engellemeler",
        description="Kök engelleyici (head blocker) ve engellenen tüm oturumların ayrıntılarını hiyerarşik olarak sunar.",
        risk_level="read_only",
        tags=["engelleme", "kilitler", "performans", "blocking"],
        min_sql_version="2008",
        sql="""
WITH blockers AS (
    SELECT DISTINCT blocking_session_id AS session_id FROM sys.dm_exec_requests
    WHERE blocking_session_id > 0
)
SELECT
    b.session_id        AS blocker_session_id,
    bs.login_name       AS blocker_login,
    bs.host_name        AS blocker_host,
    r.session_id        AS blocked_session_id,
    r.wait_type,
    r.wait_time         AS wait_ms,
    DB_NAME(r.database_id) AS database_name,
    SUBSTRING(CAST(t.text AS NVARCHAR(MAX)),1,500) AS blocked_sql
FROM blockers b
JOIN sys.dm_exec_sessions bs ON bs.session_id = b.session_id
JOIN sys.dm_exec_requests r ON r.blocking_session_id = b.session_id
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
ORDER BY r.wait_time DESC;
""".strip(),
    ),
    DBAScript(
        id="blocking-002",
        name="Kilit Bekleme İstatistikleri",
        category="Engellemeler",
        description="Sunucunun son başlangıcından bu yana bekleme türlerine göre kümülatif kilit bekleme istatistikleri.",
        risk_level="read_only",
        tags=["engelleme", "beklemeler", "istatistikler", "waits"],
        min_sql_version="2008",
        sql="""
SELECT TOP 20
    wait_type,
    waiting_tasks_count,
    wait_time_ms,
    max_wait_time_ms,
    signal_wait_time_ms,
    wait_time_ms - signal_wait_time_ms AS resource_wait_ms
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN (
    'SLEEP_TASK','BROKER_TO_FLUSH','BROKER_TASK_STOP','CLR_AUTO_EVENT',
    'DISPATCHER_QUEUE_SEMAPHORE','FT_IFTS_SCHEDULER_IDLE_WAIT',
    'HADR_WORK_QUEUE','HADR_FILESTREAM_IOMGR_IOCOMPLETION',
    'LAZYWRITER_SLEEP','LOGMGR_QUEUE','ONDEMAND_TASK_QUEUE',
    'REQUEST_FOR_DEADLOCK_SEARCH','RESOURCE_QUEUE','SERVER_IDLE_CHECK',
    'SLEEP_DBSTARTUP','SLEEP_DCOMSTARTUP','SLEEP_MASTERDBREADY',
    'SLEEP_MASTERMDREADY','SLEEP_MASTERUPGRADED','SLEEP_MSDBSTARTUP',
    'SLEEP_TEMPDBSTARTUP','SNI_HTTP_ACCEPT','SP_SERVER_DIAGNOSTICS_SLEEP',
    'SQLTRACE_BUFFER_FLUSH','SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
    'WAIT_XTP_OFFLINE_CKPT_NEW_LOG','WAITFOR','XE_DISPATCHER_WAIT',
    'XE_TIMER_EVENT','BROKER_EVENTHANDLER','CHECKPOINT_QUEUE',
    'DBMIRROR_EVENTS_QUEUE','SQLTRACE_WAIT_ENTRIES'
)
AND waiting_tasks_count > 0
ORDER BY wait_time_ms DESC;
""".strip(),
    ),
    # ── İndeks Analizi ──────────────────────────────────────────────────────
    DBAScript(
        id="index-001",
        name="Eksik İndeks Önerileri",
        category="İndeks Analizi",
        description="Tahmini performans iyileştirme etkisine (impact score) göre sıralanmış en kritik eksik indeksler.",
        risk_level="read_only",
        tags=["indeksler", "eksik", "performans", "tuning", "missing"],
        min_sql_version="2008",
        notes="SQL Server yeniden başlatıldığında sıfırlanır. İndeks oluşturmadan önce doğrulayınız.",
        sql="""
SELECT TOP 25
    ROUND(s.avg_total_user_cost * s.avg_user_impact * (s.user_seeks + s.user_scans), 0)
                                    AS improvement_measure,
    d.statement                     AS table_name,
    d.equality_columns,
    d.inequality_columns,
    d.included_columns,
    s.user_seeks,
    s.user_scans,
    s.last_user_seek,
    s.last_user_scan,
    s.avg_total_user_cost,
    s.avg_user_impact
FROM sys.dm_db_missing_index_group_stats s
JOIN sys.dm_db_missing_index_groups g     ON g.index_group_handle = s.group_handle
JOIN sys.dm_db_missing_index_details d    ON d.index_handle       = g.index_handle
ORDER BY improvement_measure DESC;
""".strip(),
    ),
    DBAScript(
        id="index-002",
        name="Kullanılmayan İndeksler",
        category="İndeks Analizi",
        description="Sorgularda hiç seek/scan almayan ancak veri güncellemelerinde (write) maliyet yaratan indeksler.",
        risk_level="caution",
        tags=["indeksler", "kullanilmayan", "bakim", "unused"],
        min_sql_version="2008",
        notes="Yeniden başlatmada veriler sıfırlanır. İndeksi silmeden önce Query Store ile doğrulayınız.",
        sql="""
SELECT
    OBJECT_NAME(i.object_id)       AS table_name,
    i.name                         AS index_name,
    i.type_desc,
    i.is_unique,
    i.is_primary_key,
    s.user_seeks,
    s.user_scans,
    s.user_lookups,
    s.user_updates,
    s.last_user_seek,
    s.last_user_scan
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats s
    ON s.object_id = i.object_id AND s.index_id = i.index_id
    AND s.database_id = DB_ID()
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
  AND i.type > 0
  AND i.is_primary_key = 0
  AND i.is_unique_constraint = 0
  AND (s.user_seeks IS NULL OR s.user_seeks = 0)
  AND (s.user_scans IS NULL OR s.user_scans = 0)
  AND (s.user_lookups IS NULL OR s.user_lookups = 0)
ORDER BY ISNULL(s.user_updates, 0) DESC;
""".strip(),
    ),
    DBAScript(
        id="index-003",
        name="İndeks Parçalanma Analizi (Fragmentation)",
        category="İndeks Analizi",
        description="1000'den fazla sayfaya sahip indekslerin parçalanma oranlarını ve bakım aksiyonu önerilerini listeler.",
        risk_level="read_only",
        tags=["indeksler", "parcalanma", "bakim", "fragmentation"],
        min_sql_version="2008",
        notes="Büyük veritabanlarında yavaş çalışabilir. Örnekleme (SAMPLED) modu kullanılması tavsiye edilir.",
        sql="""
SELECT
    DB_NAME()                       AS database_name,
    OBJECT_NAME(ps.object_id)       AS table_name,
    i.name                          AS index_name,
    ps.index_type_desc,
    ps.avg_fragmentation_in_percent AS frag_pct,
    ps.page_count,
    CASE
        WHEN ps.avg_fragmentation_in_percent < 10  THEN 'OK'
        WHEN ps.avg_fragmentation_in_percent < 30  THEN 'REORGANIZE'
        ELSE 'REBUILD'
    END                             AS recommendation
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'SAMPLED') ps
JOIN sys.indexes i ON i.object_id = ps.object_id AND i.index_id = ps.index_id
WHERE ps.page_count > 1000
  AND i.type > 0
ORDER BY ps.avg_fragmentation_in_percent DESC;
""".strip(),
    ),
    DBAScript(
        id="index-004",
        name="Mükerrer (Duplicate) İndeksler",
        category="İndeks Analizi",
        description="Aynı tablo üzerinde aynı öncü anahtar sütunlarına sahip mükerrer ve gereksiz indeksleri bulur.",
        risk_level="caution",
        tags=["indeksler", "mukerrer", "optimizasyon", "duplicate"],
        min_sql_version="2012",
        sql="""
WITH idx_cols AS (
    SELECT
        i.object_id,
        i.index_id,
        i.name,
        STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_cols
    FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.type > 0 AND ic.is_included_column = 0
    GROUP BY i.object_id, i.index_id, i.name
)
SELECT
    OBJECT_NAME(a.object_id)  AS table_name,
    a.name                    AS index_a,
    b.name                    AS index_b,
    a.key_cols
FROM idx_cols a
JOIN idx_cols b ON b.object_id = a.object_id AND b.key_cols = a.key_cols AND b.index_id > a.index_id
ORDER BY table_name, a.key_cols;
""".strip(),
    ),
    # ── Veritabanı Dosyaları ────────────────────────────────────────────────
    DBAScript(
        id="files-001",
        name="Dosya Boyutları ve Autogrowth",
        category="Veritabanı Dosyaları",
        description="Veri ve log dosyalarının disk boyutları, boş alanları ve otomatik büyüme (autogrowth) ayarları.",
        risk_level="read_only",
        tags=["dosyalar", "autogrowth", "alan", "depolama", "storage"],
        min_sql_version="2008",
        sql="""
SELECT
    DB_NAME(database_id)        AS database_name,
    name                        AS logical_name,
    physical_name,
    type_desc,
    CAST(size * 8.0 / 1024 AS DECIMAL(10,2))   AS size_mb,
    CASE max_size
        WHEN -1 THEN 'Sınırsız'
        WHEN  0 THEN 'Büyüme Kapalı'
        ELSE CAST(CAST(max_size * 8.0 / 1024 AS DECIMAL(10,2)) AS VARCHAR) + ' MB'
    END                         AS max_size,
    CASE is_percent_growth
        WHEN 1 THEN CAST(growth AS VARCHAR) + '%'
        ELSE CAST(CAST(growth * 8.0 / 1024 AS DECIMAL(10,2)) AS VARCHAR) + ' MB'
    END                         AS autogrowth,
    is_percent_growth
FROM sys.master_files
ORDER BY database_name, type_desc;
""".strip(),
    ),
    DBAScript(
        id="files-002",
        name="TempDB Tahsisat Çekişmesi (Contention)",
        category="Veritabanı Dosyaları",
        description="PAGELATCH bekleme istatistikleri üzerinden TempDB dosya tahsisat çekişmelerini denetler.",
        risk_level="read_only",
        tags=["tempdb", "cekisme", "beklemeler", "contention"],
        min_sql_version="2008",
        sql="""
SELECT
    wait_type,
    waiting_tasks_count,
    wait_time_ms,
    max_wait_time_ms
FROM sys.dm_os_wait_stats
WHERE wait_type IN ('PAGELATCH_UP','PAGELATCH_EX','PAGELATCH_SH',
                    'PAGEIOLATCH_UP','PAGEIOLATCH_EX','PAGEIOLATCH_SH')
ORDER BY wait_time_ms DESC;
""".strip(),
    ),
    # ── Yedekleme ───────────────────────────────────────────────────────────
    DBAScript(
        id="backup-001",
        name="Veritabanı Başına Son Alınan Yedekler",
        category="Yedekleme",
        description="Her veritabanı için en güncel Tam (Full), Fark (Diff) ve Günlük (Log) yedek tarihleri ve yaşları.",
        risk_level="read_only",
        tags=["yedekleme", "kurtarma", "izleme", "backup"],
        min_sql_version="2008",
        sql="""
SELECT
    d.name                                              AS database_name,
    d.recovery_model_desc                               AS recovery_model,
    MAX(CASE WHEN bs.type = 'D' THEN bs.backup_finish_date END) AS last_full,
    MAX(CASE WHEN bs.type = 'I' THEN bs.backup_finish_date END) AS last_diff,
    MAX(CASE WHEN bs.type = 'L' THEN bs.backup_finish_date END) AS last_log,
    DATEDIFF(HOUR,
        MAX(CASE WHEN bs.type='D' THEN bs.backup_finish_date END),
        GETDATE())                                      AS full_age_hours
FROM sys.databases d
LEFT JOIN msdb.dbo.backupset bs ON bs.database_name = d.name
WHERE d.database_id > 4
GROUP BY d.name, d.recovery_model_desc
ORDER BY full_age_hours DESC;
""".strip(),
    ),
    DBAScript(
        id="backup-002",
        name="Yedek Boyut Eğilimleri (Son 30 Gün)",
        category="Yedekleme",
        description="Son 30 güne ait veritabanı ve yedek türü bazında günlük yedek boyutları ve sıkıştırma oranları.",
        risk_level="read_only",
        tags=["yedekleme", "boyut", "egilim", "trend"],
        min_sql_version="2008",
        sql="""
SELECT
    database_name,
    type                                                    AS backup_type,
    CAST(backup_start_date AS DATE)                         AS backup_date,
    CAST(SUM(backup_size) / 1073741824.0 AS DECIMAL(10,3)) AS total_size_gb,
    CAST(SUM(ISNULL(compressed_backup_size,0)) / 1073741824.0 AS DECIMAL(10,3)) AS compressed_gb,
    COUNT(1)                                                AS backup_count
FROM msdb.dbo.backupset
WHERE backup_start_date >= DATEADD(DAY, -30, GETDATE())
GROUP BY database_name, type, CAST(backup_start_date AS DATE)
ORDER BY backup_date DESC, database_name;
""".strip(),
    ),
    # ── Query Store ─────────────────────────────────────────────────────────
    DBAScript(
        id="qs-001",
        name="Query Store Durumu (Tüm Veritabanları)",
        category="Query Store",
        description="Tüm kullanıcı veritabanlarında Query Store özelliğinin etkin ve çalışma durumunu listeler.",
        risk_level="read_only",
        tags=["query store", "izleme", "yapilandirma"],
        min_sql_version="2016",
        sql="""
SELECT
    name                        AS database_name,
    is_query_store_on           AS qs_enabled,
    state_desc,
    compatibility_level
FROM sys.databases
WHERE database_id > 4
ORDER BY name;
""".strip(),
    ),
    DBAScript(
        id="qs-002",
        name="En Çok CPU Tüketen Sorgular (Query Store)",
        category="Query Store",
        description="Query Store verilerine göre son 24 saatte ortalama CPU tüketimi en yüksek 25 sorgu.",
        risk_level="read_only",
        tags=["query store", "cpu", "performans", "tuning"],
        min_sql_version="2016",
        sql="""
SELECT TOP 25
    q.query_id,
    SUBSTRING(qt.query_sql_text, 1, 300)            AS sql_snippet,
    p.plan_id,
    rs.count_executions,
    CAST(rs.avg_cpu_time   / 1000.0 AS DECIMAL(12,2)) AS avg_cpu_ms,
    CAST(rs.avg_duration   / 1000.0 AS DECIMAL(12,2)) AS avg_duration_ms,
    rs.avg_logical_io_reads,
    rsi.start_time                                   AS interval_start
FROM sys.query_store_query q
JOIN sys.query_store_query_text qt ON qt.query_text_id = q.query_text_id
JOIN sys.query_store_plan p        ON p.query_id = q.query_id
JOIN sys.query_store_runtime_stats rs ON rs.plan_id = p.plan_id
JOIN sys.query_store_runtime_stats_interval rsi
    ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
WHERE rsi.start_time >= DATEADD(HOUR, -24, GETUTCDATE())
ORDER BY rs.avg_cpu_time DESC;
""".strip(),
    ),
    # ── Hata Günlüğü ────────────────────────────────────────────────────────
    DBAScript(
        id="errorlog-001",
        name="Son Sunucu Hataları (Error Log)",
        category="Hata Günlüğü",
        description="SQL Server hata günlüğündeki (error log) kritik hata kayıtlarını sorgular.",
        risk_level="read_only",
        tags=["hata gunlugu", "izleme", "tani", "error log"],
        min_sql_version="2008",
        sql="""
EXEC xp_readerrorlog 0, 1, N'error';
""".strip(),
        notes="VIEW SERVER STATE veya sysadmin yetkisi gerektirir.",
    ),
    DBAScript(
        id="errorlog-002",
        name="Sunucu Yeniden Başlatma Geçmişi",
        category="Hata Günlüğü",
        description="Hata günlüğündeki başlatma kayıtlarından SQL Server'ın geçmiş yeniden başlama tarihlerini listeler.",
        risk_level="read_only",
        tags=["hata gunlugu", "yeniden baslatma", "uptime"],
        min_sql_version="2008",
        sql="""
EXEC xp_readerrorlog 0, 1, N'SQL Server is starting';
EXEC xp_readerrorlog 1, 1, N'SQL Server is starting';
EXEC xp_readerrorlog 2, 1, N'SQL Server is starting';
""".strip(),
    ),
    # ── Yapılandırma ────────────────────────────────────────────────────────
    DBAScript(
        id="config-001",
        name="Sunucu Yapılandırma Ayarları (sp_configure)",
        category="Yapılandırma",
        description="SQL Server'ın tüm sp_configure ayarlarını geçerli ve yapılandırılmış değerleriyle listeler.",
        risk_level="read_only",
        tags=["yapilandirma", "ayarlar", "sp_configure", "config"],
        min_sql_version="2008",
        sql="""
SELECT
    name,
    minimum,
    maximum,
    value_in_use    AS current_value,
    value           AS configured_value,
    description
FROM sys.configurations
ORDER BY name;
""".strip(),
    ),
    DBAScript(
        id="config-002",
        name="Veritabanı Uyumluluk Seviyeleri (Compatibility)",
        category="Yapılandırma",
        description="Tüm veritabanlarının uyumluluk seviyelerini ve denk gelen SQL Server sürümlerini gösterir.",
        risk_level="read_only",
        tags=["yapilandirma", "uyumluluk", "surum"],
        min_sql_version="2008",
        sql="""
SELECT
    name                    AS database_name,
    compatibility_level,
    CASE compatibility_level
        WHEN 160 THEN 'SQL Server 2022'
        WHEN 150 THEN 'SQL Server 2019'
        WHEN 140 THEN 'SQL Server 2017'
        WHEN 130 THEN 'SQL Server 2016'
        WHEN 120 THEN 'SQL Server 2014'
        WHEN 110 THEN 'SQL Server 2012'
        WHEN 100 THEN 'SQL Server 2008/R2'
        ELSE 'Bilinmiyor'
    END                     AS sql_version_equiv,
    state_desc,
    recovery_model_desc
FROM sys.databases
WHERE database_id > 4
ORDER BY name;
""".strip(),
    ),
    DBAScript(
        id="config-003",
        name="Maksimum Bellek ve CPU Ayarları",
        category="Yapılandırma",
        description="Max/Min Server Memory, MAXDOP, Cost Threshold ve mantıksal işlemci çekirdeklerinin genel özeti.",
        risk_level="read_only",
        tags=["yapilandirma", "bellek", "cpu", "memory"],
        min_sql_version="2008",
        sql="""
SELECT
    (SELECT value_in_use FROM sys.configurations WHERE name = 'max server memory (MB)') AS max_server_memory_mb,
    (SELECT value_in_use FROM sys.configurations WHERE name = 'min server memory (MB)') AS min_server_memory_mb,
    (SELECT value_in_use FROM sys.configurations WHERE name = 'max degree of parallelism') AS maxdop,
    (SELECT value_in_use FROM sys.configurations WHERE name = 'cost threshold for parallelism') AS ctp,
    (SELECT physical_memory_kb FROM sys.dm_os_sys_info) / 1024.0 AS total_physical_memory_mb,
    (SELECT cpu_count FROM sys.dm_os_sys_info) AS logical_cpu_count,
    (SELECT hyperthread_ratio FROM sys.dm_os_sys_info) AS hyperthread_ratio;
""".strip(),
    ),
    DBAScript(
        id="config-004",
        name="Aktif Trace Flag Listesi",
        category="Yapılandırma",
        description="Sunucu genelinde ve oturum düzeyinde etkinleştirilmiş olan global trace flag'leri listeler.",
        risk_level="read_only",
        tags=["yapilandirma", "trace flags", "tani"],
        min_sql_version="2008",
        sql="""
DBCC TRACESTATUS(-1) WITH NO_INFOMSGS;
""".strip(),
    ),
]


def get_all_scripts(search: str = "", category: str = "") -> List[DBAScript]:
    results = _SCRIPTS
    if category:
        results = [s for s in results if s.category.lower() == category.lower()]
    if search:
        search_lower = search.lower()
        results = [
            s for s in results
            if search_lower in s.name.lower()
            or search_lower in s.description.lower()
            or any(search_lower in tag.lower() for tag in s.tags)
            or search_lower in s.sql.lower()
        ]
    return results


def get_categories() -> List[ScriptCategory]:
    from collections import Counter
    counts = Counter(s.category for s in _SCRIPTS)
    category_descs = {
        "Oturumlar": "Aktif kullanıcı oturumlarını, uzun süren sorguları ve açık kalan işlemleri görüntüleyin.",
        "Engellemeler": "Canlı engelleme zincirlerini tespit edin ve kilit bekleme istatistiklerini analiz edin.",
        "İndeks Analizi": "Eksik, kullanılmayan, parçalanmış veya mükerrer indeksleri inceleyin.",
        "Veritabanı Dosyaları": "Dosya boyutlarını, autogrowth ayarlarını ve TempDB tahsisat çekişmesini denetleyin.",
        "Yedekleme": "Yedekleme geçmişini, boyut eğilimlerini ve kurtarma hazırlığını gözden geçirin.",
        "Query Store": "Query Store durumunu ve en çok kaynak tüketen sorguları analiz edin.",
        "Hata Günlüğü": "SQL Server hata günlüğü (error log) kayıtlarını okuyun ve inceleyin.",
        "Yapılandırma": "SQL Server sunucu ve veritabanı yapılandırma ayarlarını denetleyin.",
    }
    return [
        ScriptCategory(name=cat, description=category_descs.get(cat, ""), script_count=cnt)
        for cat, cnt in sorted(counts.items())
    ]
