"""services/toolkit_service.py — Hardcoded DBA script library (20+ scripts) in Turkish."""
from __future__ import annotations

from typing import List, Optional

from app.schemas.toolkit import DBAScript, ScriptCategory
from app.services.toolkit_extended_scripts import EXTENDED_SCRIPTS

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

    # ── Bellek & Önbellek ────────────────────────────────────────────────────
    DBAScript(
        id="memory-001",
        name="Page Life Expectancy (PLE) ve Bellek Sayaçları",
        category="Bellek & Önbellek",
        description="Buffer Pool sayfa ömrünü (PLE), Buffer Cache Hit Ratio ve SQL Server hedeflenen/toplam bellek tüketimini ölçer.",
        risk_level="read_only",
        tags=["bellek", "memory", "ple", "buffer pool", "hit ratio"],
        min_sql_version="2008",
        sql="""
SELECT
    RTRIM(object_name) AS object_name,
    RTRIM(counter_name) AS counter_name,
    cntr_value,
    CASE 
        WHEN counter_name = 'Page life expectancy' AND cntr_value < 300 THEN 'Kritik: Bellek Baskısı Var (<300s)'
        WHEN counter_name = 'Page life expectancy' THEN 'Sağlıklı (>300s)'
        ELSE 'Metrik'
    END AS status_desc
FROM sys.dm_os_performance_counters
WHERE (object_name LIKE '%:Buffer Manager%' AND counter_name IN ('Page life expectancy', 'Buffer cache hit ratio', 'Buffer cache hit ratio base'))
   OR (object_name LIKE '%:Memory Manager%' AND counter_name IN ('Total Server Memory (KB)', 'Target Server Memory (KB)'));
""".strip(),
    ),
    DBAScript(
        id="memory-002",
        name="Veritabanı ve Tablo Bazında Buffer Pool Kullanımı",
        category="Bellek & Önbellek",
        description="RAM'deki Buffer Pool veri sayfalarının hangi veritabanları tarafından ne kadar kullanıldığını ve kirli (dirty) sayfa oranlarını gösterir.",
        risk_level="read_only",
        tags=["bellek", "buffer pool", "veritabani", "dirty pages"],
        min_sql_version="2008",
        sql="""
SELECT 
    ISNULL(DB_NAME(database_id), 'Kaynak / Sistem') AS database_name,
    COUNT(*) AS total_pages_8kb,
    CAST(ROUND(COUNT(*) * 8.0 / 1024.0, 2) AS FLOAT) AS buffer_pool_mb,
    CAST(ROUND(SUM(CASE WHEN is_modified = 1 THEN 1 ELSE 0 END) * 8.0 / 1024.0, 2) AS FLOAT) AS dirty_pages_mb,
    CAST(ROUND(SUM(CASE WHEN is_modified = 0 THEN 1 ELSE 0 END) * 8.0 / 1024.0, 2) AS FLOAT) AS clean_pages_mb
FROM sys.dm_os_buffer_descriptors
GROUP BY database_id
ORDER BY total_pages_8kb DESC;
""".strip(),
    ),
    DBAScript(
        id="memory-003",
        name="Ad-Hoc Plan Cache Şişmesi (Single-Use Plans)",
        category="Bellek & Önbellek",
        description="Yalnızca bir kez çalıştırılmış ad-hoc dinamik sorguların bellekte kilitlediği israf edilen alanı hesaplar.",
        risk_level="read_only",
        tags=["bellek", "plan cache", "bloat", "adhoc", "single-use"],
        min_sql_version="2008",
        sql="""
SELECT 
    objtype AS plan_type,
    COUNT(*) AS total_cached_plans,
    SUM(CASE WHEN usecounts = 1 THEN 1 ELSE 0 END) AS single_use_plans,
    CAST(ROUND(SUM(size_in_bytes) / 1024.0 / 1024.0, 2) AS FLOAT) AS total_cache_mb,
    CAST(ROUND(SUM(CASE WHEN usecounts = 1 THEN size_in_bytes ELSE 0 END) / 1024.0 / 1024.0, 2) AS FLOAT) AS wasted_single_use_mb
FROM sys.dm_exec_cached_plans
GROUP BY objtype
ORDER BY wasted_single_use_mb DESC;
""".strip(),
    ),
    DBAScript(
        id="memory-004",
        name="Query Memory Grants & RESOURCE_SEMAPHORE Beklemeleri",
        category="Bellek & Önbellek",
        description="Büyük sıralama (sort) ve hash join sorgularının çalışma belleği hibelerini, bekleme kuyruklarını ve israf oranlarını listeler.",
        risk_level="read_only",
        tags=["bellek", "memory grants", "resource_semaphore", "sort", "hash"],
        min_sql_version="2008",
        sql="""
SELECT
    mg.session_id,
    mg.request_time,
    mg.grant_time,
    CAST(ROUND(mg.requested_memory_kb / 1024.0, 2) AS FLOAT) AS requested_mb,
    CAST(ROUND(mg.granted_memory_kb / 1024.0, 2) AS FLOAT)   AS granted_mb,
    CAST(ROUND(mg.used_memory_kb / 1024.0, 2) AS FLOAT)      AS used_mb,
    CASE 
        WHEN mg.granted_memory_kb > 0 
        THEN CAST(ROUND((1.0 - (CAST(mg.used_memory_kb AS FLOAT) / CAST(mg.granted_memory_kb AS FLOAT))) * 100.0, 1) AS FLOAT)
        ELSE 0 
    END AS waste_pct,
    mg.is_waiting,
    mg.wait_time_ms,
    SUBSTRING(CAST(t.text AS NVARCHAR(MAX)), 1, 300) AS sql_text
FROM sys.dm_exec_query_memory_grants mg
CROSS APPLY sys.dm_exec_sql_text(mg.sql_handle) t
ORDER BY mg.requested_memory_kb DESC;
""".strip(),
    ),

    # ── Disk & IO ────────────────────────────────────────────────────────────
    DBAScript(
        id="storage-001",
        name="Dosya Bazında Disk Gecikmesi (IO Stall Latency)",
        category="Disk & IO",
        description="sys.dm_io_virtual_file_stats üzerinden veri ve log dosyalarının okuma/yazma gecikmelerini (ms/stall) hesaplar.",
        risk_level="read_only",
        tags=["disk", "io", "stall", "gecikme", "latency", "storage"],
        min_sql_version="2008",
        sql="""
SELECT 
    DB_NAME(vfs.database_id) AS database_name,
    mf.name AS file_name,
    mf.type_desc AS file_type,
    mf.physical_name,
    CASE WHEN vfs.num_of_reads = 0 THEN 0 ELSE (vfs.io_stall_read_ms / vfs.num_of_reads) END AS read_latency_ms,
    CASE WHEN vfs.num_of_writes = 0 THEN 0 ELSE (vfs.io_stall_write_ms / vfs.num_of_writes) END AS write_latency_ms,
    CASE 
        WHEN (vfs.io_stall_read_ms / NULLIF(vfs.num_of_reads, 0)) > 20 THEN 'Kritik Okuma Gecikmesi (>20ms)'
        WHEN (vfs.io_stall_write_ms / NULLIF(vfs.num_of_writes, 0)) > 20 THEN 'Kritik Yazma Gecikmesi (>20ms)'
        ELSE 'Normal'
    END AS latency_status
FROM sys.dm_io_virtual_file_stats(NULL, NULL) vfs
JOIN sys.master_files mf ON vfs.database_id = mf.database_id AND vfs.file_id = mf.file_id
ORDER BY (vfs.io_stall_read_ms + vfs.io_stall_write_ms) DESC;
""".strip(),
    ),
    DBAScript(
        id="storage-002",
        name="Sanal Log Dosyaları (VLF) Parçalanma Analizi",
        category="Disk & IO",
        description="sys.dm_db_log_info ile veritabanlarının Transaction Log (LDF) dosyalarındaki VLF sayılarını ve aktif/inaktif oranlarını gösterir.",
        risk_level="read_only",
        tags=["disk", "log", "vlf", "parcalanma", "ldf", "virtual log file"],
        min_sql_version="2016 SP2",
        sql="""
SELECT 
    d.name AS database_name,
    d.recovery_model_desc,
    d.log_reuse_wait_desc,
    COUNT(li.vlf_sequence_number) AS vlf_count,
    SUM(CASE WHEN li.vlf_status = 2 THEN 1 ELSE 0 END) AS active_vlf_count,
    SUM(CASE WHEN li.vlf_status != 2 THEN 1 ELSE 0 END) AS inactive_vlf_count,
    CAST(ROUND(SUM(li.vlf_size_mb), 2) AS FLOAT) AS total_log_size_mb,
    CASE 
        WHEN COUNT(li.vlf_sequence_number) > 1000 THEN 'Kritik Parçalanma (>1000 VLF)'
        WHEN COUNT(li.vlf_sequence_number) > 500 THEN 'Uyarı (500-1000 VLF)'
        ELSE 'Sağlıklı'
    END AS vlf_health
FROM sys.databases d
CROSS APPLY sys.dm_db_log_info(d.database_id) li
GROUP BY d.name, d.recovery_model_desc, d.log_reuse_wait_desc
ORDER BY vlf_count DESC;
""".strip(),
    ),
    DBAScript(
        id="storage-003",
        name="Log Kesilmesini Engelleyen Sebepler (log_reuse_wait)",
        category="Disk & IO",
        description="Transaction Log dosyasının küçültülmesini veya üzerine yazılmasını engelleyen kök nedenleri listeler.",
        risk_level="read_only",
        tags=["disk", "log", "log_reuse_wait", "truncate", "shrink"],
        min_sql_version="2008",
        sql="""
SELECT 
    name AS database_name,
    recovery_model_desc AS recovery_model,
    log_reuse_wait_desc,
    CASE 
        WHEN log_reuse_wait_desc = 'NOTHING' THEN 'Log kesilmesini engelleyen durum yok.'
        WHEN log_reuse_wait_desc = 'ACTIVE_TRANSACTION' THEN 'Açık kalan uncommitted işlem log truncate edilmesini engelliyor.'
        WHEN log_reuse_wait_desc = 'LOG_BACKUP' THEN 'Log yedeği (BACKUP LOG) alınması gerekiyor.'
        WHEN log_reuse_wait_desc = 'REPLICATION' THEN 'Replikasyon log okuyucu ajanı bekleniyor.'
        WHEN log_reuse_wait_desc = 'AVAILABILITY_GROUP' THEN 'Always On ikincil replika senkronizasyonu bekleniyor.'
        WHEN log_reuse_wait_desc = 'CHECKPOINT' THEN 'Simple modelde Checkpoint işlemi bekleniyor.'
        ELSE 'Özel sebep: ' + log_reuse_wait_desc
    END AS explanation
FROM sys.databases
WHERE database_id > 4
ORDER BY log_reuse_wait_desc;
""".strip(),
    ),

    # ── Veri Bütünlüğü & Kurtarma ────────────────────────────────────────────
    DBAScript(
        id="integrity-001",
        name="Fiziksel Disk Bozulmaları ve Hasarlı Sayfa Radarı (suspect_pages)",
        category="Veri Bütünlüğü",
        description="msdb.dbo.suspect_pages tablosunda 823/824 I/O sağlama hatalarıyla işaretlenmiş hasarlı 8KB veri sayfalarını listeler.",
        risk_level="read_only",
        tags=["butunluk", "suspect_pages", "corruption", "824", "823", "hasarli sayfa"],
        min_sql_version="2008",
        sql="""
SELECT 
    DB_NAME(sp.database_id) AS database_name,
    sp.file_id,
    sp.page_id,
    sp.event_type,
    CASE sp.event_type
        WHEN 1 THEN '823 (İşletim Sistemi / Disk I/O Hatası)'
        WHEN 2 THEN '824 (Bozuk Veri Sayfası / Checksum Hatası)'
        WHEN 3 THEN 'Yırtık Sayfa (Torn Page)'
        WHEN 4 THEN 'Geri Yüklendi (Restored)'
        WHEN 5 THEN 'Onarıldı (Repaired)'
        WHEN 7 THEN 'Sayfa Başarıyla Yeniden Okundu'
        ELSE 'Bilinmeyen Hata Kodu'
    END AS event_desc,
    sp.error_count,
    sp.last_update_date
FROM msdb.dbo.suspect_pages sp
ORDER BY sp.last_update_date DESC;
""".strip(),
    ),
    DBAScript(
        id="integrity-002",
        name="DBCC CHECKDB Son Başarılı Bütünlük Denetim Tarihleri",
        category="Veri Bütünlüğü",
        description="Her veritabanında DBCC CHECKDB bütünlük kontrolünün en son ne zaman hatasız çalıştığını dbi_dbccLastKnownGood ile denetler.",
        risk_level="read_only",
        tags=["butunluk", "checkdb", "integrity", "last known good"],
        min_sql_version="2008",
        sql="""
CREATE TABLE #DbccDates (
    DatabaseName NVARCHAR(128),
    Field VARCHAR(50),
    Value VARCHAR(100)
);

EXEC sp_MSforeachdb '
IF ''?'' NOT IN (''tempdb'')
BEGIN
    INSERT INTO #DbccDates (Field, Value)
    EXEC (''DBCC DBINFO (''''?'''') WITH TABLERESULTS, NO_INFOMSGS'');
    UPDATE #DbccDates SET DatabaseName = ''?'' WHERE DatabaseName IS NULL;
END
';

SELECT 
    DatabaseName,
    TRY_CAST(Value AS DATETIME) AS LastSuccessfulCheckdb,
    DATEDIFF(DAY, TRY_CAST(Value AS DATETIME), GETDATE()) AS DaysSinceLastCheckdb,
    CASE 
        WHEN Value = '1900-01-01 00:00:00.000' OR Value IS NULL THEN 'Kritik: Hiç CHECKDB Yapılmamış!'
        WHEN DATEDIFF(DAY, TRY_CAST(Value AS DATETIME), GETDATE()) > 7 THEN 'Uyarı: Son 7 Gündür CHECKDB Çalışmamış'
        ELSE 'Sağlıklı'
    END AS integrity_status
FROM #DbccDates
WHERE Field = 'dbi_dbccLastKnownGood';

DROP TABLE #DbccDates;
""".strip(),
    ),

    # ── Bekleme İstatistikleri ───────────────────────────────────────────────
    DBAScript(
        id="waits-001",
        name="En Yüksek Kaynak Beklemeleri (Top Wait Stats)",
        category="Bekleme İstatistikleri",
        description="sys.dm_os_wait_stats üzerinden önemsiz kuyruk beklemelerini eleyerek sisteme en çok zaman kaybettiren bekleme türlerini ve yüzdelerini gösterir.",
        risk_level="read_only",
        tags=["bekleme", "wait stats", "cxpacket", "pageiolatch", "performans"],
        min_sql_version="2008",
        sql="""
WITH Waits AS (
    SELECT 
        wait_type,
        wait_time_ms / 1000.0 AS wait_time_s,
        (wait_time_ms - signal_wait_time_ms) / 1000.0 AS resource_wait_s,
        signal_wait_time_ms / 1000.0 AS signal_wait_s,
        waiting_tasks_count,
        100.0 * wait_time_ms / SUM(wait_time_ms) OVER() AS percentage
    FROM sys.dm_os_wait_stats
    WHERE wait_type NOT IN (
        'CLR_SEMAPHORE', 'LAZYWRITER_SLEEP', 'RESOURCE_QUEUE', 'SLEEP_TASK',
        'SLEEP_SYSTEMTASK', 'SQLTRACE_BUFFER_FLUSH', 'WAITFOR', 'LOGMGR_QUEUE',
        'CHECKPOINT_QUEUE', 'REQUEST_FOR_DEADLOCK_SEARCH', 'XE_TIMER_EVENT',
        'BROKER_TO_FLUSH', 'BROKER_TASK_STOP', 'CLR_MANUAL_EVENT',
        'CLR_AUTO_EVENT', 'DISPATCHER_QUEUE_SEMAPHORE', 'FT_IFTS_SCHEDULER_IDLE_WAIT',
        'XE_DISPATCHER_WAIT', 'XE_DISPATCHER_JOIN', 'SQLTRACE_INCREMENTAL_FLUSH_SLEEP'
    )
)
SELECT TOP 15
    wait_type,
    CAST(ROUND(wait_time_s, 2) AS FLOAT) AS wait_time_s,
    CAST(ROUND(resource_wait_s, 2) AS FLOAT) AS resource_wait_s,
    CAST(ROUND(signal_wait_s, 2) AS FLOAT) AS signal_wait_s,
    waiting_tasks_count,
    CAST(ROUND(percentage, 2) AS FLOAT) AS percentage
FROM Waits
WHERE percentage > 0.5
ORDER BY wait_time_s DESC;
""".strip(),
    ),
    DBAScript(
        id="waits-002",
        name="Extended Events (system_health) Son Deadlock XML Analizi",
        category="Bekleme İstatistikleri",
        description="Varsayılan system_health oturumunun ring buffer alanından son gerçekleşen kilitlenme (deadlock) grafiklerini ve XML detaylarını çıkarır.",
        risk_level="read_only",
        tags=["deadlock", "kilitlenme", "system_health", "xevent", "xml_deadlock_report"],
        min_sql_version="2008 R2",
        sql="""
SELECT 
    CAST(event_data AS XML).value('(/event/@timestamp)[1]', 'DATETIME2') AS deadlock_timestamp,
    CAST(event_data AS XML).query('/event/data[@name="xml_report"]/value/deadlock') AS deadlock_graph_xml
FROM sys.fn_xe_file_target_read_file('system_health*.xel', NULL, NULL, NULL)
WHERE object_name = 'xml_deadlock_report'
ORDER BY deadlock_timestamp DESC;
""".strip(),
    ),

    # ── Güvenlik ─────────────────────────────────────────────────────────────
    DBAScript(
        id="security-001",
        name="Sysadmin ve Sunucu Rolü Üyeleri Denetimi",
        category="Güvenlik",
        description="sysadmin, serveradmin ve securityadmin gibi yüksek yetkili sunucu rollerine atanmış hesapları ve tipini (SQL/Windows) listeler.",
        risk_level="read_only",
        tags=["guvenlik", "sysadmin", "server role", "yetki", "audit"],
        min_sql_version="2008",
        sql="""
SELECT 
    r.name AS server_role,
    m.name AS member_login,
    m.type_desc AS login_type,
    m.is_disabled,
    m.create_date,
    m.modify_date
FROM sys.server_role_members rm
JOIN sys.server_principals r ON rm.role_principal_id = r.principal_id
JOIN sys.server_principals m ON rm.member_principal_id = m.principal_id
ORDER BY r.name, m.name;
""".strip(),
    ),
    DBAScript(
        id="security-002",
        name="Yetim Kullanıcılar (Orphaned Users - SID Uyuşmazlığı)",
        category="Güvenlik",
        description="Veritabanı kullanıcısı olup master veritabanında karşılık gelen sunucu login'i bulunmayan sahipsiz hesapları listeler.",
        risk_level="read_only",
        tags=["guvenlik", "orphaned users", "yetim kullanici", "sid mismatch"],
        min_sql_version="2008",
        sql="""
SELECT 
    dp.name AS database_user,
    dp.type_desc,
    dp.create_date,
    'ALTER USER [' + dp.name + '] WITH LOGIN = [' + dp.name + '];' AS repair_sql
FROM sys.database_principals dp
LEFT JOIN sys.server_principals sp ON dp.sid = sp.sid
WHERE dp.type IN ('S', 'U', 'G')
  AND dp.authentication_type = 1
  AND sp.sid IS NULL
  AND dp.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys', 'without login');
""".strip(),
    ),
    DBAScript(
        id="security-003",
        name="Parola Politikası (CHECK_POLICY) Kapalı SQL Login'leri",
        category="Güvenlik",
        description="Windows şifre karmaşıklığı denetimi (CHECK_POLICY) veya süre sonu denetimi (CHECK_EXPIRATION) kapalı olan SQL kimlik doğrulamalı hesapları listeler.",
        risk_level="read_only",
        tags=["guvenlik", "check_policy", "password", "parola", "guvenlik riski"],
        min_sql_version="2008",
        sql="""
SELECT 
    name AS login_name,
    is_disabled,
    is_policy_checked,
    is_expiration_checked,
    create_date,
    modify_date,
    'ALTER LOGIN [' + name + '] WITH CHECK_POLICY = ON, CHECK_EXPIRATION = ON;' AS hardening_sql
FROM sys.sql_logins
WHERE is_policy_checked = 0 OR is_expiration_checked = 0
ORDER BY is_policy_checked ASC, name;
""".strip(),
    ),

    # ── SQL Agent & Bakım ────────────────────────────────────────────────────
    DBAScript(
        id="agent-001",
        name="Son 24 Saatte Hata Alan SQL Server Agent Adımları",
        category="SQL Agent",
        description="msdb.dbo.sysjobhistory üzerinden son 24 saat içinde hata alan işleri, başarısız adımları ve hata mesajlarını listeler.",
        risk_level="read_only",
        tags=["agent", "jobs", "hata", "failed jobs", "sysjobhistory"],
        min_sql_version="2008",
        sql="""
SELECT 
    j.name AS job_name,
    h.step_name,
    h.step_id,
    msdb.dbo.agent_datetime(h.run_date, h.run_time) AS failure_time,
    h.run_duration AS duration_hhmmss,
    h.sql_severity,
    h.message AS error_message
FROM msdb.dbo.sysjobhistory h
JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
WHERE h.run_status = 0 -- 0 = Failed
  AND msdb.dbo.agent_datetime(h.run_date, h.run_time) >= DATEADD(HOUR, -24, GETDATE())
ORDER BY failure_time DESC;
""".strip(),
    ),
    DBAScript(
        id="agent-002",
        name="SQL Server Kritik Sistem Alarmları (sysalerts - Severity 17-25)",
        category="SQL Agent",
        description="msdb.dbo.sysalerts tablosunda kritik donanım, bozulma (823, 824, 825) ve kaynak tükenme alarmlarının tanımlı olup olmadığını denetler.",
        risk_level="read_only",
        tags=["agent", "alerts", "sysalerts", "severity", "donanim hatasi"],
        min_sql_version="2008",
        sql="""
SELECT 
    name AS alert_name,
    event_source,
    message_id,
    severity,
    enabled,
    delay_between_responses AS delay_seconds,
    last_occurrence_date,
    last_occurrence_time,
    occurrence_count
FROM msdb.dbo.sysalerts
ORDER BY severity DESC, message_id;
""".strip(),
    ),
] + EXTENDED_SCRIPTS


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
        "Bellek & Önbellek": "Buffer Pool dağılımı, PLE bellek ömrü, Plan Cache şişmesi ve bellek hibelerini (grants) analiz edin.",
        "Disk & IO": "Veri ve log dosyası disk gecikmelerini (stalls), VLF parçalanmasını ve log kesilme engellerini denetleyin.",
        "Veri Bütünlüğü": "Fiziksel bozuk sayfa radarı (suspect_pages) ve DBCC CHECKDB son başarılı çalışma geçmişini inceleyin.",
        "Bekleme İstatistikleri": "Sunucu genelindeki en yüksek kaynak beklemelerini ve ring buffer deadlock grafiklerini analiz edin.",
        "Güvenlik": "Sysadmin yetkili hesapları, yetim kullanıcıları ve zayıf parola politikalarını denetleyin.",
        "SQL Agent": "Son 24 saatte hata alan SQL Agent adımlarını ve kritik sistem hata alarmlarını (sysalerts) izleyin.",
        "Yüksek Erişilebilirlik": "Always On Availability Groups senkronizasyon gecikmesini, redo kuyruklarını ve failover hazırlığını denetleyin.",
    }
    return [
        ScriptCategory(name=cat, description=category_descs.get(cat, ""), script_count=cnt)
        for cat, cnt in sorted(counts.items())
    ]
