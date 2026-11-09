import logging
from typing import List, Optional
from datetime import datetime
from app.db.connection import ConnectionParams, get_connection
from app.schemas.connection_pool import (
    ClientConnectionGroup,
    SleepingTransactionItem,
    ConnectionPoolSummary,
)

logger = logging.getLogger(__name__)


def _get_demo_connection_summary() -> ConnectionPoolSummary:
    """Yüksek gerçeklikli kurumsal bağlantı havuzu ve zombie transaction simülasyonu."""
    top_clients = [
        ClientConnectionGroup(
            client_ip="10.10.4.82",
            program_name="CorePaymentService (.NET 8 EF Core)",
            host_name="APP-PROD-PAY-01",
            login_name="app_payments",
            active_connections=14,
            sleeping_connections=48,
            total_connections=62,
            pool_utilization_pct=62.0,
        ),
        ClientConnectionGroup(
            client_ip="10.10.4.83",
            program_name="OrderIngestionWorker (Node.js / pg-pool)",
            host_name="K8S-WORKER-NODE-04",
            login_name="svc_orders",
            active_connections=8,
            sleeping_connections=32,
            total_connections=40,
            pool_utilization_pct=40.0,
        ),
        ClientConnectionGroup(
            client_ip="10.10.6.15",
            program_name="AnalyticsSyncPipeline (Python / SQLAlchemy)",
            host_name="ETL-PIPELINE-02",
            login_name="etl_agent",
            active_connections=3,
            sleeping_connections=12,
            total_connections=15,
            pool_utilization_pct=15.0,
        ),
        ClientConnectionGroup(
            client_ip="10.10.2.110",
            program_name="AdminPortalBackend (Java Spring Boot)",
            host_name="ADMIN-API-SRV",
            login_name="admin_portal_user",
            active_connections=2,
            sleeping_connections=18,
            total_connections=20,
            pool_utilization_pct=20.0,
        ),
        ClientConnectionGroup(
            client_ip="10.10.1.45",
            program_name="Microsoft SQL Server Management Studio",
            host_name="DBA-WORKSTATION-X",
            login_name="dba_erdim",
            active_connections=1,
            sleeping_connections=4,
            total_connections=5,
            pool_utilization_pct=5.0,
        ),
    ]

    sleeping_trans = [
        SleepingTransactionItem(
            session_id=74,
            host_name="APP-PROD-PAY-01",
            program_name="CorePaymentService (.NET 8 EF Core)",
            login_name="app_payments",
            client_ip="10.10.4.82",
            status="sleeping",
            open_tran_count=1,
            transaction_begin_time="2026-11-10T00:41:15",
            idle_duration_sec=1620,  # 27 dakika boşta uyuyor
            transaction_isolation_level="READ COMMITTED",
            last_sql_text="BEGIN TRANSACTION;\nUPDATE dbo.Orders WITH (UPDLOCK) SET PaymentStatus = 'PROCESSING', LastUpdated = GETUTCDATE() WHERE OrderID = 849204;",
            blocked_sessions_count=6,
            database_name="Datapath_TestDB",
            log_bytes_used_mb=42.8,
            severity="CRITICAL",
            risk_summary="Açık işlem 'sleeping' durumunda 27 dakikadır bekliyor. Exclusive kilitleri bırakmadığı için arkasında 6 kullanıcı oturumunu (LCK_M_U) kilitliyor ve transaction log kesilmesini engelliyor.",
        ),
        SleepingTransactionItem(
            session_id=92,
            host_name="ETL-PIPELINE-02",
            program_name="AnalyticsSyncPipeline (Python / SQLAlchemy)",
            login_name="etl_agent",
            client_ip="10.10.6.15",
            status="sleeping",
            open_tran_count=1,
            transaction_begin_time="2026-11-10T00:54:30",
            idle_duration_sec=820,
            transaction_isolation_level="SNAPSHOT",
            last_sql_text="SET TRANSACTION ISOLATION LEVEL SNAPSHOT;\nBEGIN TRAN;\nSELECT COUNT_BIG(*) FROM dbo.CustomerAuditLog WHERE ChangeDate >= '2026-11-09';",
            blocked_sessions_count=0,
            database_name="Datapath_TestDB",
            log_bytes_used_mb=12.4,
            severity="WARNING",
            risk_summary="Snapshot izolasyonunda unutulmuş açık işlem. Doğrudan kilit blokajı yaratmasa da TempDB Version Store temizliğini (Ghost Cleanup) geciktirmekte ve TempDB şişmesine yol açmaktadır.",
        ),
    ]

    return ConnectionPoolSummary(
        server_name="localhost (Demo Telemetry)",
        is_demo=True,
        total_connections=142,
        active_sessions=28,
        sleeping_sessions=114,
        orphaned_sleeping_transactions_count=2,
        max_worker_threads=512,
        current_worker_threads_used=58,
        top_client_groups=top_clients,
        sleeping_transactions=sleeping_trans,
        diagnostic_verdict="DİKKAT: 2 adet 'sleeping' oturum açık transaction (open_tran_count > 0) tutmaktadır. SPID 74 baş bloklayıcı (Lead Blocker) olup 6 oturumu bekletmekte ve log dosyasının büyümesine sebep olmaktadır. Uygulama kodundaki bağlantı sızıntısı (Connection Leak) derhal incelenmelidir.",
    )


