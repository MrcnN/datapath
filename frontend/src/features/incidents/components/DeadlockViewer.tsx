import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Radio,
  RefreshCw,
  Search,
  AlertTriangle,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { DeadlockResult, DeadlockHistoryItem } from '../../../lib/types';
import { parseDeadlock, getDeadlockHistory } from '../../../lib/api';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import DeadlockGraphVisualizer from './DeadlockGraphVisualizer';
import styles from './DeadlockViewer.module.css';
import { truncate } from '../../../lib/utils';

interface DeadlockViewerProps {
  result?: DeadlockResult | null;
}

const SAMPLE_XDL = `<deadlock>
  <victim-list>
    <victimProcess id="process1470" />
  </victim-list>
  <process-list>
    <process id="process1470" currentdb="OrdersDB" loginname="app_user" hostname="WEB-APP-01" waittype="LCK_M_X">
      <inputbuf>UPDATE Orders SET Status = 'Processing' WHERE OrderID = 101;</inputbuf>
    </process>
    <process id="process2890" currentdb="OrdersDB" loginname="report_user" hostname="BI-SERVER" waittype="LCK_M_S">
      <inputbuf>SELECT * FROM Orders WITH (HOLDLOCK) WHERE OrderID = 101;</inputbuf>
    </process>
  </process-list>
  <resource-list>
    <keylock objectname="Orders" mode="X">
      <waiter-list>
        <waiter id="process1470" mode="X" />
      </waiter-list>
    </keylock>
  </resource-list>
</deadlock>`;

