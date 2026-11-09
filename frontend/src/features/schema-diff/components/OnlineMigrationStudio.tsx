import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Database,
  ShieldCheck,
  RefreshCw,
  Code2,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  PlayCircle,
  FileCode,
  ArrowRight,
  Sliders,
  CheckCircle2,
  Lock,
  Zap,
} from 'lucide-react';
import {
  getMigrationCandidateTables,
  getTableSchemaDetails,
  generateMigrationRunbook,
  getDatabases,
} from '../../../lib/api';
import type {
  CandidateTableInfo,
  TableSchemaInspection,
  GenerateMigrationRunbookRequest,
  MigrationRunbookResponse,
  Database as DbItem,
} from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import styles from './OnlineMigrationStudio.module.css';

interface OnlineMigrationStudioProps {
  initialDatabase?: string;
}

export default function OnlineMigrationStudio({ initialDatabase }: OnlineMigrationStudioProps) {
  const [databases, setDatabases] = useState<DbItem[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>(initialDatabase || 'Datapath_TestDB');
  const [tables, setTables] = useState<CandidateTableInfo[]>([]);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<CandidateTableInfo | null>(null);
  const [tableDetails, setTableDetails] = useState<TableSchemaInspection | null>(null);

  const [loadingTables, setLoadingTables] = useState<boolean>(true);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Migration Configuration Form
  const [pattern, setPattern] = useState<'ADD_NOT_NULL_COLUMN' | 'COLUMN_TYPE_EVOLUTION' | 'ONLINE_INDEX_REBUILD' | 'COLUMN_SPLIT'>('ADD_NOT_NULL_COLUMN');
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [newColumnName, setNewColumnName] = useState<string>('IsActive');
  const [newDataType, setNewDataType] = useState<string>('BIT');
  const [defaultValue, setDefaultValue] = useState<string>('1');
  const [batchSize, setBatchSize] = useState<number>(5000);
  const [throttleDelay, setThrottleDelay] = useState<number>(50);

  // Runbook Result State
  const [runbook, setRunbook] = useState<MigrationRunbookResponse | null>(null);
  const [genLoading, setGenLoading] = useState<boolean>(false);
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(0);
  const [showRollback, setShowRollback] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load Database List
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

  // Load Candidate Tables
  const loadTables = useCallback(async () => {
    try {
      setLoadingTables(true);
      setError(null);
      const res = await getMigrationCandidateTables(selectedDb);
      setTables(res);
      if (res && res.length > 0 && !selectedTable) {
        setSelectedTable(res[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Tablo listesi alınamadı.');
    } finally {
      setLoadingTables(false);
    }
  }, [selectedDb, selectedTable]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Load Table Details when selected
  useEffect(() => {
    if (!selectedTable) return;
    async function loadDetails() {
      try {
        setLoadingDetails(true);
        const details = await getTableSchemaDetails(selectedTable!.table_name, selectedTable!.schema_name, selectedDb);
        setTableDetails(details);
        if (details.columns.length > 0) {
          setTargetColumn(details.columns[0].column_name);
        }
      } catch (err: any) {
        console.error('Failed to load table schema details:', err);
      } finally {
        setLoadingDetails(false);
      }
    }
    loadDetails();
  }, [selectedTable, selectedDb]);

  // Auto-Generate Runbook
  const handleGenerateRunbook = async () => {
    if (!selectedTable) return;
    try {
      setGenLoading(true);
      const req: GenerateMigrationRunbookRequest = {
        database_name: selectedDb,
        table_name: selectedTable.table_name,
        schema_name: selectedTable.schema_name,
        pattern,
        target_column: targetColumn,
        new_column_name: newColumnName,
        new_data_type: newDataType,
        default_value: defaultValue,
        batch_size: batchSize,
        throttle_delay_ms: throttleDelay,
      };
      const res = await generateMigrationRunbook(req);
      setRunbook(res);
      setActivePhaseIndex(0);
      setShowRollback(false);
    } catch (err: any) {
      console.error('Failed to generate runbook:', err);
    } finally {
      setGenLoading(false);
    }
  };

  // Generate initial runbook when table details are loaded
  useEffect(() => {
    if (selectedTable && tableDetails && !runbook) {
      handleGenerateRunbook();
    }
  }, [selectedTable, tableDetails]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getRiskBadgeClass = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return `${styles.riskBadge} ${styles.riskCritical}`;
      case 'HIGH':
        return `${styles.riskBadge} ${styles.riskHigh}`;
      case 'MEDIUM':
        return `${styles.riskBadge} ${styles.riskMedium}`;
      default:
        return `${styles.riskBadge} ${styles.riskLow}`;
    }
  };

  const filteredTables = tables.filter((t) =>
    t.table_name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className={styles.container}>
      {/* Header Bar */}
      <div className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.titleIcon}>
            <Zap size={22} />
          </div>
          <div>
            <div className={styles.headerTitle}>
              Zero-Downtime Online Schema Migration &amp; Shadow Evolution Studio
            </div>
            <div className={styles.headerSubtitle}>
              Büyük tablolarda Sch-M kilitlenmelerini, transaction log patlamalarını ve kesintileri önleyen Expand-Contract DDL orkestrasyonu.
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <select
            className={styles.dbSelect}
            value={selectedDb}
            onChange={(e) => {
              setSelectedDb(e.target.value);
              setSelectedTable(null);
              setRunbook(null);
            }}
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

          <button className={styles.refreshBtn} onClick={loadTables} disabled={loadingTables}>
            <RefreshCw size={14} className={loadingTables ? 'spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {/* Advisory Banner */}
      <div className={styles.advisoryBanner}>
        <ShieldCheck size={18} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Kurumsal Güvenlik Politikası (Review-Only):</strong> Veritabanında canlı Sch-M kilitlemesi ve kilitlenme (deadlock) oluşumunu önlemek amacıyla tüm betikler mimari inceleme ve kontrollü pencereler için üretilir. Her faz mikro-batch döngüleri (`WAITFOR DELAY`) ve `ONLINE = ON` parametreleriyle kilitlenme süresini milisaniyelere indirir.
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={loadTables} />}

      {/* Main Studio Grid */}
      <div className={styles.studioLayout}>
        {/* Left Column: Candidate Tables List */}
        <div className={styles.tableListPanel}>
          <div className={styles.tableListHeader}>
            <span>Aday Tablolar ({filteredTables.length})</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Risk Seviyesi</span>
          </div>

          <div className={styles.tableSearchBox}>
            <input
              type="text"
              placeholder="Tablo ara..."
              className={styles.tableSearchInput}
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
            />
          </div>

          <div className={styles.tableItems}>
            {loadingTables ? (
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : filteredTables.length === 0 ? (
              <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '12px', textAlign: 'center' }}>
                Tablo bulunamadı.
              </div>
            ) : (
              filteredTables.map((t) => (
                <div
                  key={`${t.schema_name}.${t.table_name}`}
                  className={`${styles.tableItem} ${
                    selectedTable?.table_name === t.table_name ? styles.tableItemActive : ''
                  }`}
                  onClick={() => {
                    setSelectedTable(t);
                    setRunbook(null);
                  }}
                >
                  <div className={styles.tableItemRow}>
                    <span className={styles.tableNameText}>
                      [{t.schema_name}].[{t.table_name}]
                    </span>
                    <span className={getRiskBadgeClass(t.migration_risk_level)}>
                      {t.migration_risk_level}
                    </span>
                  </div>
                  <div className={styles.tableItemRow}>
                    <span className={styles.tableMetaText}>
                      {t.total_rows.toLocaleString()} satır • {t.total_reserved_mb.toFixed(1)} MB
                    </span>
                    <span className={styles.tableMetaText}>{t.column_count} kolon</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Schema Details & Migration Generator */}
        <div className={styles.mainPanel}>
          {selectedTable && (
            <>
              {/* Selected Table Info Card */}
              <div className={styles.selectedTableCard}>
                <div className={styles.selectedTableInfo}>
                  <Database size={20} style={{ color: '#38bdf8' }} />
                  <div>
                    <div className={styles.selectedTableName}>
                      [{selectedTable.schema_name}].[{selectedTable.table_name}]
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      {selectedTable.recommendation_tip}
                    </div>
                  </div>
                </div>

                <div className={styles.tableStatsRow}>
                  <div>
                    Satır: <strong>{selectedTable.total_rows.toLocaleString()}</strong>
                  </div>
                  <div>
                    Boyut: <strong>{selectedTable.total_reserved_mb.toFixed(2)} MB</strong>
                  </div>
                  <div>
                    İndeks: <strong>{tableDetails?.indexes?.length || 0}</strong>
                  </div>
                  <div>
                    FK:{' '}
                    <strong>{tableDetails?.foreign_keys_count || 0}</strong>
                  </div>
                </div>
              </div>

              {/* Migration Pattern Selector */}
              <div className={styles.patternSelectorCard}>
                <div className={styles.patternTitle}>Sıfır Kesinti Göç Deseni (Migration Pattern)</div>
                <div className={styles.patternGrid}>
                  <div
                    className={`${styles.patternBtn} ${pattern === 'ADD_NOT_NULL_COLUMN' ? styles.patternBtnActive : ''}`}
                    onClick={() => {
                      setPattern('ADD_NOT_NULL_COLUMN');
                      setNewColumnName('IsActive');
                      setNewDataType('BIT');
                      setDefaultValue('1');
                    }}
                  >
                    <div className={styles.patternBtnName}>
                      <Sliders size={14} style={{ color: '#38bdf8' }} />
                      NOT NULL Kolon Ekleme
                    </div>
                    <div className={styles.patternBtnDesc}>
                      Expand-Contract ile nullable shadow kolon, kademeli backfill ve NOCHECK constraint.
                    </div>
                  </div>

                  <div
                    className={`${styles.patternBtn} ${pattern === 'COLUMN_TYPE_EVOLUTION' ? styles.patternBtnActive : ''}`}
                    onClick={() => {
                      setPattern('COLUMN_TYPE_EVOLUTION');
                      setNewDataType('BIGINT');
                    }}
                  >
                    <div className={styles.patternBtnName}>
                      <Layers size={14} style={{ color: '#f59e0b' }} />
                      Kolon Tip Dönüşümü
                    </div>
                    <div className={styles.patternBtnDesc}>
                      INT -&gt; BIGINT veya VARCHAR genişletme. Dual-write trigger ve sp_rename atomik takası.
                    </div>
                  </div>

                  <div
                    className={`${styles.patternBtn} ${pattern === 'ONLINE_INDEX_REBUILD' ? styles.patternBtnActive : ''}`}
                    onClick={() => setPattern('ONLINE_INDEX_REBUILD')}
                  >
                    <div className={styles.patternBtnName}>
                      <PlayCircle size={14} style={{ color: '#10b981' }} />
                      Online Index Rebuild
                    </div>
                    <div className={styles.patternBtnDesc}>
                      WAIT_AT_LOW_PRIORITY ve ABORT_AFTER_WAIT = SELF ile canlı sorguları asla kilitlemez.
                    </div>
                  </div>

                  <div
                    className={`${styles.patternBtn} ${pattern === 'COLUMN_SPLIT' ? styles.patternBtnActive : ''}`}
                    onClick={() => setPattern('COLUMN_SPLIT')}
                  >
                    <div className={styles.patternBtnName}>
                      <FileCode size={14} style={{ color: '#a855f7' }} />
                      Ağır Kolon Ayrıştırma
                    </div>
                    <div className={styles.patternBtnDesc}>
                      Büyük metin/BLOB kolonunu uydu tabloya ayırarak ana tablonun I/O yükünü %70 düşürür.
                    </div>
                  </div>
                </div>

                {/* Dynamic Configuration Form */}
                <div className={styles.configFormGrid}>
                  {pattern === 'COLUMN_TYPE_EVOLUTION' || pattern === 'COLUMN_SPLIT' ? (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Hedef Kolon</label>
                      <select
                        className={styles.formSelect}
                        value={targetColumn}
                        onChange={(e) => setTargetColumn(e.target.value)}
                      >
                        {tableDetails?.columns.map((c: any) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.column_name} ({c.data_type})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {pattern === 'ADD_NOT_NULL_COLUMN' && (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Eklenecek Kolon Adı</label>
                      <input
                        type="text"
                        className={styles.formInput}
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                      />
                    </div>
                  )}

                  {pattern !== 'ONLINE_INDEX_REBUILD' && (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Hedef Veri Tipi</label>
                      <input
                        type="text"
                        className={styles.formInput}
                        value={newDataType}
                        onChange={(e) => setNewDataType(e.target.value)}
                      />
                    </div>
                  )}

                  {pattern === 'ADD_NOT_NULL_COLUMN' && (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Varsayılan Değer (Default)</label>
                      <input
                        type="text"
                        className={styles.formInput}
                        value={defaultValue}
                        onChange={(e) => setDefaultValue(e.target.value)}
                      />
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Batch Boyutu (Satır)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Throttling Gecikmesi (ms)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={throttleDelay}
                      onChange={(e) => setThrottleDelay(Number(e.target.value))}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
                    <button
                      className={styles.submitBtn}
                      onClick={handleGenerateRunbook}
                      disabled={genLoading}
                    >
                      <Code2 size={15} />
                      Kesintisiz Reçete Üret (T-SQL)
                    </button>
                  </div>
                </div>
              </div>

              {genLoading ? (
                <LoadingSpinner message="Sıfır kesinti göç reçetesi derleniyor..." />
              ) : runbook ? (
                <>
                  {/* Naive vs Online Comparison Card */}
                  <div className={styles.comparisonCard}>
                    <div className={styles.patternTitle}>
                      Mimari Risk Analizi: Doğrudan ALTER TABLE vs Datapath Expand-Contract
                    </div>
                    <div className={styles.comparisonGrid}>
                      <div className={styles.compColDanger}>
                        <div className={styles.compColTitle} style={{ color: '#ef4444' }}>
                          <AlertTriangle size={15} />
                          Geleneksel Doğrudan Yöntem (Tehlikeli)
                        </div>
                        <div className={styles.compItem}>
                          <span className={styles.compItemLabel}>Kilit Seviyesi</span>
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>
                            {runbook.comparison.naive_lock_type}
                          </span>
                        </div>
                        <div className={styles.compItem}>
                          <span className={styles.compItemLabel}>Tahmini Kesinti Süresi</span>
                          <span>{runbook.comparison.naive_downtime_estimate}</span>
                        </div>
                        <div className={styles.compItem}>
                          <span className={styles.compItemLabel}>Transaction Log / LDF Riski</span>
                          <span>{runbook.comparison.naive_log_risk}</span>
                        </div>
                      </div>

                      <div className={styles.compColSuccess}>
                        <div className={styles.compColTitle} style={{ color: '#10b981' }}>
                          <CheckCircle2 size={15} />
                          Datapath Sıfır Kesinti Göç Stratejisi
                        </div>
                        <div className={styles.compItem}>
                          <span className={styles.compItemLabel}>Kilit Seviyesi</span>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>
                            {runbook.comparison.online_lock_type}
                          </span>
                        </div>
                        <div className={styles.compItem}>
                          <span className={styles.compItemLabel}>Tahmini Kesinti Süresi</span>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>
                            {runbook.comparison.online_downtime_estimate}
                          </span>
                        </div>
                        <div className={styles.compItem}>
                          <span className={styles.compItemLabel}>Transaction Log / LDF Riski</span>
                          <span>{runbook.comparison.online_log_risk}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Runbook Phases Tabs & Code Box */}
                  <div className={styles.runbookCard}>
                    <div className={styles.phaseTabsBar}>
                      {runbook.phases.map((p: any, idx: number) => (
                        <button
                          key={p.phase_number}
                          className={`${styles.phaseTabBtn} ${
                            !showRollback && activePhaseIndex === idx ? styles.phaseTabActive : ''
                          }`}
                          onClick={() => {
                            setActivePhaseIndex(idx);
                            setShowRollback(false);
                          }}
                        >
                          Faz {p.phase_number}: {p.phase_name}
                        </button>
                      ))}
                      <button
                        className={`${styles.phaseTabBtn} ${styles.phaseTabRollback} ${
                          showRollback ? styles.phaseTabRollbackActive : ''
                        }`}
                        onClick={() => setShowRollback(true)}
                      >
                        Acil Geri Alma (Rollback)
                      </button>
                    </div>

                    {!showRollback && runbook.phases[activePhaseIndex] && (
                      <div className={styles.phaseContent}>
                        <div className={styles.phaseMetaRow}>
                          <div className={styles.phaseTitleText}>
                            {runbook.phases[activePhaseIndex].title}
                          </div>
                          <div className={styles.phaseTags}>
                            <div className={styles.phaseTag}>
                              Kilit Tipi: <strong>{runbook.phases[activePhaseIndex].lock_type}</strong>
                            </div>
                            <div className={styles.phaseTag}>
                              Kilit Süresi:{' '}
                              <strong style={{ color: '#10b981' }}>
                                {runbook.phases[activePhaseIndex].lock_duration_ms}
                              </strong>
                            </div>
                            <div className={styles.phaseTag}>
                              Tahmini Süre:{' '}
                              <strong>{runbook.phases[activePhaseIndex].estimated_duration}</strong>
                            </div>
                          </div>
                        </div>

                        <div className={styles.phaseDescText}>
                          {runbook.phases[activePhaseIndex].description}
                        </div>

                        <div className={styles.codeBox}>
                          <div className={styles.codeBoxHeader}>
                            <span>
                              Hedef: [{runbook.schema_name}].[{runbook.table_name}] • Faz{' '}
                              {runbook.phases[activePhaseIndex].phase_number}
                            </span>
                            <button
                              className={styles.copyCodeBtn}
                              onClick={() =>
                                handleCopy(
                                  runbook.phases[activePhaseIndex].sql_script,
                                  `phase_${activePhaseIndex}`
                                )
                              }
                            >
                              {copiedKey === `phase_${activePhaseIndex}` ? (
                                <Check size={13} />
                              ) : (
                                <Copy size={13} />
                              )}
                              {copiedKey === `phase_${activePhaseIndex}` ? 'Kopyalandı!' : 'T-SQL Kopyala'}
                            </button>
                          </div>
                          <pre className={styles.codePre}>
                            {runbook.phases[activePhaseIndex].sql_script}
                          </pre>
                        </div>

                        {runbook.phases[activePhaseIndex].safety_checklist.length > 0 && (
                          <div className={styles.checklistCard}>
                            <div
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#10b981',
                                textTransform: 'uppercase',
                              }}
                            >
                              Faz Güvenlik Kontrolleri
                            </div>
                            {runbook.phases[activePhaseIndex].safety_checklist.map((item: string, i: number) => (
                              <div key={i} className={styles.checklistItem}>
                                <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {showRollback && (
                      <div className={styles.phaseContent}>
                        <div className={styles.phaseMetaRow}>
                          <div className={styles.phaseTitleText} style={{ color: '#ef4444' }}>
                            Acil Durum Geri Alma Reçetesi (Rollback Runbook)
                          </div>
                        </div>
                        <div className={styles.phaseDescText}>
                          Geçiş penceresinde öngörülmeyen bir aksilik yaşanırsa, tabloyu kesintiye uğratmadan eski haline getirmek için hazırlanmış güvenli temizlik betiği.
                        </div>
                        <div className={styles.codeBox}>
                          <div className={styles.codeBoxHeader}>
                            <span style={{ color: '#ef4444' }}>EMERGENCY ROLLBACK SCRIPT</span>
                            <button
                              className={styles.copyCodeBtn}
                              onClick={() => handleCopy(runbook.emergency_rollback_sql, 'rollback')}
                            >
                              {copiedKey === 'rollback' ? <Check size={13} /> : <Copy size={13} />}
                              {copiedKey === 'rollback' ? 'Kopyalandı!' : 'Rollback SQL Kopyala'}
                            </button>
                          </div>
                          <pre className={styles.codePre} style={{ color: '#fca5a5' }}>
                            {runbook.emergency_rollback_sql}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
