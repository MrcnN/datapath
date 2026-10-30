import React, { useState, useEffect } from 'react';
import {
  Layers,
  Clock,
  AlertTriangle,
  Zap,
  Activity,
  Cpu,
  ShieldCheck,
  RefreshCw,
  Code,
} from 'lucide-react';
import { getMemoryGrantsSummary } from '../../../lib/api';
import type {
  MemoryGrantsSummary,
  QueryMemoryGrantDetail,
} from '../../../lib/types';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import styles from './MemoryGrantsViewer.module.css';

export default function MemoryGrantsViewer() {
  const [data, setData] = useState<MemoryGrantsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMemoryGrantsSummary();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Bellek hibesi verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Sorgu bellek hibeleri ve RESOURCE_SEMAPHORE durumu denetleniyor..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Veri yüklenemedi.'} onRetry={loadData} />;
  }

  const columns: Column<QueryMemoryGrantDetail>[] = [
    {
      key: 'session_id',
      label: 'SPID & İş Parçacığı',
      sortable: true,
      render: (g) => (
        <div>
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>SPID {g.session_id}</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Scheduler #{g.scheduler_id} • DOP: {g.dop}
          </div>
        </div>
      ),
    },
    {
      key: 'is_waiting',
      label: 'Durum & Semaphore',
      sortable: true,
      render: (g) => {
        if (g.is_waiting) {
          return (
            <div>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)', fontWeight: 700 }}>
                BEKLİYOR (RESOURCE_SEMAPHORE)
              </span>
              <div style={{ fontSize: '11px', color: 'var(--status-danger)', marginTop: '2px', fontWeight: 600 }}>
                Bekleme: {(g.wait_time_ms / 1000).toFixed(1)} sn
              </div>
            </div>
          );
        }
        return (
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)', fontWeight: 700 }}>
            TAHSİS EDİLDİ (YÜRÜTÜLÜYOR)
          </span>
        );
      },
    },
    {
      key: 'granted_memory_mb',
      label: 'Talep vs Tahsis (MB)',
      sortable: true,
      render: (g) => (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Tahsis: {g.granted_memory_mb.toFixed(1)} MB
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Talep: {g.requested_memory_mb.toFixed(1)} MB (İdeal: {g.ideal_memory_mb.toFixed(1)} MB)
          </div>
        </div>
      ),
    },
    {
      key: 'used_memory_mb',
      label: 'Gerçek Bellek Kullanımı',
      sortable: true,
      render: (g) => (
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
            Maksimum: {g.max_used_memory_mb.toFixed(1)} MB
          </div>
          {g.waste_ratio_percent > 30 && (
            <div style={{ fontSize: '11px', color: 'var(--status-warning)', fontWeight: 600 }}>
              İsraf: %{g.waste_ratio_percent.toFixed(0)} (Aşırı Tahsis)
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'query_text',
      label: 'Sorgu Metni (T-SQL)',
      render: (g) => (
        <div className={styles.querySnippet} title={g.query_text}>
          {g.query_text}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Aktif Bellek Hibesi</span>
            <Layers size={18} color="var(--accent-blue)" />
          </div>
          <div className={styles.kpiValue}>{data.total_granted_mb.toFixed(1)} MB</div>
          <div className={styles.kpiSub}>{data.total_grant_count} aktif sorgu</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Kuyrukta Bekleyen Sorgu</span>
            <Clock size={18} color={data.waiting_grant_count > 0 ? 'var(--status-danger)' : 'var(--status-success)'} />
          </div>
          <div className={styles.kpiValue} style={{ color: data.waiting_grant_count > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
            {data.waiting_grant_count} Sorgu
          </div>
          <div className={styles.kpiSub}>RESOURCE_SEMAPHORE bekleyenler</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Semaphore Baskısı</span>
            <Activity size={18} color={data.semaphore_pressure === 'HEALTHY' ? 'var(--status-success)' : 'var(--status-danger)'} />
          </div>
          <div className={styles.kpiValue} style={{ color: data.semaphore_pressure === 'HEALTHY' ? 'var(--status-success)' : 'var(--status-danger)' }}>
            {data.semaphore_pressure === 'HEALTHY' ? 'Normal' : data.semaphore_pressure === 'PRESSURE_DETECTED' ? 'Baskı Var' : 'KRİTİK DARBOĞAZ'}
          </div>
          <div className={styles.kpiSub}>Çalışma Belleği Yeterliliği</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Talep Edilen Bellek</span>
            <Zap size={18} color="var(--accent-cyan)" />
          </div>
          <div className={styles.kpiValue}>{data.total_requested_mb.toFixed(1)} MB</div>
          <div className={styles.kpiSub}>Hash Join / Sort işlemleri için</div>
        </div>
      </div>

      {/* Semaphore Waiting Alert */}
      {data.waiting_grant_count > 0 && (
        <div className={styles.semaphoreAlert}>
          <AlertTriangle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>DİKKAT: Bellek Hibesi Kuyruğu (RESOURCE_SEMAPHORE) Oluştu!</strong>
            <div>
              Büyük Sort veya Hash Join işlemi içeren sorgular yeterli çalışma belleği (workspace memory) alamadığı için askıda bekliyor.
              Bu durum CPU düşük görünse bile veritabanında şiddetli kilitlenme ve yanıtsızlığa yol açar.
            </div>
          </div>
        </div>
      )}

      {/* Memory Grants Table */}
      <div className={styles.cardWrap}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <Layers size={16} />
            Anlık Sorgu Bellek Hibeleri &amp; Semaphore Durumu (sys.dm_exec_query_memory_grants)
          </div>
        </div>
        <DataTable
          data={data.grants}
          columns={columns}
          keyField="session_id"
          emptyMessage="Şu anda çalışma belleği kullanan veya sırada bekleyen sorgu yok."
        />
      </div>
    </div>
  );
}