export default function DeadlockViewer({ result: initialResult }: DeadlockViewerProps) {
  const [activeTab, setActiveTab] = useState<'RADAR' | 'MANUAL'>('RADAR');
  const [history, setHistory] = useState<DeadlockHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const [xmlContent, setXmlContent] = useState<string>('');
  const [result, setResult] = useState<DeadlockResult | null>(initialResult || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async (autoSelectFirst = false) => {
    setLoadingHistory(true);
    try {
      const items = await getDeadlockHistory(15);
      setHistory(items);
      if (autoSelectFirst && items.length > 0 && !result) {
        setSelectedHistoryId(items[0].id);
        setXmlContent(items[0].deadlock_xml);
        handleParse(items[0].deadlock_xml);
      }
    } catch (err: any) {
      console.error('Failed to fetch deadlock history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory(true);
  }, []);

  const handleParse = async (contentToParse?: string) => {
    const text = contentToParse ?? xmlContent;
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await parseDeadlock(text);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Deadlock XML ayrıştırılırken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistoryItem = (item: DeadlockHistoryItem) => {
    setSelectedHistoryId(item.id);
    setXmlContent(item.deadlock_xml);
    handleParse(item.deadlock_xml);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setXmlContent(content);
        setSelectedHistoryId(null);
        handleParse(content);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setXmlContent(SAMPLE_XDL);
    setSelectedHistoryId(null);
    handleParse(SAMPLE_XDL);
  };

  return (
    <div className={styles.viewer}>
      {/* Source Switcher Tabs */}
      <div className={styles.sourceTabs}>
        <button
          type="button"
          className={`${styles.sourceTab} ${activeTab === 'RADAR' ? styles.sourceTabActive : ''}`}
          onClick={() => setActiveTab('RADAR')}
        >
          <Radio size={15} />
          Canlı system_health Radarı ({history.length})
        </button>
        <button
          type="button"
          className={`${styles.sourceTab} ${activeTab === 'MANUAL' ? styles.sourceTabActive : ''}`}
          onClick={() => setActiveTab('MANUAL')}
        >
          <Upload size={15} />
          Özel XML / XDL Yükle
        </button>
      </div>

      {/* Tab 1: Live system_health Ring Buffer Radar */}
      {activeTab === 'RADAR' && (
        <div className={styles.section}>
          <div className={styles.historyHeader}>
            <div>
              <div className={styles.historyTitle}>
                <Radio size={16} color="var(--accent)" />
                <span>system_health Ring Buffer Deadlock Geçmişi</span>
              </div>
              <div className={styles.historySubtitle}>
                SQL Server motorunun arka planda otomatik kaydettiği Extended Events olayları
              </div>
            </div>

            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => fetchHistory(false)}
              disabled={loadingHistory}
            >
              <RefreshCw size={13} className={loadingHistory ? styles.spinIcon : ''} />
              Yenile
            </button>
          </div>

          {loadingHistory && (
            <div style={{ padding: 'var(--space-4)' }}>
              <LoadingSpinner message="system_health ring_buffer olayları taranıyor..." />
            </div>
          )}

          {!loadingHistory && history.length === 0 && (
            <div style={{ padding: 'var(--space-4)' }}>
              <EmptyState
                icon={<Sparkles size={36} color="var(--status-success)" />}
                title="Kayıtlı Deadlock Bulunmadı"
                message="Sunucuda son dönemde kaydedilmiş bir deadlock kilitlenme olayı bulunmuyor. Sistem kilitlenme açısından sağlıklı."
              />
            </div>
          )}

          {!loadingHistory && history.length > 0 && (
            <div className={styles.historyGrid}>
              {history.map((item) => {
                const isSelected = selectedHistoryId === item.id;
                const dateStr = item.timestamp
                  ? new Date(item.timestamp).toLocaleString('tr-TR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Bilinmiyor';

                return (
                  <div
                    key={item.id}
                    className={`${styles.historyRow} ${isSelected ? styles.historyRowSelected : ''}`}
                    onClick={() => handleSelectHistoryItem(item)}
                  >
                    <div className={styles.historyInfo}>
                      <div className={styles.historyMeta}>
                        <span className={styles.historyTime}>{dateStr}</span>
                        <span className={styles.historyDb}>
                          <Database size={11} style={{ display: 'inline', marginRight: 4 }} />
                          {item.database_name || 'master'}
                        </span>
                        <span className={styles.historyProcesses}>
                          {item.process_count} Süreç Çakışması
                        </span>
                        <span className={styles.historyVictim}>
                          Kurban: {item.victim_id || 'Otomatik Seçildi'}
                        </span>
                      </div>

                      {item.victim_sql && (
                        <div className={styles.historySql} title={item.victim_sql}>
                          {item.victim_sql}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={styles.inspectBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectHistoryItem(item);
                      }}
                    >
                      <Search size={13} />
                      {isSelected ? 'Grafik Seçili' : 'Grafiği Çiz'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manual Upload & Input Section */}
      {activeTab === 'MANUAL' && (
        <div className={styles.section} style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--space-3) 0' }}>
            Deadlock XML / XDL Yükleme ve Ayrıştırma
          </h3>

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <Upload size={16} color="var(--accent)" />
              <span>.XDL / .XML Dosyası Yükle</span>
              <input
                type="file"
                accept=".xdl,.xml"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>

            <button
              type="button"
              onClick={handleLoadSample}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              <FileText size={16} />
              Örnek Deadlock Yükle
            </button>
          </div>

          <textarea
            rows={5}
            placeholder="Veya SQL Server Deadlock Graph XML metnini buraya yapıştırın..."
            value={xmlContent}
            onChange={(e) => setXmlContent(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              padding: '8px 12px',
              outline: 'none',
              resize: 'vertical',
              marginBottom: 'var(--space-3)',
            }}
          />

          <button
            type="button"
            onClick={() => handleParse()}
            disabled={loading || !xmlContent.trim()}
            style={{
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: xmlContent.trim() ? 'pointer' : 'not-allowed',
              opacity: xmlContent.trim() ? 1 : 0.5,
            }}
          >
            {loading ? 'Ayrıştırılıyor...' : 'Deadlock Grafiğini Ayrıştır'}
          </button>
        </div>
      )}

      {loading && <LoadingSpinner message="Deadlock grafiği çözümleniyor..." />}
      {error && <ErrorState message={error} onRetry={() => handleParse()} />}

      {/* Results View */}
      {result && (
        <>
          {/* Interactive SVG Deadlock Graph */}
          <DeadlockGraphVisualizer result={result} />

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              Kilitlenme Özeti (Deadlock Summary)
              {result.timestamp && (
                <span className={styles.sectionCount}>Zaman: {result.timestamp}</span>
              )}
            </div>
            <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Kurban Process(ler):{' '}
              <strong style={{ color: 'var(--status-error)' }}>
                {result.victims && result.victims.length > 0 ? result.victims.join(', ') : 'Belirtilmedi'}
              </strong>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              Katılımcı Süreçler (Processes)
              <span className={styles.sectionCount}>{result.processes?.length ?? 0} adet</span>
            </div>
            <div className={styles.processList}>
              {result.processes?.map((proc) => {
                const isVictim = result.victims?.includes(proc.process_id);
                return (
                  <div key={proc.process_id} className={styles.process}>
                    <div className={styles.processHeader}>
                      <span className={styles.processId}>Process ID: {proc.process_id}</span>
                      {isVictim && <span className={styles.victimBadge}>Kurban (Victim)</span>}
                    </div>
                    <div className={styles.processMeta}>
                      <span>Login: {proc.login || (proc as any).login_name || '—'}</span>
                      <span>Host: {proc.hostname || (proc as any).host_name || '—'}</span>
                      <span>DB: {proc.db_name || (proc as any).database_name || '—'}</span>
                      <span>Bekleme: {proc.wait_type || '—'}</span>
                    </div>
                    {proc.sql_text && (
                      <CodeBlock code={truncate(proc.sql_text, 500)} showCopy maxHeight="120px" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {result.resources && result.resources.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                Kilitlenen Kaynaklar (Resources)
                <span className={styles.sectionCount}>{result.resources.length} adet</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.resources.map((res, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      fontSize: '13px',
                    }}
                  >
                    <strong>[{res.resource_type}]</strong> {res.object_name || 'Bilinmeyen Nesne'}{' '}
                    (Mod: {res.mode || 'N/A'})
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
