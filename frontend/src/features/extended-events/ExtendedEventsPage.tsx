import React, { useState, useEffect } from 'react';
import {
  Radio,
  Activity,
  FileText,
  CheckCircle,
  AlertTriangle,
  Play,
  Square,
  Code2,
  Copy,
  Check,
  Search,
  Database,
  Flame,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import DemoDataBanner from '../../components/ui/DemoDataBanner';
import { getExtendedEventsSummary } from '../../lib/api';
import type {
  ExtendedEventsSummary,
  XESession,
  RingBufferEvent,
  XETemplate,
} from '../../lib/types';
import styles from './ExtendedEventsPage.module.css';

type TabType = 'sessions' | 'events' | 'templates';

export default function ExtendedEventsPage() {
  const [summary, setSummary] = useState<ExtendedEventsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [search, setSearch] = useState<string>('');
  const [activeScript, setActiveScript] = useState<{ title: string; sql: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getExtendedEventsSummary();
        setSummary(data);
      } catch (err: any) {
        setError(err.message || 'Extended Events verileri alınırken hata oluştu.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredSessions = (summary?.sessions || []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.target_types.toLowerCase().includes(q);
  });

  const filteredEvents = (summary?.recent_events || []).filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.event_type.toLowerCase().includes(q) ||
      e.message.toLowerCase().includes(q) ||
      (e.database_name || '').toLowerCase().includes(q)
    );
  });

  const sessionColumns: Column<XESession>[] = [
    {
      key: 'name',
      label: 'Olay Oturumu (Session Name)',
      sortable: true,
      render: (s) => (
        <div>
          <strong style={{ color: '#ffffff', fontSize: '13px' }}>{s.name}</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {s.start_time ? `Başlangıç: ${s.start_time}` : 'Oturum durdurulmuş'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Durum',
      sortable: true,
      render: (s) => (
        <StatusBadge
          variant={s.status === 'RUNNING' ? 'success' : 'neutral'}
          label={s.status === 'RUNNING' ? 'ÇALIŞIYOR (RUNNING)' : 'DURDURULDU (STOPPED)'}
        />
      ),
    },
    {
      key: 'auto_start',
      label: 'Sunucu Başlangıcı',
      sortable: true,
      render: (s) => (
        <span style={{ fontSize: '12px', color: s.auto_start ? '#10b981' : 'var(--text-muted)' }}>
          {s.auto_start ? '✓ Otomatik (Auto-Start)' : 'Manuel (Manual)'}
        </span>
      ),
    },
    {
      key: 'total_buffer_size_kb',
      label: 'Bellek / Arabellek',
      sortable: true,
      render: (s) => (
        <div style={{ fontSize: '12px' }}>
          <strong>{(s.total_buffer_size_kb / 1024).toFixed(1)} MB</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Maks: {(s.max_memory_kb / 1024).toFixed(1)} MB
          </div>
        </div>
      ),
    },
    {
      key: 'target_types',
      label: 'Hedefler (Targets)',
      render: (s) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {s.targets.length > 0 ? (
            s.targets.map((t, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: t === 'ring_buffer' ? 'rgba(0, 210, 255, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: t === 'ring_buffer' ? 'var(--accent)' : '#f59e0b',
                  fontWeight: 600,
                }}
              >
                {t}
              </span>
            ))
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Hedef yok</span>
          )}
        </div>
      ),
    },
    {
      key: 'dropped_event_count',
      label: 'Düşen Olaylar',
      sortable: true,
      render: (s) => (
        <span style={{ fontSize: '12px', color: s.dropped_event_count > 0 ? '#ef4444' : 'var(--text-muted)' }}>
          {s.dropped_event_count.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'İşlemler',
      render: (s) => (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() =>
            setActiveScript({
              title: `XE Oturum Yönetimi — [${s.name}]`,
              sql: `-- =======================================================
-- Datapath Extended Events Oturum Yönetim Betiği
-- Oturum: ${s.name} | Mevcut Durum: ${s.status}
-- =======================================================

-- 1. Oturumu Başlat / Durdur:
${s.alter_state_script}
GO

-- 2. Gerekirse Oturumu Tamamen Kaldır:
${s.drop_script}
GO`,
            })
          }
        >
          <Code2 size={13} />
          Yönetim Betiği
        </button>
      ),
    },
  ];

  const eventColumns: Column<RingBufferEvent>[] = [
    {
      key: 'timestamp',
      label: 'Zaman Damgası',
      sortable: true,
      width: '150px',
      render: (e) => (
        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
          {e.timestamp}
        </span>
      ),
    },
    {
      key: 'event_type',
      label: 'Olay Türü',
      sortable: true,
      width: '160px',
      render: (e) => {
        let variant: 'error' | 'warning' | 'info' | 'neutral' = 'neutral';
        let lbl = e.event_type;

        if (e.event_type === 'deadlock') {
          variant = 'error';
          lbl = 'Kilitlenme (Deadlock)';
        } else if (e.event_type === 'error_reported') {
          variant = e.severity && e.severity >= 20 ? 'error' : 'warning';
          lbl = `Hata (Sev ${e.severity ?? '?'})`;
        } else if (e.event_type === 'connectivity') {
          variant = 'info';
          lbl = 'Bağlantı Sorunu';
        } else if (e.event_type === 'memory_broker') {
          variant = 'warning';
          lbl = 'Bellek Daralması';
        }

        return <StatusBadge variant={variant} label={lbl} />;
      },
    },
    {
      key: 'message',
      label: 'Olay Açıklaması',
      render: (e) => (
        <div>
          <strong style={{ color: 'var(--text-primary)', fontSize: '12.5px' }}>{e.message}</strong>
          {e.details && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {e.details}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'database_name',
      label: 'Veritabanı',
      render: (e) => (
        <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
          {e.database_name || 'Sunucu Geneli'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Detay',
      render: (e) => (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() =>
            setActiveScript({
              title: `Ring Buffer Olay Detayı — ${e.event_type} (${e.timestamp})`,
              sql: e.xml_payload || `-- Olay: ${e.message}\n-- Detaylar: ${e.details || 'Ek bilgi yok.'}\n-- Veritabanı: ${e.database_name || 'Bilinmiyor'}`,
            })
          }
        >
          <Code2 size={13} />
          {e.xml_payload ? 'XML Deadlock' : 'Detayı İncele'}
        </button>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Genişletilmiş Olaylar (Extended Events - XE)"
        subtitle="Hafif olay izleme mimarisi, system_health ring buffer hata analizi ve üretime hazır DBA tanı şablonları"
      />

      {summary?.is_demo && <DemoDataBanner />}

      {/* KPI Cards */}
      {summary && (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Toplam XE Oturumu</div>
            <div className={styles.kpiValue} style={{ color: 'var(--accent)' }}>
              {summary.total_sessions}
            </div>
            <div className={styles.kpiSub}>Sunucuda kayıtlı oturum sayısı</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Aktif Çalışan</div>
            <div className={styles.kpiValue} style={{ color: '#10b981' }}>
              {summary.running_sessions} Oturum
            </div>
            <div className={styles.kpiSub}>Olay toplayan canlı süreçler</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>system_health Durumu</div>
            <div className={styles.kpiValue} style={{ color: summary.system_health_running ? '#10b981' : '#ef4444' }}>
              {summary.system_health_running ? 'AKTİF' : 'KAPALI'}
            </div>
            <div className={styles.kpiSub}>Varsayılan sağlık halka arabelleği</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Ring Buffer Kilitlenmeleri</div>
            <div className={styles.kpiValue} style={{ color: summary.deadlocks_in_ring_count > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
              {summary.deadlocks_in_ring_count} Deadlock
            </div>
            <div className={styles.kpiSub}>Hafızada yakalanan kilit grafikleri</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Kritik Hatalar (Sev ≥ 20)</div>
            <div className={styles.kpiValue} style={{ color: summary.severe_errors_count > 0 ? '#ef4444' : 'var(--status-success)' }}>
              {summary.severe_errors_count}
            </div>
            <div className={styles.kpiSub}>Disk, bellek veya bozulma uyarıları</div>
          </div>
        </div>
      )}

      {/* Segmented Tab Bar */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'sessions' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <Radio size={15} />
          XE Oturumları ({summary?.sessions?.length || 0})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'events' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <Activity size={15} />
          Ring Buffer Telemetrisi ({summary?.recent_events?.length || 0})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'templates' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileText size={15} />
          DBA Tanı Şablonları ({summary?.templates?.length || 0})
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <LoadingSpinner label="Extended Events oturumları ve halka arabellek verileri alınıyor..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          {/* Tab 1: Sessions */}
          {activeTab === 'sessions' && (
            <div>
              <div className={styles.infoCallout}>
                <Radio size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Extended Events (Genişletilmiş Olaylar):</strong> SQL Server Profiler ve SQL Trace mimarilerinin yerini alan modern, son derece düşük sistem yüküne sahip olay yakalama motorudur. Çalışan oturumlar arka planda olayları dairesel bellek arabelleğine (ring_buffer) veya disk dosyasına (.xel) yazar.
                </div>
              </div>

              <div className={styles.filterBar}>
                <div className={styles.searchWrap}>
                  <Search size={15} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Oturum adına veya hedefe göre ara..."
                    className={styles.searchInput}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <DataTable
                columns={sessionColumns}
                data={filteredSessions}
                emptyMessage="Tanımlı Extended Events oturumu bulunamadı."
              />
            </div>
          )}

          {/* Tab 2: Ring Buffer Events */}
          {activeTab === 'events' && (
            <div>
              <div className={styles.infoCallout}>
                <Activity size={18} style={{ color: '#00d2ff', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>system_health Ring Buffer Teşhisi:</strong> SQL Server varsayılan olarak arka planda system_health oturumunu çalıştırır. Kilitlenmeler (Deadlock), şiddeti 20 ve üzeri olan kritik donanım/veri bozulması hataları, bağlantı el sıkışma zaman aşımları ve önbellek daralmaları doğrudan bu arabellekte XML olarak tutulur.
                </div>
              </div>

              <div className={styles.filterBar}>
                <div className={styles.searchWrap}>
                  <Search size={15} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Olay türü, hata mesajı veya veritabanına göre ara..."
                    className={styles.searchInput}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <DataTable
                columns={eventColumns}
                data={filteredEvents}
                emptyMessage="Ring Buffer üzerinde kaydedilmiş kritik olay bulunamadı."
              />
            </div>
          )}

          {/* Tab 3: Pre-built Templates */}
          {activeTab === 'templates' && (
            <div>
              <div className={styles.infoCallout}>
                <FileText size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Üretime Hazır Güvenli Şablonlar:</strong> Üretim ortamlarında performans darboğazlarını analiz etmek için tasarlanmış, optimize edilmiş ve kaynak tüketimi minimumda tutulan (VERY_LOW) Extended Events oturum oluşturma betikleri.
                </div>
              </div>

              <div className={styles.templateGrid}>
                {(summary?.templates || []).map((tmpl) => (
                  <div key={tmpl.id} className={styles.templateCard}>
                    <div>
                      <div className={styles.templateHeader}>
                        <StatusBadge
                          variant={tmpl.overhead_impact === 'VERY_LOW' ? 'success' : 'warning'}
                          label={`Kaynak Yükü: ${tmpl.overhead_impact}`}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          Hedef: {tmpl.target_type}
                        </span>
                      </div>

                      <div className={styles.templateTitle} style={{ marginTop: '10px' }}>
                        {tmpl.name}
                      </div>

                      <div className={styles.templateDesc} style={{ marginTop: '6px' }}>
                        {tmpl.description}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() =>
                        setActiveScript({
                          title: `Oturum Oluşturma Şablonu — ${tmpl.name}`,
                          sql: tmpl.create_script,
                        })
                      }
                    >
                      <Code2 size={14} />
                      T-SQL Şablonunu İncele & Kopyala
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Script Drawer / Modal */}
      {activeScript && (
        <div className={styles.modalOverlay} onClick={() => setActiveScript(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{activeScript.title}</h3>
              </div>
              <button className={styles.closeBtn} onClick={() => setActiveScript(null)}>✕</button>
            </div>

            <div className={styles.sqlCodeBox}>
              <pre>{activeScript.sql}</pre>
            </div>

            <div className={styles.modalFooter}>
              <span className={styles.reviewNotice}>
                ⚠️ Güvenlik İlkesi: Datapath sunucu üzerinde otomatik olay oturumu başlatmaz veya silmez. Betiği kopyalayıp DBA kontrolünde SSMS üzerinde çalıştırınız.
              </span>
              <button className={styles.actionBtn} onClick={() => handleCopy(activeScript.sql)}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Kopyalandı!' : 'Betiği Kopyala'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
