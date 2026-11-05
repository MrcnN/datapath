import React, { useState, useEffect } from 'react';
import {
  Layers,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Database,
  FileCode,
  Copy,
  Check,
  Server,
  Activity,
  Flame,
} from 'lucide-react';
import { getVersionStoreAnalysis } from '../../../lib/api';
import type {
  VersionStoreAnalysis,
  ActiveSnapshotTransaction,
  VersionStoreDatabaseUsage,
  TopVersionGenerator,
} from '../../../lib/types';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import styles from './VersionStoreRadar.module.css';

export default function VersionStoreRadar() {
  const [data, setData] = useState<VersionStoreAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getVersionStoreAnalysis();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Sürüm deposu verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = () => {
    if (!data?.remediation_sql) return;
    navigator.clipboard.writeText(data.remediation_sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          TempDB Sürüm Deposu (Version Store) taranıyor...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.culpritBanner}>
          <AlertTriangle size={18} />
          <span>{error || 'Sürüm deposu verisi yüklenemedi.'}</span>
        </div>
      </div>
    );
  }

  const oldest = data.oldest_active_transaction;
  const isPurgeBlocked = data.purge_status !== 'NORMAL';

  const txColumns: Column<ActiveSnapshotTransaction>[] = [
    {
      key: 'session_id',
      label: 'SPID',
      sortable: true,
      render: (t) => (
        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: t.is_blocking_purge ? '#ef4444' : 'inherit' }}>
          {t.session_id} {t.is_blocking_purge && '⚠️'}
        </span>
      ),
    },
    {
      key: 'login_name',
      label: 'Kullanıcı & Host',
      render: (t) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.login_name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.host_name || '—'}</div>
        </div>
      ),
    },
    {
      key: 'database_name',
      label: 'Veritabanı',
      render: (t) => <strong>{t.database_name}</strong>,
    },
    {
      key: 'elapsed_time_formatted',
      label: 'Açık Kalma Süresi',
      sortable: true,
      render: (t) => (
        <span style={{ color: t.elapsed_time_seconds > 3600 ? '#ef4444' : '#f59e0b', fontWeight: 600, fontFamily: 'monospace' }}>
          {t.elapsed_time_formatted}
        </span>
      ),
    },
    {
      key: 'is_snapshot',
      label: 'İzolasyon Türü',
      render: (t) => (
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {t.is_snapshot ? 'Snapshot' : 'RCSI (Read Committed)'}
        </span>
      ),
    },
    {
      key: 'max_version_chain_traversed',
      label: 'Sürüm Zinciri Derinliği',
      render: (t) => `${t.max_version_chain_traversed} adım`,
    },
  ];

  const dbColumns: Column<VersionStoreDatabaseUsage>[] = [
    {
      key: 'database_name',
      label: 'Veritabanı Adı',
      render: (d) => <strong>{d.database_name}</strong>,
    },
    {
      key: 'version_store_mb',
      label: 'Sürüm Alanı (MB)',
      sortable: true,
      render: (d) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: d.version_store_mb > 5000 ? '#ef4444' : 'inherit' }}>
          {d.version_store_mb.toLocaleString()} MB
        </span>
      ),
    },
    {
      key: 'rcsi_enabled',
      label: 'RCSI Durumu',
      render: (d) => (
        <span
          style={{
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '3px',
            backgroundColor: d.rcsi_enabled ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.15)',
            color: d.rcsi_enabled ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
          }}
        >
          {d.rcsi_enabled ? 'RCSI AÇIK' : 'KAPALI'}
        </span>
      ),
    },
    {
      key: 'snapshot_isolation_state',
      label: 'Snapshot İzolasyon',
      render: (d) => (
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {d.snapshot_isolation_state}
        </span>
      ),
    },
  ];

  const genColumns: Column<TopVersionGenerator>[] = [
    {
      key: 'table_name',
      label: 'Tablo',
      render: (g) => (
        <span>
          <strong>{g.database_name}</strong>.{g.schema_name}.{g.table_name}
        </span>
      ),
    },
    {
      key: 'version_size_mb',
      label: 'Oluşturulan Sürüm (MB)',
      sortable: true,
      render: (g) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--accent)' }}>
          {g.version_size_mb.toLocaleString()} MB
        </span>
      ),
    },
    {
      key: 'version_record_count',
      label: 'Satır Sürümü Sayısı',
      sortable: true,
      render: (g) => `${g.version_record_count.toLocaleString()} satır`,
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Layers className={styles.titleIcon} size={20} />
          <div>
            <h3 className={styles.title}>TempDB Sürüm Deposu &amp; Snapshot İzolasyonu Sızıntı Radarı</h3>
            <p className={styles.subtitle}>
              sys.dm_tran_version_store ve aktif snapshot oturumları taranarak TempDB temizliğini (purge) engelleyen oturumlar yakalanır.
            </p>
          </div>
        </div>

        <div>
          <span
            className={`${styles.purgeBadge} ${
              data.purge_status === 'NORMAL'
                ? styles.purgeNormal
                : data.purge_status === 'PURGE_BLOCKED_WARNING'
                ? styles.purgeWarning
                : styles.purgeCritical
            }`}
          >
            {data.purge_status === 'NORMAL'
              ? 'Purge Sağlıklı ✓'
              : data.purge_status === 'PURGE_BLOCKED_WARNING'
              ? 'Purge Kilitli (Temizlik Engelleniyor!)'
              : 'Kritik Sürüm Şişmesi!'}
          </span>
        </div>
      </div>

      {/* Culprit Alert Banner if Purge Blocked */}
      {isPurgeBlocked && oldest && (
        <div className={styles.culpritBanner}>
          <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div className={styles.culpritDetails}>
            <strong>KÖK NEDEN TESPİT EDİLDİ: TempDB Temizliğini Bloke Eden Oturum (Oldest Active Transaction)</strong>
            <span>
              Aşağıdaki açık transaction sonlanmadığı veya commit edilmediği sürece SQL Server daha önceki satır sürümlerini TempDB diskinden temizleyemez.
            </span>
            <div className={styles.culpritMeta}>
              <span className={styles.culpritTag}>SPID: {oldest.session_id}</span>
              <span className={styles.culpritTag}>Kullanıcı: {oldest.login_name}</span>
              <span className={styles.culpritTag}>İstemci: {oldest.host_name || 'N/A'}</span>
              <span className={styles.culpritTag}>Süre: {oldest.elapsed_time_formatted}</span>
              <span className={styles.culpritTag}>Hedef DB: {oldest.database_name}</span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Toplam Sürüm Deposu Boyutu</span>
          <span className={styles.kpiVal} style={{ color: data.version_store_percent_of_tempdb > 30 ? '#ef4444' : '#ffffff' }}>
            {(data.total_version_store_mb / 1024).toFixed(2)} GB
          </span>
          <span className={styles.kpiSub}>TempDB alanının %{data.version_store_percent_of_tempdb.toFixed(1)}'i</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>En Eski Açık Snapshot Süresi</span>
          <span className={styles.kpiVal} style={{ color: oldest && oldest.elapsed_time_seconds > 3600 ? '#f59e0b' : '#ffffff' }}>
            {oldest ? oldest.elapsed_time_formatted : '0 sn (Yok)'}
          </span>
          <span className={styles.kpiSub}>{oldest ? `SPID ${oldest.session_id}` : 'Aktif kilit yok'}</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Aktif Snapshot / RCSI Oturumları</span>
          <span className={styles.kpiVal}>{data.active_transactions_count} Oturum</span>
          <span className={styles.kpiSub}>Satır sürümü kullanan sorgular</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>TempDB Toplam Boyutu</span>
          <span className={styles.kpiVal}>{(data.tempdb_total_size_mb / 1024).toFixed(1)} GB</span>
          <span className={styles.kpiSub}>Tüm veri dosyaları toplamı</span>
        </div>
      </div>

      {/* Dual Column: DB Breakdown & Top Generators */}
      <div className={styles.dualGrid}>
        <div className={styles.subCard}>
          <div className={styles.subTitle}>
            <Database size={15} color="var(--accent)" />
            Veritabanı Bazında Sürüm Deposu Tüketimi
          </div>
          <DataTable
            columns={dbColumns}
            data={data.database_usage}
            emptyMessage="Sürüm deposu kullanan veritabanı bulunamadı."
          />
        </div>

        <div className={styles.subCard}>
          <div className={styles.subTitle}>
            <Flame size={15} color="#f59e0b" />
            En Çok Sürüm Üreten Tablolar (Top Generators)
          </div>
          <DataTable
            columns={genColumns}
            data={data.top_generators}
            emptyMessage="Sürüm üreten tablo kaydı bulunamadı."
          />
        </div>
      </div>

      {/* Active Snapshot Transactions Table */}
      <div className={styles.subCard}>
        <div className={styles.subTitle}>
          <Clock size={15} color="var(--accent)" />
          Aktif Snapshot &amp; RCSI Oturumları (sys.dm_tran_active_snapshot_database_transactions)
        </div>
        <DataTable
          columns={txColumns}
          data={data.active_transactions}
          emptyMessage="Aktif snapshot oturumu bulunamadı."
        />
      </div>

      {/* Review-Only Remediation T-SQL */}
      {data.remediation_sql && (
        <div className={styles.scriptCard}>
          <div className={styles.scriptHeader}>
            <div className={styles.scriptTitle}>
              <FileCode size={14} color="var(--accent)" />
              [Review-Only] Sürüm Deposu Engelleyici Oturum Teşhis ve Çözüm Reçetesi
            </div>
            <button className={styles.copyBtn} onClick={handleCopy}>
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copied ? 'Kopyalandı!' : 'T-SQL Betiğini Kopyala'}
            </button>
          </div>
          <pre className={styles.codeArea}>{data.remediation_sql}</pre>
        </div>
      )}
    </div>
  );
}
