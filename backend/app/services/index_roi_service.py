import logging
from typing import List, Optional
from app.db.connection import ConnectionParams, get_connection
from app.schemas.index_roi import IndexRoiItem, IndexRoiOverview

logger = logging.getLogger(__name__)


def _build_demo_roi_overview(database_name: str) -> IndexRoiOverview:
    """Yüksek gerçeklikli kurumsal İndeks Yatırım Getirisi (ROI) ve Yazma Cezası simülasyonu."""
    demo_items = [
        IndexRoiItem(
            database_name=database_name,
            schema_name="dbo",
            table_name="AuditEvents",
            index_name="IX_AuditEvents_EventDate_Payload",
            index_type="NONCLUSTERED",
            is_unique=False,
            user_seeks=2,
            user_scans=1,
            user_lookups=0,
            total_reads=3,
            total_writes=1450000,
            write_to_read_ratio=483333.3,
            size_mb=420.5,
            row_count=1850000,
            page_lock_wait_count=1420,
            page_io_latch_wait_in_ms=3840.0,
            roi_score=-99.9,
            classification="CRITICAL_BOTTLENECK",
            key_columns="EventDate",
            included_columns="Payload, HostName, UserID",
            verdict_reason="Bu indeks 1.45 milyon kez güncellenmiş ve yalnızca 3 kez okunmuştur. Her INSERT/UPDATE işleminde gereksiz 420 MB veri yazma I/O cezası kesmekte ve sayfa kilitlenmelerine (LCK_M_X) yol açmaktadır.",
            recommended_action="DROP",
            drop_script=f"DROP INDEX [IX_AuditEvents_EventDate_Payload] ON [{database_name}].[dbo].[AuditEvents];",
            rollback_create_script=f"CREATE NONCLUSTERED INDEX [IX_AuditEvents_EventDate_Payload] ON [{database_name}].[dbo].[AuditEvents] ([EventDate]) INCLUDE ([Payload], [HostName], [UserID]) WITH (ONLINE = ON);",
        ),
        IndexRoiItem(
            database_name=database_name,
            schema_name="dbo",
            table_name="OrderTransactions",
            index_name="IX_OrderTransactions_Status_CreatedAt",
            index_type="NONCLUSTERED",
            is_unique=False,
            user_seeks=14,
            user_scans=2,
            user_lookups=0,
            total_reads=16,
            total_writes=890000,
            write_to_read_ratio=55625.0,
            size_mb=285.0,
            row_count=1200000,
            page_lock_wait_count=840,
            page_io_latch_wait_in_ms=1950.0,
            roi_score=-96.4,
            classification="NEGATIVE_ROI",
            key_columns="Status, CreatedAt",
            included_columns="Amount, GatewayReference",
            verdict_reason="Düşük kardinaliteye sahip Status kolonu nedeniyle optimizer tabloyu taramayı tercih ediyor. Okunmadığı halde 890 bin yazma maliyeti üretmektedir.",
            recommended_action="DROP",
            drop_script=f"DROP INDEX [IX_OrderTransactions_Status_CreatedAt] ON [{database_name}].[dbo].[OrderTransactions];",
            rollback_create_script=f"CREATE NONCLUSTERED INDEX [IX_OrderTransactions_Status_CreatedAt] ON [{database_name}].[dbo].[OrderTransactions] ([Status], [CreatedAt]) INCLUDE ([Amount], [GatewayReference]) WITH (ONLINE = ON);",
        ),
        IndexRoiItem(
            database_name=database_name,
            schema_name="dbo",
            table_name="CustomerSessions",
            index_name="IX_CustomerSessions_IpAddress",
            index_type="NONCLUSTERED",
            is_unique=False,
            user_seeks=120,
            user_scans=45,
            user_lookups=10,
            total_reads=175,
            total_writes=350000,
            write_to_read_ratio=2000.0,
            size_mb=115.0,
            row_count=650000,
            page_lock_wait_count=210,
            page_io_latch_wait_in_ms=420.0,
            roi_score=-78.2,
            classification="LOW_ROI",
            key_columns="IpAddress",
            included_columns="LastActivity",
            verdict_reason="Yazma hacmi okumanın 2000 katıdır. Nadir yapılan IP aramaları için tutulan bu indeksin PAGE seviyesinde sıkıştırılması (Page Compression) disk ve bellek ayak izini %60 azaltacaktır.",
            recommended_action="COMPRESS_PAGE",
            drop_script=f"ALTER INDEX [IX_CustomerSessions_IpAddress] ON [{database_name}].[dbo].[CustomerSessions] REBUILD WITH (DATA_COMPRESSION = PAGE, ONLINE = ON);",
            rollback_create_script=f"ALTER INDEX [IX_CustomerSessions_IpAddress] ON [{database_name}].[dbo].[CustomerSessions] REBUILD WITH (DATA_COMPRESSION = NONE, ONLINE = ON);",
        ),
        IndexRoiItem(
            database_name=database_name,
            schema_name="dbo",
            table_name="Orders",
            index_name="PK_Orders_OrderID",
            index_type="CLUSTERED",
            is_unique=True,
            user_seeks=4850000,
            user_scans=12000,
            user_lookups=0,
            total_reads=4862000,
            total_writes=320000,
            write_to_read_ratio=0.07,
            size_mb=890.0,
            row_count=2200000,
            page_lock_wait_count=12,
            page_io_latch_wait_in_ms=15.0,
            roi_score=87.6,
            classification="OPTIMAL_ROI",
            key_columns="OrderID",
            included_columns=None,
            verdict_reason="Birincil anahtar (Primary Key) ve Clustered indeks. Okuma sayısı yazma sayısının 15 katından fazladır ve mükemmel yatırım getirisi sağlamaktadır.",
            recommended_action="KEEP",
            drop_script="-- Primary Key / Clustered indeks silinemez.",
            rollback_create_script="-- No rollback needed.",
        ),
        IndexRoiItem(
            database_name=database_name,
            schema_name="dbo",
            table_name="Customers",
            index_name="IX_Customers_Email",
            index_type="NONCLUSTERED",
            is_unique=True,
            user_seeks=3200000,
            user_scans=450,
            user_lookups=0,
            total_reads=3200450,
            total_writes=45000,
            write_to_read_ratio=0.01,
            size_mb=92.0,
            row_count=450000,
            page_lock_wait_count=4,
            page_io_latch_wait_in_ms=8.0,
            roi_score=97.2,
            classification="OPTIMAL_ROI",
            key_columns="Email",
            included_columns="FirstName, LastName, PhoneNumber",
            verdict_reason="Kapsayıcı (Covering) benzersiz indeks. Giriş doğrulama sorgularını disk I/O yapmadan bellekte çözmektedir.",
            recommended_action="KEEP",
            drop_script=f"DROP INDEX [IX_Customers_Email] ON [{database_name}].[dbo].[Customers];",
            rollback_create_script=f"CREATE UNIQUE NONCLUSTERED INDEX [IX_Customers_Email] ON [{database_name}].[dbo].[Customers] ([Email]) INCLUDE ([FirstName], [LastName], [PhoneNumber]) WITH (ONLINE = ON);",
        ),
    ]

    return IndexRoiOverview(
        database_name=database_name,
        is_demo=True,
        total_evaluated_indexes=len(demo_items),
        negative_roi_count=2,
        wasted_write_iops_total=2340000,
        reclaimable_storage_mb=705.5,
        overall_efficiency_score=68.4,
        items=demo_items,
        executive_summary=f"İndeks ROI Teşhisi: '{database_name}' veritabanında 2 adet negatif ROI üreten indeks tespit edildi. Bu indeksler okunmadığı halde 2.34 milyon yazma (Write IOPS) cezası kesmekte ve 705.5 MB disk alanı işgal etmektedir. Bu indekslerin silinmesi INSERT/UPDATE hızını %35 artıracaktır.",
    )


