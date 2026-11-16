"""services/maintenance_generator_service.py — Ola Hallengren & Native Maintenance Agent Job Generator."""
from __future__ import annotations

import logging
from typing import List, Optional
import pyodbc

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.maintenance_generator import (
    CommandLogEntry,
    MaintenanceInstalledComponent,
    MaintenanceExistingJob,
    MaintenanceStatusResponse,
    MaintenanceJobGenerateRequest,
    MaintenanceJobScriptResponse,
)

logger = logging.getLogger(__name__)

OLA_TARGET_COMPONENTS = [
    {"name": "DatabaseBackup", "type": "STORED_PROCEDURE"},
    {"name": "DatabaseIntegrityCheck", "type": "STORED_PROCEDURE"},
    {"name": "IndexOptimize", "type": "STORED_PROCEDURE"},
    {"name": "CommandExecute", "type": "STORED_PROCEDURE"},
    {"name": "CommandLog", "type": "USER_TABLE"},
]


def get_maintenance_status(params: ConnectionParams, target_db: str = "master") -> MaintenanceStatusResponse:
    """Inspect whether Ola Hallengren maintenance components and SQL Agent jobs are configured."""
    components: List[MaintenanceInstalledComponent] = []
    recent_executions: List[CommandLogEntry] = []
    existing_jobs: List[MaintenanceExistingJob] = []
    has_command_log = False
    recent_errors_count = 0
    sql_edition = "Standard"
    supports_online = False
    supports_resumable = False
    target_database = target_db or "master"

    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()

            # 1. Inspect Engine Edition & Version
            try:
                cursor.execute("""
                SELECT 
                    CAST(SERVERPROPERTY('EngineEdition') AS INT) AS edition_id,
                    CAST(SERVERPROPERTY('ProductMajorVersion') AS INT) AS major_ver,
                    CAST(SERVERPROPERTY('Edition') AS VARCHAR(100)) AS edition_name
                """)
                row = cursor.fetchone()
                if row:
                    ed_id = row[0] or 2
                    major_ver = row[1] or 13
                    sql_edition = str(row[2] or "Standard")
                    # 3 = Enterprise, 5 = Azure SQL Database / Hyperscale
                    supports_online = ed_id in (3, 5) or "Enterprise" in sql_edition or "Developer" in sql_edition
                    supports_resumable = supports_online and (major_ver >= 14)
            except Exception as e:
                logger.warning("Error detecting SQL edition: %s", e)

            # 2. Check existence of Ola objects in target_database and master
            db_to_check = target_database if target_database != "master" else "master"
            for comp in OLA_TARGET_COMPONENTS:
                c_name = comp["name"]
                c_type = "P" if comp["type"] == "STORED_PROCEDURE" else "U"
                check_sql = f"""
                SELECT 
                    name, 
                    type_desc, 
                    CONVERT(VARCHAR(19), create_date, 120) AS create_date,
                    CONVERT(VARCHAR(19), modify_date, 120) AS modify_date
                FROM [{db_to_check}].sys.objects 
                WHERE name = ? AND type = ?;
                """
                try:
                    cursor.execute(check_sql, (c_name, c_type))
                    found = cursor.fetchone()
                    if found:
                        components.append(MaintenanceInstalledComponent(
                            name=c_name,
                            database=db_to_check,
                            object_type=comp["type"],
                            create_date=found[2],
                            modify_date=found[3],
                            is_installed=True,
                        ))
                        if c_name == "CommandLog":
                            has_command_log = True
                    else:
                        components.append(MaintenanceInstalledComponent(
                            name=c_name,
                            database=db_to_check,
                            object_type=comp["type"],
                            is_installed=False,
                        ))
                except Exception as e:
                    logger.debug("Component check failed for %s: %s", c_name, e)
                    components.append(MaintenanceInstalledComponent(
                        name=c_name,
                        database=db_to_check,
                        object_type=comp["type"],
                        is_installed=False,
                    ))

            # 3. Query CommandLog if installed
            if has_command_log:
                try:
                    log_query = f"""
                    SELECT TOP 25
                        ID,
                        DatabaseName,
                        SchemaName,
                        ObjectName,
                        CommandType,
                        Command,
                        CONVERT(VARCHAR(19), StartTime, 120) AS StartTime,
                        CONVERT(VARCHAR(19), EndTime, 120) AS EndTime,
                        ISNULL(ErrorNumber, 0) AS ErrorNumber,
                        ErrorMessage
                    FROM [{db_to_check}].dbo.CommandLog
                    ORDER BY ID DESC;
                    """
                    cursor.execute(log_query)
                    rows = rows_to_dicts(cursor)
                    for r in rows:
                        err_num = int(r.get("ErrorNumber") or 0)
                        if err_num != 0:
                            recent_errors_count += 1
                        recent_executions.append(CommandLogEntry(
                            id=int(r.get("ID") or 0),
                            database_name=r.get("DatabaseName"),
                            schema_name=r.get("SchemaName"),
                            object_name=r.get("ObjectName"),
                            command_type=r.get("CommandType"),
                            command=r.get("Command"),
                            start_time=r.get("StartTime"),
                            end_time=r.get("EndTime"),
                            error_number=err_num,
                            error_message=r.get("ErrorMessage"),
                        ))
                except Exception as e:
                    logger.warning("Could not read CommandLog: %s", e)

            # 4. Check existing maintenance Agent Jobs in msdb
            try:
                jobs_query = """
                SELECT 
                    j.job_id,
                    j.name,
                    j.enabled,
                    j.description,
                    CONVERT(VARCHAR(19), j.date_created, 120) AS date_created,
                    CONVERT(VARCHAR(19), js.last_run_date, 120) AS last_run_date,
                    CASE js.last_run_outcome
                        WHEN 0 THEN 'FAILED'
                        WHEN 1 THEN 'SUCCESS'
                        WHEN 2 THEN 'RETRY'
                        WHEN 3 THEN 'CANCELED'
                        ELSE 'UNKNOWN'
                    END AS last_run_status
                FROM msdb.dbo.sysjobs j
                LEFT JOIN (
                    SELECT 
                        job_id,
                        MAX(run_date) AS last_run_date,
                        MAX(run_status) AS last_run_outcome
                    FROM msdb.dbo.sysjobhistory
                    WHERE step_id = 0
                    GROUP BY job_id
                ) js ON j.job_id = js.job_id
                WHERE j.name LIKE '%Backup%' 
                   OR j.name LIKE '%Index%' 
                   OR j.name LIKE '%Integrity%' 
                   OR j.name LIKE '%Maintenance%' 
                   OR j.name LIKE '%CheckDB%'
                   OR j.name LIKE '%Ola%'
                ORDER BY j.name ASC;
                """
                cursor.execute(jobs_query)
                jrows = rows_to_dicts(cursor)
                for jr in jrows:
                    existing_jobs.append(MaintenanceExistingJob(
                        job_id=str(jr.get("job_id") or ""),
                        name=str(jr.get("name") or ""),
                        enabled=bool(jr.get("enabled", 1)),
                        description=jr.get("description"),
                        date_created=jr.get("date_created"),
                        last_run_date=jr.get("last_run_date"),
                        last_run_status=jr.get("last_run_status") or "UNKNOWN",
                    ))
            except Exception as e:
                logger.warning("Could not query msdb.dbo.sysjobs: %s", e)

    except Exception as exc:
        logger.error("Failed to query maintenance status: %s", exc)

    installed_count = sum(1 for c in components if c.is_installed)
    is_ola_installed = installed_count >= 4  # 4 core stored procs

    return MaintenanceStatusResponse(
        is_ola_installed=is_ola_installed,
        target_database=target_database,
        components=components,
        installed_count=installed_count,
        total_components=len(OLA_TARGET_COMPONENTS),
        has_command_log=has_command_log,
        recent_errors_count=recent_errors_count,
        recent_executions=recent_executions,
        existing_maintenance_jobs=existing_jobs,
        sql_edition=sql_edition,
        supports_online_rebuild=supports_online,
        supports_resumable_rebuild=supports_resumable,
    )


