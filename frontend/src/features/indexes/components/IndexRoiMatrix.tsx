import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Database,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  X,
  Code2,
  Trash2,
  Zap,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { getIndexRoiOverview } from '../../../lib/api';
import type { IndexRoiOverview, IndexRoiItem } from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import DemoDataBanner from '../../../components/ui/DemoDataBanner';
import styles from './IndexRoiMatrix.module.css';

interface IndexRoiMatrixProps {
  database?: string;
}

export default function IndexRoiMatrix({ database }: IndexRoiMatrixProps) {
  const [data, setData] = useState<IndexRoiOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [classificationFilter, setClassificationFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  // Modal
  const [selectedItem, setSelectedItem] = useState<IndexRoiItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getIndexRoiOverview(database);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'İndeks ROI ve yazma cezası verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [database]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredItems = (data?.items || []).filter((item) => {
    if (classificationFilter !== 'ALL' && item.classification !== classificationFilter) return false;
    if (actionFilter !== 'ALL' && item.recommended_action !== actionFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTable = item.table_name.toLowerCase().includes(q);
      const matchIndex = item.index_name.toLowerCase().includes(q);
      const matchKeyCols = item.key_columns.toLowerCase().includes(q);
      const matchIncCols = (item.included_columns || '').toLowerCase().includes(q);
      return matchTable || matchIndex || matchKeyCols || matchIncCols;
    }
    return true;
  });

  if (loading && !data) {
    return <LoadingSpinner message="SQL Server indeks kullanım istatistikleri ve yazma cezaları analiz ediliyor..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const getRoiBadgeClass = (score: number) => {
    if (score <= -75) return styles.roiCritical;
    if (score < 0) return styles.roiNegative;
    if (score < 25) return styles.roiLow;
    return styles.roiOptimal;
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'DROP':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 600, fontSize: '0.75rem' }}>
            DROP (Kaldır)
          </span>
        );
      case 'COMPRESS_PAGE':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 600, fontSize: '0.75rem' }}>
            PAGE COMPRESS
          </span>
        );
      case 'KEEP':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', fontWeight: 600, fontSize: '0.75rem' }}>
            KORU (Optimal)
          </span>
        );
      default:
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>
            {action}
          </span>
        );
    }
  };

  return (
    <div className={styles.container}>
      {data?.is_demo && <DemoDataBanner />}

      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h3>
            <TrendingDown size={18} color="#f59e0b" />
            İndeks Yatırım Getirisi & Yazma Cezası Matrisi (Index Usage ROI)
          </h3>
          <p>
            Her INSERT, UPDATE ve DELETE işleminde ödenen I/O yazma cezasını okuma (Seek/Scan) faydasıyla karşılaştırır; net zarar üreten indeksleri teşhis eder.
          </p>
        </div>
        <button className={styles.actionBtn} onClick={fetchData} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Canlı Analizi Yenile
        </button>
      </div>

      {/* KPI Row */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Değerlendirilen İndeks</span>
            <Layers size={16} />
          </div>
          <div className={styles.kpiValue}>{data?.total_evaluated_indexes ?? 0}</div>
          <div className={styles.kpiSubtext}>Hedef veritabanı genelinde</div>
        </div>

        <div className={styles.kpiCard} style={{ borderColor: (data?.negative_roi_count ?? 0) > 0 ? '#ef4444' : undefined }}>
          <div className={styles.kpiHeader}>
            <span style={{ color: (data?.negative_roi_count ?? 0) > 0 ? '#ef4444' : undefined }}>
              Negatif ROI İndeksleri
            </span>
            <AlertTriangle size={16} color={(data?.negative_roi_count ?? 0) > 0 ? '#ef4444' : undefined} />
          </div>
          <div className={styles.kpiValue} style={{ color: (data?.negative_roi_count ?? 0) > 0 ? '#ef4444' : undefined }}>
            {data?.negative_roi_count ?? 0}
          </div>
          <div className={styles.kpiSubtext}>Yazma maliyeti okumayı aşanlar</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Boşa Harcanan Yazma IOPS</span>
            <Zap size={16} />
          </div>
          <div className={styles.kpiValue} style={{ fontSize: '1.4rem' }}>
            {data?.wasted_write_iops_total?.toLocaleString() ?? 0}
          </div>
          <div className={styles.kpiSubtext}>Okunmayan indeks güncellemeleri</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Kazanılabilir Depolama</span>
            <Database size={16} />
          </div>
          <div className={styles.kpiValue}>{data?.reclaimable_storage_mb ?? 0} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>MB</span></div>
          <div className={styles.kpiSubtext}>Gereksiz indeks disk alanı</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Genel Verimlilik</span>
            <TrendingUp size={16} color="#22c55e" />
          </div>
          <div className={styles.kpiValue} style={{ color: '#22c55e' }}>
            %{data?.overall_efficiency_score ?? 100}
          </div>
          <div className={styles.kpiSubtext}>Pozitif ROI sağlayan indeks oranı</div>
        </div>
      </div>

      {/* Executive Verdict Banner */}
      {data?.executive_summary && (
        <div className={`${styles.verdictBox} ${(data.negative_roi_count ?? 0) > 0 ? styles.verdictCritical : ''}`}>
          {(data.negative_roi_count ?? 0) > 0 ? (
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
          )}
          <div className={styles.verdictText}>{data.executive_summary}</div>
        </div>
      )}

      {/* Index Matrix Table Card */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Database size={16} color="#38bdf8" />
            İndeks Yazma Cezası ve ROI Matrisi
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontWeight: 700,
              }}
            >
              {filteredItems.length} İndeks
            </span>
          </div>

          <div className={styles.filterControls}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Tablo, indeks veya kolon ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }} />
            </div>

            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              className={styles.selectInput}
            >
              <option value="ALL">Tüm Sınıflar</option>
              <option value="CRITICAL_BOTTLENECK">Kritik Darboğaz</option>
              <option value="NEGATIVE_ROI">Negatif ROI</option>
              <option value="LOW_ROI">Düşük ROI</option>
              <option value="OPTIMAL_ROI">Optimal ROI</option>
            </select>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className={styles.selectInput}
            >
              <option value="ALL">Tüm Reçeteler</option>
              <option value="DROP">DROP (Kaldır)</option>
              <option value="COMPRESS_PAGE">PAGE Sıkıştırma</option>
              <option value="KEEP">KORU (Optimal)</option>
            </select>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
            Filtreleme kriterlerine uygun indeks bulunamadı.
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tablo / İndeks</th>
                  <th>Kolonlar</th>
                  <th>Okuma (Seek/Scan)</th>
                  <th>Yazma (Updates)</th>
                  <th>Yazma/Okuma Oranı</th>
                  <th>Boyut / Satır</th>
                  <th>ROI Skoru</th>
                  <th>Önerilen Reçete</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                        {item.schema_name}.{item.table_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                        {item.index_name}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        <span style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }}>
                          {item.index_type}
                        </span>
                        {item.is_unique && (
                          <span style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                            UNIQUE
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ maxWidth: '200px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.key_columns}>
                        <strong>Key:</strong> {item.key_columns}
                      </div>
                      {item.included_columns && (
                        <div style={{ fontSize: '0.725rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.included_columns}>
                          <strong>Inc:</strong> {item.included_columns}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#22c55e' }}>{item.total_reads.toLocaleString()}</span>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {item.user_seeks} seek / {item.user_scans} scan
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: item.total_writes > item.total_reads ? '#ef4444' : '#f8fafc' }}>
                        {item.total_writes.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          color: item.write_to_read_ratio > 10 ? '#ef4444' : item.write_to_read_ratio > 1 ? '#f59e0b' : '#22c55e',
                        }}
                      >
                        {item.write_to_read_ratio > 1000 ? `${(item.write_to_read_ratio / 1000).toFixed(0)}k:1` : `${item.write_to_read_ratio}:1`}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.size_mb} MB</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{item.row_count.toLocaleString()} satır</div>
                    </td>
                    <td>
                      <span className={`${styles.roiBadge} ${getRoiBadgeClass(item.roi_score)}`}>
                        {item.roi_score > 0 ? `+${item.roi_score}` : item.roi_score}
                      </span>
                    </td>
                    <td>{getActionBadge(item.recommended_action)}</td>
                    <td>
                      <button
                        className={styles.actionBtn}
                        onClick={() => setSelectedItem(item)}
                        style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                      >
                        İncele & Betik
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail / Script Modal */}
      {selectedItem && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedItem(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>
                <Code2 size={18} color="#38bdf8" />
                {selectedItem.index_name} — ROI Optimizasyon Reçetesi
              </h4>
              <button className={styles.closeBtn} onClick={() => setSelectedItem(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  background: selectedItem.roi_score < 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                  border: `1px solid ${selectedItem.roi_score < 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`,
                  fontSize: '0.825rem',
                  color: selectedItem.roi_score < 0 ? '#f87171' : '#4ade80',
                  lineHeight: '1.45',
                }}
              >
                <strong>DBA Teşhis Özeti:</strong> {selectedItem.verdict_reason}
              </div>

              {/* T-SQL Action Script */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9' }}>
                    1. Önerilen T-SQL Müdahale Betiği ({selectedItem.recommended_action}):
                  </span>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleCopy(selectedItem.drop_script, 'action')}
                    style={{ padding: '2px 8px', fontSize: '0.725rem', color: copiedKey === 'action' ? '#22c55e' : '#38bdf8' }}
                  >
                    {copiedKey === 'action' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'action' ? 'Kopyalandı' : 'Betiği Kopyala'}
                  </button>
                </div>
                <div className={styles.codeArea}>{selectedItem.drop_script}</div>
              </div>

              {/* Rollback Script */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
                    2. Geri Alma (Rollback) Betiği:
                  </span>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleCopy(selectedItem.rollback_create_script, 'rollback')}
                    style={{ padding: '2px 8px', fontSize: '0.725rem', color: copiedKey === 'rollback' ? '#22c55e' : '#38bdf8' }}
                  >
                    {copiedKey === 'rollback' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'rollback' ? 'Kopyalandı' : 'Rollback Betiğini Kopyala'}
                  </button>
                </div>
                <div className={styles.codeArea}>{selectedItem.rollback_create_script}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
