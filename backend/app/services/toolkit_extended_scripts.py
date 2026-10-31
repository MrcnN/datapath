"""services/toolkit_extended_scripts.py — Extended enterprise DBA script library."""
from __future__ import annotations

from typing import List
from app.schemas.toolkit import DBAScript

EXTENDED_SCRIPTS: List[DBAScript] = [
    # ── Yüksek Erişilebilirlik ───────────────────────────────────────────────
    DBAScript(
        id="ha-001",
        name="Always On Senkronizasyon Gecikmesi & Redo Kuyruğu",
        category="Yüksek Erişilebilirlik",
        description="Always On replikaları arasındaki log gönderme (send rate), redo kuyruk boyutu ve tahmini veri kaybı (RPO) gecikmesini hesaplar.",
        risk_level="read_only",
        tags=["always-on", "ha", "senkronizasyon", "redo-queue", "rpo"],
        min_sql_version="2012",
        sql="""
SELECT
    ag.name AS ag_name,
    ar.replica_server_name,
    d.name AS database_name,
    drs.synchronization_state_desc,
    drs.synchronization_health_desc,
    drs.log_send_queue_size AS log_send_queue_kb,
    drs.log_send_rate AS log_send_rate_kb_sec,
    drs.redo_queue_size AS redo_queue_kb,
    drs.redo_rate AS redo_rate_kb_sec,
    drs.secondary_lag_seconds
FROM sys.dm_hadr_database_replica_states drs
JOIN sys.availability_groups ag ON ag.group_id = drs.group_id
JOIN sys.availability_replicas ar ON ar.replica_id = drs.replica_id
JOIN sys.databases d ON d.database_id = drs.database_id
ORDER BY ag.name, ar.replica_server_name, d.name;
""".strip(),
    ),
    DBAScript(
        id="ha-002",
        name="Always On Otomatik Failover Hazırlığı & Lease Sağlığı",
        category="Yüksek Erişilebilirlik",
        description="Senkron modda çalışan replikaların failover hazırlık durumunu ve cluster lease timeout sağlığını denetler.",
        risk_level="read_only",
        tags=["always-on", "failover", "lease", "health", "cluster"],
        min_sql_version="2012",
        sql="""
SELECT
    ag.name AS ag_name,
    ar.replica_server_name,
    ar.availability_mode_desc,
    ar.failover_mode_desc,
    ags.primary_replica,
    ags.synchronization_health_desc,
    ags.recovery_health_desc
FROM sys.availability_groups ag
JOIN sys.availability_replicas ar ON ar.group_id = ag.group_id
JOIN sys.dm_hadr_availability_group_states ags ON ags.group_id = ag.group_id
ORDER BY ag.name;
""".strip(),
    ),
    # ── Veritabanı Dosyaları & TempDB ─────────────────────────────────────────
    DBAScript(
        id="tempdb-001",
        name="TempDB Sayfa Tahsis Mandallanması (PFS/GAM/SGAM Latch)",
        category="Veritabanı Dosyaları",
        description="TempDB veri dosyalarındaki PFS, GAM ve SGAM sayfa mandallanmalarını (PAGELATCH_UP/EX) ve bekleyen oturumları yakalar.",
        risk_level="read_only",
        tags=["tempdb", "pfs", "gam", "sgam", "latch", "mandallanma"],
        min_sql_version="2008",
        sql="""
SELECT
    wt.session_id,
    wt.wait_duration_ms,
    wt.wait_type,
    wt.resource_description,
    r.command,
    SUBSTRING(t.text, (r.statement_start_offset/2)+1,
        (((CASE r.statement_end_offset WHEN -1 THEN DATALENGTH(t.text) ELSE r.statement_end_offset END) - r.statement_start_offset)/2)+1) AS query_text
FROM sys.dm_os_waiting_tasks wt
JOIN sys.dm_exec_requests r ON r.session_id = wt.session_id
OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE wt.wait_type LIKE 'PAGELATCH_%'
  AND wt.resource_description LIKE '2:%'
ORDER BY wt.wait_duration_ms DESC;
""".strip(),
    ),
    DBAScript(
        id="tempdb-002",
        name="TempDB Oturum ve İç Nesne Alan Tüketimi",
        category="Veritabanı Dosyaları",
        description="TempDB'de geçici tablo (#temp) ve internal sort/hash nesneleriyle disk alanını tüketen oturumları sıralar.",
        risk_level="read_only",
        tags=["tempdb", "alan", "tuketim", "space", "internal-objects"],
        min_sql_version="2008",
        sql="""
SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.program_name,
    (su.user_objects_alloc_page_count - su.user_objects_dealloc_page_count) * 8 / 1024 AS user_objects_net_mb,
    (su.internal_objects_alloc_page_count - su.internal_objects_dealloc_page_count) * 8 / 1024 AS internal_objects_net_mb,
    s.status
FROM sys.dm_db_session_space_usage su
JOIN sys.dm_exec_sessions s ON s.session_id = su.session_id
WHERE (su.user_objects_alloc_page_count - su.user_objects_dealloc_page_count) > 0
   OR (su.internal_objects_alloc_page_count - su.internal_objects_dealloc_page_count) > 0
ORDER BY (su.user_objects_alloc_page_count - su.user_objects_dealloc_page_count +
          su.internal_objects_alloc_page_count - su.internal_objects_dealloc_page_count) DESC;
""".strip(),
    ),
    # ── Disk & IO ─────────────────────────────────────────────────────────────
    DBAScript(
        id="storage-004",
        name="Transaction Log Alan Tüketimi & Log Kesilme Engeli (log_reuse_wait)",
        category="Disk & IO",
        description="Her veritabanının transaction log doluluk oranını ve log kesilmesini durduran kök nedeni listeler.",
        risk_level="read_only",
        tags=["log", "ldf", "log_reuse_wait", "truncation", "kesilme"],
        min_sql_version="2012",
        sql="""
SELECT
    d.name AS database_name,
    d.recovery_model_desc,
    d.log_reuse_wait_desc,
    ls.total_log_size_in_bytes / 1024 / 1024 AS total_log_mb,
    ls.used_log_space_in_bytes / 1024 / 1024 AS used_log_mb,
    ls.used_log_space_in_percent
FROM sys.databases d
CROSS APPLY sys.dm_db_log_space_usage ls
WHERE d.database_id = ls.database_id
ORDER BY ls.used_log_space_in_percent DESC;
""".strip(),
    ),
    DBAScript(
        id="storage-005",
        name="Acil Durum Transaction Log Küçültme & Güvenli Büyütme Reçetesi",
        category="Disk & IO",
        description="Şişmiş transaction log dosyasını disk taşması krizinde güvenle küçültmek ve VLF patlamasını önleyecek uygun boyutta büyütmek için dinamik T-SQL üretir.",
        risk_level="caution",
        tags=["shrink", "log", "ldf", "vlf", "acil-durum", "shrinkfile"],
        min_sql_version="2008",
        sql="""
-- ⚠️ REVIEW-ONLY GÜVENLİK UYARISI: Canlı ortamda çalıştırmadan önce LOG yedeklemesi alındığından emin olun.
SELECT
    d.name AS database_name,
    mf.name AS logical_log_name,
    mf.physical_name,
    mf.size * 8 / 1024 AS current_size_mb,
    'BACKUP LOG [' + d.name + '] TO DISK = ''NUL:'' -- ya da kurumsal yedek dizinine' AS step1_log_backup,
    'USE [' + d.name + ']; DBCC SHRINKFILE (N''' + mf.name + ''' , 1024);' AS step2_shrink_to_1gb,
    'ALTER DATABASE [' + d.name + '] MODIFY FILE (NAME = N''' + mf.name + ''', FILEGROWTH = 512MB);' AS step3_fix_autogrowth
FROM sys.master_files mf
JOIN sys.databases d ON d.database_id = mf.database_id
WHERE mf.type_desc = 'LOG'
  AND d.database_id > 4;
""".strip(),
    ),
    # ── Performans & Query Store ──────────────────────────────────────────────
    DBAScript(
        id="perf-001",
        name="Ad-Hoc Plan Cache Eviction & Tek Sorgu Recompile Reçetesi",
        category="Query Store",
        description="Tüm önbelleği sıfırlamadan, yalnızca problemli ve gerileyen sorgunun derleme planını hafızadan düşüren (eviction) cerrahi T-SQL reçetesi.",
        risk_level="caution",
        tags=["plan-cache", "recompile", "eviction", "free-proc-cache", "plan"],
        min_sql_version="2008",
        sql="""
SELECT TOP 20
    qs.execution_count,
    qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_ms,
    qs.total_elapsed_time / qs.execution_count / 1000 AS avg_duration_ms,
    qs.plan_handle,
    'DBCC FREEPROCCACHE (' + sys.fn_varbintohexstr(qs.plan_handle) + '); -- Tek planı önbellekten düşürür' AS eviction_tsql,
    SUBSTRING(st.text, 1, 300) AS query_preview
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY qs.total_worker_time DESC;
""".strip(),
    ),
    DBAScript(
        id="perf-002",
        name="Örtük Veri Tipi Dönüşümü (CONVERT_IMPLICIT) Anti-Deseni",
        category="İndeks Analizi",
        description="WHERE koşullarındaki örtük tip dönüşümü nedeniyle Index Seek yerine Index Scan yapıp CPU'yu kilitleyen sorguları ve plan uyarılarını yakalar.",
        risk_level="read_only",
        tags=["convert-implicit", "veri-tipi", "index-scan", "anti-pattern", "cpu"],
        min_sql_version="2008",
        sql="""
SELECT TOP 15
    qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_ms,
    qs.execution_count,
    SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
        (((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END) - qs.statement_start_offset)/2)+1) AS query_text,
    qp.query_plan
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
WHERE CAST(qp.query_plan AS NVARCHAR(MAX)) LIKE '%PlanAffectingConvert%'
   OR CAST(qp.query_plan AS NVARCHAR(MAX)) LIKE '%CONVERT_IMPLICIT%'
ORDER BY qs.total_worker_time DESC;
""".strip(),
    ),
    # ── Bellek & Önbellek ─────────────────────────────────────────────────────
    DBAScript(
        id="memory-005",
        name="Memory Clerks Bellek Tüketim Dökümü",
        category="Bellek & Önbellek",
        description="SQL Server içindeki en büyük bellek tüketen motor parçalarını (Buffer Pool, SQL General, Lock Manager, XML, CLR) sıralar.",
        risk_level="read_only",
        tags=["memory-clerks", "ram", "bellek", "buffer-pool", "hafiza"],
        min_sql_version="2008",
        sql="""
SELECT TOP 15
    type AS clerk_type,
    SUM(pages_kb) / 1024 AS allocated_mb,
    SUM(virtual_memory_committed_kb) / 1024 AS virtual_committed_mb
FROM sys.dm_os_memory_clerks
GROUP BY type
ORDER BY SUM(pages_kb) DESC;
""".strip(),
    ),
    DBAScript(
        id="memory-006",
        name="Sayfa Yaşam Beklentisi (PLE) Düşüş Radarı & Buffer Çalkantısı",
        category="Bellek & Önbellek",
        description="NUMA node bazında Page Life Expectancy (PLE) değerini ölçer; 300 saniyenin altına inen bellek baskısını ve buffer çalkantısını raporlar.",
        risk_level="read_only",
        tags=["ple", "page-life-expectancy", "numa", "bellek-baskisi", "churn"],
        min_sql_version="2008",
        sql="""
SELECT
    instance_name AS numa_node,
    cntr_value AS page_life_expectancy_sec,
    CASE
        WHEN cntr_value < 300 THEN 'KRİTİK (Şiddetli RAM Yetersizliği / Çalkantı)'
        WHEN cntr_value < 1000 THEN 'UYARI (Bellek Baskısı Gözleniyor)'
        ELSE 'SAĞLIKLI'
    END AS status_assessment
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Page life expectancy'
  AND object_name LIKE '%Buffer Node%';
""".strip(),
    ),
    # ── Veri Bütünlüğü ────────────────────────────────────────────────────────
    DBAScript(
        id="integrity-003",
        name="Acil Durum Tek Sayfa Kurtarma Reçetesi (Online Page Restore)",
        category="Veri Bütünlüğü",
        description="Bozulan 8KB'lık tek bir veri sayfasını (Error 824) tüm veritabanını offline etmeden log yedekleriyle online kurtaran T-SQL reçetesi üretir.",
        risk_level="caution",
        tags=["page-restore", "suspect-pages", "824", "bozulma", "kurtarma", "dbcc"],
        min_sql_version="2008",
        sql="""
-- ⚠️ REVIEW-ONLY REÇETE: Suspect pages tablosundaki bozuk sayfaları kurtarma rehberi
SELECT
    sp.database_id,
    DB_NAME(sp.database_id) AS database_name,
    sp.file_id,
    sp.page_id,
    sp.event_type,
    'RESTORE DATABASE [' + DB_NAME(sp.database_id) + '] PAGE = ''' + CAST(sp.file_id AS VARCHAR) + ':' + CAST(sp.page_id AS VARCHAR) + ''' FROM DISK = ''C:\\Backups\\' + DB_NAME(sp.database_id) + '_Full.bak'' WITH NORECOVERY;' AS step1_restore_page,
    'BACKUP LOG [' + DB_NAME(sp.database_id) + '] TO DISK = ''C:\\Backups\\' + DB_NAME(sp.database_id) + '_TailLog.trn'';' AS step2_tail_log_backup,
    'RESTORE LOG [' + DB_NAME(sp.database_id) + '] FROM DISK = ''C:\\Backups\\' + DB_NAME(sp.database_id) + '_TailLog.trn'' WITH RECOVERY;' AS step3_restore_tail
FROM msdb.dbo.suspect_pages sp;
""".strip(),
    ),
    # ── Güvenlik ──────────────────────────────────────────────────────────────
    DBAScript(
        id="security-004",
        name="Sunucu ve Veritabanı Düzeyi Ayrıcalıklı Rol Üyeleri",
        category="Güvenlik",
        description="sysadmin, securityadmin ve db_owner rollerine atanmış tüm Windows/SQL kullanıcılarını ve yetki yükseltme yollarını denetler.",
        risk_level="read_only",
        tags=["sysadmin", "roller", "guvenlik", "ayricalik", "securityadmin", "db_owner"],
        min_sql_version="2008",
        sql="""
SELECT
    r.name AS server_role,
    m.name AS member_principal_name,
    m.type_desc AS principal_type,
    m.is_disabled
FROM sys.server_role_members srm
JOIN sys.server_principals r ON r.principal_id = srm.role_principal_id
JOIN sys.server_principals m ON m.principal_id = srm.member_principal_id
ORDER BY r.name, m.name;
""".strip(),
    ),
    # ── Yapılandırma ──────────────────────────────────────────────────────────
    DBAScript(
        id="config-005",
        name="Maksimum Bellek (max server memory) ve Paralellik (MAXDOP) Analizi",
        category="Yapılandırma",
        description="max server memory, cost threshold for parallelism ve MAXDOP ayarlarının donanıma göre en iyi DBA pratiklerine uygunluğunu analiz eder.",
        risk_level="read_only",
        tags=["max-server-memory", "maxdop", "parallelism", "best-practice", "yapilandirma"],
        min_sql_version="2008",
        sql="""
SELECT
    name AS config_name,
    value AS configured_value,
    value_in_use AS running_value,
    description
FROM sys.configurations
WHERE name IN (
    'max server memory (MB)',
    'min server memory (MB)',
    'max degree of parallelism',
    'cost threshold for parallelism',
    'optimize for ad hoc workloads',
    'backup compression default'
)
ORDER BY name;
""".strip(),
    ),
]
