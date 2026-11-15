"""schemas/io_heatmap.py — Pydantic schemas for File IO Latency & Stall Heatmap Studio."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class IOStatus(str, Enum):
    EXCELLENT = "EXCELLENT"
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class FileIOHeatmapItem(BaseModel):
    database_name: str = Field(..., description="Veritabanı adı")
    file_name: str = Field(..., description="Mantıksal dosya adı")
    file_type: str = Field(..., description="Dosya türü (ROWS, LOG, FILESTREAM)")
    physical_name: str = Field(..., description="Fiziksel disk yolu")
    drive_letter: str = Field(..., description="Sürücü harfi (C:, D: vb.)")
    size_mb: float = Field(default=0.0, description="Dosya boyutu (MB)")
    num_of_reads: int = Field(default=0, description="Toplam okuma işlem sayısı")
    num_of_writes: int = Field(default=0, description="Toplam yazma işlem sayısı")
    read_mb: float = Field(default=0.0, description="Okunan toplam veri hacmi (MB)")
    write_mb: float = Field(default=0.0, description="Yazılan toplam veri hacmi (MB)")
    read_latency_ms: float = Field(..., description="Ortalama okuma gecikmesi (ms)")
    write_latency_ms: float = Field(..., description="Ortalama yazma gecikmesi (ms)")
    overall_latency_ms: float = Field(..., description="Ağırlıklı genel I/O gecikmesi (ms)")
    io_stall_read_ms: float = Field(default=0.0, description="Toplam okuma bekleme süresi (ms)")
    io_stall_write_ms: float = Field(default=0.0, description="Toplam yazma bekleme süresi (ms)")
    io_stall_total_ms: float = Field(default=0.0, description="Toplam I/O bekleme süresi (ms)")
    status: IOStatus = Field(default=IOStatus.NORMAL, description="Gecikme sağlık durumu")
    bottleneck_verdict: str = Field(..., description="Darboğaz veya performans değerlendirmesi")
    recommendation: Optional[str] = Field(default=None, description="Operasyonel optimizasyon önerisi")
    rebalance_script: Optional[str] = Field(default=None, description="DBA için T-SQL taşıma/yapılandırma betiği")


class DriveHeatmapGroup(BaseModel):
    drive_letter: str = Field(..., description="Sürücü harfi")
    file_count: int = Field(..., description="Bu sürücüdeki toplam dosya sayısı")
    total_reads: int = Field(default=0, description="Toplam okuma sayısı")
    total_writes: int = Field(default=0, description="Toplam yazma sayısı")
    avg_read_latency_ms: float = Field(..., description="Sürücü ortalama okuma gecikmesi (ms)")
    avg_write_latency_ms: float = Field(..., description="Sürücü ortalama yazma gecikmesi (ms)")
    avg_overall_latency_ms: float = Field(..., description="Sürücü ağırlıklı genel gecikmesi (ms)")
    status: IOStatus = Field(default=IOStatus.NORMAL, description="Sürücü genel I/O durumu")
    files: List[FileIOHeatmapItem] = Field(default_factory=list, description="Sürücüdeki dosyalar")


class IOHeatmapSummary(BaseModel):
    total_files: int = Field(..., description="İncelenen toplam veri ve log dosyası sayısı")
    total_drives: int = Field(..., description="Kullanılan fiziksel/mantıksal sürücü sayısı")
    critical_files_count: int = Field(..., description="Gecikmesi 25 ms üzerinde olan kritik dosya sayısı")
    warning_files_count: int = Field(..., description="Gecikmesi 15-25 ms arası uyarı veren dosya sayısı")
    optimal_files_count: int = Field(..., description="Gecikmesi 5 ms altı mükemmel dosya sayısı")
    highest_latency_file: str = Field(..., description="En yüksek I/O gecikmesine sahip dosya")
    highest_latency_ms: float = Field(..., description="En yüksek gecikme süresi (ms)")
    total_io_stall_sec: float = Field(..., description="Sistem başlangıcından bu yana toplam I/O bekleme süresi (sn)")
    avg_read_latency_ms: float = Field(..., description="Filo geneli ortalama okuma gecikmesi (ms)")
    avg_write_latency_ms: float = Field(..., description="Filo geneli ortalama yazma gecikmesi (ms)")


class IOHeatmapResponse(BaseModel):
    summary: IOHeatmapSummary
    drives: List[DriveHeatmapGroup]
    all_files: List[FileIOHeatmapItem]
    recommendations: List[str] = Field(default_factory=list, description="Genel I/O iyileştirme tavsiyeleri")
    evaluated_at: str = Field(..., description="Sorgulama zamanı")
