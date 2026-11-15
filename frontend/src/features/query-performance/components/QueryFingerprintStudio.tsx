import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Search,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Terminal,
  AlertTriangle,
  Flame,
  FileCode,
  ArrowUpRight,
  Database as DbIcon,
  X,
  Split,
  Cpu,
} from 'lucide-react';
import styles from './QueryFingerprintStudio.module.css';
import { getQueryFingerprints } from '../../../lib/api';
import type {
  QueryFingerprintResponse,
  QueryFingerprintItem,
} from '../../../lib/types';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';

export default function QueryFingerprintStudio() {
  const [data, setData] = useState<QueryFingerprintResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [metric, setMetric] = useState<string>('duration');
  const [modalSql, setModalSql] = useState<{ title: string; desc: string; sql: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getQueryFingerprints(metric, 50, searchQuery || undefined);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Sorgu parmak izi verileri alınırken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [metric, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <LoadingSpinner message="Sorgular query_hash bazında gruplanıyor ve parmak izi şablonları normalleştiriliyor..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Sorgu parmak izi verisi yüklenemedi.'} onRetry={loadData} />;
  }

  const { summary, signatures, recommendations } = data;

  const columns: Column<QueryFingerprintItem>[] = [
    {
      key: 'normalized_signature',
      label: 'Normalleştirilmiş Sorgu İmzası (Signature)',
      sortable: false,
      render: (s) => (
        <div style={{ maxWidth: '420px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-blue)', fontWeight: 600 }}>
              {s.query_hash}
            </span>
            <span
              style={{
                fontSize: '10.5px',
                padding: '1px 6px',
                borderRadius: '4px',
                background:
                  s.risk_verdict === 'CRITICAL_BLOAT'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : s.risk_verdict === 'HIGH_VARIANCE'
                    ? 'rgba(234, 179, 8, 0.15)'
                    : 'rgba(34, 197, 94, 0.15)',
                color:
                  s.risk_verdict === 'CRITICAL_BLOAT'
                    ? 'var(--status-danger)'
                    : s.risk_verdict === 'HIGH_VARIANCE'
                    ? '#eab308'
                    : 'var(--status-success)',
                fontWeight: 600,
              }}
            >
              {s.risk_verdict === 'CRITICAL_BLOAT'
                ? 'Plan Cache Şişmesi'
                : s.risk_verdict === 'HIGH_VARIANCE'
                ? 'Yüksek Varyans (Sniffing)'
                : 'Optimal'}
            </span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>({s.database_name})</span>
          </div>
          <pre className={styles.queryCode}>{s.normalized_signature}</pre>
        </div>
      ),
    },
    {
      key: 'total_executions',
      label: 'Toplam Çalıştırma & Plan',
      sortable: true,
      render: (s) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13.5px' }}>
            {s.total_executions.toLocaleString()} kez
          </div>
          <div style={{ fontSize: '11.5px', color: s.plan_variants_count > 1 ? '#eab308' : 'var(--text-muted)', marginTop: '2px' }}>
            {s.plan_variants_count} Farklı Yürütme Planı
          </div>
          {s.is_adhoc_unparameterized && (
            <div style={{ fontSize: '10.5px', color: 'var(--status-danger)', fontWeight: 500 }}>
              Literal değerler parametresiz
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'total_duration_ms',
      label: 'Toplam & Ort. Süre',
      sortable: true,
      render: (s) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13.5px' }}>
            {s.total_duration_ms >= 1000
              ? `${(s.total_duration_ms / 1000).toFixed(1)} sn`
              : `${s.total_duration_ms.toFixed(0)} ms`}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Ort: <strong>{s.avg_duration_ms.toFixed(1)} ms</strong>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Min: {s.min_duration_ms.toFixed(1)} ms • Max: {s.max_duration_ms.toFixed(1)} ms
          </div>
        </div>
      ),
    },
    {
      key: 'duration_variance_ratio',
      label: 'Süre Varyansı (Max/Min)',
      sortable: true,
      render: (s) => (
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: '13px',
              color: s.duration_variance_ratio > 50 ? 'var(--status-danger)' : s.duration_variance_ratio > 10 ? '#eab308' : 'var(--text-primary)',
            }}
          >
            {s.duration_variance_ratio.toFixed(0)}x Kat Fark
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            CPU: {s.avg_cpu_ms.toFixed(1)} ms
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Ort. Okuma: {s.avg_logical_reads.toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      key: 'risk_verdict',
      label: 'Aksiyon & Reçete',
      render: (s) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() =>
              setModalSql({
                title: `Sorgu İmzası (${s.query_hash}) İyileştirme Planı`,
                desc: s.is_adhoc_unparameterized
                  ? 'Bu sorgu ailesi parametresiz literal değerlerle çalışmaktadır. SQL Server her farklı değer için yeni bir yürütme planı derleyip belleği şişirir. Aşağıdaki betik ile sp_executesql veya Forced Parameterization uygulanabilir.'
                  : 'Sorgu ailesi detayları ve optimizasyon reçetesi:',
                sql: s.remediation_sql,
              })
            }
          >
            <FileCode size={12} /> T-SQL Reçetesi
          </button>

          <button
            type="button"
            className={styles.actionBtn}
            onClick={() =>
              setModalSql({
                title: `Ham Örnek Sorgu Metni (${s.query_hash})`,
                desc: 'SQL Server önbelleğinde yakalanan ham çalışan sorgu örneği:',
                sql: s.sample_raw_sql,
              })
            }
          >
            <Search size={12} /> Ham SQL Örneği
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* Metric Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Tekil Sorgu Aileleri</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
              <Layers size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{summary.total_signatures_evaluated}</div>
          <div className={styles.kpiSub}>Normalleştirilmiş query_hash şablonu</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Toplam Çalıştırma Hacmi</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)' }}>
              <Zap size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{summary.total_server_executions.toLocaleString()}</div>
          <div className={styles.kpiSub}>Tüm parametrik çağrılar dahil</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Parametresiz Şişme Riski</span>
            <div
              className={styles.kpiIconWrap}
              style={{
                background: summary.adhoc_unparameterized_count > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: summary.adhoc_unparameterized_count > 0 ? 'var(--status-danger)' : 'var(--status-success)',
              }}
            >
              <Flame size={17} />
            </div>
          </div>
          <div
            className={styles.kpiValue}
            style={{ color: summary.adhoc_unparameterized_count > 0 ? 'var(--status-danger)' : 'inherit' }}
          >
            {summary.adhoc_unparameterized_count}
          </div>
          <div className={styles.kpiSub}>Ad-Hoc plan cache şişmesi oluşturan</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Çoklu Plan Kararsızlığı</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
              <Split size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{summary.multi_plan_signatures_count}</div>
          <div className={styles.kpiSub}>Aynı sorgu için &gt;1 plan derleyen</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>#1 Ailenin Sunucu Payı</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)' }}>
              <ArrowUpRight size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>%{summary.top_signature_impact_pct.toFixed(1)}</div>
          <div className={styles.kpiSub}>En çok süre tüketen tekil şablon</div>
        </div>
      </div>

      {/* Advisory Banner */}
      <div
        className={`${styles.alertBox} ${
          summary.adhoc_unparameterized_count > 0
            ? styles.alertBoxCritical
            : summary.multi_plan_signatures_count > 0
            ? styles.alertBoxWarning
            : styles.alertBoxHealthy
        }`}
      >
        <AlertTriangle
          size={20}
          color={
            summary.adhoc_unparameterized_count > 0
              ? 'var(--status-danger)'
              : summary.multi_plan_signatures_count > 0
              ? '#eab308'
              : 'var(--status-success)'
          }
        />
        <div className={styles.alertContent}>
          <strong>
            {summary.adhoc_unparameterized_count > 0
              ? 'Sorgu Normalleştirme ve Plan Cache Şişmesi Tespit Edildi'
              : 'Sorgu İmzaları ve Parametreleme Durumu Sağlıklı'}
          </strong>
          <ul className={styles.recommendationsList}>
            {recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <div className={styles.searchBox}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Şablon SQL metni veya query_hash ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            className={styles.selectInput}
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            <option value="duration">Toplam Süreye Göre Sırala</option>
            <option value="cpu">Toplam CPU Süresine Göre</option>
            <option value="executions">Çalıştırma Sayısına Göre</option>
            <option value="reads">Mantıksal Okumaya Göre</option>
          </select>
        </div>

        <button type="button" className={styles.refreshBtn} onClick={loadData}>
          <RefreshCw size={14} /> Yenile
        </button>
      </div>

      {/* Table */}
      <div className={styles.cardTable}>
        <DataTable
          columns={columns}
          data={signatures}
          emptyMessage="Kriterlere uygun sorgu parmak izi bulunamadı."
        />
      </div>

      {/* Modal Drawer */}
      {modalSql && (
        <div className={styles.modalOverlay} onClick={() => setModalSql(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <Terminal size={16} color="var(--accent-blue)" />
                {modalSql.title}
              </div>
              <button type="button" className={styles.closeBtn} onClick={() => setModalSql(null)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalExplainer}>{modalSql.desc}</div>
              <pre className={styles.sqlPreWrap}>{modalSql.sql}</pre>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.actionBtn}
                style={{ padding: '7px 12px' }}
                onClick={() => setModalSql(null)}
              >
                Kapat
              </button>
              <button
                type="button"
                className={styles.copyPrimaryBtn}
                onClick={() => handleCopy(modalSql.sql)}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Kopyalandı' : 'T-SQL Betiğini Kopyala'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