def get_connection_pool_summary(
    params: Optional[ConnectionParams] = None, database: Optional[str] = None
) -> ConnectionPoolSummary:
    """SQL Server DMV'lerini tarayarak canlı bağlantı havuzunu ve uyuyan açık işlemleri (Zombie Transactions) çözümler."""
    if not params:
        return _get_demo_connection_summary()

    try:
        conn_params = ConnectionParams(
            server=params.server,
            database=database or params.database or "master",
            driver=params.driver,
            username=params.username,
            password=params.password,
            trusted_connection=params.trusted_connection,
            timeout=params.timeout,
        )
        with get_connection(conn_params) as conn:
            cursor = conn.cursor()
            # 1. Genel sunucu oturum ve iş parçacığı metrikleri
            cursor.execute("""
                SELECT 
                    COUNT(*) AS total_connections,
                    SUM(CASE WHEN s.status IN ('running', 'runnable') THEN 1 ELSE 0 END) AS active_sessions,
                    SUM(CASE WHEN s.status = 'sleeping' THEN 1 ELSE 0 END) AS sleeping_sessions,
                    SUM(CASE WHEN s.status = 'sleeping' AND s.open_transaction_count > 0 THEN 1 ELSE 0 END) AS orphaned_sleeping_count
                FROM sys.dm_exec_sessions s
                WHERE s.is_user_process = 1;
            """)
            row = cursor.fetchone()
            total_conn = row[0] or 0
            active_sess = row[1] or 0
            sleep_sess = row[2] or 0
            orphaned_count = row[3] or 0

            # 2. Worker Threads
            cursor.execute("""
                SELECT 
                    max_workers_count,
                    (SELECT COUNT(*) FROM sys.dm_os_threads) AS active_threads
                FROM sys.dm_os_sys_info;
            """)
            sys_info_row = cursor.fetchone()
            max_workers = sys_info_row[0] if sys_info_row else 512
            active_threads = sys_info_row[1] if sys_info_row else 40

            # 3. İstemci bazlı bağlantı havuzu dağılımı
            cursor.execute("""
                SELECT TOP 15
                    COALESCE(CAST(c.client_net_address AS VARCHAR(50)), '127.0.0.1') AS client_ip,
                    COALESCE(s.program_name, 'Unknown App') AS program_name,
                    COALESCE(s.host_name, 'Unknown Host') AS host_name,
                    COALESCE(s.login_name, 'Unknown Login') AS login_name,
                    SUM(CASE WHEN s.status IN ('running', 'runnable') THEN 1 ELSE 0 END) AS active_connections,
                    SUM(CASE WHEN s.status = 'sleeping' THEN 1 ELSE 0 END) AS sleeping_connections,
                    COUNT(*) AS total_connections
                FROM sys.dm_exec_sessions s
                LEFT JOIN sys.dm_exec_connections c ON s.session_id = c.session_id
                WHERE s.is_user_process = 1
                GROUP BY c.client_net_address, s.program_name, s.host_name, s.login_name
                ORDER BY total_connections DESC;
            """)
            client_rows = cursor.fetchall()
            client_groups = []
            for r in client_rows:
                tot = r[6]
                pct = round((tot / max(total_conn, 1)) * 100.0, 1)
                client_groups.append(
                    ClientConnectionGroup(
                        client_ip=str(r[0]),
                        program_name=str(r[1]),
                        host_name=str(r[2]),
                        login_name=str(r[3]),
                        active_connections=int(r[4] or 0),
                        sleeping_connections=int(r[5] or 0),
                        total_connections=int(tot),
                        pool_utilization_pct=pct,
                    )
                )

            # 4. Açık işlemle uyuyan (Zombie / Orphaned Transactions) oturumlar
            cursor.execute("""
                SELECT 
                    s.session_id,
                    s.host_name,
                    s.program_name,
                    s.login_name,
                    COALESCE(CAST(c.client_net_address AS VARCHAR(50)), 'Localhost') AS client_ip,
                    s.status,
                    s.open_transaction_count,
                    CONVERT(VARCHAR(30), tat.transaction_begin_time, 126) AS transaction_begin_time,
                    DATEDIFF(SECOND, s.last_request_end_time, GETDATE()) AS idle_duration_sec,
                    CASE s.transaction_isolation_level
                        WHEN 0 THEN 'Unspecified'
                        WHEN 1 THEN 'READ UNCOMMITTED'
                        WHEN 2 THEN 'READ COMMITTED'
                        WHEN 3 THEN 'REPEATABLE READ'
                        WHEN 4 THEN 'SERIALIZABLE'
                        WHEN 5 THEN 'SNAPSHOT'
                        ELSE 'READ COMMITTED'
                    END AS isolation_level_desc,
                    DB_NAME(dt.database_id) AS database_name,
                    COALESCE(CAST(dt.database_transaction_log_bytes_used AS FLOAT) / 1048576.0, 0.0) AS log_bytes_used_mb,
                    (
                        SELECT COUNT(DISTINCT wt.session_id) 
                        FROM sys.dm_os_waiting_tasks wt 
                        WHERE wt.blocking_session_id = s.session_id
                    ) AS blocked_sessions_count,
                    SUBSTRING(st.text, 1, 1000) AS last_sql_text
                FROM sys.dm_exec_sessions s
                INNER JOIN sys.dm_tran_session_transactions tst ON s.session_id = tst.session_id
                INNER JOIN sys.dm_tran_active_transactions tat ON tst.transaction_id = tat.transaction_id
                LEFT JOIN sys.dm_tran_database_transactions dt ON tat.transaction_id = dt.transaction_id
                LEFT JOIN sys.dm_exec_connections c ON s.session_id = c.session_id
                OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) st
                WHERE s.is_user_process = 1
                  AND s.status = 'sleeping'
                  AND s.open_transaction_count > 0
                ORDER BY blocked_sessions_count DESC, s.open_transaction_count DESC, idle_duration_sec DESC;
            """)
            sleeping_rows = cursor.fetchall()
            sleeping_list = []
            for sr in sleeping_rows:
                spid = int(sr[0])
                blocked_c = int(sr[12] or 0)
                idle_sec = max(int(sr[8] or 0), 0)
                sev = "CRITICAL" if blocked_c > 0 or idle_sec > 300 else ("WARNING" if idle_sec > 60 else "NORMAL")
                
                risk = (
                    f"Bu oturum {blocked_c} adet diğer oturumu bloklamaktadır (Lead Blocker) ve transaction log alanını rezerve etmektedir."
                    if blocked_c > 0
                    else f"Oturum {idle_sec} saniyedir hiçbir komut çalıştırmadan açık işlem tutmaktadır. Kilitlenme riski taşır."
                )

                sleeping_list.append(
                    SleepingTransactionItem(
                        session_id=spid,
                        host_name=sr[1],
                        program_name=sr[2],
                        login_name=sr[3],
                        client_ip=sr[4],
                        status=sr[5],
                        open_tran_count=int(sr[6]),
                        transaction_begin_time=sr[7],
                        idle_duration_sec=idle_sec,
                        transaction_isolation_level=sr[9] or "READ COMMITTED",
                        database_name=sr[10],
                        log_bytes_used_mb=round(float(sr[11] or 0.0), 2),
                        blocked_sessions_count=blocked_c,
                        last_sql_text=sr[13] or "-- SQL cümlesi önbellekte bulunamadı",
                        severity=sev,
                        risk_summary=risk,
                    )
                )

            # Teşhis özeti oluştur
            if len(sleeping_list) == 0:
                verdict = "SAĞLIKLI: Veritabanında açık işlemle başıboş uyuyan (Zombie/Orphaned Transaction) hiçbir oturum bulunmamaktadır. Bağlantı havuzları düzgün geri bırakılıyor."
            else:
                crit_count = sum(1 for x in sleeping_list if x.severity == "CRITICAL")
                if crit_count > 0:
                    verdict = f"KRİTİK UYARI: {len(sleeping_list)} adet uyuyan oturum açık transaction tutmaktadır ({crit_count} kritik bloklayıcı). Diğer oturumların kilitlenmesini önlemek için oturumlar incelenmeli veya sonlandırılmalıdır."
                else:
                    verdict = f"UYARI: {len(sleeping_list)} adet oturum işlem tamamlandıktan sonra COMMIT/ROLLBACK yapmadan uyumaktadır. Uygulama bağlantı havuzlarında connection leak kontrolü yapılmalıdır."

            return ConnectionPoolSummary(
                server_name="localhost",
                is_demo=False,
                total_connections=total_conn,
                active_sessions=active_sess,
                sleeping_sessions=sleep_sess,
                orphaned_sleeping_transactions_count=len(sleeping_list),
                max_worker_threads=max_workers,
                current_worker_threads_used=active_threads,
                top_client_groups=client_groups,
                sleeping_transactions=sleeping_list,
                diagnostic_verdict=verdict,
            )

    except Exception as exc:
        logger.warning(f"Bağlantı havuzu DMV'leri sorgulanırken hata oluştu ({exc}), demo verisine geçiliyor.")
        return _get_demo_connection_summary()


