import React, { useState, useEffect } from 'react';
import {
  Wrench,
  CalendarClock,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle,
  FileCode,
  X,
  Play,
  Layers,
  Sparkles,
} from 'lucide-react';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import { getMaintenancePlan } from '../../../lib/api';
import type { MaintenancePlanSummary, MaintenanceActionItem } from '../../../lib/types';
import styles from './SmartMaintenancePlanner.module.css';

interface SmartMaintenancePlannerProps {
  database?: string;
}

export default function SmartMaintenancePlanner({ database }: SmartMaintenancePlannerProps) {
  const [plan, setPlan] = useState<MaintenancePlanSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [minPages, setMinPages] = useState<number>(1000);
  const [activeModal, setActiveModal] = useState<'batch' | 'agent' | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMaintenancePlan({ database, min_pages: minPages });
      setPlan(data);
    } catch (err: any) {
      setError(err.message || 'Bakım planı oluşturulurken bir hata meydana geldi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [database, minPages]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  if (loading) {
    return <LoadingSpinner message="İndeks parçalanması, sayfa sayıları ve istatistik değişiklikleri analiz ediliyor..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchPlan} />;
  }

  if (!plan) {
    return (
      <EmptyState
        title="Bakım Planı Alınamadı"
        message="Veritabanı seçilmedi veya bağlantı kurulamadı."
      />
    );
  }

  const columns: Column<MaintenanceActionItem>[] = [
    {
      key: 'object',
      label: 'Tablo / İndeks',
      render: (item) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {item.schema_name}.{item.table_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {item.index_name} ({item.index_type})
          </div>
        </div>
      ),
    },
    {
      key: 'fragmentation',
      label: 'Parçalanma',
      sortable: true,
      render: (item) => {
        const frag = item.avg_fragmentation_percent;
        const color = frag >= 30 ? '#ef4444' : frag >= 10 ? '#f59e0b' : '#10b981';
        return (
          <div className={styles.fragBarWrapper}>
            <div className={styles.fragBarBg}>
              <div
                className={styles.fragBarFill}
                style={{ width: `${Math.min(100, frag)}%`, backgroundColor: color }}
              />
            </div>
            <span className={styles.fragText} style={{ color }}>
              %{frag.toFixed(1)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'size',
      label: 'Boyut / Sayfa',
      sortable: true,
      render: (item) => (
        <div>
          <span style={{ fontWeight: 600 }}>{item.size_mb.toFixed(1)} MB</span>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {item.page_count.toLocaleString()} sayfa
          </div>
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Akıllı Öneri',
      render: (item) => {
        let badgeClass = styles.badgeNoAction;
        let label = 'Dokunma';
        if (item.action_type.includes('REBUILD')) {
          badgeClass = styles.badgeRebuild;
          label = item.action_type === 'REBUILD_ONLINE' ? 'REBUILD (ONLINE)' : 'REBUILD (OFFLINE)';
        } else if (item.action_type === 'REORGANIZE') {
          badgeClass = styles.badgeReorg;
          label = 'REORGANIZE';
        } else if (item.action_type === 'UPDATE_STATS') {
          badgeClass = styles.badgeStats;
          label = 'UPDATE STATS';
        }

        return <span className={`${styles.actionBadge} ${badgeClass}`}>{label}</span>;
      },
    },
    {
      key: 'reason',
      label: 'Gerekçe & Analiz',
      render: (item) => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {item.reason}
        </span>
      ),
    },
    {
      key: 'copy_sql',
      label: 'İşlem',
      render: (item) => (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => handleCopy(item.command_tsql)}
          title="T-SQL komutunu kopyala"
        >
          <Copy size={12} />
          <span>SQL</span>
        </button>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardRebuild}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Yeniden Oluştur (Rebuild)</span>
            <AlertTriangle size={16} color="#ef4444" />
          </div>
          <span className={styles.kpiVal}>{plan.rebuild_count}</span>
          <span className={styles.kpiDesc}>Parçalanma &gt; %30 olan büyük indeksler</span>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardReorg}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Yeniden Düzenle (Reorg)</span>
            <Wrench size={16} color="#f59e0b" />
          </div>
          <span className={styles.kpiVal}>{plan.reorganize_count}</span>
          <span className={styles.kpiDesc}>Parçalanma %10 - %30 (Kilit oluşturmaz)</span>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardStats}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>İstatistik Tazeleme</span>
            <Sparkles size={16} color="#3b82f6" />
          </div>
          <span className={styles.kpiVal}>{plan.stats_update_count}</span>
          <span className={styles.kpiDesc}>Yoğun satır değişikliği geçiren nesneler</span>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardHealthy}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Atlanan / Korunan</span>
            <CheckCircle size={16} color="#10b981" />
          </div>
          <span className={styles.kpiVal}>{plan.no_action_count}</span>
          <span className={styles.kpiDesc}>Küçük/sağlıklı nesneler (I/O tasarrufu)</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.filterLabel}>Minimum Sayfa Eşiği:</span>
          <select
            className={styles.filterSelect}
            value={minPages}
            onChange={(e) => setMinPages(Number(e.target.value))}
            title="Bu sayfa sayısının altındaki indeksler belleğe sığdığından bakıma dahil edilmez"
          >
            <option value={200}>200 Sayfa (~1.6 MB)</option>
            <option value={500}>500 Sayfa (~4 MB)</option>
            <option value={1000}>1,000 Sayfa (~8 MB - Önerilen)</option>
            <option value={2500}>2,500 Sayfa (~20 MB)</option>
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Tahmini Süre: ~<strong>{plan.estimated_total_minutes} dk</strong> ({plan.total_size_mb} MB)
          </span>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => setActiveModal('batch')}
          >
            <FileCode size={13} />
            <span>Toplu T-SQL Skripti</span>
          </button>

          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setActiveModal('agent')}
          >
            <CalendarClock size={13} />
            <span>SQL Agent İşi Olarak Dışa Aktar</span>
          </button>
        </div>
      </div>

      {/* Detailed Items Table */}
      <DataTable
        columns={columns}
        data={plan.items}
        emptyTitle="İndeks bulunamadı"
        emptyMessage="Bu veritabanında değerlendirilecek indeks tespit edilmedi."
      />

      {/* Modal / Drawer for Generated Scripts */}
      {activeModal && (
        <div className={styles.scriptOverlay} onClick={() => setActiveModal(null)}>
          <div className={styles.scriptModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                {activeModal === 'batch' ? (
                  <>
                    <FileCode size={16} color="var(--accent-primary, #3b82f6)" />
                    Toplu İndeks & İstatistik Bakım Betiği ({plan.database_name})
                  </>
                ) : (
                  <>
                    <CalendarClock size={16} color="var(--accent-primary, #3b82f6)" />
                    SQL Server Agent Otomasyon İşi Kurulumu
                  </>
                )}
              </div>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${copiedScript ? styles.actionBtnPrimary : ''}`}
                  onClick={() =>
                    handleCopy(
                      activeModal === 'batch'
                        ? plan.generated_batch_script
                        : plan.generated_agent_job_tsql
                    )
                  }
                >
                  {copiedScript ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedScript ? 'Kopyalandı!' : 'Tümünü Kopyala'}</span>
                </button>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setActiveModal(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>
                {activeModal === 'batch'
                  ? 'Aşağıdaki T-SQL betiği yalnızca eşik değerleri aşan indeksleri hedefler; TRY/CATCH blokları ile hata durumunda diğer indekslerin bakımını aksatmaz ve 15 saniyelik kilit bekleme sınırı uygular.'
                  : 'Aşağıdaki script SQL Server Agent servisinde Pazar günleri 02:00 saatinde otomatik çalışacak haftalık bir bakım işi oluşturur.'}
              </p>
              <CodeBlock
                code={
                  activeModal === 'batch'
                    ? plan.generated_batch_script
                    : plan.generated_agent_job_tsql
                }
                language="sql"
                maxLines={20}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