def generate_maintenance_scripts(request: MaintenanceJobGenerateRequest) -> MaintenanceJobScriptResponse:
    """Generate production-ready, idempotent T-SQL scripts for Ola Hallengren or Native SQL Agent jobs."""
    target_db = request.target_database or "master"
    b_dir = request.backup_directory.replace("'", "''")
    ret_hours = request.backup_retention_hours
    compress = "Y" if request.backup_compress else "N"
    checksum = "Y" if request.backup_checksum else "N"
    verify = "Y" if request.backup_verify else "N"
    op_name = request.operator_name or "DBA_Operator"

    # Online & resumable flags for IndexOptimize
    frag_low = "NULL"
    frag_med = f"'INDEX_REORGANIZE,INDEX_REBUILD_ONLINE,INDEX_REBUILD_OFFLINE'" if request.online_rebuild else "'INDEX_REORGANIZE,INDEX_REBUILD_OFFLINE'"
    frag_high = f"'INDEX_REBUILD_ONLINE,INDEX_REBUILD_OFFLINE'" if request.online_rebuild else "'INDEX_REBUILD_OFFLINE'"
    resumable_val = "Y" if request.resumable_rebuild else "N"

    update_stats_flag = request.update_statistics if request.update_statistics != "NONE" else "NULL"
    only_modified_flag = "Y" if request.only_modified_statistics else "N"
    integrity_physical = "Y" if request.integrity_mode == "PHYSICAL_ONLY" else "N"

    job_names: List[str] = []

    if request.solution_type == "OLA_HALLENGREN":
        job_names = [
            "DatabaseBackup - USER_DATABASES - FULL",
            "DatabaseBackup - USER_DATABASES - DIFF",
            "DatabaseBackup - USER_DATABASES - LOG",
            "DatabaseBackup - SYSTEM_DATABASES - FULL",
            "DatabaseIntegrityCheck - USER_DATABASES",
            "IndexOptimize - USER_DATABASES",
            "Maintenance - CommandLog & JobHistory Cleanup",
        ]

        agent_jobs_script = f"""/*
================================================================================
 DATAPATH DATABASE INTELLIGENCE PLATFORM — SQL SERVER AGENT MAINTENANCE SUITE
 Çözüm: Ola Hallengren Maintenance Solution Entegrasyonu
 Hedef Veritabanı: [{target_db}]
 Yedekleme Dizini: {b_dir}
 Saklama Süresi: {ret_hours} saat
 Politika: Güvenli & İdempotent (Var olan işler güvenle güncellenir)
================================================================================
*/

USE [msdb];
GO

-- 1. Bildirim Operatörü Oluşturma (Gerekiyorsa)
IF NOT EXISTS (SELECT name FROM msdb.dbo.sysoperators WHERE name = N'{op_name}')
BEGIN
    EXEC msdb.dbo.sp_add_operator 
        @name = N'{op_name}', 
        @enabled = 1{f", @email_address = N'{request.operator_email}'" if request.operator_email else ""};
    PRINT 'Operatör [{op_name}] oluşturuldu.';
END;
GO

-- Ortak Değişkenler
DECLARE @jobId BINARY(16);
DECLARE @ReturnCode INT = 0;

--------------------------------------------------------------------------------
-- İŞ 1: DatabaseBackup - USER_DATABASES - FULL (Haftalık Pazar 01:00)
--------------------------------------------------------------------------------
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs_view WHERE name = N'DatabaseBackup - USER_DATABASES - FULL')
    EXEC msdb.dbo.sp_delete_job @job_name = N'DatabaseBackup - USER_DATABASES - FULL', @delete_unused_schedule = 1;

EXEC @ReturnCode = msdb.dbo.sp_add_job 
    @job_name = N'DatabaseBackup - USER_DATABASES - FULL', 
    @enabled = 1, 
    @notify_level_eventlog = 2, 
    @notify_level_email = {2 if request.operator_email else 0},
    @notify_email_operator_name = N'{op_name}',
    @description = N'Kullanıcı veritabanlarının tam (FULL) yedeklemesi, sıkıştırma ve sağlama toplamı kontrolü.', 
    @category_name = N'Database Maintenance', 
    @owner_login_name = N'sa', 
    @job_id = @jobId OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobId, 
    @step_name = N'DatabaseBackup - USER_DATABASES - FULL', 
    @step_id = 1, 
    @cmdexec_success_code = 0, 
    @on_success_action = 1, 
    @on_fail_action = 2, 
    @retry_attempts = 1, 
    @retry_interval = 5, 
    @os_run_priority = 0, 
    @subsystem = N'TSQL', 
    @command = N'EXECUTE [{target_db}].dbo.DatabaseBackup
    @Databases = ''USER_DATABASES'',
    @Directory = ''{b_dir}'',
    @BackupType = ''FULL'',
    @Verify = ''{verify}'',
    @CleanupTime = {ret_hours},
    @CheckSum = ''{checksum}'',
    @Compress = ''{compress}'',
    @LogToTable = ''Y'';', 
    @database_name = N'{target_db}', 
    @flags = 4;

-- Program: Her Pazar saat 01:00
EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobId, 
    @name = N'Schedule_Weekly_Sunday_0100', 
    @enabled = 1, 
    @freq_type = 8, -- Weekly
    @freq_interval = 1, -- Sunday
    @freq_recurrence_factor = 1, 
    @active_start_time = 010000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobId, @server_name = N'(local)';
PRINT 'İş oluşturuldu: DatabaseBackup - USER_DATABASES - FULL';
GO

--------------------------------------------------------------------------------
-- İŞ 2: DatabaseBackup - USER_DATABASES - DIFF (Hafta İçi Günlük 01:00)
--------------------------------------------------------------------------------
{"-- DIFF İşlemi Etkinleştirildi" if request.backup_diff_enabled else "/* DIFF İşlemi Atlandı */"}
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs_view WHERE name = N'DatabaseBackup - USER_DATABASES - DIFF')
    EXEC msdb.dbo.sp_delete_job @job_name = N'DatabaseBackup - USER_DATABASES - DIFF', @delete_unused_schedule = 1;

DECLARE @jobIdDiff BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'DatabaseBackup - USER_DATABASES - DIFF', 
    @enabled = {1 if request.backup_diff_enabled else 0}, 
    @notify_level_eventlog = 2, 
    @notify_level_email = {2 if request.operator_email else 0},
    @notify_email_operator_name = N'{op_name}',
    @description = N'Kullanıcı veritabanlarının günlük fark (DIFF) yedeklemesi.', 
    @category_name = N'Database Maintenance', 
    @owner_login_name = N'sa', 
    @job_id = @jobIdDiff OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobIdDiff, 
    @step_name = N'DatabaseBackup - USER_DATABASES - DIFF', 
    @step_id = 1, 
    @cmdexec_success_code = 0, 
    @on_success_action = 1, 
    @on_fail_action = 2, 
    @retry_attempts = 1, 
    @retry_interval = 5, 
    @subsystem = N'TSQL', 
    @command = N'EXECUTE [{target_db}].dbo.DatabaseBackup
    @Databases = ''USER_DATABASES'',
    @Directory = ''{b_dir}'',
    @BackupType = ''DIFF'',
    @Verify = ''{verify}'',
    @CleanupTime = {ret_hours},
    @CheckSum = ''{checksum}'',
    @Compress = ''{compress}'',
    @LogToTable = ''Y'';', 
    @database_name = N'{target_db}', 
    @flags = 4;

-- Program: Pazartesi-Cumartesi 01:00
EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobIdDiff, 
    @name = N'Schedule_Daily_Mon_Sat_0100', 
    @enabled = 1, 
    @freq_type = 8, 
    @freq_interval = 126, -- Mon, Tue, Wed, Thu, Fri, Sat
    @freq_recurrence_factor = 1, 
    @active_start_time = 010000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobIdDiff, @server_name = N'(local)';
PRINT 'İş oluşturuldu: DatabaseBackup - USER_DATABASES - DIFF';
GO

--------------------------------------------------------------------------------
-- İŞ 3: DatabaseBackup - USER_DATABASES - LOG (Her {request.backup_log_frequency_minutes} dakikada bir)
--------------------------------------------------------------------------------
{"-- LOG Yedeklemesi Etkinleştirildi" if request.backup_log_enabled else "/* LOG Yedeklemesi Atlandı */"}
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs_view WHERE name = N'DatabaseBackup - USER_DATABASES - LOG')
    EXEC msdb.dbo.sp_delete_job @job_name = N'DatabaseBackup - USER_DATABASES - LOG', @delete_unused_schedule = 1;

DECLARE @jobIdLog BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'DatabaseBackup - USER_DATABASES - LOG', 
    @enabled = {1 if request.backup_log_enabled else 0}, 
    @notify_level_eventlog = 2, 
    @notify_level_email = {2 if request.operator_email else 0},
    @notify_email_operator_name = N'{op_name}',
    @description = N'Point-in-Time kurtarma için işlem günlüğü (Transaction Log) yedeklemesi.', 
    @category_name = N'Database Maintenance', 
    @owner_login_name = N'sa', 
    @job_id = @jobIdLog OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobIdLog, 
    @step_name = N'DatabaseBackup - USER_DATABASES - LOG', 
    @step_id = 1, 
    @cmdexec_success_code = 0, 
    @on_success_action = 1, 
    @on_fail_action = 2, 
    @subsystem = N'TSQL', 
    @command = N'EXECUTE [{target_db}].dbo.DatabaseBackup
    @Databases = ''USER_DATABASES'',
    @Directory = ''{b_dir}'',
    @BackupType = ''LOG'',
    @Verify = ''{verify}'',
    @CleanupTime = {ret_hours},
    @CheckSum = ''{checksum}'',
    @Compress = ''{compress}'',
    @LogToTable = ''Y'';', 
    @database_name = N'{target_db}', 
    @flags = 4;

-- Program: Her {request.backup_log_frequency_minutes} dakikada bir çalıştır
EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobIdLog, 
    @name = N'Schedule_Every_{request.backup_log_frequency_minutes}min', 
    @enabled = 1, 
    @freq_type = 4, -- Daily
    @freq_interval = 1, 
    @freq_subday_type = 4, -- Minutes
    @freq_subday_interval = {request.backup_log_frequency_minutes}, 
    @active_start_time = 000000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobIdLog, @server_name = N'(local)';
PRINT 'İş oluşturuldu: DatabaseBackup - USER_DATABASES - LOG';
GO

--------------------------------------------------------------------------------
-- İŞ 4: DatabaseBackup - SYSTEM_DATABASES - FULL (Günlük 00:00)
--------------------------------------------------------------------------------
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs_view WHERE name = N'DatabaseBackup - SYSTEM_DATABASES - FULL')
    EXEC msdb.dbo.sp_delete_job @job_name = N'DatabaseBackup - SYSTEM_DATABASES - FULL', @delete_unused_schedule = 1;

DECLARE @jobIdSys BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'DatabaseBackup - SYSTEM_DATABASES - FULL', 
    @enabled = 1, 
    @notify_level_eventlog = 2, 
    @notify_level_email = {2 if request.operator_email else 0},
    @notify_email_operator_name = N'{op_name}',
    @description = N'master, model, msdb sistem veritabanı yedekleri.', 
    @category_name = N'Database Maintenance', 
    @owner_login_name = N'sa', 
    @job_id = @jobIdSys OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobIdSys, 
    @step_name = N'DatabaseBackup - SYSTEM_DATABASES - FULL', 
    @step_id = 1, 
    @subsystem = N'TSQL', 
    @command = N'EXECUTE [{target_db}].dbo.DatabaseBackup
    @Databases = ''SYSTEM_DATABASES'',
    @Directory = ''{b_dir}'',
    @BackupType = ''FULL'',
    @Verify = ''{verify}'',
    @CleanupTime = {ret_hours},
    @CheckSum = ''{checksum}'',
    @Compress = ''{compress}'',
    @LogToTable = ''Y'';', 
    @database_name = N'{target_db}', 
    @flags = 4;

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobIdSys, 
    @name = N'Schedule_Daily_Midnight', 
    @enabled = 1, 
    @freq_type = 4, 
    @freq_interval = 1, 
    @active_start_time = 000000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobIdSys, @server_name = N'(local)';
PRINT 'İş oluşturuldu: DatabaseBackup - SYSTEM_DATABASES - FULL';
GO

--------------------------------------------------------------------------------
-- İŞ 5: DatabaseIntegrityCheck - USER_DATABASES (Haftalık Pazar 03:00)
--------------------------------------------------------------------------------
{"-- Bütünlük Kontrolü Etkinleştirildi" if request.integrity_check_enabled else "/* Bütünlük Kontrolü Atlandı */"}
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs_view WHERE name = N'DatabaseIntegrityCheck - USER_DATABASES')
    EXEC msdb.dbo.sp_delete_job @job_name = N'DatabaseIntegrityCheck - USER_DATABASES', @delete_unused_schedule = 1;

DECLARE @jobIdCheck BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'DatabaseIntegrityCheck - USER_DATABASES', 
    @enabled = {1 if request.integrity_check_enabled else 0}, 
    @notify_level_eventlog = 2, 
    @notify_level_email = {2 if request.operator_email else 0},
    @notify_email_operator_name = N'{op_name}',
    @description = N'DBCC CHECKDB veri bozulması ve mantıksal sayfa bütünlüğü kontrolü.', 
    @category_name = N'Database Maintenance', 
    @owner_login_name = N'sa', 
    @job_id = @jobIdCheck OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobIdCheck, 
    @step_name = N'DatabaseIntegrityCheck - USER_DATABASES', 
    @step_id = 1, 
    @subsystem = N'TSQL', 
    @command = N'EXECUTE [{target_db}].dbo.DatabaseIntegrityCheck
    @Databases = ''USER_DATABASES'',
    @CheckCommands = ''CHECKDB'',
    @PhysicalOnly = ''{integrity_physical}'',
    @MaxDOP = {request.maxdop},
    @LogToTable = ''Y'';', 
    @database_name = N'{target_db}', 
    @flags = 4;

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobIdCheck, 
    @name = N'Schedule_Weekly_Sunday_0300', 
    @enabled = 1, 
    @freq_type = 8, 
    @freq_interval = 1, 
    @active_start_time = 030000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobIdCheck, @server_name = N'(local)';
PRINT 'İş oluşturuldu: DatabaseIntegrityCheck - USER_DATABASES';
GO

--------------------------------------------------------------------------------
-- İŞ 6: IndexOptimize - USER_DATABASES (Haftalık Pazar 05:00)
--------------------------------------------------------------------------------
{"-- İndeks & İstatistik Optimizasyonu Etkinleştirildi" if request.index_optimize_enabled else "/* İndeks Optimizasyonu Atlandı */"}
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs_view WHERE name = N'IndexOptimize - USER_DATABASES')
    EXEC msdb.dbo.sp_delete_job @job_name = N'IndexOptimize - USER_DATABASES', @delete_unused_schedule = 1;

DECLARE @jobIdIdx BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'IndexOptimize - USER_DATABASES', 
    @enabled = {1 if request.index_optimize_enabled else 0}, 
    @notify_level_eventlog = 2, 
    @notify_level_email = {2 if request.operator_email else 0},
    @notify_email_operator_name = N'{op_name}',
    @description = N'Parçalanmaya göre akıllı Reorganize ve Rebuild; modifiye istatistik güncellemesi.', 
    @category_name = N'Database Maintenance', 
    @owner_login_name = N'sa', 
    @job_id = @jobIdIdx OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobIdIdx, 
    @step_name = N'IndexOptimize - USER_DATABASES', 
    @step_id = 1, 
    @subsystem = N'TSQL', 
    @command = N'EXECUTE [{target_db}].dbo.IndexOptimize
    @Databases = ''USER_DATABASES'',
    @FragmentationLow = {frag_low},
    @FragmentationMedium = {frag_med},
    @FragmentationHigh = {frag_high},
    @FragmentationLevel1 = {request.frag_reorganize_threshold},
    @FragmentationLevel2 = {request.frag_rebuild_threshold},
    @UpdateStatistics = {f"''{update_stats_flag}''" if update_stats_flag != "NULL" else "NULL"},
    @OnlyModifiedStatistics = ''{only_modified_flag}'',
    @MaxDOP = {request.maxdop},
    @Resumable = ''{resumable_val}'',
    @LogToTable = ''Y'';', 
    @database_name = N'{target_db}', 
    @flags = 4;

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobIdIdx, 
    @name = N'Schedule_Weekly_Sunday_0500', 
    @enabled = 1, 
    @freq_type = 8, 
    @freq_interval = 1, 
    @active_start_time = 050000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobIdIdx, @server_name = N'(local)';
PRINT 'İş oluşturuldu: IndexOptimize - USER_DATABASES';
GO

--------------------------------------------------------------------------------
-- İŞ 7: Maintenance - CommandLog & JobHistory Cleanup (Haftalık Pazar 23:00)
--------------------------------------------------------------------------------
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs_view WHERE name = N'Maintenance - CommandLog & JobHistory Cleanup')
    EXEC msdb.dbo.sp_delete_job @job_name = N'Maintenance - CommandLog & JobHistory Cleanup', @delete_unused_schedule = 1;

DECLARE @jobIdClean BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'Maintenance - CommandLog & JobHistory Cleanup', 
    @enabled = 1, 
    @notify_level_eventlog = 2, 
    @description = N'CommandLog tablosu ve msdb iş geçmişi temizliği (30 günlük saklama).', 
    @category_name = N'Database Maintenance', 
    @owner_login_name = N'sa', 
    @job_id = @jobIdClean OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobIdClean, 
    @step_name = N'Purge CommandLog Table', 
    @step_id = 1, 
    @subsystem = N'TSQL', 
    @command = N'DELETE FROM [{target_db}].dbo.CommandLog WHERE StartTime < DATEADD(DAY, -30, GETDATE());', 
    @database_name = N'{target_db}', 
    @flags = 4;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobIdClean, 
    @step_name = N'Purge msdb Job History', 
    @step_id = 2, 
    @subsystem = N'TSQL', 
    @command = N'DECLARE @OldestDate DATETIME = DATEADD(DAY, -30, GETDATE());
    EXEC msdb.dbo.sp_purge_jobhistory @oldest_date = @OldestDate;', 
    @database_name = N'msdb', 
    @flags = 4;

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobIdClean, 
    @name = N'Schedule_Weekly_Sunday_2300', 
    @enabled = 1, 
    @freq_type = 8, 
    @freq_interval = 1, 
    @active_start_time = 230000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobIdClean, @server_name = N'(local)';
PRINT 'İş oluşturuldu: Maintenance - CommandLog & JobHistory Cleanup';
GO
"""

    else:
        # Native T-SQL solution without Ola Hallengren
        job_names = [
            "NativeMaintenance - User Databases Full Backup",
            "NativeMaintenance - User Databases Index Reorganize & Rebuild",
            "NativeMaintenance - User Databases Integrity Check",
        ]
        agent_jobs_script = f"""/*
================================================================================
 DATAPATH DATABASE INTELLIGENCE PLATFORM — NATIVE SQL AGENT MAINTENANCE SUITE
 Çözüm: Yerel T-SQL (Ola Hallengren Kurulumu Gerektirmez)
 Yedekleme Dizini: {b_dir}
================================================================================
*/

USE [msdb];
GO

-- 1. Bildirim Operatörü Oluşturma
IF NOT EXISTS (SELECT name FROM msdb.dbo.sysoperators WHERE name = N'{op_name}')
BEGIN
    EXEC msdb.dbo.sp_add_operator 
        @name = N'{op_name}', 
        @enabled = 1{f", @email_address = N'{request.operator_email}'" if request.operator_email else ""};
END;
GO

--------------------------------------------------------------------------------
-- İŞ 1: NativeMaintenance - User Databases Full Backup
--------------------------------------------------------------------------------
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs_view WHERE name = N'NativeMaintenance - User Databases Full Backup')
    EXEC msdb.dbo.sp_delete_job @job_name = N'NativeMaintenance - User Databases Full Backup', @delete_unused_schedule = 1;

DECLARE @jobId BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'NativeMaintenance - User Databases Full Backup', 
    @enabled = 1, 
    @notify_level_eventlog = 2, 
    @notify_level_email = {2 if request.operator_email else 0},
    @notify_email_operator_name = N'{op_name}',
    @description = N'Tüm kullanıcı veritabanlarının yerel T-SQL imleci ile dinamik tam yedeği.', 
    @category_name = N'Database Maintenance', 
    @job_id = @jobId OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobId, 
    @step_name = N'Backup All User Databases', 
    @step_id = 1, 
    @subsystem = N'TSQL', 
    @command = N'DECLARE @dbName NVARCHAR(256), @sql NVARCHAR(MAX), @fileName NVARCHAR(500);
DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.databases 
    WHERE database_id > 4 AND state_desc = ''ONLINE'' AND is_read_only = 0;
OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @dbName;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @fileName = ''{b_dir}\'' + @dbName + ''_FULL_'' + REPLACE(CONVERT(VARCHAR(20), GETDATE(), 120), '':'', ''-'') + ''.bak'';
    SET @sql = ''BACKUP DATABASE ['' + @dbName + ''] TO DISK = N'''''' + @fileName + '''''' WITH {"COMPRESSION, " if request.backup_compress else ""}{"CHECKSUM, " if request.backup_checksum else ""}STATS = 10;'';
    PRINT ''Yedekleniyor: '' + @dbName;
    EXEC sp_executesql @sql;
    FETCH NEXT FROM db_cursor INTO @dbName;
END;
CLOSE db_cursor;
DEALLOCATE db_cursor;', 
    @database_name = N'master', 
    @flags = 4;

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobId, 
    @name = N'Schedule_Daily_0100', 
    @enabled = 1, 
    @freq_type = 4, 
    @freq_interval = 1, 
    @active_start_time = 010000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobId, @server_name = N'(local)';
PRINT 'İş oluşturuldu: NativeMaintenance - User Databases Full Backup';
GO

--------------------------------------------------------------------------------
-- İŞ 2: NativeMaintenance - User Databases Index Reorganize & Rebuild
--------------------------------------------------------------------------------
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs_view WHERE name = N'NativeMaintenance - User Databases Index Reorganize & Rebuild')
    EXEC msdb.dbo.sp_delete_job @job_name = N'NativeMaintenance - User Databases Index Reorganize & Rebuild', @delete_unused_schedule = 1;

DECLARE @jobIdIdx BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'NativeMaintenance - User Databases Index Reorganize & Rebuild', 
    @enabled = 1, 
    @notify_level_eventlog = 2, 
    @notify_level_email = {2 if request.operator_email else 0},
    @notify_email_operator_name = N'{op_name}',
    @description = N'sys.dm_db_index_physical_stats parçalanma oranına göre akıllı Reorganize veya Rebuild.', 
    @category_name = N'Database Maintenance', 
    @job_id = @jobIdIdx OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobIdIdx, 
    @step_name = N'Smart Rebuild and Reorg Indexes', 
    @step_id = 1, 
    @subsystem = N'TSQL', 
    @command = N'DECLARE @sql NVARCHAR(MAX), @dbName NVARCHAR(128);
DECLARE db_cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.databases WHERE database_id > 4 AND state_desc = ''ONLINE'' AND is_read_only = 0;
OPEN db_cur;
FETCH NEXT FROM db_cur INTO @dbName;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = ''
    USE ['' + @dbName + ''];
    DECLARE @cmd NVARCHAR(MAX);
    DECLARE idx_cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT 
            CASE 
                WHEN ips.avg_fragmentation_in_percent >= {request.frag_rebuild_threshold}
                THEN ''''ALTER INDEX ['''' + i.name + ''''] ON ['''' + s.name + ''''].['''' + t.name + ''''] REBUILD WITH ({"ONLINE = ON, " if request.online_rebuild else ""}MAXDOP = {request.maxdop});''''
                ELSE ''''ALTER INDEX ['''' + i.name + ''''] ON ['''' + s.name + ''''].['''' + t.name + ''''] REORGANIZE;''''
            END
        FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, ''''LIMITED'''') ips
        INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE ips.avg_fragmentation_in_percent >= {request.frag_reorganize_threshold}
          AND ips.page_count > 1000
          AND i.name IS NOT NULL;
    OPEN idx_cur;
    FETCH NEXT FROM idx_cur INTO @cmd;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        PRINT @cmd;
        BEGIN TRY EXEC sp_executesql @cmd; END TRY
        BEGIN CATCH PRINT ''Hata: '' + ERROR_MESSAGE(); END CATCH;
        FETCH NEXT FROM idx_cur INTO @cmd;
    END;
    CLOSE idx_cur;
    DEALLOCATE idx_cur;'';
    EXEC sp_executesql @sql;
    FETCH NEXT FROM db_cur INTO @dbName;
END;
CLOSE db_cur;
DEALLOCATE db_cur;', 
    @database_name = N'master', 
    @flags = 4;

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobIdIdx, 
    @name = N'Schedule_Weekly_Sunday_0400', 
    @enabled = 1, 
    @freq_type = 8, 
    @freq_interval = 1, 
    @active_start_time = 040000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobIdIdx, @server_name = N'(local)';
PRINT 'İş oluşturuldu: NativeMaintenance - User Databases Index Reorganize & Rebuild';
GO

--------------------------------------------------------------------------------
-- İŞ 3: NativeMaintenance - User Databases Integrity Check
--------------------------------------------------------------------------------
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs_view WHERE name = N'NativeMaintenance - User Databases Integrity Check')
    EXEC msdb.dbo.sp_delete_job @job_name = N'NativeMaintenance - User Databases Integrity Check', @delete_unused_schedule = 1;

DECLARE @jobIdCheck BINARY(16);
EXEC msdb.dbo.sp_add_job 
    @job_name = N'NativeMaintenance - User Databases Integrity Check', 
    @enabled = 1, 
    @notify_level_eventlog = 2, 
    @notify_level_email = {2 if request.operator_email else 0},
    @notify_email_operator_name = N'{op_name}',
    @description = N'DBCC CHECKDB ile veritabanı bozulma kontrolü.', 
    @category_name = N'Database Maintenance', 
    @job_id = @jobIdCheck OUTPUT;

EXEC msdb.dbo.sp_add_jobstep 
    @job_id = @jobIdCheck, 
    @step_name = N'Run DBCC CHECKDB', 
    @step_id = 1, 
    @subsystem = N'TSQL', 
    @command = N'DECLARE @dbName NVARCHAR(256), @sql NVARCHAR(MAX);
DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.databases 
    WHERE database_id > 4 AND state_desc = ''ONLINE'' AND is_read_only = 0;
OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @dbName;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = ''DBCC CHECKDB (['' + @dbName + '']) WITH NO_INFOMSGS{" , PHYSICAL_ONLY" if request.integrity_mode == "PHYSICAL_ONLY" else ""};'';
    PRINT ''Bütünlük kontrol ediliyor: '' + @dbName;
    EXEC sp_executesql @sql;
    FETCH NEXT FROM db_cursor INTO @dbName;
END;
CLOSE db_cursor;
DEALLOCATE db_cursor;', 
    @database_name = N'master', 
    @flags = 4;

EXEC msdb.dbo.sp_add_jobschedule 
    @job_id = @jobIdCheck, 
    @name = N'Schedule_Weekly_Sunday_0200', 
    @enabled = 1, 
    @freq_type = 8, 
    @freq_interval = 1, 
    @active_start_time = 020000;

EXEC msdb.dbo.sp_add_jobserver @job_id = @jobIdCheck, @server_name = N'(local)';
PRINT 'İş oluşturuldu: NativeMaintenance - User Databases Integrity Check';
GO
"""

    # Verification Script
    verification_script = f"""/*
================================================================================
 DATAPATH — BAKIM İŞLERİ DOĞRULAMA VE SAĞLIK SORGULARI
================================================================================
*/

-- 1. Oluşturulan SQL Server Agent İşlerinin Durumunu İnceleyin
SELECT 
    j.name AS job_name,
    j.enabled AS is_enabled,
    s.step_name,
    s.subsystem,
    s.database_name,
    c.name AS category_name
FROM msdb.dbo.sysjobs j
INNER JOIN msdb.dbo.sysjobsteps s ON j.job_id = s.job_id
LEFT JOIN msdb.dbo.syscategories c ON j.category_id = c.category_id
WHERE j.name LIKE '%Backup%' 
   OR j.name LIKE '%Index%' 
   OR j.name LIKE '%Integrity%' 
   OR j.name LIKE '%Maintenance%'
ORDER BY j.name, s.step_id;

-- 2. Zaman Planlarını (Schedules) Kontrol Edin
SELECT 
    j.name AS job_name,
    sch.name AS schedule_name,
    sch.enabled AS is_active,
    sch.active_start_time
FROM msdb.dbo.sysjobs j
INNER JOIN msdb.dbo.sysjobschedules js ON j.job_id = js.job_id
INNER JOIN msdb.dbo.sysschedules sch ON js.schedule_id = sch.schedule_id
ORDER BY sch.active_start_time;

-- 3. Ola Hallengren Günlük Kayıtlarını İnceleyin (Varsa)
IF OBJECT_ID('[{target_db}].dbo.CommandLog') IS NOT NULL
BEGIN
    SELECT TOP 50
        ID, DatabaseName, SchemaName, ObjectName, CommandType,
        StartTime, EndTime, ErrorNumber, ErrorMessage
    FROM [{target_db}].dbo.CommandLog
    ORDER BY ID DESC;
END;
"""

    # Cleanup / Rollback Script
    cleanup_script = f"""/*
================================================================================
 DATAPATH — BAKIM İŞLERİ GERİ ALMA (ROLLBACK) BETİĞİ
 Güvenli: Yalnızca Datapath tarafından tanımlanan bakım işlerini kaldırır.
================================================================================
*/

USE [msdb];
GO

DECLARE @jobName NVARCHAR(128);
DECLARE job_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM msdb.dbo.sysjobs
    WHERE name IN (
        {', '.join(f"N'{j}'" for j in job_names)}
    );

OPEN job_cursor;
FETCH NEXT FROM job_cursor INTO @jobName;
WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT 'Siliniyor: ' + @jobName;
    EXEC msdb.dbo.sp_delete_job @job_name = @jobName, @delete_unused_schedule = 1;
    FETCH NEXT FROM job_cursor INTO @jobName;
END;

CLOSE job_cursor;
DEALLOCATE job_cursor;
PRINT 'Tüm bakım işleri başarıyla geri alındı.';
GO
"""

    ola_deployment_script = f"""/*
================================================================================
 OLA HALLENGREN SQL SERVER MAINTENANCE SOLUTION — DAĞITIM TALİMATI
 Resmi Kaynak: https://ola.hallengren.com
 Kurulum Veritabanı: [{target_db}]
================================================================================
1. https://ola.hallengren.com/scripts/MaintenanceSolution.sql adresindeki güncel
   resmi MaintenanceSolution.sql betiğini indirin veya açın.
2. Betiğin başında yer alan aşağıdaki parametreleri ortamınıza göre yapılandırın:
   - DECLARE @CreateJobs NVARCHAR(max) = 'N'  -- (İşleri Datapath üreteceğinden 'N' seçebilirsiniz)
   - DECLARE @BackupDirectory NVARCHAR(max) = '{b_dir}'
   - DECLARE @CleanupTime INT = {ret_hours}
   - DECLARE @OutputFileDirectory NVARCHAR(max) = NULL
   - DECLARE @LogToTable NVARCHAR(max) = 'Y'
3. Hedef [{target_db}] veritabanında çalıştırın.
4. Kurulum tamamlandıktan sonra CommandExecute, DatabaseBackup, DatabaseIntegrityCheck
   ve IndexOptimize nesneleri hazır olacaktır.
================================================================================
*/
"""

    guidance = [
        f"Üretilen T-SQL betiği SQL Server Agent üzerinde {len(job_names)} adet bakım işi tanımlar.",
        f"Yedekler '{request.backup_directory}' dizinine yazılacak ve {request.backup_retention_hours} saat sonra otomatik temizlenecektir.",
        "İşler 'sa' hesabı sahipliğinde oluşturulur ve hata durumunda Windows Olay Günlüğü'ne (Event Viewer) otomatik düşer.",
        "Üretim ortamında çalıştırmadan önce T-SQL kodunu inceleyiniz; Datapath Salt-Okunur Güvenlik Politikası uyarınca betiği otomatik çalıştırmaz."
    ]

    return MaintenanceJobScriptResponse(
        solution_type=request.solution_type,
        target_database=target_db,
        ola_installer_url="https://ola.hallengren.com/scripts/MaintenanceSolution.sql",
        ola_deployment_script=ola_deployment_script,
        agent_jobs_script=agent_jobs_script,
        verification_script=verification_script,
        cleanup_script=cleanup_script,
        jobs_created_count=len(job_names),
        job_names=job_names,
        execution_guidance=guidance,
    )