def get_kill_session_script(session_id: int) -> dict:
    """Belirtilen oturum için güvenli inceleme ve sonlandırma (KILL) betiği üretir."""
    script = f"""-- =========================================================================
-- Datapath Acil Durum Oturum İnceleme ve Güvenli Sonlandırma Betiği
-- Hedef SPID: {session_id}
-- =========================================================================

-- 1. ADIM: Oturumun tuttuğu kilitleri ve beklettiği işlemleri doğrula
SELECT 
    tl.resource_type,
    DB_NAME(tl.resource_database_id) AS database_name,
    tl.resource_description,
    tl.request_mode,
    tl.request_status
FROM sys.dm_tran_locks tl
WHERE tl.request_session_id = {session_id};

-- 2. ADIM: Bu oturumun blokladığı kurbanları listele
SELECT 
    waiting_task_address,
    session_id AS blocked_spid,
    blocking_session_id AS blocker_spid,
    wait_type,
    wait_duration_ms
FROM sys.dm_os_waiting_tasks
WHERE blocking_session_id = {session_id};

-- 3. ADIM: Güvenli Acil Durum Sonlandırma (İşlem otomatik ROLLBACK edilir)
-- UYARI: Bu komut oturumu derhal keser ve uncommitted işlemleri geri alır.
KILL {session_id};
"""
    return {
        "session_id": session_id,
        "investigation_sql": script,
        "kill_command": f"KILL {session_id};",
        "description": f"SPID {session_id} için kilit analizi ve güvenli sonlandırma betiği.",
    }
