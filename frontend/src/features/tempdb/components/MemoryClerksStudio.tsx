import React, { useState, useEffect } from 'react';
import {
  Layers,
  Cpu,
  PieChart,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  FileCode,
  Terminal,
  ShieldAlert,
  HardDrive,
  Sparkles,
  Info,
} from 'lucide-react';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import { getMemoryClerksAnalysis } from '../../../lib/api';
import type { MemoryClerksResponse, MemoryClerkDetailItem, NumaMemoryNodeItem } from '../../../lib/types';
import styles from './MemoryClerksStudio.module.css';

export default function MemoryClerksStudio() {
  const [data, setData] = useState<MemoryClerksResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showRunbook, setShowRunbook] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMemoryClerksAnalysis();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Bellek katipleri ve plan cache verileri alınamadı.');
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
    return <LoadingSpinner message="SQL Server bellek katipleri (sys.dm_os_memory_clerks) ve plan önbelleği analiz ediliyor..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Veri yüklenemedi.'} onRetry={fetchData} />;
  }

  const { total_allocated_mb, clerks, plan_cache_bloat, os_memory, numa_nodes, overall_health, diagnostic_verdict, remediation_runbook } = data;

  const clerkColumns: Column<MemoryClerkDetailItem>[] = [
    {
      key: 'friendly_name',
      label: 'Bellek Katibi (Memory Clerk)',
      render: (c) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
            {c.friendly_name}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {c.clerk_type}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Kategori',
      render: (c) => {
        const catCls =
          c.category === 'Buffer Pool'
            ? styles.catBuffer
            : c.category === 'Plan Cache'
            ? styles.catPlan
            : c.category === 'Query Memory'
            ? styles.catQuery
            : c.category === 'Security'
            ? styles.catSecurity
            : styles.catSystem;

        return <span className={`${styles.categoryBadge} ${catCls}`}>{c.category}</span>;
      },
    },
    {
      key: 'pages_mb',
      label: 'Ayrılan RAM (MB)',
      sortable: true,
      render: (c) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {c.pages_mb >= 1024 ? `${(c.pages_mb / 1024).toFixed(2)} GB` : `${c.pages_mb.toFixed(1)} MB`}
        </span>
      ),
    },
    {
      key: 'percentage_of_total',
      label: 'Toplam RAM Oranı',
      sortable: true,
      render: (c) => {
        const color =
          c.category === 'Buffer Pool'
            ? '#3b82f6'
            : c.category === 'Plan Cache'
            ? '#f59e0b'
            : '#10b981';

        return (
          <div className={styles.pctBarWrapper}>
            <div className={styles.pctBarBg}>
              <div
                className={styles.pctBarFill}
                style={{ width: `${Math.min(100, c.percentage_of_total)}%`, backgroundColor: color }}
              />
            </div>
            <span className={styles.pctText} style={{ color }}>
              %{c.percentage_of_total.toFixed(1)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'virtual_memory_mb',
      label: 'Sanal Bellek (Committed)',
      render: (c) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {c.virtual_memory_mb > 0 ? `${c.virtual_memory_mb.toFixed(1)} MB` : '—'}
        </span>
      ),
    },
  ];

  const numaColumns: Column<NumaMemoryNodeItem>[] = [
    {
      key: 'memory_node_id',
      label: 'NUMA Düğümü',
      render: (n) => <strong>Node #{n.memory_node_id}</strong>,
    },
    {
      key: 'total_pages_mb',
      label: 'Düğüm Belleği',
      render: (n) => <span>{n.total_pages_mb >= 1024 ? `${(n.total_pages_mb / 1024).toFixed(2)} GB` : `${n.total_pages_mb} MB`}</span>,
    },
    {
      key: 'foreign_pages_mb',
      label: 'Yabancı Düğüm Belleği (Foreign)',
      render: (n) => (
        <span style={{ color: n.foreign_pages_mb > 100 ? '#f59e0b' : 'var(--text-secondary)' }}>
          {n.foreign_pages_mb.toFixed(1)} MB
        </span>
      ),
    },
    {
      key: 'foreign_ratio_pct',
      label: 'Yabancı Erişim Oranı',
      render: (n) => (
        <span style={{ fontWeight: 600, color: n.foreign_ratio_pct > 10 ? '#ef4444' : '#10b981' }}>
          %{n.foreign_ratio_pct}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.studio}>
      {/* 1. Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <Layers size={20} color="var(--primary-color, #2563eb)" />
            <h3 className={styles.title}>Bellek Katipleri (Memory Clerks) &amp; Plan Cache Şişkinliği</h3>
            <span className={styles.badgeLive}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Live Clerks
            </span>
          </div>
          <p className={styles.subtitle}>
            Buffer Pool dışındaki tüm SQL Server bellek tüketicilerini, ad-hoc tek kullanımlık sorgu planı israfını ve işletim sistemi RAM baskısını analiz eder.
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
          overall_health === 'CRITICAL'
            ? styles.verdictCritical
            : overall_health === 'WARNING'
            ? styles.verdictWarning
            : styles.verdictHealthy
        }`}
      >
        {overall_health === 'CRITICAL' ? (
          <ShieldAlert size={20} style={{ flexShrink: 0 }} />
        ) : overall_health === 'WARNING' ? (
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
        ) : (
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
        )}
        <span>{diagnostic_verdict}</span>
      </div>

      {/* 3. Bloat Warning Alert Banner (if Plan Cache Bloat detected) */}
      {plan_cache_bloat.is_bloat_detected && (
        <div className={styles.bloatBanner}>
          <div className={styles.bloatContent}>
            <Sparkles size={22} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className={styles.bloatTitle}>
                Ad-Hoc Plan Önbelleği Şişkinliği: ~{plan_cache_bloat.reclamation_potential_mb.toFixed(0)} MB RAM Geri Kazanılabilir
              </div>
              <div className={styles.bloatDesc}>
                {plan_cache_bloat.single_use_plans_count.toLocaleString()} adet tek kullanımlık dinamik SQL sorgusu önbellekte {plan_cache_bloat.single_use_plans_mb.toFixed(1)} MB RAM tutuyor.
                Bu sorgular bir daha asla çalışmayacak olsa da tam yürütme planları Buffer Pool alanını daraltıyor.
                <code>sp_configure 'optimize for ad hoc workloads', 1</code> ayarı ile ilk çalıştırmada tam plan yerine 352 baytlık hafif plan stub'ı saklanır.
              </div>
            </div>
          </div>
          <button className={styles.btnPrimary} onClick={() => setShowRunbook(true)}>
            <Terminal size={14} />
            Reçeteyi Uygula
          </button>
        </div>
      )}

      {/* 4. KPI Summary Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Toplam Ayrılmış Bellek</span>
            <Layers size={16} color="var(--primary-color, #2563eb)" />
          </div>
          <div className={styles.kpiValue}>
            {total_allocated_mb >= 1024
              ? `${(total_allocated_mb / 1024).toFixed(2)} GB`
              : `${total_allocated_mb.toFixed(1)} MB`}
          </div>
          <div className={styles.kpiFooter}>
            sys.dm_os_memory_clerks toplamı
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Ad-Hoc Plan İsrafı (Single-Use)</span>
            <PieChart size={16} color={plan_cache_bloat.is_bloat_detected ? '#f59e0b' : '#10b981'} />
          </div>
          <div
            className={styles.kpiValue}
            style={{ color: plan_cache_bloat.is_bloat_detected ? '#f59e0b' : 'var(--text-primary)' }}
          >
            {plan_cache_bloat.single_use_plans_mb.toFixed(1)} MB
          </div>
          <div className={styles.kpiFooter}>
            Plan önbelleğinin %{plan_cache_bloat.adhoc_waste_percentage}'i ({plan_cache_bloat.single_use_plans_count.toLocaleString()} plan)
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>optimize for ad hoc</span>
            <Sparkles size={16} color={plan_cache_bloat.optimize_for_adhoc_enabled ? '#10b981' : '#f59e0b'} />
          </div>
          <div
            className={styles.kpiValue}
            style={{ fontSize: '1.05rem', color: plan_cache_bloat.optimize_for_adhoc_enabled ? '#10b981' : '#f59e0b' }}
          >
            {plan_cache_bloat.optimize_for_adhoc_enabled ? 'Etkin (1)' : 'Devre Dışı (0)'}
          </div>
          <div className={styles.kpiFooter}>
            {plan_cache_bloat.optimize_for_adhoc_enabled
              ? 'Plan stub optimizasyonu devrede'
              : 'Öneri: 1 olarak yapılandırılmalıdır'}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>İşletim Sistemi Fiziksel RAM</span>
            <HardDrive size={16} color="#3b82f6" />
          </div>
          <div className={styles.kpiValue}>
            {os_memory.available_physical_memory_gb.toFixed(1)} GB
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
              / {os_memory.total_physical_memory_gb.toFixed(1)} GB Boş
            </span>
          </div>
          <div className={styles.kpiFooter}>
            SQL Server Kullanımı: {os_memory.sql_memory_in_use_gb.toFixed(1)} GB ({os_memory.system_memory_state})
          </div>
        </div>
      </div>

      {/* 5. Memory Clerks Allocation Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: 'var(--space-3)' }}>
          Bellek Katibi Tahsisat Dağılımı ({clerks.length} Katip)
        </span>
        <DataTable data={clerks} columns={clerkColumns} />
      </div>

      {/* 6. NUMA Memory Nodes */}
      {numa_nodes.length > 1 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: 'var(--space-3)' }}>
            NUMA Bellek Düğümleri Dağılımı ({numa_nodes.length} Düğüm)
          </span>
          <DataTable data={numa_nodes} columns={numaColumns} />
        </div>
      )}

      {/* 7. Remediation Runbook T-SQL */}
      {showRunbook && (
        <div className={styles.runbookSection}>
          <div className={styles.runbookHeader}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={15} color="var(--primary-color, #2563eb)" />
              Önerilen T-SQL İyileştirme ve Temizlik Betiği
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
