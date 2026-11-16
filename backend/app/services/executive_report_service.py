"""services/executive_report_service.py — Executive Database Health & Audit Report Service."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List

from app.schemas.executive_report import (
    ReportPillarSummary,
    PriorityAction,
    ExecutiveReportResponse,
)
from app.services.health_score_service import calculate_health_score

logger = logging.getLogger(__name__)


def generate_executive_health_report() -> ExecutiveReportResponse:
    """Generates an executive-level database health audit report aggregating
    health score pillars, risk assessments, prioritized remediation actions,
    and a print-ready / shareable corporate Markdown report.
    """
    score_data = calculate_health_score()
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S") + " UTC"
    server_name = score_data.server_name or "SQL Server"

    pillars: List[ReportPillarSummary] = []
    key_risks: List[str] = []
    actions: List[PriorityAction] = []

    for p in score_data.pillars:
        pillars.append(
            ReportPillarSummary(
                id=p.id,
                name=p.name,
                score=p.score,
                max_weight=p.weight,
                status=p.status,
                findings=p.findings,
                recommendations=p.recommendations,
            )
        )
        if p.status in ("critical", "warning"):
            for f in p.findings:
                if f not in key_risks:
                    key_risks.append(f)

    # Compile Prioritized Action Plan
    rank = 1
    # Check Backup
    backup_pillar = next((p for p in score_data.pillars if p.id == "backup_rpo"), None)
    if backup_pillar and backup_pillar.status in ("critical", "warning"):
        actions.append(
            PriorityAction(
                rank=rank,
                title="Veritabanı Yedekleme & RPO SLA Güvencesi",
                category="Yedekleme & Felaket Kurtarma",
                urgency="CRITICAL" if backup_pillar.status == "critical" else "HIGH",
                impact="Eksik veya gecikmiş tam/günlük yedekleri, donanım veya veri bozulması krizlerinde veri kaybına yol açabilir.",
                remediation_tsql=(
                    "-- Eksik veritabanı yedeğini sıkıştırmalı ve CHECKSUM doğrulamalı olarak başlatın:\n"
                    "BACKUP DATABASE [Datapath_TestDB]\n"
                    "TO DISK = N'C:\\SQLBackups\\Datapath_TestDB_Full.bak'\n"
                    "WITH COMPRESSION, CHECKSUM, STATS = 10;\n"
                    "GO"
                ),
            )
        )
        rank += 1

    # Check Memory
    mem_pillar = next((p for p in score_data.pillars if p.id == "memory"), None)
    if mem_pillar and mem_pillar.status in ("critical", "warning"):
        actions.append(
            PriorityAction(
                rank=rank,
                title="Bellek Tahsisi ve Sınırlaması (Max Server Memory)",
                category="Bellek & Önbellek",
                urgency="HIGH",
                impact="Max Server Memory sınırlandırılmadığında SQL Server işletim sistemi RAM'ini tüketerek OS donmasına sebep olabilir.",
                remediation_tsql=(
                    "-- İşletim sistemi için güvenli pay bırakarak üst bellek sınırı belirleyin:\n"
                    "EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\n"
                    "EXEC sp_configure 'max server memory (MB)', 28672;\n"
                    "RECONFIGURE WITH OVERRIDE;\n"
                    "GO"
                ),
            )
        )
        rank += 1

    # Check CPU / Paralellik
    cpu_pillar = next((p for p in score_data.pillars if p.id == "cpu_waits"), None)
    if cpu_pillar and cpu_pillar.status in ("critical", "warning"):
        actions.append(
            PriorityAction(
                rank=rank,
                title="İşlemci Paralellik Parametreleri (MAXDOP & CTP)",
                category="İşlemci & Paralellik",
                urgency="HIGH",
                impact="MAXDOP 0 veya CTP 5 ayarları, hafif sorgularda bile tüm çekirdeklerin kilitlenmesine (CXPACKET) sebep olur.",
                remediation_tsql=(
                    "EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\n"
                    "EXEC sp_configure 'cost threshold for parallelism', 50;\n"
                    "EXEC sp_configure 'max degree of parallelism', 4;\n"
                    "RECONFIGURE WITH OVERRIDE;\n"
                    "GO"
                ),
            )
        )
        rank += 1

    # Check Storage
    storage_pillar = next((p for p in score_data.pillars if p.id == "storage"), None)
    if storage_pillar and storage_pillar.status in ("critical", "warning"):
        actions.append(
            PriorityAction(
                rank=rank,
                title="Depolama G/Ç ve Autogrowth Yapılandırması",
                category="Depolama & Disk I/O",
                urgency="MEDIUM",
                impact="Yüzdesel (%) veya çok küçük (1 MB) otomatik büyüme ayarları diskte yoğun parçalanmaya ve I/O gecikmelerine yol açar.",
                remediation_tsql=(
                    "ALTER DATABASE [Datapath_TestDB]\n"
                    "MODIFY FILE (NAME = N'Datapath_TestDB', FILEGROWTH = 256MB);\n"
                    "GO"
                ),
            )
        )
        rank += 1

    # General Best Practice Action if list is short
    if len(actions) < 3:
        actions.append(
            PriorityAction(
                rank=rank,
                title="Ad-Hoc Plan Önbelleği Şişkinlik Koruması",
                category="Sorgu Zekâsı",
                urgency="MEDIUM",
                impact="Parametresiz tek kullanımlık sorguların plan önbelleğinde gigabaytlarca RAM işgal etmesini engeller.",
                remediation_tsql=(
                    "EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\n"
                    "EXEC sp_configure 'optimize for ad hoc workloads', 1;\n"
                    "RECONFIGURE WITH OVERRIDE;\n"
                    "GO"
                ),
            )
        )

    # Format Corporate Markdown Report
    status_emoji = "🟢 SAĞLIKLI" if score_data.status == "healthy" else ("🟡 UYARI" if score_data.status == "warning" else "🔴 KRİTİK")

    md_lines = [
        f"# Datapath — Yönetici Veritabanı Sağlık & Denetim Raporu",
        f"**Hedef Sunucu:** `{server_name}`  ",
        f"**Rapor Tarihi:** {now_str}  ",
        f"**Bütünleşik Sağlık Skoru:** **{score_data.overall_score} / 100** ({status_emoji})  ",
        "\n---\n",
        "## 1. Yönetici Özeti (Executive Summary)",
        f"Datapath Zekâ Platformu tarafından gerçekleştirilen adli telemetri denetimi sonucunda, sunucu genel sağlık skoru **%{score_data.overall_score}** olarak hesaplanmıştır. "
        + ("Sistem genel olarak kararlı çalışmakta olup bazı optimizasyon fırsatları mevcuttur." if score_data.overall_score >= 70 else "Acil müdahale gerektiren mimari riskler tespit edilmiştir."),
        "\n### Mimari Sütun Puanlama Matrisi",
        "| Mimari Sütun | Ağırlık | Alınan Puan | Durum |",
        "| :--- | :---: | :---: | :---: |",
    ]

    for p in pillars:
        status_txt = "Sağlıklı" if p.status == "healthy" else ("Uyarı" if p.status == "warning" else "Kritik Risk")
        md_lines.append(f"| **{p.name}** | {p.max_weight} | **{p.score}** | {status_txt} |")

    md_lines.extend([
        "\n---\n",
        "## 2. Tespit Edilen Temel Riskler & Bulgular",
    ])

    if key_risks:
        for r in key_risks:
            md_lines.append(f"- ⚠️ {r}")
    else:
        md_lines.append("- ✅ Kritik bir operasyonel risk tespit edilmedi.")

    md_lines.extend([
        "\n---\n",
        "## 3. Öncelikli DBA Eylem Planı (Actionable Remediation Runbook)",
        "Aşağıdaki adımlar kıdemli DBA incelemesi (Review-Only) için önem sırasına göre derlenmiştir:",
    ])

    for act in actions:
        md_lines.extend([
            f"\n### {act.rank}. {act.title} [{act.urgency}]",
            f"**Kategori:** {act.category}  ",
            f"**Etki:** {act.impact}  ",
            "```sql",
            act.remediation_tsql,
            "```",
        ])

    md_lines.extend([
        "\n---\n",
        "*Not: Bu rapor Datapath Kurumsal Veritabanı Zekası Platformu tarafından otomatik olarak üretilmiştir. T-SQL komutları üretim ortamında uygulanmadan önce DBA onayından geçirilmelidir.*",
    ])

    return ExecutiveReportResponse(
        server_name=server_name,
        overall_score=score_data.overall_score,
        health_status=score_data.status,
        generated_at=now_str,
        pillars=pillars,
        key_risks=key_risks,
        priority_actions=actions,
        markdown_content="\n".join(md_lines),
    )
