"""services/config_drift_service.py — Multi-Environment Configuration Drift Service."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from app.db.connection import get_connection, ConnectionParams, rows_to_dicts
from app.schemas.config_drift import (
    ConfigDriftItem,
    ConfigDriftSummary,
    BaselineProfileMeta,
    ConfigDriftResponse,
)

logger = logging.getLogger(__name__)

AVAILABLE_BASELINES: List[BaselineProfileMeta] = [
    BaselineProfileMeta(
        key="ENTERPRISE_PROD_STANDARD",
        label="Kurumsal Üretim Standardı (Enterprise Production)",
        description="Dengeli kurumsal iş yükleri, yüksek erişilebilirlik ve bellek koruması için önerilen altın standart.",
    ),
    BaselineProfileMeta(
        key="HIGH_CONCURRENCY_OLTP",
        label="Yüksek Eşzamanlılık & OLTP (E-Ticaret / Finans)",
        description="Binlerce eşzamanlı kısa işlem, düşük kilit beklemesi ve anlık yanıt gerektiren sistemler için standart.",
    ),
    BaselineProfileMeta(
        key="ANALYTICS_DW",
        label="Veri Ambarı & Analitik Raporlama (DW / BI)",
        description="Ağır toplu analitik hesaplamalar, geniş paralellik ve veri ambarı sorguları için yapılandırılmış profil.",
    ),
]


def get_configuration_drift_analysis(
    params: ConnectionParams,
    baseline_key: Optional[str] = "ENTERPRISE_PROD_STANDARD",
) -> ConfigDriftResponse:
    """Compares live server sp_configure parameters and database options against
    the specified Golden Baseline to pinpoint configuration drift and pending reboots.
    """
    selected_baseline = baseline_key or "ENTERPRISE_PROD_STANDARD"
    server_name = params.server or "SQL-INSTANCE"
    items: List[ConfigDriftItem] = []
    alignment_scripts: List[str] = [
        "-- =========================================================================",
        f"-- Datapath Konfigürasyon Sapması Düzeltme Betiği (Golden Baseline: {selected_baseline})",
        f"-- Üretim Zamanı: {datetime.utcnow().isoformat()}Z",
        "-- Güvenlik Politikası: Yalnızca DBA İncelemesi (Review-Only) için üretilmiştir.",
        "-- =========================================================================\n",
        "USE [master];",
        "EXEC sp_configure 'show advanced options', 1;",
        "RECONFIGURE WITH OVERRIDE;\n",
    ]

    # Baseline target values
    is_oltp = selected_baseline == "HIGH_CONCURRENCY_OLTP"
    is_dw = selected_baseline == "ANALYTICS_DW"

    target_maxdop = 8 if is_dw else (2 if is_oltp else 4)
    target_cost_threshold = 25 if is_dw else 50
    target_optimize_adhoc = 0 if is_dw else 1
    target_backup_compression = 1
    target_remote_admin = 1
    target_clr = 0
    target_xp_cmdshell = 0
    target_blocked_process = 30 if is_dw else (5 if is_oltp else 15)

    try:
        with get_connection(params) as conn:
            cursor = conn.cursor()

            # 1. Server name and specs
            try:
                cursor.execute("SELECT @@SERVERNAME, cpu_count, physical_memory_kb FROM sys.dm_os_sys_info;")
                row = cursor.fetchone()
                if row:
                    server_name = str(row[0] or server_name)
                    cpu_cores = int(row[1] or 8)
                    total_ram_gb = round(float(row[2] or 33554432) / (1024 * 1024), 1)
                else:
                    cpu_cores = 8
                    total_ram_gb = 32.0
            except Exception:
                cpu_cores = 8
                total_ram_gb = 32.0

            # 2. Server sp_configure options
            cursor.execute("""
            SELECT 
                configuration_id,
                name,
                CAST(value AS BIGINT) AS configured_value,
                CAST(value_in_use AS BIGINT) AS value_in_use,
                is_dynamic,
                is_advanced,
                description
            FROM sys.configurations
            ORDER BY name;
            """)
            raw_configs = rows_to_dicts(cursor)
            config_map: Dict[str, Dict[str, Any]] = {c["name"]: c for c in raw_configs}

            # Helper for adding an item
            def check_setting(
                setting_name: str,
                category: str,
                expected_val: Any,
                unit: str = "",
                is_critical: bool = False,
                risk_msg: str = "",
                custom_sql: Optional[str] = None,
            ):
                cfg = config_map.get(setting_name)
                if not cfg:
                    return

                conf_val = cfg["configured_value"]
                run_val = cfg["value_in_use"]
                is_dynamic = bool(cfg.get("is_dynamic", True))

                # Check reboot or reconfigure pending
                reboot_pending = (conf_val != run_val)

                # Evaluate drift
                matched = (conf_val == expected_val)

                if reboot_pending:
                    status = "REBOOT_REQUIRED"
                    risk = (
                        f"Yapılandırılan değer ({conf_val}) ile bellekte koşan değer ({run_val}) farklı! "
                        + ("Sunucunun yeniden başlatılması bekleniyor." if not is_dynamic else "RECONFIGURE çalıştırılmamış.")
                    )
                elif not matched:
                    status = "DRIFTED_CRITICAL" if is_critical else "DRIFTED_WARNING"
                    risk = risk_msg
                else:
                    status = "IN_SYNC"
                    risk = "Konfigürasyon kurumsal Golden Baseline ile tam uyumlu."

                tsql = custom_sql or f"EXEC sp_configure '{setting_name}', {expected_val};\nRECONFIGURE WITH OVERRIDE;"
                if status != "IN_SYNC":
                    alignment_scripts.append(f"-- {setting_name} ({category}): Mevcut={conf_val}{unit}, Hedef={expected_val}{unit}")
                    alignment_scripts.append(tsql + "\n")

                items.append(
                    ConfigDriftItem(
                        scope="SERVER",
                        target_name=server_name,
                        setting_name=setting_name,
                        category=category,
                        baseline_value=f"{expected_val}{unit}",
                        current_value=f"{conf_val}{unit}",
                        in_memory_value=f"{run_val}{unit}",
                        is_reboot_pending=reboot_pending,
                        drift_status=status,
                        risk_assessment=risk,
                        remediation_tsql=tsql,
                    )
                )

            # Max Degree of Parallelism
            check_setting(
                setting_name="max degree of parallelism",
                category="CPU & Paralellik",
                expected_val=target_maxdop,
                is_critical=True,
                risk_msg=(
                    "MAXDOP 0 (varsayılan) bırakılmışsa, paralelleşen sorgular tüm çekirdekleri tüketerek "
                    "CXPACKET bekleme fırtınasına ve thread starvation sorununa yol açar."
                ),
            )

            # Cost Threshold for Parallelism
            check_setting(
                setting_name="cost threshold for parallelism",
                category="CPU & Paralellik",
                expected_val=target_cost_threshold,
                is_critical=True,
                risk_msg=(
                    "Varsayılan eşik değeri (5) modern CPU'lar için aşırı düşüktür. Trivial hafif sorguların gereksiz yere "
                    "paralelleşmesine ve CPU ek yüküne (overhead) neden olur."
                ),
            )

            # Optimize for Ad Hoc Workloads
            check_setting(
                setting_name="optimize for ad hoc workloads",
                category="Bellek & Önbellek",
                expected_val=target_optimize_adhoc,
                is_critical=False,
                risk_msg=(
                    "Parametresiz tek seferlik sorgular plan önbelleğinde (Plan Cache) megabaytlarca şişkinliğe "
                    "ve veri sayfalarının bellekten düşmesine yol açar."
                ),
            )

            # Backup Compression Default
            check_setting(
                setting_name="backup compression default",
                category="Depolama & Yedekleme",
                expected_val=target_backup_compression,
                is_critical=False,
                risk_msg=(
                    "Sıkıştırma kapalı olduğunda veritabanı yedekleri 4-5 kat daha fazla disk alanı tüketir ve "
                    "yedekleme/geri yükleme G/Ç süresini uzatır."
                ),
            )

            # Remote Admin Connections (DAC)
            check_setting(
                setting_name="remote admin connections",
                category="Güvenlik & Erişim",
                expected_val=target_remote_admin,
                is_critical=True,
                risk_msg=(
                    "Özel Yönetici Bağlantısı (DAC) uzaktan erişime kapalı olduğunda, %100 CPU veya kilitlenme krizlerinde "
                    "DBA sunucuya uzaktan bağlanıp müdahale edemez."
                ),
            )

            # CLR Enabled
            check_setting(
                setting_name="clr enabled",
                category="Güvenlik & Erişim",
                expected_val=target_clr,
                is_critical=False,
                risk_msg="Gerekli olmayan ortamlarda CLR etkinleştirilmesi saldırı yüzeyini genişletir.",
            )

            # xp_cmdshell
            check_setting(
                setting_name="xp_cmdshell",
                category="Güvenlik & Erişim",
                expected_val=target_xp_cmdshell,
                is_critical=True,
                risk_msg="xp_cmdshell aktif olması durumunda işletim sistemi seviyesinde komut çalıştırılabilir; kritik güvenlik açığıdır.",
            )

            # Blocked Process Threshold
            check_setting(
                setting_name="blocked process threshold (s)",
                category="İzleme & Olaylar",
                expected_val=target_blocked_process,
                unit="s",
                is_critical=False,
                risk_msg=(
                    "Eşik 0 (kapalı) olduğunda SQL Server engellenen süreç olaylarını (Blocked Process Report) "
                    "üretmez; uzun kilitlenmeler teşhis edilemez."
                ),
            )

            # Max Server Memory Check
            max_mem_cfg = config_map.get("max server memory (MB)")
            if max_mem_cfg:
                conf_mem = max_mem_cfg["configured_value"]
                run_mem = max_mem_cfg["value_in_use"]
                is_uncapped = conf_mem > 1000000 or conf_mem == 2147483647
                
                # Recommended memory = RAM - OS Buffer
                safe_os_reserve = max(4.0, total_ram_gb * 0.15)
                rec_max_mb = int((total_ram_gb - safe_os_reserve) * 1024)

                if is_uncapped:
                    status = "DRIFTED_CRITICAL"
                    risk = (
                        f"Max Server Memory sınırı atanmamış ({conf_mem} MB - varsayılan sınırsız). "
                        f"SQL Server işletim sisteminin RAM'ini tüketerek sayfalama (paging) ve çökme riski doğurur."
                    )
                elif conf_conf_diff := (conf_mem != run_mem):
                    status = "REBOOT_REQUIRED"
                    risk = f"Bellek ayarı değiştirilmiş ({conf_mem} MB) fakat bellekte {run_mem} MB olarak çalışıyor."
                else:
                    status = "IN_SYNC"
                    risk = "Max Server Memory işletim sistemi için güvenli bir sınır ile yapılandırılmış."

                mem_tsql = f"EXEC sp_configure 'max server memory (MB)', {rec_max_mb};\nRECONFIGURE WITH OVERRIDE;"
                if status != "IN_SYNC":
                    alignment_scripts.append(f"-- Max Server Memory: Mevcut={conf_mem}MB, Önerilen={rec_max_mb}MB (Toplam RAM: {total_ram_gb}GB)")
                    alignment_scripts.append(mem_tsql + "\n")

                items.append(
                    ConfigDriftItem(
                        scope="SERVER",
                        target_name=server_name,
                        setting_name="max server memory (MB)",
                        category="Bellek & Depolama",
                        baseline_value=f"{rec_max_mb} MB",
                        current_value=f"{conf_mem} MB" if not is_uncapped else "Sınırsız (2 TB)",
                        in_memory_value=f"{run_mem} MB" if run_mem < 1000000 else "Sınırsız (2 TB)",
                        is_reboot_pending=(conf_mem != run_mem),
                        drift_status=status,
                        risk_assessment=risk,
                        remediation_tsql=mem_tsql,
                    )
                )

            # 3. Database-Level Options across User Databases
            cursor.execute("""
            SELECT 
                name AS database_name,
                database_id,
                compatibility_level,
                is_auto_close_on,
                is_auto_shrink_on,
                page_verify_option_desc,
                target_recovery_time_in_seconds,
                is_read_committed_snapshot_on
            FROM sys.databases
            WHERE database_id > 4 AND state_desc = 'ONLINE';
            """)
            user_dbs = rows_to_dicts(cursor)

            for db in user_dbs:
                dbname = db["database_name"]

                # Check AUTO_CLOSE
                auto_close = bool(db.get("is_auto_close_on"))
                ac_status = "DRIFTED_CRITICAL" if auto_close else "IN_SYNC"
                ac_risk = (
                    "AUTO_CLOSE = ON: Her bağlantı koptuğunda veritabanı bellekten boşaltılır ve yeniden açılır. "
                    "Bu durum bağlantılarda 1-2 saniye gecikmeye ve disk I/O fırtınasına yol açar."
                    if auto_close else "AUTO_CLOSE kapalı; kurumsal standart."
                )
                ac_sql = f"ALTER DATABASE [{dbname}] SET AUTO_CLOSE OFF WITH NO_WAIT;"
                if auto_close:
                    alignment_scripts.append(f"-- {dbname} AUTO_CLOSE düzeltmesi:")
                    alignment_scripts.append(ac_sql + "\n")
                items.append(
                    ConfigDriftItem(
                        scope="DATABASE",
                        target_name=dbname,
                        setting_name="AUTO_CLOSE",
                        category="Veritabanı Seçenekleri",
                        baseline_value="OFF",
                        current_value="ON" if auto_close else "OFF",
                        in_memory_value="ON" if auto_close else "OFF",
                        is_reboot_pending=False,
                        drift_status=ac_status,
                        risk_assessment=ac_risk,
                        remediation_tsql=ac_sql,
                    )
                )

                # Check AUTO_SHRINK
                auto_shrink = bool(db.get("is_auto_shrink_on"))
                ash_status = "DRIFTED_CRITICAL" if auto_shrink else "IN_SYNC"
                ash_risk = (
                    "AUTO_SHRINK = ON: Veritabanı sürekli küçültülüp tekrar büyür; tüm indeksleri aşırı parçalar (fragmentation) "
                    "ve disk I/O darboğazına sebep olur."
                    if auto_shrink else "AUTO_SHRINK kapalı; kurumsal standart."
                )
                ash_sql = f"ALTER DATABASE [{dbname}] SET AUTO_SHRINK OFF WITH NO_WAIT;"
                if auto_shrink:
                    alignment_scripts.append(f"-- {dbname} AUTO_SHRINK düzeltmesi:")
                    alignment_scripts.append(ash_sql + "\n")
                items.append(
                    ConfigDriftItem(
                        scope="DATABASE",
                        target_name=dbname,
                        setting_name="AUTO_SHRINK",
                        category="Veritabanı Seçenekleri",
                        baseline_value="OFF",
                        current_value="ON" if auto_shrink else "OFF",
                        in_memory_value="ON" if auto_shrink else "OFF",
                        is_reboot_pending=False,
                        drift_status=ash_status,
                        risk_assessment=ash_risk,
                        remediation_tsql=ash_sql,
                    )
                )

                # Check PAGE_VERIFY
                pv = str(db.get("page_verify_option_desc") or "NONE")
                pv_status = "IN_SYNC" if pv == "CHECKSUM" else "DRIFTED_CRITICAL"
                pv_risk = (
                    "PAGE_VERIFY = CHECKSUM haricinde ayarlandığında disk bozulmaları ve sessiz veri kayıpları (silent data corruption) "
                    "tespit edilemez!" if pv != "CHECKSUM" else "PAGE_VERIFY CHECKSUM etkin; disk bütünlüğü korunuyor."
                )
                pv_sql = f"ALTER DATABASE [{dbname}] SET PAGE_VERIFY CHECKSUM WITH NO_WAIT;"
                if pv != "CHECKSUM":
                    alignment_scripts.append(f"-- {dbname} PAGE_VERIFY CHECKSUM düzeltmesi:")
                    alignment_scripts.append(pv_sql + "\n")
                items.append(
                    ConfigDriftItem(
                        scope="DATABASE",
                        target_name=dbname,
                        setting_name="PAGE_VERIFY",
                        category="Veritabanı Bütünlüğü",
                        baseline_value="CHECKSUM",
                        current_value=pv,
                        in_memory_value=pv,
                        is_reboot_pending=False,
                        drift_status=pv_status,
                        risk_assessment=pv_risk,
                        remediation_tsql=pv_sql,
                    )
                )

                # Check Target Recovery Time (Indirect Checkpoint)
                trt = int(db.get("target_recovery_time_in_seconds") or 0)
                trt_status = "IN_SYNC" if trt >= 60 else "DRIFTED_WARNING"
                trt_risk = (
                    "TARGET_RECOVERY_TIME = 0 (Legacy Checkpoint): Büyük bellek tamponu temizleme dalgalanmalarına yol açar. "
                    "60 saniye (Indirect Checkpoint) önerilir." if trt < 60 else "Indirect checkpoint etkin; G/Ç yükü dengeli."
                )
                trt_sql = f"ALTER DATABASE [{dbname}] SET TARGET_RECOVERY_TIME = 60 SECONDS;"
                if trt < 60:
                    alignment_scripts.append(f"-- {dbname} TARGET_RECOVERY_TIME düzeltmesi:")
                    alignment_scripts.append(trt_sql + "\n")
                items.append(
                    ConfigDriftItem(
                        scope="DATABASE",
                        target_name=dbname,
                        setting_name="TARGET_RECOVERY_TIME",
                        category="Veritabanı Bütünlüğü",
                        baseline_value="60s",
                        current_value=f"{trt}s",
                        in_memory_value=f"{trt}s",
                        is_reboot_pending=False,
                        drift_status=trt_status,
                        risk_assessment=trt_risk,
                        remediation_tsql=trt_sql,
                    )
                )

    except Exception as e:
        logger.error("Error evaluating configuration drift: %s", e)

    # Calculate summary metrics
    total_evaluated = len(items)
    in_sync = sum(1 for it in items if it.drift_status == "IN_SYNC")
    critical_cnt = sum(1 for it in items if it.drift_status == "DRIFTED_CRITICAL")
    warning_cnt = sum(1 for it in items if it.drift_status == "DRIFTED_WARNING")
    reboot_cnt = sum(1 for it in items if it.drift_status == "REBOOT_REQUIRED" or it.is_reboot_pending)

    drift_score = round((in_sync / max(1, total_evaluated)) * 100.0, 1) if total_evaluated > 0 else 100.0

    summary = ConfigDriftSummary(
        server_name=server_name,
        baseline_profile=selected_baseline,
        total_rules_evaluated=total_evaluated,
        in_sync_count=in_sync,
        drifted_critical_count=critical_cnt,
        drifted_warning_count=warning_cnt,
        reboot_pending_count=reboot_cnt,
        drift_score_pct=drift_score,
        evaluated_at=datetime.utcnow().isoformat(),
    )

    return ConfigDriftResponse(
        summary=summary,
        items=items,
        available_baselines=AVAILABLE_BASELINES,
        full_alignment_script="\n".join(alignment_scripts),
    )
