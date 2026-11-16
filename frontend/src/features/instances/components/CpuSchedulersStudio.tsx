import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  AlertOctagon,
  ShieldAlert,
  CheckCircle2,
  Clock,
  HardDrive,
  RefreshCw,
  Copy,
  Check,
  FileCode,
  Activity,
  Terminal,
  Sliders,
  Info,
} from 'lucide-react';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import { getSchedulersAnalysis } from '../../../lib/api';
import type { SchedulersResponse, SchedulerCoreItem, NumaNodeItem } from '../../../lib/types';
import styles from './CpuSchedulersStudio.module.css';

export default function CpuSchedulersStudio() {
  const [data, setData] = useState<SchedulersResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showRunbook, setShowRunbook] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSchedulersAnalysis();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'CPU Zamanlayıcıları ve iş parçacığı havuzu analizi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !data) {
    return <LoadingSpinner message="SQL Server CPU SOS Zamanlayıcıları ve Worker Thread Pool yükü denetleniyor..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Zamanlayıcı bilgisi yüklenemedi.'} onRetry={fetchData} />;
  }

  const { summary, schedulers, numa_nodes, remediation_runbook } = data;

  const numaColumns: Column<NumaNodeItem>[] = [
    {
      key: 'node_id',
      label: 'NUMA Düğümü',
      render: (n) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          Node #{n.node_id} ({n.node_state})
        </span>
      ),
    },
    {
      key: 'online_scheduler_count',
      label: 'Çevrimiçi Çekirdek',
      render: (n) => <span>{n.online_scheduler_count} Zamanlayıcı</span>,
    },
    {
      key: 'active_worker_count',
      label: 'Aktif Worker',
      render: (n) => <span>{n.active_worker_count} İş Parçacığı</span>,
    },
    {
      key: 'avg_load_factor',
      label: 'Ortalama Yük Faktörü',
      render: (n) => <span>{n.avg_load_factor.toFixed(1)}</span>,
    },
  ];

  return (
    <div className={styles.studio}>
      {/* 1. Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <Cpu size={20} color="var(--primary-color, #2563eb)" />
            <h3 className={styles.title}>CPU SOS Zamanlayıcıları &amp; İş Parçacığı Havuzu (Worker Threads)</h3>
            <span className={styles.badgeLive}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Live SOS
            </span>
          </div>
          <p className={styles.subtitle}>
            SQL Server Operating System (SOS) zamanlayıcılarını, THREADPOOL tıkanma riskini, runnable görev kuyruklarını ve NUMA düğüm yük dağılımını canlı inceler.
          </p>
        </div>

        <div className={styles.actionsArea}>
          <button className={styles.btnSecondary} onClick={() => setShowRunbook(!showRunbook)}>
            <FileCode size={14} />
            {showRunbook ? 'Reçeteyi Gizle' : 'T-SQL İyileştirme Reçetesi'}
          </button>
          <button className={styles.btnSecondary} onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {/* 2. Diagnostic Verdict Banner */}
      <div
        className={`${styles.verdictBanner} ${
          summary.overall_health === 'CRITICAL'
            ? styles.verdictCritical
            : summary.overall_health === 'WARNING'
            ? styles.verdictWarning
            : styles.verdictHealthy
        }`}
      >
        {summary.overall_health === 'CRITICAL' ? (
          <AlertOctagon size={20} style={{ flexShrink: 0 }} />
        ) : summary.overall_health === 'WARNING' ? (
          <ShieldAlert size={20} style={{ flexShrink: 0 }} />
        ) : (
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
        )}
        <span>{summary.verdict}</span>
      </div>

      {/* 3. KPI Summary Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Worker Havuzu Doluluğu</span>
            <Activity size={16} color="var(--primary-color, #2563eb)" />
          </div>
          <div className={styles.kpiValue}>
            %{summary.worker_utilization_pct}
          </div>
          <div className={styles.kpiFooter}>
            {summary.total_active_workers} / {summary.max_workers_count} Aktif İş Parçacığı
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Kuyrukta Bekleyen Görevler</span>
            <Clock size={16} color={summary.total_work_queue_count > 0 ? '#ef4444' : '#10b981'} />
          </div>
          <div
            className={styles.kpiValue}
            style={{ color: summary.total_work_queue_count > 0 ? '#ef4444' : 'var(--text-primary)' }}
          >
            {summary.total_work_queue_count}
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
              work_queue
            </span>
          </div>
          <div className={styles.kpiFooter}>
            {summary.total_work_queue_count > 0 ? 'DİKKAT: THREADPOOL Beklemesi Var!' : '0 = İş parçacığı kıtlığı yok'}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Ortalama Runnable Görev / Çekirdek</span>
            <Cpu size={16} color={summary.avg_runnable_per_scheduler > 1 ? '#f59e0b' : '#10b981'} />
          </div>
          <div className={styles.kpiValue}>
            {summary.avg_runnable_per_scheduler}
          </div>
          <div className={styles.kpiFooter}>
            Toplam {summary.total_runnable_tasks} görev CPU döngüsü bekliyor
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Bekleyen Disk I/O Talepleri</span>
            <HardDrive size={16} color="#3b82f6" />
          </div>
          <div className={styles.kpiValue}>
            {summary.total_pending_disk_io}
          </div>
          <div className={styles.kpiFooter}>
            {summary.visible_online_schedulers} Görünür Çekirdek • {summary.numa_nodes_count} NUMA Düğümü
          </div>
        </div>
      </div>

      {/* 4. CPU Core Grid (Logical Core Status Matrix) */}
      <div className={styles.coreSection}>
        <div className={styles.coreSectionHeader}>
          <span className={styles.coreSectionTitle}>
            <Cpu size={15} />
            Mantıksal CPU Çekirdekleri &amp; Zamanlayıcı Matrisi ({schedulers.length} Çekirdek)
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Her kutucuk SQL Server Operating System tarafından yönetilen bağımsız bir zamanlayıcıyı temsil eder
          </span>
        </div>

        <div className={styles.coreGrid}>
          {schedulers.map((core) => {
            const isCrit = core.health_status === 'CRITICAL';
            const isWarn = core.health_status === 'WARNING';
            const cls = isCrit ? styles.coreCardCritical : isWarn ? styles.coreCardWarning : styles.coreCardHealthy;

            return (
              <div key={core.scheduler_id} className={`${styles.coreCard} ${cls}`}>
                <div className={styles.coreHeader}>
                  <span>Çekirdek #{core.cpu_id}</span>
                  {core.work_queue_count > 0 && (
                    <span className={styles.queueBadge}>
                      +{core.work_queue_count} Kuyrukta
                    </span>
                  )}
                  {core.is_idle && core.work_queue_count === 0 && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Boşta</span>
                  )}
                </div>

                <div className={styles.coreSub}>
                  Zamanlayıcı ID: {core.scheduler_id} • NUMA {core.numa_node_id}
                </div>

                <div className={styles.coreStats}>
                  <span>Runnable: <strong style={{ color: core.runnable_tasks_count > 0 ? '#f59e0b' : 'var(--text-primary)' }}>{core.runnable_tasks_count}</strong></span>
                  <span>Worker: <strong>{core.active_workers_count}</strong></span>
                </div>

                <div className={styles.coreStats}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Bekleyen I/O: {core.pending_disk_io_count}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Yük: {core.load_factor}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. NUMA Nodes Load Balance Table */}
      {numa_nodes.length > 1 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: 'var(--space-3)' }}>
            NUMA Düğümleri İş Yükü Dağılımı ({numa_nodes.length} Düğüm)
          </span>
          <DataTable data={numa_nodes} columns={numaColumns} />
        </div>
      )}

      {/* 6. Remediation Runbook T-SQL */}
      {showRunbook && (
        <div className={styles.runbookSection}>
          <div className={styles.runbookHeader}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={15} color="var(--primary-color, #2563eb)" />
              Önerilen T-SQL İyileştirme ve Teşhis Betiği
            </span>
            <button className={styles.btnPrimary} onClick={() => handleCopy(remediation_runbook)}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Kopyalandı' : 'Betiği Kopyala'}
            </button>
          </div>
          <div className={styles.runbookCodeArea}>
            <CodeBlock code={remediation_runbook} language="sql" />
          </div>
        </div>
      )}
    </div>
  );
}
