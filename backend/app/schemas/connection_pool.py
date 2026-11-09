from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ClientConnectionGroup(BaseModel):
    client_ip: str = Field(..., description="İstemci IP adresi")
    program_name: str = Field(..., description="Uygulama veya sürücü adı (örn. EntityFramework, Dapper, JDBC)")
    host_name: str = Field(..., description="İstemci makine adı")
    login_name: str = Field(..., description="SQL veya Windows oturum açma adı")
    active_connections: int = Field(0, description="Aktif çalışan (running/runnable) bağlantı sayısı")
    sleeping_connections: int = Field(0, description="Uyuyan (sleeping) bağlantı sayısı")
    total_connections: int = Field(0, description="Toplam oturum sayısı")
    pool_utilization_pct: float = Field(0.0, description="Tahmini bağlantı havuzu yoğunluk yüzdesi")


class SleepingTransactionItem(BaseModel):
    session_id: int = Field(..., description="SPID (Oturum ID)")
    host_name: Optional[str] = Field(None, description="İstemci makine")
    program_name: Optional[str] = Field(None, description="Uygulama adı")
    login_name: str = Field(..., description="Oturum kullanıcısı")
    client_ip: Optional[str] = Field(None, description="İstemci IP")
    status: str = Field("sleeping", description="Oturum durumu")
    open_tran_count: int = Field(..., description="Açık işlem sayısı (open_tran_count > 0)")
    transaction_begin_time: Optional[str] = Field(None, description="İşlem başlama zamanı")
    idle_duration_sec: int = Field(..., description="Son aktiviteden bu yana geçen saniye")
    transaction_isolation_level: str = Field("READ COMMITTED", description="İzolasyon seviyesi")
    last_sql_text: Optional[str] = Field(None, description="Oturumun yürüttüğü en son SQL cümlesi")
    blocked_sessions_count: int = Field(0, description="Bu oturum tarafından kilitlenen diğer oturum sayısı")
    database_name: Optional[str] = Field(None, description="Bağlı olduğu veritabanı")
    log_bytes_used_mb: float = Field(0.0, description="Transaction log'da tuttuğu aktif alan (MB)")
    severity: str = Field("WARNING", description="NORMAL, WARNING, CRITICAL (diğerlerini blokluyorsa CRITICAL)")
    risk_summary: str = Field(..., description="Mimari etki ve risk açıklaması")


class ConnectionPoolSummary(BaseModel):
    server_name: str
    is_demo: bool = False
    total_connections: int
    active_sessions: int
    sleeping_sessions: int
    orphaned_sleeping_transactions_count: int
    max_worker_threads: int = 512
    current_worker_threads_used: int = 42
    top_client_groups: List[ClientConnectionGroup] = []
    sleeping_transactions: List[SleepingTransactionItem] = []
    diagnostic_verdict: str = Field(..., description="Sistem geneli bağlantı havuzu ve transaction sağlığı özeti")
