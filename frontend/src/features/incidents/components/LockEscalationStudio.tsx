import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  AlertTriangle,
  Clock,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  FileCode,
  Copy,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import { getLockEscalationAnalysis } from '../../../lib/api';
import type {
  LockEscalationResponse,
  LockContentionItem,
} from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import styles from './LockEscalationStudio.module.css';

export default function LockEscalationStudio() {
  const [data, setData] = useState<LockEscalationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedItem, setSelectedItem] = useState<LockContentionItem | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLockEscalationAnalysis();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Kilit yükseltme ve çakışma verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        item.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.schema_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.index_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchSeverity =
        severityFilter === 'ALL' || item.contention_severity === severityFilter;

      return matchSearch && matchSeverity;
    });
  }, [data?.items, searchQuery, severityFilter]);

  if (loading && !data) {
    return <LoadingSpinner message="Kilit eskalasyonu ve nesne çakışma istatistikleri taranıyor..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const summary = data?.summary;
  const isCriticalOverall = (summary?.total_escalation_count ?? 0) > 0 || (summary?.total_lock_wait_ms ?? 0) > 2000;

  return (
    <div className={styles.studio}>
      {/* Studio Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Kilit Yükseltme &amp; Çakışma Isı Haritası</h2>
            <span className={styles.badgeLive}>
              <span className={styles.legendDot} style={{ background: '#10b981' }} />
              Canlı DMV Telemetrisi
            </span>
          </div>
          <p className={styles.subtitle}>
            Satır ve sayfa kilit birikimlerini, 5.000 eşiğini aşarak tüm tabloyu kilitleyen Table Lock eskalasyonlarını
            (sys.dm_db_index_operational_stats) adli düzeyde analiz eder.
          </p>
        </div>

        <div className={styles.actionsArea}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={fetchData}
            title="Telemetriyi Yenile"
          >
            <RefreshCw size={13} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className={styles.kpiGrid}>
        <div
          className={styles.kpiCard}
          data-status={summary && summary.total_lock_wait_ms > 1000 ? 'critical' : 'optimal'}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Toplam Kilit Beklemesi</span>
            <div className={styles.kpiIconWrap}>
              <Clock size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary ? (summary.total_lock_wait_ms / 1000).toFixed(2) : 0}s
          </div>
          <span className={styles.kpiDesc}>Satır ve sayfa kilitlerinde beklenen kümülatif süre</span>
        </div>

        <div
          className={styles.kpiCard}
          data-status={summary && summary.total_escalation_count > 0 ? 'critical' : 'optimal'}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Gerçekleşen Eskalasyon</span>
            <div className={styles.kpiIconWrap} style={{ color: summary && summary.total_escalation_count > 0 ? '#ef4444' : undefined }}>
              <Flame size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary?.total_escalation_count || 0}
          </div>
          <span className={styles.kpiDesc}>Tablo geneline yükseltilen (Table Lock) kilit adedi</span>
        </div>

        <div
          className={styles.kpiCard}
          data-status={summary && summary.contended_objects_count > 0 ? 'warning' : 'optimal'}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Çakışan Nesneler</span>
            <div className={styles.kpiIconWrap}>
              <ShieldAlert size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary?.contended_objects_count || 0} / {summary?.total_objects_analyzed || 0}
          </div>
          <span className={styles.kpiDesc}>Kilit beklemesi veya eskalasyon denemesi yaşayan tablolar</span>
        </div>

        <div className={styles.kpiCard} data-status="optimal">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>En Yoğun Çakışan Tablo</span>
            <div className={styles.kpiIconWrap}>
              <Layers size={14} />
            </div>
          </div>
          <div className={styles.kpiVal} style={{ fontSize: '1.05rem', wordBreak: 'break-all' }}>
            {summary?.top_contended_object || 'Yok'}
          </div>
          <span className={styles.kpiDesc}>En yüksek bekleme ve kilit yoğunluğuna sahip nesne</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={14} color="var(--text-tertiary)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Tablo, şema veya indeks adına göre filtrele..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <button
            type="button"
            className={`${styles.filterPill} ${severityFilter === 'ALL' ? styles.filterPillActive : ''}`}
            onClick={() => setSeverityFilter('ALL')}
          >
            Tümü ({data?.items.length || 0})
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${severityFilter === 'CRITICAL' ? styles.filterPillActive : ''}`}
            onClick={() => setSeverityFilter('CRITICAL')}
          >
            Kritik Eskalasyon ({data?.items.filter((i) => i.contention_severity === 'CRITICAL').length || 0})
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${severityFilter === 'WARNING' ? styles.filterPillActive : ''}`}
            onClick={() => setSeverityFilter('WARNING')}
          >
            Uyarı / Bekleme ({data?.items.filter((i) => i.contention_severity === 'WARNING').length || 0})
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${severityFilter === 'HEALTHY' ? styles.filterPillActive : ''}`}
            onClick={() => setSeverityFilter('HEALTHY')}
          >
            Sağlıklı ({data?.items.filter((i) => i.contention_severity === 'HEALTHY').length || 0})
          </button>
        </div>
      </div>

      {/* Forensic Contention Heatmap Table */}
      <div className={styles.tableCard}>
        {filteredItems.length === 0 ? (
          <EmptyState
            title="Eşleşen Kilit Çakışması Bulunamadı"
            description="Seçili arama veya ciddiyet filtrelerine uyan herhangi bir tablo ya da indeks kaydı mevcut değil."
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tablo &amp; Şema</th>
                  <th>İndeks &amp; Tip</th>
                  <th>Kilit Dağılımı</th>
                  <th>Satır Kilitleri</th>
                  <th>Sayfa Kilitleri</th>
                  <th>Eskalasyon</th>
                  <th>Ayar</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'right' }}>Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const totalLocks = Math.max(1, item.row_lock_count + item.page_lock_count);
                  const rowPct = Math.round((item.row_lock_count / totalLocks) * 100);
                  const pagePct = 100 - rowPct;

                  return (
                    <tr key={`${item.schema_name}-${item.table_name}-${item.index_name}-${idx}`}>
                      <td>
                        <div className={styles.objCell}>
                          <span className={styles.objName}>
                            {item.schema_name}.{item.table_name}
                          </span>
                          <span className={styles.objMeta}>
                            Bölüm #{item.partition_number} &bull; {item.database_name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.objCell}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                            {item.index_name}
                          </span>
                          <span className={styles.objMeta}>{item.index_type}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.ratioBarWrap}>
                          <div className={styles.ratioBar}>
                            <div className={styles.barRow} style={{ width: `${rowPct}%` }} title={`Satır: %${rowPct}`} />
                            <div className={styles.barPage} style={{ width: `${pagePct}%` }} title={`Sayfa: %${pagePct}`} />
                          </div>
                          <div className={styles.ratioLegend}>
                            <span>
                              <span className={styles.legendDot} style={{ background: '#3b82f6' }} /> Satır %{rowPct}
                            </span>
                            <span>
                              <span className={styles.legendDot} style={{ background: '#f59e0b' }} /> Sayfa %{pagePct}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.objCell}>
                          <span className={styles.numVal}>{item.row_lock_count.toLocaleString()} istek</span>
                          <span className={styles.objMeta}>
                            {item.row_lock_wait_count} bekleyen &bull; {item.row_lock_wait_ms} ms
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.objCell}>
                          <span className={styles.numVal}>{item.page_lock_count.toLocaleString()} istek</span>
                          <span className={styles.objMeta}>
                            {item.page_lock_wait_count} bekleyen &bull; {item.page_lock_wait_ms} ms
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.objCell}>
                          <span
                            className={styles.numVal}
                            style={{
                              color: item.escalation_count > 0 ? '#ef4444' : 'var(--text-primary)',
                              fontWeight: item.escalation_count > 0 ? 700 : 500,
                            }}
                          >
                            {item.escalation_count} eskalasyon
                          </span>
                          <span className={styles.objMeta}>
                            {item.escalation_attempt_count} deneme (%{item.escalation_rate_pct})
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.settingBadge}>{item.lock_escalation_setting}</span>
                      </td>
                      <td>
                        {item.contention_severity === 'CRITICAL' && (
                          <span className={`${styles.severityBadge} ${styles.sevCritical}`}>
                            <Flame size={11} /> Kritik
                          </span>
                        )}
                        {item.contention_severity === 'WARNING' && (
                          <span className={`${styles.severityBadge} ${styles.sevWarning}`}>
                            <AlertTriangle size={11} /> Uyarı
                          </span>
                        )}
                        {item.contention_severity === 'MODERATE' && (
                          <span className={`${styles.severityBadge} ${styles.sevModerate}`}>
                            <Info size={11} /> Çakışma
                          </span>
                        )}
                        {item.contention_severity === 'HEALTHY' && (
                          <span className={`${styles.severityBadge} ${styles.sevHealthy}`}>
                            <ShieldCheck size={11} /> Sağlıklı
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={styles.btnInspect}
                          onClick={() => setSelectedItem(item)}
                        >
                          <span>Detay &amp; T-SQL</span>
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Forensic Detail & T-SQL Modal Drawer */}
      {selectedItem && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedItem(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitleArea}>
                <h3 className={styles.drawerTitle}>
                  {selectedItem.schema_name}.{selectedItem.table_name}
                </h3>
                <span className={styles.drawerSub}>
                  İndeks: {selectedItem.index_name} ({selectedItem.index_type}) &bull; Mevcut Ayar: {selectedItem.lock_escalation_setting}
                </span>
              </div>
              <button
                type="button"
                className={styles.btnClose}
                onClick={() => setSelectedItem(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              {/* Verdict Box */}
              <div className={styles.verdictBox}>
                <span className={styles.verdictTitle}>
                  <AlertTriangle size={14} color="var(--accent)" />
                  Adli Teşhis &amp; Çakışma Değerlendirmesi
                </span>
                <p className={styles.verdictText}>{selectedItem.diagnostic_verdict}</p>
              </div>

              {/* Detailed Metrics Grid */}
              <div className={styles.metricsGrid}>
                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Satır Kilidi Beklemesi</span>
                  <span className={styles.metricBlockVal}>{selectedItem.row_lock_wait_ms} ms</span>
                  <span className={styles.metricBlockSub}>{selectedItem.row_lock_wait_count} bekleme olayı</span>
                </div>

                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Sayfa Kilidi Beklemesi</span>
                  <span className={styles.metricBlockVal}>{selectedItem.page_lock_wait_ms} ms</span>
                  <span className={styles.metricBlockSub}>{selectedItem.page_lock_wait_count} bekleme olayı</span>
                </div>

                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Gerçekleşen Table Lock</span>
                  <span className={styles.metricBlockVal} style={{ color: selectedItem.escalation_count > 0 ? '#ef4444' : undefined }}>
                    {selectedItem.escalation_count}
                  </span>
                  <span className={styles.metricBlockSub}>{selectedItem.escalation_attempt_count} eskalasyon denemesi</span>
                </div>

                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Mandal (Latch) Çakışması</span>
                  <span className={styles.metricBlockVal}>{selectedItem.page_latch_wait_ms + selectedItem.page_io_latch_wait_ms} ms</span>
                  <span className={styles.metricBlockSub}>Bellek içi + G/Ç sayfa beklemeleri</span>
                </div>
              </div>

              {/* T-SQL Remediation Card */}
              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span className={styles.codeTitle}>Önerilen T-SQL İyileştirme Betiği (Review-Only)</span>
                  <button
                    type="button"
                    className={styles.btnCopy}
                    onClick={() => handleCopyCode(selectedItem.remediation_tsql)}
                  >
                    {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{copied ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
                  </button>
                </div>
                <pre className={styles.codeContent}>{selectedItem.remediation_tsql}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
