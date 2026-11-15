import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  AlertTriangle,
  Layers,
  Database,
  RefreshCw,
  Search,
  Copy,
  Check,
  Zap,
  ShieldAlert,
  ArrowUpRight,
  UserX,
  FileCode,
  Clock,
  Terminal,
  X,
  Info,
} from 'lucide-react';
import styles from './TempDBForensicsStudio.module.css';
import { getTempDBForensics } from '../../../lib/api';
import type {
  TempDBForensicsResponse,
  TempDBSpillQuery,
  TempDBSessionConsumer,
  TempDBActiveObject,
} from '../../../lib/types';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';

export default function TempDBForensicsStudio() {
  const [data, setData] = useState<TempDBForensicsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'spills' | 'sessions' | 'objects'>('spills');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modalSql, setModalSql] = useState<{ title: string; desc: string; sql: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getTempDBForensics();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'TempDB forensik verileri alınırken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <LoadingSpinner message="TempDB spill olayları, oturum tahsisleri ve geçici nesne envanteri taranıyor..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'TempDB forensik verisi yüklenemedi.'} onRetry={loadData} />;
  }

  const { summary, spills, session_consumers, temp_objects, recommendations } = data;

  // Filtered lists based on search query
  const filteredSpills = spills.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.query_text.toLowerCase().includes(q) ||
      s.query_hash.toLowerCase().includes(q) ||
      s.spill_type.toLowerCase().includes(q) ||
      s.root_cause.toLowerCase().includes(q)
    );
  });

  const filteredSessions = session_consumers.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(c.session_id).includes(q) ||
      c.login_name.toLowerCase().includes(q) ||
      (c.host_name && c.host_name.toLowerCase().includes(q)) ||
      (c.program_name && c.program_name.toLowerCase().includes(q)) ||
      (c.current_sql && c.current_sql.toLowerCase().includes(q))
    );
  });

  const filteredObjects = temp_objects.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.clean_table_name.toLowerCase().includes(q) ||
      o.raw_object_name.toLowerCase().includes(q)
    );
  });

  // Columns for 1. Spills
  const spillColumns: Column<TempDBSpillQuery>[] = [
    {
      key: 'query_text',
      label: 'Sorgu Metni & Hash',
      sortable: false,
      render: (s) => (
        <div style={{ maxWidth: '440px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-blue)', fontWeight: 600 }}>
              {s.query_hash}
            </span>
            <span
              style={{
                fontSize: '10.5px',
                padding: '1px 6px',
                borderRadius: '4px',
                background: s.spill_type.includes('Sort') ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: s.spill_type.includes('Sort') ? '#eab308' : 'var(--status-danger)',
                fontWeight: 600,
              }}
            >
              {s.spill_type}
            </span>
          </div>
          <pre className={styles.queryCode}>{s.query_text}</pre>
        </div>
      ),
    },
    {
      key: 'total_spill_mb',
      label: 'Toplam Taşma (MB)',
      sortable: true,
      render: (s) => (
        <div>
          <div style={{ fontWeight: 700, color: s.total_spill_mb > 500 ? 'var(--status-danger)' : s.total_spill_mb > 50 ? '#eab308' : 'var(--text-primary)' }}>
            {s.total_spill_mb >= 1024 ? `${(s.total_spill_mb / 1024).toFixed(2)} GB` : `${s.total_spill_mb.toFixed(2)} MB`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {s.total_spills.toLocaleString()} sayfa • {s.execution_count} çalıştırma
          </div>
        </div>
      ),
    },
    {
      key: 'avg_spill_mb',
      label: 'Ort. Taşma / Çalıştırma',
      sortable: true,
      render: (s) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {s.avg_spill_mb.toFixed(2)} MB
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Son: {s.last_spill_mb.toFixed(2)} MB
          </div>
        </div>
      ),
    },
    {
      key: 'avg_elapsed_time_ms',
      label: 'Süre & CPU',
      sortable: true,
      render: (s) => (
        <div style={{ fontSize: '12px' }}>
          <div>Ort: <strong>{s.avg_elapsed_time_ms.toFixed(1)} ms</strong></div>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>CPU: {(s.total_worker_time_ms / 1000).toFixed(1)}s</div>
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Kök Neden & Aksiyon',
      sortable: true,
      render: (s) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '300px' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            {s.root_cause}
          </div>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() =>
              setModalSql({
                title: `${s.spill_type} İyileştirme T-SQL Reçetesi`,
                desc: 'Aşağıdaki T-SQL betiği, derleme anındaki kardinalite tahmin sapmasını gidermek ve sorgunun bellek yetersizliği sebebiyle TempDB worktable diske taşmasını önlemek üzere hazırlanmıştır.',
                sql: s.remediation_sql,
              })
            }
          >
            <FileCode size={12} /> İyileştirme Betiği (T-SQL)
          </button>
        </div>
      ),
    },
  ];

  // Columns for 2. Sessions
  const sessionColumns: Column<TempDBSessionConsumer>[] = [
    {
      key: 'session_id',
      label: 'SPID & Oturum',
      sortable: true,
      render: (c) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>SPID {c.session_id}</span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '4px',
                background: c.status === 'running' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                color: c.status === 'running' ? 'var(--status-success)' : 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {c.status}
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {c.login_name} • {c.host_name || 'Bilinmiyor'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {c.program_name || 'Uygulama Bilgisi Yok'}
          </div>
        </div>
      ),
    },
    {
      key: 'total_net_mb',
      label: 'Net TempDB Alanı',
      sortable: true,
      render: (c) => {
        const isCrit = c.risk_level === 'CRITICAL';
        const isWarn = c.risk_level === 'WARNING';
        return (
          <div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: isCrit ? 'var(--status-danger)' : isWarn ? '#eab308' : 'var(--text-primary)',
              }}
            >
              {c.total_net_mb >= 1024 ? `${(c.total_net_mb / 1024).toFixed(2)} GB` : `${c.total_net_mb.toFixed(2)} MB`}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Kullanıcı: {c.user_objects_mb.toFixed(1)} MB • Dahili: {c.internal_objects_mb.toFixed(1)} MB
            </div>
          </div>
        );
      },
    },
    {
      key: 'open_transaction_count',
      label: 'İşlem & Uyuma Riski',
      sortable: true,
      render: (c) => (
        <div>
          {c.is_sleeping_with_tran ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-danger)', fontWeight: 600, fontSize: '12px' }}>
              <AlertTriangle size={13} />
              Açık İşlemde Uyuyor ({c.open_transaction_count} Tran)
            </div>
          ) : c.open_transaction_count > 0 ? (
            <span style={{ color: '#eab308', fontWeight: 600, fontSize: '12px' }}>
              {c.open_transaction_count} Aktif İşlem
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Açık İşlem Yok</span>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Geçen Süre: {(c.elapsed_time_ms / 1000).toFixed(0)}s • CPU: {(c.cpu_time_ms / 1000).toFixed(1)}s
          </div>
        </div>
      ),
    },
    {
      key: 'current_sql',
      label: 'Çalışan SQL Metni',
      render: (c) => (
        <div style={{ maxWidth: '320px' }}>
          <pre className={styles.queryCode} style={{ maxHeight: '60px' }}>{c.current_sql || '-- SQL metni yok'}</pre>
        </div>
      ),
    },
    {
      key: 'risk_level',
      label: 'Yönetimsel Aksiyon',
      render: (c) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() =>
              setModalSql({
                title: `SPID ${c.session_id} Teşhis Sorgusu`,
                desc: 'Oturumun beklediği kilitler, kaynak mandalları ve yürütme planı detaylarını canlı olarak incelemek için aşağıdaki T-SQL betiğini çalıştırabilirsiniz.',
                sql: c.investigation_sql,
              })
            }
          >
            <Search size={12} /> Oturumu İncele
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() =>
              setModalSql({
                title: `SPID ${c.session_id} Güvenli Sonlandırma (KILL) Reçetesi`,
                desc: 'Dikkat: KILL komutu çalıştırmadan önce oturumun veritabanındaki işlem durumunu doğrulayın. Aşağıdaki betik güvenli doğrulama adımları içerir.',
                sql: c.kill_sql,
              })
            }
          >
            <UserX size={12} /> Güvenli KILL Betiği
          </button>
        </div>
      ),
    },
  ];

  // Columns for 3. Objects
  const objectColumns: Column<TempDBActiveObject>[] = [
    {
      key: 'clean_table_name',
      label: 'Geçici Tablo Adı',
      sortable: true,
      render: (o) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {o.clean_table_name}
            </span>
            {o.stale_risk && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--status-danger)',
                  fontWeight: 600,
                }}
              >
                Eski / Unutulmuş
              </span>
            )}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
            {o.raw_object_name}
          </div>
        </div>
      ),
    },
    {
      key: 'total_size_mb',
      label: 'Boyut Dağılımı',
      sortable: true,
      render: (o) => (
        <div>
          <div style={{ fontWeight: 700, color: o.total_size_mb > 500 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
            {o.total_size_mb >= 1024 ? `${(o.total_size_mb / 1024).toFixed(2)} GB` : `${o.total_size_mb.toFixed(2)} MB`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Veri: {o.data_size_mb.toFixed(1)} MB • İndeks: {o.index_size_mb.toFixed(1)} MB
          </div>
        </div>
      ),
    },
    {
      key: 'row_count',
      label: 'Satır Sayısı',
      sortable: true,
      render: (o) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {o.row_count.toLocaleString()} satır
        </span>
      ),
    },
    {
      key: 'age_minutes',
      label: 'Oluşturulma & Yaş',
      sortable: true,
      render: (o) => (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: o.age_minutes > 60 ? '#eab308' : 'var(--text-secondary)' }}>
            {o.age_minutes > 60 ? `${(o.age_minutes / 60).toFixed(1)} saat önce` : `${o.age_minutes.toFixed(0)} dk önce`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {o.create_date}
          </div>
        </div>
      ),
    },
    {
      key: 'stale_risk',
      label: 'Teşhis & İnceleme',
      render: (o) => (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() =>
            setModalSql({
              title: `${o.clean_table_name} Tablo İnceleme Betiği`,
              desc: 'TempDB kataloğundaki geçici tablonun kolonlarını, satır yapısını ve tahsis edilen sayfa tiplerini incelemek için aşağıdaki sorguyu kullanabilirsiniz.',
              sql: `-- ${o.clean_table_name} Geçici Tablo Detaylı Teşhisi:\nSELECT c.name AS ColumnName, ty.name AS DataType, c.max_length, c.is_nullable\nFROM tempdb.sys.columns c\nJOIN tempdb.sys.types ty ON c.user_type_id = ty.user_type_id\nWHERE c.object_id = ${o.object_id};\n\n-- İndeks ve İstatistik Bilgisi:\nSELECT i.name, i.type_desc, i.is_unique\nFROM tempdb.sys.indexes i\nWHERE i.object_id = ${o.object_id};`,
            })
          }
        >
          <Search size={12} /> Kolonları İncele
        </button>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* High-Level Metric KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>TempDB Disk Taşmaları (Spill)</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)' }}>
              <Flame size={18} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            {summary.total_spill_mb >= 1024 ? `${(summary.total_spill_mb / 1024).toFixed(2)} GB` : `${summary.total_spill_mb.toFixed(1)} MB`}
          </div>
          <div className={styles.kpiSub}>
            <span>{summary.total_spill_events} adet taşan sorgu planı</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Aktif Geçici Tablolar (#temp)</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
              <Layers size={18} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            {summary.active_temp_tables_count} <span style={{ fontSize: '14px', fontWeight: 500 }}>Tablo</span>
          </div>
          <div className={styles.kpiSub}>
            <span>Toplam Hacim: {summary.active_temp_tables_mb >= 1024 ? `${(summary.active_temp_tables_mb / 1024).toFixed(2)} GB` : `${summary.active_temp_tables_mb.toFixed(1)} MB`}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>En Büyük Oturum Tüketicisi</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
              <Database size={18} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            {summary.top_consumer_spid ? `SPID ${summary.top_consumer_spid}` : 'Yok'}
          </div>
          <div className={styles.kpiSub}>
            <span>Net Tüketim: {summary.top_consumer_mb >= 1024 ? `${(summary.top_consumer_mb / 1024).toFixed(2)} GB` : `${summary.top_consumer_mb.toFixed(1)} MB`}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Açık İşlemde Uyuyan Oturumlar</span>
            <div
              className={styles.kpiIconWrap}
              style={{
                background: summary.sleeping_with_tran_count > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: summary.sleeping_with_tran_count > 0 ? 'var(--status-danger)' : 'var(--status-success)',
              }}
            >
              <ShieldAlert size={18} />
            </div>
          </div>
          <div
            className={styles.kpiValue}
            style={{ color: summary.sleeping_with_tran_count > 0 ? 'var(--status-danger)' : 'inherit' }}
          >
            {summary.sleeping_with_tran_count} <span style={{ fontSize: '14px', fontWeight: 500 }}>Oturum</span>
          </div>
          <div className={styles.kpiSub}>
            <span>{summary.sleeping_with_tran_count > 0 ? 'TempDB şişme riski yaratıyor!' : 'Zombi işlem tespit edilmedi'}</span>
          </div>
        </div>
      </div>

      {/* Advisory & Recommendations Banner */}
      <div
        className={`${styles.alertBox} ${
          summary.overall_risk === 'CRITICAL'
            ? styles.alertBoxCritical
            : summary.overall_risk === 'WARNING'
            ? styles.alertBoxWarning
            : styles.alertBoxHealthy
        }`}
      >
        <AlertTriangle
          size={20}
          color={
            summary.overall_risk === 'CRITICAL'
              ? 'var(--status-danger)'
              : summary.overall_risk === 'WARNING'
              ? '#eab308'
              : 'var(--status-success)'
          }
        />
        <div className={styles.alertContent}>
          <strong>
            {summary.overall_risk === 'CRITICAL'
              ? 'Kritik TempDB Tüketim & Taşma Riski Tespit Edildi'
              : summary.overall_risk === 'WARNING'
              ? 'TempDB Kaynak Kullanımı Eşik Değerlere Yakın'
              : 'TempDB Tüketim & Bellek Tahsisleri Sağlıklı'}
          </strong>
          <ul className={styles.recommendationsList}>
            {recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className={styles.subNavBar}>
        <div className={styles.tabPillGroup}>
          <button
            type="button"
            className={`${styles.tabPill} ${activeTab === 'spills' ? styles.tabPillActive : ''}`}
            onClick={() => setActiveTab('spills')}
          >
            <Flame size={14} />
            Sorgu Spill &amp; Taşma Forensiği
            <span className={styles.pillBadge}>{spills.length}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabPill} ${activeTab === 'sessions' ? styles.tabPillActive : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            <Database size={14} />
            Canlı Oturum &amp; Görev Tüketicileri
            <span className={styles.pillBadge}>{session_consumers.length}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabPill} ${activeTab === 'objects' ? styles.tabPillActive : ''}`}
            onClick={() => setActiveTab('objects')}
          >
            <Layers size={14} />
            Geçici Tablo Envanteri (#temp)
            <span className={styles.pillBadge}>{temp_objects.length}</span>
          </button>
        </div>

        <div className={styles.controlsWrap}>
          <div className={styles.searchBox}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Sorgu, SPID veya nesne adına göre filtrele..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button type="button" className={styles.refreshBtn} onClick={loadData}>
            <RefreshCw size={14} /> Yenile
          </button>
        </div>
      </div>

      {/* Tab 1: Spills */}
      {activeTab === 'spills' && (
        <div className={styles.cardTable}>
          <div className={styles.tableHeaderBar}>
            <span className={styles.tableTitle}>
              <Flame size={16} color="var(--status-danger)" />
              Sorgu Yürütme Planı Bellek Taşmaları (sys.dm_exec_query_stats total_spills)
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Sort ve Hash Join işlemlerinde memory grant yetersiz kaldığında disk sayfalarına dökülen taşmalar
            </span>
          </div>
          <DataTable
            data={filteredSpills}
            columns={spillColumns}
            emptyMessage="TempDB'ye taşma (spill) yapan sorgu tespit edilmedi."
          />
        </div>
      )}

      {/* Tab 2: Sessions */}
      {activeTab === 'sessions' && (
        <div className={styles.cardTable}>
          <div className={styles.tableHeaderBar}>
            <span className={styles.tableTitle}>
              <Database size={16} color="var(--accent-blue)" />
              En Çok TempDB Alanı Tutan Oturumlar &amp; Görevler (sys.dm_db_session_space_usage &amp; task_space)
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Kullanıcı nesneleri (#tablo), dahili nesneler (sıralama) ve aktif paralel iş parçacığı tahsisleri
            </span>
          </div>
          <DataTable
            data={filteredSessions}
            columns={sessionColumns}
            emptyMessage="TempDB alanı tutan aktif oturum bulunamadı."
          />
        </div>
      )}

      {/* Tab 3: Objects */}
      {activeTab === 'objects' && (
        <div className={styles.cardTable}>
          <div className={styles.tableHeaderBar}>
            <span className={styles.tableTitle}>
              <Layers size={16} color="var(--accent-cyan)" />
              TempDB Canlı Geçici Tablo Kataloğu (tempdb.sys.tables)
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Oturumlar tarafından oluşturulmuş ve henüz silinmemiş geçici (#) tabloların boyut ve satır analizi
            </span>
          </div>
          <DataTable
            data={filteredObjects}
            columns={objectColumns}
            emptyMessage="TempDB veritabanında aktif geçici tablo bulunamadı."
          />
        </div>
      )}

      {/* Modal Drawer for T-SQL Scripts */}
      {modalSql && (
        <div className={styles.modalOverlay} onClick={() => setModalSql(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <Terminal size={16} color="var(--accent-blue)" />
                {modalSql.title}
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setModalSql(null)}
              >
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
