import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, ShieldAlert, Copy, Check } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { getHAStatus } from '../../lib/api';
import type { HAStatus, AGReplica, AGDatabase } from '../../lib/types';
import styles from './HAPage.module.css';

export default function HAPage() {
  const [status, setStatus] = useState<HAStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getHAStatus();
        setStatus(data);
      } catch (err: any) {
        setError(err.message || 'Yüksek erişilebilirlik verisi alınamadı');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const replicaColumns: Column<AGReplica>[] = [
    {
      key: 'name',
      label: 'Replika Sunucu',
      sortable: true,
      render: (r) => <strong>{r.name}</strong>,
    },
    {
      key: 'role',
      label: 'Rol',
      render: (r) => {
        const isPrimary = r.role?.toLowerCase() === 'primary';
        return (
          <StatusBadge
            variant={isPrimary ? 'info' : 'neutral'}
            label={isPrimary ? 'Birincil (PRIMARY)' : 'İkincil (SECONDARY)'}
          />
        );
      },
    },
    {
      key: 'availability_mode',
      label: 'Kullanılabilirlik Modu',
      render: (r) => r.availability_mode || '—',
    },
    {
      key: 'failover_mode',
      label: 'Failover Modu',
      render: (r) => r.failover_mode || '—',
    },
    {
      key: 'synchronization_health',
      label: 'Senkronizasyon Sağlığı',
      render: (r) => {
        const isHealthy = r.synchronization_health?.toLowerCase().includes('healthy');
        return (
          <StatusBadge
            variant={isHealthy ? 'success' : 'warning'}
            label={r.synchronization_health || 'Bilinmiyor'}
          />
        );
      },
    },
  ];

  const dbColumns: Column<AGDatabase>[] = [
    {
      key: 'name',
      label: 'Veritabanı',
      render: (d) => <strong>{d.name}</strong>,
    },
    {
      key: 'sync_state',
      label: 'Senkronizasyon Durumu',
      render: (d) => (
        <StatusBadge
          variant={d.sync_state?.toLowerCase().includes('synch') ? 'success' : 'warning'}
          label={d.sync_state || '—'}
        />
      ),
    },
    {
      key: 'is_suspended',
      label: 'Askıya Alındı mı?',
      render: (d) => (
        <StatusBadge
          variant={d.is_suspended ? 'error' : 'success'}
          label={d.is_suspended ? 'Askıda (Suspended)' : 'Aktif'}
        />
      ),
    },
    {
      key: 'redo_queue_size_kb',
      label: 'Redo Kuyruğu (KB)',
      render: (d) => `${d.redo_queue_size_kb ?? 0} KB`,
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Yüksek Erişilebilirlik (Always On High Availability)"
        subtitle="Always On kullanılabilirlik grupları, birincil/ikincil replikalar ve senkronizasyon sağlığı"
      />

      {loading && <LoadingSpinner message="Always On AG durumu denetleniyor..." />}
      {error && <ErrorState message={error} onRetry={() => setLoading(true)} />}

      {!loading && status && !status.available && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '850px', margin: '20px auto' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{
                background: 'rgba(234, 179, 8, 0.12)',
                padding: '12px',
                borderRadius: '10px',
                color: 'var(--warning, #eab308)',
                flexShrink: 0
              }}>
                <ShieldAlert size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--text-primary)' }}>
                  Always On Availability Groups Aktif Değil
                </h3>
                <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                  {status.reason || 'Bu SQL Server sunucusunda Always On High Availability özelliği yapılandırılmamış.'}
                </p>

                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Neden Aktif Gözükmüyor? (DBA Teşhisi)
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                    <li>
                      <strong>Tekil (Standalone) Kurulum:</strong> SQL Server tek bir fiziksel veya sanal makine üzerinde tekil (standalone) olarak kurulduysa Always On motoru varsayılan olarak kapalıdır (<code style={{ color: 'var(--accent)' }}>IsHadrEnabled = 0</code>). Bu bir hata değil, sunucunuzun kümelenmemiş tekil bir instance olduğunu doğrular.
                    </li>
                    <li>
                      <strong>Windows Cluster (WSFC) veya Servis Ayarı:</strong> Always On kullanabilmek için sunucunun bir Windows Server Failover Cluster (WSFC) üyesi olması ve SQL Server Configuration Manager üzerinden <em>"Enable Always On Availability Groups"</em> seçeneğinin işaretlenerek servisin yeniden başlatılması gerekir.
                    </li>
                  </ul>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Doğrulama T-SQL Sorgusu:
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("SELECT SERVERPROPERTY('IsHadrEnabled') AS IsHadrEnabled, SERVERPROPERTY('HadrManagerStatus') AS HadrManagerStatus;");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: 'rgba(0, 210, 255, 0.1)',
                      border: '1px solid rgba(0, 210, 255, 0.3)',
                      color: 'var(--accent, #00d2ff)',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
                <pre style={{
                  background: 'rgba(0,0,0,0.4)',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#38bdf8'
                }}>
                  SELECT SERVERPROPERTY('IsHadrEnabled') AS IsHadrEnabled, SERVERPROPERTY('HadrManagerStatus') AS HadrManagerStatus;
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && status && status.available && status.groups.length === 0 && (
        <EmptyState
          title="Kullanılabilirlik Grubu Bulunamadı"
          message={status.reason || 'Always On özelliği sunucuda açık ancak henüz yapılandırılmış bir AG grubu bulunmuyor.'}
        />
      )}

      {!loading && status && status.available && status.groups.map((group) => (
        <div key={group.ag_name} className={styles.agCard}>
          <div className={styles.agHeader}>
            <div className={styles.agTitle}>
              <Activity size={20} color="var(--accent)" />
              <span>Grup: {group.ag_name}</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <StatusBadge
                variant={group.sync_health?.toLowerCase().includes('healthy') ? 'success' : 'warning'}
                label={`Senkronizasyon: ${group.sync_health || 'Normal'}`}
              />
              <StatusBadge
                variant="info"
                label={`Birincil: ${group.primary_replica || '—'}`}
              />
            </div>
          </div>

          <div className={styles.replicaSection}>
            <span className={styles.sectionTitle}>Replikalar ({group.replicas.length})</span>
            <DataTable
              columns={replicaColumns}
              data={group.replicas}
              emptyMessage="Replika bulunamadı."
            />
          </div>

          <div className={styles.dbSection}>
            <span className={styles.sectionTitle}>Grup İçi Veritabanları ({group.databases.length})</span>
            <DataTable
              columns={dbColumns}
              data={group.databases}
              emptyMessage="Gruba eklenmiş veritabanı yok."
            />
          </div>
        </div>
      ))}
    </div>
  );
}
