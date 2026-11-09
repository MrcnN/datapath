import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Database,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  RefreshCw,
  Code2,
  Sliders,
  X,
  FileCode,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import {
  getPartitioningOverview,
  generatePartitionScript,
  getDatabases,
} from '../../../lib/api';
import type {
  PartitioningOverviewResponse,
  PartitionCandidate,
  TablePartitionSummary,
  GeneratePartitionScriptRequest,
  GeneratePartitionScriptResponse,
  Database as DbItem,
} from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import styles from './PartitioningAdvisor.module.css';

interface PartitioningAdvisorProps {
  initialDatabase?: string;
}

export default function PartitioningAdvisor({ initialDatabase }: PartitioningAdvisorProps) {
  const [databases, setDatabases] = useState<DbItem[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>(initialDatabase || 'Datapath_TestDB');
  const [data, setData] = useState<PartitioningOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State for Script Generation
  const [selectedCandidate, setSelectedCandidate] = useState<PartitionCandidate | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [genLoading, setGenLoading] = useState<boolean>(false);
  const [generatedScript, setGeneratedScript] = useState<GeneratePartitionScriptResponse | null>(null);
  const [activeScriptTab, setActiveScriptTab] = useState<'scheme' | 'rebuild' | 'split' | 'switch'>('scheme');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form Parameters for Script Generation
  const [interval, setInterval] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');
  const [keyColumn, setKeyColumn] = useState<string>('OrderDate');
  const [keyType, setKeyType] = useState<string>('DATETIME2');
  const [startYear, setStartYear] = useState<number>(2024);
  const [endYear, setEndYear] = useState<number>(2027);

  // Load database list once
  useEffect(() => {
    async function loadDbs() {
      try {
        const dbs = await getDatabases();
        if (dbs && dbs.length > 0) {
          setDatabases(dbs);
          if (!initialDatabase) {
            const hasTest = dbs.find((d) => d.name === 'Datapath_TestDB');
            setSelectedDb(hasTest ? 'Datapath_TestDB' : dbs[0].name);
          }
        }
      } catch {
        // ignore fallback
      }
    }
    loadDbs();
  }, [initialDatabase]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPartitioningOverview(selectedDb);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Bölümleme verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [selectedDb]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenScriptModal = async (c: PartitionCandidate) => {
    setSelectedCandidate(c);
    setKeyColumn(c.recommended_key_column || 'CreatedAt');
    setKeyType((c.recommended_key_type || 'DATETIME2').toUpperCase());
    setModalOpen(true);
    setActiveScriptTab('scheme');

    const req: GeneratePartitionScriptRequest = {
      database_name: selectedDb || data?.database_name || 'Datapath_TestDB',
      table_name: c.table_name,
      schema_name: c.schema_name,
      key_column: c.recommended_key_column || 'CreatedAt',
      key_type: (c.recommended_key_type || 'DATETIME2').toUpperCase(),
      boundary_interval: interval,
      start_year: startYear,
      end_year: endYear,
      filegroup: 'PRIMARY',
    };

    try {
      setGenLoading(true);
      const res = await generatePartitionScript(req);
      setGeneratedScript(res);
    } catch (err: any) {
      console.error('Failed to generate partition script:', err);
    } finally {
      setGenLoading(false);
    }
  };

  const handleRegenerateScript = async () => {
    if (!selectedCandidate) return;

    const req: GeneratePartitionScriptRequest = {
      database_name: selectedDb || data?.database_name || 'Datapath_TestDB',
      table_name: selectedCandidate.table_name,
      schema_name: selectedCandidate.schema_name,
      key_column: keyColumn,
      key_type: keyType,
      boundary_interval: interval,
      start_year: Number(startYear),
      end_year: Number(endYear),
      filegroup: 'PRIMARY',
    };

    try {
      setGenLoading(true);
      const res = await generatePartitionScript(req);
      setGeneratedScript(res);
    } catch (err: any) {
      console.error('Failed to regenerate partition script:', err);
    } finally {
      setGenLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const formatMb = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const getUrgencyBadgeClass = (urgency: string) => {
    switch (urgency) {
      case 'CRITICAL':
        return `${styles.urgencyBadge} ${styles.urgencyCritical}`;
      case 'HIGH':
        return `${styles.urgencyBadge} ${styles.urgencyHigh}`;
      default:
        return `${styles.urgencyBadge} ${styles.urgencyMedium}`;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Bar */}
      <div className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.titleIcon}>
            <Layers size={22} />
          </div>
          <div>
            <div className={styles.headerTitle}>
              Table Partitioning & Sliding Window Lifecycle Advisor
            </div>
            <div className={styles.headerSubtitle}>
              Büyük tablolar için yatay bölümleme (partitioning) aday analizi, ısı haritası ve sıfır-log arşivleme otomasyonu.
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <select
            className={styles.dbSelect}
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
          >
            {databases.length > 0 ? (
              databases.map((db) => (
                <option key={db.name} value={db.name}>
                  {db.name}
                </option>
              ))
            ) : (
              <option value="Datapath_TestDB">Datapath_TestDB</option>
            )}
          </select>

          <button className={styles.refreshBtn} onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {/* Review-Only Advisory Banner */}
      <div className={styles.advisoryBanner}>
        <ShieldCheck size={18} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Kurumsal Güvenlik Politikası (Review-Only):</strong> Bölümleme şemaları ve CLUSTERED INDEX dönüşümleri yüksek I/O ve şema kilidi (Sch-M) doğurabileceğinden betikler doğrudan çalıştırılmaz. Üretilen T-SQL reçeteleri `ONLINE = ON` parametresi ve `DROP_EXISTING = ON` mekanizmaları ile DBA incelemesine ve kontrollü bakım pencerelerine sunulur.
        </div>
      </div>

      {loading && <LoadingSpinner message="Tablo bölümleme metrikleri ve adayları analiz ediliyor..." />}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {!loading && !error && data && (
        <>
          {/* KPI Cards Grid */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                <Layers size={22} />
              </div>
              <div>
                <div className={styles.kpiLabel}>Bölümlenmiş Tablolar</div>
                <div className={styles.kpiValue}>{data.total_partitioned_tables}</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                <Calendar size={22} />
              </div>
              <div>
                <div className={styles.kpiLabel}>Aktif Yönetilen Dilimler</div>
                <div className={styles.kpiValue}>{data.total_managed_partitions}</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div
                className={styles.kpiIconWrap}
                style={{
                  background: data.total_candidate_tables > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  color: data.total_candidate_tables > 0 ? '#ef4444' : '#10b981',
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className={styles.kpiLabel}>Bölümleme Bekleyen Adaylar</div>
                <div
                  className={styles.kpiValue}
                  style={{ color: data.total_candidate_tables > 0 ? '#ef4444' : 'inherit' }}
                >
                  {data.total_candidate_tables} Tablo
                </div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                <Database size={22} />
              </div>
              <div>
                <div className={styles.kpiLabel}>Bölümlenmiş Veri Satırı</div>
                <div className={styles.kpiValue}>
                  {data.total_partitioned_rows > 0 ? data.total_partitioned_rows.toLocaleString() : '0'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Candidate Tables */}
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              Bölümleme Bekleyen Yüksek Hacimli Aday Tablolar
              <span className={styles.sectionCountBadge}>{data.candidates.length}</span>
            </div>
          </div>

          {data.candidates.length === 0 ? (
            <EmptyState
              title="Aday Tablo Bulunmuyor"
              message="Veritabanında 5.000 satırı aşan veya tek parça saklanan kritik büyüklükte aday tablo tespit edilmedi."
            />
          ) : (
            <div className={styles.candidateGrid}>
              {data.candidates.map((c) => (
                <div key={`${c.schema_name}.${c.table_name}`} className={styles.candidateCard}>
                  <div className={styles.candidateTopRow}>
                    <div className={styles.candidateTableName}>
                      <Database size={16} style={{ color: '#38bdf8' }} />
                      [{c.schema_name}].[{c.table_name}]
                    </div>

                    <div className={styles.candidateMetrics}>
                      <div className={styles.candidateMetricItem}>
                        <span>Satır:</span>
                        <strong>{c.total_rows.toLocaleString()}</strong>
                      </div>
                      <div className={styles.candidateMetricItem}>
                        <span>Boyut:</span>
                        <strong>{formatMb(c.total_reserved_mb)}</strong>
                      </div>
                      <span className={getUrgencyBadgeClass(c.urgency)}>{c.urgency}</span>
                    </div>
                  </div>

                  <div className={styles.candidateDetails}>
                    <div className={styles.detailCol}>
                      <div className={styles.detailColLabel}>Mimari Teşhis & Darboğaz Riski</div>
                      <div className={styles.detailColText}>{c.candidate_reason}</div>
                    </div>
                    <div className={styles.detailCol}>
                      <div className={styles.detailColLabel}>Sliding Window Yaşam Döngüsü Katkısı</div>
                      <div className={styles.detailColText}>{c.archival_benefit}</div>
                    </div>
                  </div>

                  <div className={styles.candidateActions}>
                    <div className={styles.keySuggestion}>
                      <span>Önerilen Bölümleme Anahtarı:</span>
                      <code>
                        {c.recommended_key_column} ({c.recommended_key_type})
                      </code>
                    </div>

                    <button
                      className={styles.actionBtn}
                      onClick={() => handleOpenScriptModal(c)}
                      title="Bölümleme ve Sliding Window Reçetesi Üret"
                    >
                      <Code2 size={14} />
                      Bölümleme Reçetesi Oluştur (T-SQL)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Section 2: Existing Partitioned Tables */}
          <div className={styles.sectionHeader} style={{ marginTop: '1.25rem' }}>
            <div className={styles.sectionTitle}>
              <Layers size={18} style={{ color: '#10b981' }} />
              Mevcut Bölümlenmiş Tablolar & Dilim Dağılımı
              <span className={styles.sectionCountBadge}>{data.partitioned_tables.length}</span>
            </div>
          </div>

          {data.partitioned_tables.length === 0 ? (
            <div className={styles.tableCard} style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.875rem' }}>
                Bu veritabanında henüz Partition Scheme üzerinde yapılandırılmış tablo bulunmamaktadır.
              </div>
              <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.8125rem', marginTop: '0.35rem' }}>
                Yukarıdaki aday tablolardan birini seçerek anında T-SQL bölümleme ve sliding window reçetesi oluşturabilirsiniz.
              </div>
            </div>
          ) : (
            <div className={styles.candidateGrid}>
              {data.partitioned_tables.map((t) => (
                <div key={`${t.schema_name}.${t.table_name}`} className={styles.tableCard}>
                  <div className={styles.tableHeaderBar}>
                    <div>
                      <span className={styles.tableHeaderTitle}>
                        [{t.schema_name}].[{t.table_name}]
                      </span>
                      <span style={{ fontSize: '0.8125rem', color: '#94a3b8', marginLeft: '0.75rem' }}>
                        Scheme: <code>{t.partition_scheme}</code> • Key: <code>{t.partition_key_column}</code>
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#e2e8f0', fontWeight: 600 }}>
                      Toplam: {t.total_rows.toLocaleString()} satır • {formatMb(t.total_reserved_mb)}
                    </div>
                  </div>

                  <table className={styles.partitionTable}>
                    <thead>
                      <tr>
                        <th>Dilim (Partition) #</th>
                        <th>Sınır Değeri (Boundary)</th>
                        <th>Satır Sayısı & Dağılım</th>
                        <th>Veri (MB)</th>
                        <th>İndeks (MB)</th>
                        <th>Filegroup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.partitions.map((p) => {
                        const pct = t.total_rows > 0 ? (p.row_count / t.total_rows) * 100 : 0;
                        return (
                          <tr key={p.partition_number}>
                            <td>
                              <strong>#{p.partition_number}</strong>
                              {p.is_empty && (
                                <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px' }}>
                                  (Boş Dilim)
                                </span>
                              )}
                            </td>
                            <td>
                              <code style={{ color: '#38bdf8' }}>{p.boundary_value || '< İlk Dilim Sınırı >'}</code>
                            </td>
                            <td style={{ minWidth: '180px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span>{p.row_count.toLocaleString()} satır</span>
                                <span style={{ color: '#94a3b8' }}>{pct.toFixed(1)}%</span>
                              </div>
                              <div className={styles.barTrack}>
                                <div className={styles.barFill} style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                            </td>
                            <td>{p.data_mb.toFixed(1)} MB</td>
                            <td>{p.index_mb.toFixed(1)} MB</td>
                            <td>
                              <code style={{ fontSize: '11px', color: '#cbd5e1' }}>{p.filegroup_name}</code>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Script Generation Modal */}
      {modalOpen && selectedCandidate && (
        <div className={styles.modalBackdrop} onClick={() => setModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <Sliders size={20} style={{ color: '#38bdf8' }} />
                Tablo Bölümleme &amp; Sliding Window Reçetesi: [{selectedCandidate.schema_name}].[{selectedCandidate.table_name}]
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Parameter Configuration Form */}
              <div className={styles.paramsGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Bölümleme Periyodu</label>
                  <select
                    className={styles.formSelect}
                    value={interval}
                    onChange={(e) => setInterval(e.target.value as 'MONTHLY' | 'YEARLY')}
                  >
                    <option value="YEARLY">Yıllık (YEARLY - Standart)</option>
                    <option value="MONTHLY">Aylık (MONTHLY - Yüksek Hacim)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Bölümleme Kolonu (Key)</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={keyColumn}
                    onChange={(e) => setKeyColumn(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Veri Tipi</label>
                  <select
                    className={styles.formSelect}
                    value={keyType}
                    onChange={(e) => setKeyType(e.target.value)}
                  >
                    <option value="DATETIME2">DATETIME2</option>
                    <option value="DATETIME">DATETIME</option>
                    <option value="DATE">DATE</option>
                    <option value="BIGINT">BIGINT</option>
                    <option value="INT">INT</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Başlangıç - Bitiş Yılı</label>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={startYear}
                      onChange={(e) => setStartYear(Number(e.target.value))}
                      style={{ width: '80px' }}
                    />
                    <span style={{ color: '#64748b' }}>-</span>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={endYear}
                      onChange={(e) => setEndYear(Number(e.target.value))}
                      style={{ width: '80px' }}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
                  <button
                    className={styles.actionBtn}
                    onClick={handleRegenerateScript}
                    disabled={genLoading}
                    style={{ height: '36px', justifyContent: 'center' }}
                  >
                    <RefreshCw size={14} className={genLoading ? 'spin' : ''} />
                    Betikleri Güncelle
                  </button>
                </div>
              </div>

              {genLoading ? (
                <LoadingSpinner message="T-SQL reçetesi hesaplanıyor..." />
              ) : generatedScript ? (
                <>
                  {/* Script Sub-tabs */}
                  <div className={styles.scriptTabs}>
                    <button
                      className={`${styles.scriptTabBtn} ${activeScriptTab === 'scheme' ? styles.scriptTabActive : ''}`}
                      onClick={() => setActiveScriptTab('scheme')}
                    >
                      1. Function &amp; Scheme
                    </button>
                    <button
                      className={`${styles.scriptTabBtn} ${activeScriptTab === 'rebuild' ? styles.scriptTabActive : ''}`}
                      onClick={() => setActiveScriptTab('rebuild')}
                    >
                      2. Online Tablo Dönüşümü
                    </button>
                    <button
                      className={`${styles.scriptTabBtn} ${activeScriptTab === 'split' ? styles.scriptTabActive : ''}`}
                      onClick={() => setActiveScriptTab('split')}
                    >
                      3. Sliding Window (SPLIT)
                    </button>
                    <button
                      className={`${styles.scriptTabBtn} ${activeScriptTab === 'switch' ? styles.scriptTabActive : ''}`}
                      onClick={() => setActiveScriptTab('switch')}
                    >
                      4. Sıfır-Log Arşivleme (SWITCH)
                    </button>
                  </div>

                  {/* Active Code Box */}
                  <div className={styles.codeBox}>
                    <div className={styles.codeBoxHeader}>
                      <span>
                        {activeScriptTab === 'scheme' && 'Adım 1: Partition Function & Scheme Oluşturma'}
                        {activeScriptTab === 'rebuild' && 'Adım 2: Tabloyu Scheme Üzerine Taşıma (ONLINE = ON)'}
                        {activeScriptTab === 'split' && 'Adım 3: İleriye Doğru Yeni Periyot Ekleme (SPLIT RANGE)'}
                        {activeScriptTab === 'switch' && 'Adım 4: Anında 0-ms Arşivleme (METADATA SWITCH)'}
                      </span>
                      <button
                        className={styles.copyCodeBtn}
                        onClick={() => {
                          const sql =
                            activeScriptTab === 'scheme'
                              ? generatedScript.ddl_create_scheme_sql
                              : activeScriptTab === 'rebuild'
                              ? generatedScript.ddl_rebuild_table_sql
                              : activeScriptTab === 'split'
                              ? generatedScript.sliding_window_split_sql
                              : generatedScript.switch_archive_sql;
                          handleCopy(sql, activeScriptTab);
                        }}
                      >
                        {copiedKey === activeScriptTab ? <Check size={14} /> : <Copy size={14} />}
                        {copiedKey === activeScriptTab ? 'Kopyalandı!' : 'T-SQL Kopyala'}
                      </button>
                    </div>

                    <pre className={styles.codePre}>
                      {activeScriptTab === 'scheme' && generatedScript.ddl_create_scheme_sql}
                      {activeScriptTab === 'rebuild' && generatedScript.ddl_rebuild_table_sql}
                      {activeScriptTab === 'split' && generatedScript.sliding_window_split_sql}
                      {activeScriptTab === 'switch' && generatedScript.switch_archive_sql}
                    </pre>
                  </div>

                  {/* Architectural Notes */}
                  {generatedScript.architectural_notes && generatedScript.architectural_notes.length > 0 && (
                    <div className={styles.archNotesBox}>
                      <div className={styles.archNotesTitle}>
                        <ShieldCheck size={14} />
                        DBA Uygulama ve Güvenlik İlkeleri
                      </div>
                      {generatedScript.architectural_notes.map((note, idx) => (
                        <div key={idx} className={styles.archNoteItem}>
                          <span className={styles.archNoteDot}>•</span>
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.modalFooterNote}>
                * Komutları SQL Server Management Studio (SSMS) veya Azure Data Studio üzerinde çalıştırınız.
              </div>
              <button className={styles.closeModalBtn} onClick={() => setModalOpen(false)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