def get_index_roi_overview(
    params: Optional[ConnectionParams] = None, database_name: Optional[str] = None
) -> IndexRoiOverview:
    """SQL Server DMV'lerini analiz ederek İndeks ROI ve Yazma Cezası matrisini üretir."""
    target_db = database_name or (params.database if params else "Datapath_TestDB") or "Datapath_TestDB"

    if not params:
        return _build_demo_roi_overview(target_db)

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

            sql = f"""
            SELECT 
                SCHEMA_NAME(o.schema_id) AS schema_name,
                o.name AS table_name,
                i.name AS index_name,
                i.type_desc AS index_type,
                i.is_unique,
                i.is_primary_key,
                COALESCE(us.user_seeks, 0) AS user_seeks,
                COALESCE(us.user_scans, 0) AS user_scans,
                COALESCE(us.user_lookups, 0) AS user_lookups,
                COALESCE(us.user_updates, 0) AS user_updates,
                CAST(ps.used_page_count * 8.0 / 1024.0 AS FLOAT) AS size_mb,
                ps.row_count,
                COALESCE(ios.page_lock_wait_count, 0) AS page_lock_wait_count,
                COALESCE(CAST(ios.page_io_latch_wait_in_ms AS FLOAT), 0.0) AS page_io_latch_wait_in_ms,
                key_cols.columns AS key_columns,
                inc_cols.columns AS included_columns
            FROM sys.indexes i
            INNER JOIN sys.objects o ON i.object_id = o.object_id
            LEFT JOIN sys.dm_db_index_usage_stats us 
                ON us.object_id = i.object_id 
                AND us.index_id = i.index_id 
                AND us.database_id = DB_ID()
            LEFT JOIN (
                SELECT 
                    object_id, 
                    index_id, 
                    SUM(used_page_count) AS used_page_count,
                    SUM(row_count) AS row_count
                FROM sys.dm_db_partition_stats
                GROUP BY object_id, index_id
            ) ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
            LEFT JOIN sys.dm_db_index_operational_stats(DB_ID(), NULL, NULL, NULL) ios
                ON ios.object_id = i.object_id AND ios.index_id = i.index_id
            CROSS APPLY (
                SELECT STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
                FROM sys.index_columns ic
                JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
            ) key_cols
            OUTER APPLY (
                SELECT STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.index_column_id) AS columns
                FROM sys.index_columns ic
                JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
            ) inc_cols
            WHERE o.type = 'U'
              AND i.name IS NOT NULL
              AND o.is_ms_shipped = 0
            ORDER BY us.user_updates DESC, ps.used_page_count DESC;
            """

            cursor.execute(sql)
            rows = cursor.fetchall()

            if not rows:
                return _build_demo_roi_overview(target_db)

            items: List[IndexRoiItem] = []
            negative_count = 0
            wasted_writes = 0
            reclaimable_mb = 0.0

            for r in rows:
                s_name = str(r[0])
                t_name = str(r[1])
                i_name = str(r[2])
                i_type = str(r[3])
                is_unq = bool(r[4])
                is_pk = bool(r[5])
                seeks = int(r[6] or 0)
                scans = int(r[7] or 0)
                lookups = int(r[8] or 0)
                writes = int(r[9] or 0)
                size_mb = round(float(r[10] or 0.0), 2)
                row_c = int(r[11] or 0)
                lock_wait = int(r[12] or 0)
                latch_wait = round(float(r[13] or 0.0), 1)
                k_cols = str(r[14] or "")
                inc_cols_val = str(r[15]) if r[15] else None

                reads = seeks + scans + lookups
                ratio = round(writes / max(reads, 1), 1) if reads > 0 else float(writes)

                # ROI Skoru Hesaplama (-100 ile +100 arası)
                if writes == 0 and reads > 0:
                    roi = 100.0
                elif reads == 0 and writes > 0:
                    roi = -100.0
                elif reads == 0 and writes == 0:
                    roi = 0.0
                else:
                    roi = round(((reads - writes) / (reads + writes)) * 100.0, 1)

                # Sınıflandırma ve Reçete
                if is_pk or is_unq:
                    classification = "OPTIMAL_ROI"
                    action = "KEEP"
                    reason = "Birincil anahtar (PK) veya benzersiz (Unique) indeks; veri bütünlüğü gereği korunmalıdır."
                    drop_sql = "-- Bütünlük kısıtlaması nedeniyle silinemez."
                    create_sql = "-- No script needed."
                elif roi <= -75 and size_mb >= 50.0 and writes > 1000:
                    classification = "CRITICAL_BOTTLENECK"
                    action = "DROP"
                    reason = f"Kritik darboğaz: Bu indeks {writes:,} kez güncellenirken yalnızca {reads:,} kez okunmuştur. {size_mb} MB gereksiz yazma I/O cezası kesmektedir."
                    negative_count += 1
                    wasted_writes += writes
                    reclaimable_mb += size_mb
                    drop_sql = f"DROP INDEX [{i_name}] ON [{target_db}].[{s_name}].[{t_name}];"
                    inc_part = f" INCLUDE ([{inc_cols_val.replace(', ', '], [')}])" if inc_cols_val else ""
                    create_sql = f"CREATE NONCLUSTERED INDEX [{i_name}] ON [{target_db}].[{s_name}].[{t_name}] ([{k_cols.replace(', ', '], [')}]) {inc_part} WITH (ONLINE = ON);"
                elif roi < 0:
                    classification = "NEGATIVE_ROI"
                    action = "DROP"
                    reason = f"Negatif ROI: Yazma sayısı ({writes:,}) okuma sayısını ({reads:,}) belirgin şekilde aşmaktadır."
                    negative_count += 1
                    wasted_writes += writes
                    reclaimable_mb += size_mb
                    drop_sql = f"DROP INDEX [{i_name}] ON [{target_db}].[{s_name}].[{t_name}];"
                    inc_part = f" INCLUDE ([{inc_cols_val.replace(', ', '], [')}])" if inc_cols_val else ""
                    create_sql = f"CREATE NONCLUSTERED INDEX [{i_name}] ON [{target_db}].[{s_name}].[{t_name}] ([{k_cols.replace(', ', '], [')}]) {inc_part} WITH (ONLINE = ON);"
                elif roi < 25 and size_mb > 100.0:
                    classification = "LOW_ROI"
                    action = "COMPRESS_PAGE"
                    reason = f"Düşük ROI: Yazma yükünü ve disk ayak izini azaltmak için PAGE seviyesinde veri sıkıştırması uygulanmalıdır."
                    drop_sql = f"ALTER INDEX [{i_name}] ON [{target_db}].[{s_name}].[{t_name}] REBUILD WITH (DATA_COMPRESSION = PAGE, ONLINE = ON);"
                    create_sql = f"ALTER INDEX [{i_name}] ON [{target_db}].[{s_name}].[{t_name}] REBUILD WITH (DATA_COMPRESSION = NONE, ONLINE = ON);"
                else:
                    classification = "OPTIMAL_ROI"
                    action = "KEEP"
                    reason = f"Pozitif ROI: İndeks okuma sorgularını ({reads:,}) verimli şekilde hızlandırmaktadır."
                    drop_sql = f"DROP INDEX [{i_name}] ON [{target_db}].[{s_name}].[{t_name}];"
                    inc_part = f" INCLUDE ([{inc_cols_val.replace(', ', '], [')}])" if inc_cols_val else ""
                    create_sql = f"CREATE NONCLUSTERED INDEX [{i_name}] ON [{target_db}].[{s_name}].[{t_name}] ([{k_cols.replace(', ', '], [')}]) {inc_part} WITH (ONLINE = ON);"

                items.append(
                    IndexRoiItem(
                        database_name=target_db,
                        schema_name=s_name,
                        table_name=t_name,
                        index_name=i_name,
                        index_type=i_type,
                        is_unique=is_unq,
                        user_seeks=seeks,
                        user_scans=scans,
                        user_lookups=lookups,
                        total_reads=reads,
                        total_writes=writes,
                        write_to_read_ratio=ratio,
                        size_mb=size_mb,
                        row_count=row_c,
                        page_lock_wait_count=lock_wait,
                        page_io_latch_wait_in_ms=latch_wait,
                        roi_score=roi,
                        classification=classification,
                        key_columns=k_cols,
                        included_columns=inc_cols_val,
                        verdict_reason=reason,
                        recommended_action=action,
                        drop_script=drop_sql,
                        rollback_create_script=create_sql,
                    )
                )

            total_evaluated = len(items)
            positive_count = sum(1 for it in items if it.roi_score > 0)
            efficiency = round((positive_count / max(total_evaluated, 1)) * 100.0, 1)

            exec_summary = (
                f"Toplam {total_evaluated} indeks değerlendirildi. {negative_count} adet negatif ROI üreten indeks "
                f"yaklaşık {wasted_writes:,} gereksiz yazma I/O maliyeti ve {reclaimable_mb:.1f} MB disk israfı yaratmaktadır."
                if negative_count > 0
                else f"Değerlendirilen {total_evaluated} indeksin tamamı pozitif veya dengeli ROI sağlamaktadır."
            )

            return IndexRoiOverview(
                database_name=target_db,
                is_demo=False,
                total_evaluated_indexes=total_evaluated,
                negative_roi_count=negative_count,
                wasted_write_iops_total=wasted_writes,
                reclaimable_storage_mb=round(reclaimable_mb, 1),
                overall_efficiency_score=efficiency,
                items=items,
                executive_summary=exec_summary,
            )

    except Exception as exc:
        logger.warning("Error querying index ROI DMVs (%s), falling back to demo overview", exc)
        return _build_demo_roi_overview(target_db)
