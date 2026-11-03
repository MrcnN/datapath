"""services/rca_service.py — Incident Root-Cause Analysis (RCA) Post-Mortem Generator."""
from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import List

from app.schemas.rca_report import (
    RCACorrectiveAction,
    RCAReport,
    RCARequest,
    RCATimelineEntry,
)

logger = logging.getLogger(__name__)


def generate_rca_post_mortem(req: RCARequest) -> RCAReport:
    """Generate an executive-ready Incident Root-Cause Analysis (RCA) Post-Mortem report."""
    now = datetime.now()
    report_id = f"RCA-{now.strftime('%Y%m%d')}-{int(time.time()) % 10000:04d}"
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    db = req.database or "ProductionDB"
    inc_type = req.incident_type.upper()

    if inc_type == "DEADLOCK":
        title = req.incident_title or f"Deadlock Kilit Kilitlenmesi ve Oturum İptali ({db})"
        severity = "HIGH"
        exec_summary = (
            f"{db} veritabanında iki bağımsız eşzamanlı oturumun aynı tablolara ters sırada (Reverse Locking Order) "
            f"kilit talebinde bulunması nedeniyle karşılıklı döngüsel kilitlenme (Circular Deadlock) meydana gelmiştir. "
            f"SQL Server Deadlock Monitor mekanizması kurban oturumu tespit ederek otomatik 1205 hatası ile işlemi geri almıştır."
        )
        root_cause = (
            f"Olayın temel kök nedeni, uygulama seviyesindeki işlemlerin tablolara erişirken kilit hiyerarşisini takip etmemesidir. "
            f"Kurban oturum güncellemeyi beklerken, kazanan oturum paylaşılan satır kilitlerini elinde tutmuş; "
            f"eksik kapsayıcı indeksler nedeniyle arama yerine tüm indeksin taranması kilit kapsamını genişletmiştir."
        )
        impact = "1 adet kullanıcı oturumu işlem iptali (Error 1205) aldı. Veri kaybı yaşanmadı; işlem geri alındı (Rollback)."
        timeline = [
            RCATimelineEntry(timestamp="T-02:15", event=f"Oturum 1 ({req.spids[0] if req.spids else 'SPID 64'}) yazma işlemine başladı.", severity="INFO"),
            RCATimelineEntry(timestamp="T-01:40", event=f"Oturum 2 ({req.spids[1] if len(req.spids) > 1 else 'SPID 82'}) ters sırada ilgili tabloya kilit talebi iletti.", severity="WARNING"),
            RCATimelineEntry(timestamp="T-00:05", event="Her iki oturum karşılıklı LCK_M_U ve LCK_M_X bekleyişine girdi.", severity="CRITICAL"),
            RCATimelineEntry(timestamp="T-00:00", event="SQL Server Lock Monitor kurbanı seçerek işlemi iptal etti.", severity="INFO"),
        ]
        actions = [
            RCACorrectiveAction(priority="P0", action="Uygulama kodunda tablolara erişim sırasını standardize edin.", owner="Yazılım Geliştirme"),
            RCACorrectiveAction(priority="P1", action=f"{db} üzerinde READ_COMMITTED_SNAPSHOT (RCSI) izolasyon seviyesini değerlendirin.", owner="Kıdemli DBA"),
            RCACorrectiveAction(priority="P2", action="Tablo arama koşullarını karşılayacak Covering Index tanımlayın.", owner="Veritabanı Ekibi"),
        ]
        remediation_tsql = (
            f"-- Önerilen Çözüm: Kilitlenmeyi önlemek için READ_COMMITTED_SNAPSHOT açılması okuma/yazma kilit çekişmesini sıfırlar:\n"
            f"ALTER DATABASE [{db}] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;\n"
            f"-- Tablo erişim optimizasyonu için örnek indeks:\n"
            f"CREATE NONCLUSTERED INDEX [IX_{db}_DeadlockMitigation] ON [{db}].[dbo].[Orders] ([CustomerID]) INCLUDE ([TotalAmount]) WITH (ONLINE = ON);"
        )

    elif inc_type == "BLOCKING_STORM":
        title = req.incident_title or f"Toplu Kilitlenme Zinciri ve Oturum Kuyruğu Krizi ({db})"
        severity = "CRITICAL"
        exec_summary = (
            f"{db} veritabanında uzun süren veya askıda kalan tek bir yazma oturumu (Root Blocker), "
            f"ardından gelen tüm okuma ve yazma işlemlerini arkasına alarak zincirleme bir kilit fırtınasına (Blocking Chain) yol açmıştır. "
            f"Uygulama havuzundaki bağlantı sınırları aşılmış ve kullanıcılar zaman aşımı hataları almıştır."
        )
        root_cause = (
            "Temel neden: Açık bırakılan bir transaction (Sleeping with Open Transaction) veya "
            "indeks eksikliği nedeniyle milyonlarca satırı tarayarak Exclusive Table Lock (Tablo Kilidi) alan toplu veri güncellemesi."
        )
        impact = f"En az {len(req.spids) if req.spids else '12'} oturum kilit kuyruğunda bekletildi; sorgu gecikmeleri 30 saniyenin üzerine çıktı."
        timeline = [
            RCATimelineEntry(timestamp="T-10:00", event="Kök engelleyici oturum açık bir işlem başlattı.", severity="INFO"),
            RCATimelineEntry(timestamp="T-06:00", event="Oturum uyku moduna geçti (Sleeping) fakat COMMIT iletilmedi.", severity="WARNING"),
            RCATimelineEntry(timestamp="T-03:00", event="Bekleyen oturum sayısı 10'un üzerine çıktı, LCK_M_X kilit kuyruğu uzadı.", severity="CRITICAL"),
            RCATimelineEntry(timestamp="T-00:00", event="Olay tespit edildi ve müdahale gerçekleştirildi.", severity="INFO"),
        ]
        actions = [
            RCACorrectiveAction(priority="P0", action="Uygulama bağlantı havuzunda (Connection Pool) uncommitted transaction sızıntılarını giderin.", owner="Yazılım Ekibi"),
            RCACorrectiveAction(priority="P1", action="Toplu güncellemeleri (Batch Update) 5000 satırlık küçük paketlere bölün.", owner="Veritabanı Ekibi"),
            RCACorrectiveAction(priority="P2", action="Kilit bekleme süresi 15 saniyeyi aşan oturumlar için Datapath Webhook alarmı kurun.", owner="Sistem Yöneticisi"),
        ]
        remediation_tsql = (
            f"-- Açık kalan uyuyan oturumları denetleme:\n"
            f"SELECT s.session_id, s.login_name, s.host_name, t.open_transaction_count\n"
            f"FROM sys.dm_exec_sessions s\n"
            f"JOIN sys.dm_tran_session_transactions t ON s.session_id = t.session_id\n"
            f"WHERE s.status = 'sleeping' AND s.open_transaction_count > 0;"
        )

    elif inc_type == "TEMPDB_EXHAUSTION":
        title = req.incident_title or f"TempDB Depolama Alanı Tükenmesi ve PFS Mandallanması ({db})"
        severity = "CRITICAL"
        exec_summary = (
            f"TempDB sürücüsünün disk doluluk oranı kritik eşiği (%95) aşmış ve veritabanı motoru "
            f"sıralama (Sort) ve karma birleştirme (Hash Join) işlemlerini diske dökemeyerek sorguları duraklatmıştır."
        )
        root_cause = (
            "Aşırı büyük geçici tablo kullanımı (#temp), kapatılmamış cursor'lar ve "
            "büyük veri kümelerini belleğe sığdıramayıp TempDB'ye döken (Spill) optimizasyonsuz sorgular."
        )
        impact = "Tüm sunucu genelinde dinamik sorgular ve indeks bakım işleri kilitlendi."
        timeline = [
            RCATimelineEntry(timestamp="T-15:00", event="TempDB veri dosyası hızlı büyüme (Autogrowth) döngüsüne girdi.", severity="INFO"),
            RCATimelineEntry(timestamp="T-08:00", event="PAGELATCH_UP mandallanması %60 seviyesine yükseldi.", severity="WARNING"),
            RCATimelineEntry(timestamp="T-02:00", event="Disk boş alanı 500 MB altına indi.", severity="CRITICAL"),
        ]
        actions = [
            RCACorrectiveAction(priority="P0", action="TempDB dosya büyüme adımlarını sabit MB (512MB) olarak yapılandırın.", owner="DBA"),
            RCACorrectiveAction(priority="P1", action="TempDB'yi OS diskinden (C:) ayrı yüksek hızlı SSD sürücüsüne taşıyın.", owner="Altyapı Ekibi"),
        ]
        remediation_tsql = (
            "-- TempDB dosya büyüme parametrelerini eşitleme:\n"
            "ALTER DATABASE tempdb MODIFY FILE (NAME = tempdev, SIZE = 2048MB, FILEGROWTH = 512MB);\n"
            "ALTER DATABASE tempdb MODIFY FILE (NAME = templog, SIZE = 1024MB, FILEGROWTH = 256MB);"
        )

    else:
        # Generic / Custom Incident
        title = req.incident_title or f"Kritik Veritabanı Performans Olayı ({db})"
        severity = "HIGH"
        exec_summary = f"{db} üzerinde yüksek sistem kaynağı tüketimi ve gecikme artışı gözlenmiştir."
        root_cause = "Sorgu çalışma planı sapmaları veya beklenmedik eşzamanlı işlem yükü."
        impact = "Kullanıcı işlem yanıt sürelerinde artış."
        timeline = [
            RCATimelineEntry(timestamp="T-05:00", event="Metrikler normal seyrin dışına çıktı.", severity="WARNING"),
            RCATimelineEntry(timestamp="T-00:00", event="Teşhis motoru tarafından rapor üretildi.", severity="INFO"),
        ]
        actions = [
            RCACorrectiveAction(priority="P0", action="İlgili sorgu planlarını gözden geçirin.", owner="DBA"),
        ]
        remediation_tsql = "-- Olay analizi için sys.dm_exec_requests incelemesi yapın."

    # Build Markdown Content
    md_lines = [
        f"# Olay Kök Neden Analizi (Post-Mortem Report) — {report_id}",
        f"**Tarih / Saat:** {now_str}  ",
        f"**Veritabanı:** `{db}`  ",
        f"**Önem Derecesi:** `{severity}`  ",
        f"**Olay Başlığı:** {title}",
        "",
        "## 1. Yönetici Özeti (Executive Summary)",
        exec_summary,
        "",
        "## 2. Teknik Kök Neden Analizi (Root Cause Analysis)",
        root_cause,
        "",
        "## 3. İşletimsel ve Hizmet Etkisi (Impact Assessment)",
        impact,
        "",
        "## 4. Olay Kronolojisi (Timeline of Events)",
        "| Zaman | Olay Açıklaması | Seviye |",
        "| :--- | :--- | :--- |",
    ]
    for t in timeline:
        md_lines.append(f"| {t.timestamp} | {t.event} | {t.severity} |")

    md_lines.extend([
        "",
        "## 5. Düzeltici ve Önleyici Eylemler (CAPA Action Items)",
        "| Öncelik | Eylem Maddesi | Sorumlu Ekip | Durum |",
        "| :--- | :--- | :--- | :--- |",
    ])
    for a in actions:
        md_lines.append(f"| **{a.priority}** | {a.action} | {a.owner} | {a.status} |")

    md_lines.extend([
        "",
        "## 6. Önerilen Düzeltme Betiği (Remediation T-SQL)",
        "```sql",
        remediation_tsql,
        "```",
        "",
        "---",
        "*Bu rapor Datapath Olay Analiz Motoru tarafından üretilmiştir.*",
    ])

    return RCAReport(
        report_id=report_id,
        generated_at=now_str,
        incident_title=title,
        severity=severity,
        database=db,
        executive_summary=exec_summary,
        root_cause_analysis=root_cause,
        impact_assessment=impact,
        timeline=timeline,
        corrective_actions=actions,
        remediation_tsql=remediation_tsql,
        markdown_content="\n".join(md_lines),
    )
