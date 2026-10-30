import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ListTree,
  PlayCircle,
  XCircle,
  HelpCircle,
  Activity,
  Layers,
  Bell,
  Mail,
} from 'lucide-react';
import AlertsAndMailViewer from './components/AlertsAndMailViewer';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import DemoDataBanner from '../../components/ui/DemoDataBanner';
import { getAgentJobsSummary, getJobStepHistory } from '../../lib/api';
import type { AgentJobsSummary, AgentJobDetail, JobStepHistory } from '../../lib/types';
import styles from './AgentJobsPage.module.css';

export default function AgentJobsPage() {
  const [activeMainTab, setActiveMainTab] = useState<'jobs' | 'alerts'>('jobs');
  const [summary, setSummary] = useState<AgentJobsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FAILED' | 'SUCCESS' | 'DISABLED'>('ALL');
  const [search, setSearch] = useState<string>('');

  const [selectedJob, setSelectedJob] = useState<AgentJobDetail | null>(null);
  const [steps, setSteps] = useState<JobStepHistory[]>([]);
  const [stepsLoading, setStepsLoading] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAgentJobsSummary();
        setSummary(data);
      } catch (err: any) {
        setError(err.message || 'SQL Server Agent işleri alınırken hata oluştu.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleOpenSteps = async (job: AgentJobDetail) => {
    setSelectedJob(job);
    if (job.steps && job.steps.length > 0) {
      setSteps(job.steps);
      return;
    }
    try {
      setStepsLoading(true);
      const stepData = await getJobStepHistory(job.job_id);
      setSteps(stepData);
    } catch {
      setSteps([]);
    } finally {
      setStepsLoading(false);
    }
  };

  const filteredJobs = (summary?.jobs || []).filter((j) => {
    const matchesSearch =
      !search ||
      j.name.toLowerCase().includes(search.toLowerCase()) ||
      j.category.toLowerCase().includes(search.toLowerCase()) ||
      (j.description && j.description.toLowerCase().includes(search.toLowerCase()));

    let matchesStatus = true;
    if (statusFilter === 'FAILED') matchesStatus = j.last_run_status === 'FAILED';
    else if (statusFilter === 'SUCCESS') matchesStatus = j.last_run_status === 'SUCCESS';
    else if (statusFilter === 'DISABLED') matchesStatus = !j.enabled;

    return matchesSearch && matchesStatus;
  });

  const columns: Column<AgentJobDetail>[] = [
    {
      key: 'name',
      label: 'İş Adı & Kategori',
      sortable: true,
      render: (j) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{j.name}</strong>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(59, 130, 246, 0.12)',
                color: 'var(--accent-blue)',
                fontWeight: 600,
              }}
            >
              {j.category}
            </span>
          </div>
          {j.description && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {j.description}
            </div>
          )}
          {j.last_failed_message && (
            <div className={styles.jobFailureSnippet}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{j.last_failed_message}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'enabled',
      label: 'Durum',
      sortable: true,
      render: (j) => (
        <span
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            background: j.enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.15)',
            color: j.enabled ? 'var(--status-success)' : 'var(--text-muted)',
            fontWeight: 600,
          }}
        >
          {j.enabled ? 'Etkin' : 'Devre Dışı'}
        </span>
      ),
    },
    {
      key: 'last_run_status',
      label: 'Son Çalışma Durumu',
      sortable: true,
      render: (j) => {
        const isSuccess = j.last_run_status === 'SUCCESS';
        const isFailed = j.last_run_status === 'FAILED';
        const isRunning = j.last_run_status === 'IN_PROGRESS';
        const bg = isSuccess
          ? 'rgba(34, 197, 94, 0.15)'
          : isFailed
          ? 'rgba(239, 68, 68, 0.15)'
          : isRunning
          ? 'rgba(59, 130, 246, 0.15)'
          : 'rgba(100, 116, 139, 0.15)';
        const color = isSuccess
          ? 'var(--status-success)'
          : isFailed
          ? 'var(--status-danger)'
          : isRunning
          ? 'var(--accent-blue)'
          : 'var(--text-muted)';
        const label = isSuccess
          ? 'Başarılı'
          : isFailed
          ? 'HATA ALDI'
          : isRunning
          ? 'Çalışıyor'
          : 'Çalıştırılmadı';

        return (
          <span
            style={{
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: '4px',
              background: bg,
              color: color,
              fontWeight: 700,
            }}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: 'last_run_date',
      label: 'Son Çalışma & Süre',
      sortable: true,
      render: (j) => (
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {j.last_run_date || '—'}
          </div>
          {j.last_run_duration_sec !== null && j.last_run_duration_sec !== undefined && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Süre: {j.last_run_duration_sec >= 60 ? `${(j.last_run_duration_sec / 60).toFixed(1)} dk` : `${j.last_run_duration_sec} sn`}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'next_run_date',
      label: 'Gelecek Planlı Çalışma',
      sortable: true,
      render: (j) => (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          {j.next_run_date || 'Zamanlama Yok'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Adımlar & Geçmiş',
      render: (j) => (
        <button
          className={styles.viewStepsBtn}
          onClick={() => handleOpenSteps(j)}
          title="İş adımları ve çalışma geçmişini incele"
        >
          <ListTree size={13} />
          Adım Geçmişi
        </button>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className={styles.container}>
      <PageHeader
        title="SQL Server Agent & İş Zekası (Jobs)"
        subtitle="Zamanlanmış yedekleme, bakım ve ETL işleri, adım çalışma geçmişi ve başarısız iş teşhisleri."
      />

      {summary?.is_demo && <DemoDataBanner />}

      {/* Top Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          style={{
            background: activeMainTab === 'jobs' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            color: activeMainTab === 'jobs' ? 'var(--accent-blue)' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onClick={() => setActiveMainTab('jobs')}
        >
          <CalendarClock size={16} />
          Zamanlanmış Agent İşleri ({summary?.total_jobs || 0})
        </button>
        <button
          style={{
            background: activeMainTab === 'alerts' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            color: activeMainTab === 'alerts' ? 'var(--accent-blue)' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onClick={() => setActiveMainTab('alerts')}
        >
          <Bell size={16} />
          Kritik Alarmlar & Database Mail (Severity 17-25, 823-825)
        </button>
      </div>

      {activeMainTab === 'alerts' && <AlertsAndMailViewer />}

      {activeMainTab === 'jobs' && (
        <>
          {/* KPI Cards */}

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>SQL Agent Servisi</span>
            <Activity size={18} color={summary?.agent_running ? 'var(--status-success)' : 'var(--status-danger)'} />
          </div>
          <div className={styles.kpiValue} style={{ color: summary?.agent_running ? 'var(--status-success)' : 'var(--status-danger)' }}>
            {summary?.agent_running ? 'Çalışıyor' : 'DURDURULDU'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Windows Service: SQL Server Agent
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Toplam Agent İşi</span>
            <CalendarClock size={18} color="var(--accent-blue)" />
          </div>
          <div className={styles.kpiValue}>{summary?.total_jobs}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {summary?.enabled_jobs} etkin • {summary?.disabled_jobs} devre dışı
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Son Çalışmada Hata Alan</span>
            <AlertTriangle size={18} color={(summary?.failed_jobs_count || 0) > 0 ? 'var(--status-danger)' : 'var(--status-success)'} />
          </div>
          <div className={styles.kpiValue} style={{ color: (summary?.failed_jobs_count || 0) > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
            {summary?.failed_jobs_count} İş
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {(summary?.failed_jobs_count || 0) > 0 ? 'Müdahale ve inceleme gerektirir!' : 'Tüm işler başarıyla tamamlandı'}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Şu An Çalışan İşler</span>
            <Clock size={18} color="var(--accent-purple)" />
          </div>
          <div className={styles.kpiValue}>{summary?.running_jobs_count}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Anlık yürütülen aktif görev sayısı
          </div>
        </div>
      </div>

      {/* Warning banner if failed jobs exist */}
      {(summary?.failed_jobs_count || 0) > 0 && (
        <div className={styles.dangerAlert}>
          <AlertTriangle size={20} className={styles.alertIcon} />
          <div>
            <strong>Dikkat: Son çalışmasında hata alan SQL Server Agent işleri var!</strong>
            <div>
              Yedekleme, indeks bakımı veya veri aktarımı gibi kritik görevlerin aksamaması için aşağıdaki kırmızı işaretli işlerin hata loglarını inceleyiniz.
            </div>
          </div>
        </div>
      )}

      {/* Controls: Search and Filter buttons */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="İş adı veya kategoriye göre ara..."
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterBtns}>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'ALL' ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Tümü ({summary?.total_jobs || 0})
          </button>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'FAILED' ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter('FAILED')}
          >
            Hatalı İşler ({summary?.failed_jobs_count || 0})
          </button>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'SUCCESS' ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter('SUCCESS')}
          >
            Başarılı İşler
          </button>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'DISABLED' ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter('DISABLED')}
          >
            Devre Dışı ({summary?.disabled_jobs || 0})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className={styles.tableCard}>
        <DataTable
          data={filteredJobs}
          columns={columns}
          emptyMessage="Kriterlere uygun SQL Agent işi bulunamadı."
        />
      </div>
      </>
      )}

      {/* Step History Drawer / Modal */}
      {selectedJob && (
        <div className={styles.modalOverlay} onClick={() => setSelectedJob(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{selectedJob.name}</h3>
                <p>İş Adımları ve Yürütme Kayıtları (Job Steps)</p>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedJob(null)}>✕</button>
            </div>

            {stepsLoading ? (
              <LoadingSpinner message="Adım detayları getiriliyor..." />
            ) : steps.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Bu iş için kayıtlı adım geçmişi bulunamadı.
              </div>
            ) : (
              <div className={styles.stepsTimeline}>
                {steps.map((st) => {
                  const isFail = st.run_status === 'FAILED';
                  const isOk = st.run_status === 'SUCCESS';
                  return (
                    <div key={st.step_id} className={`${styles.stepCard} ${isFail ? styles.stepFailed : ''}`}>
                      <div className={styles.stepTop}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={styles.stepBadge}>Adım {st.step_id}</span>
                          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{st.step_name}</strong>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: isOk ? 'rgba(34, 197, 94, 0.15)' : isFail ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                            color: isOk ? 'var(--status-success)' : isFail ? 'var(--status-danger)' : 'var(--text-muted)',
                          }}
                        >
                          {st.run_status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0' }}>
                        <span>Tarih: {st.run_date}</span>
                        <span>Süre: {st.run_duration_sec} sn</span>
                      </div>

                      <div className={styles.stepMessage}>
                        {st.message}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
