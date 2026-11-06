import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Database,
  Server,
  Layers,
  Activity,
  ShieldCheck,
  TrendingUp,
  HardDrive,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Clock,
  Cpu,
} from 'lucide-react';
import type { Database as DbType, Session } from '../../../lib/types';
import styles from './DatabaseDetailDrawer.module.css';

interface DatabaseDetailDrawerProps {
  database: DbType | null;
  sessions: Session[];
  onClose: () => void;
}

export default function DatabaseDetailDrawer({
  database,
  sessions,
  onClose,
}: DatabaseDetailDrawerProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!database) return null;

  const dbSessions = sessions.filter(
    (s) => s.database?.toLowerCase() === database.name.toLowerCase()
  );
  const activeSessions = dbSessions.filter((s) => s.status === 'running');

  const formatSize = (mb?: number | null) => {
    if (!mb) return '—';
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={styles.drawer}
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        {/* Drawer Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconBox}>
              <Database size={18} />
            </div>
            <div>
              <div className={styles.titleRow}>
                <h2 className={styles.dbName}>{database.name}</h2>
                <span
                  className={`${styles.statusBadge} ${
                    database.state === 'ONLINE' ? styles.badgeOnline : styles.badgeOther
                  }`}
                >
                  <span className={styles.dot} />
                  {database.state || 'ONLINE'}
                </span>
                {database.is_read_only && (
                  <span className={styles.readOnlyBadge}>Salt Okunur</span>
                )}
              </div>
              <p className={styles.dbSub}>
                Kurtarma Modeli: <strong>{database.recovery_model || 'FULL'}</strong> • Uyumluluk: <strong>{database.compatibility_level || 160}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            title="Kapat (Esc)"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className={styles.content}>
          {/* Quick Stats Grid */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Veri Boyutu (MDF)</span>
              <span className={styles.statVal}>{formatSize(database.size_mb)}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Log Boyutu (LDF)</span>
              <span className={styles.statVal}>{formatSize(database.log_size_mb)}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Aktif Oturumlar</span>
              <span className={styles.statVal} style={{ color: activeSessions.length > 0 ? '#10b981' : 'inherit' }}>
                {activeSessions.length} Aktif <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({dbSessions.length} Toplam)</span>
              </span>
            </div>
          </div>

          {/* Quick Jump Action Bar */}
          <div className={styles.actionSection}>
            <h3 className={styles.sectionTitle}>Teşhis ve İnceleme Kısayolları</h3>
            <div className={styles.actionGrid}>
              <button
                type="button"
                className={styles.actionCard}
                onClick={() => {
                  onClose();
                  navigate('/query-performance');
                }}
              >
                <div className={styles.actionCardIcon} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  <TrendingUp size={16} />
                </div>
                <div className={styles.actionCardText}>
                  <strong>Query Store &amp; Ağır Sorgular</strong>
                  <span>Bu veritabanındaki en çok CPU/IO tüketen sorguları incele</span>
                </div>
                <ArrowRight size={14} className={styles.actionArrow} />
              </button>

              <button
                type="button"
                className={styles.actionCard}
                onClick={() => {
                  onClose();
                  navigate('/indexes');
                }}
              >
                <div className={styles.actionCardIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                  <Layers size={16} />
                </div>
                <div className={styles.actionCardText}>
                  <strong>İndeks Sağlığı &amp; Bakım</strong>
                  <span>Eksik, mükerrer ve parçalanmış indeksleri denetle</span>
                </div>
                <ArrowRight size={14} className={styles.actionArrow} />
              </button>

              <button
                type="button"
                className={styles.actionCard}
                onClick={() => {
                  onClose();
                  navigate('/storage');
                }}
              >
                <div className={styles.actionCardIcon} style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                  <HardDrive size={16} />
                </div>
                <div className={styles.actionCardText}>
                  <strong>Disk &amp; VLF Mimarisi</strong>
                  <span>Dosya büyüme oranları ve sanal log (VLF) şişmesi</span>
                </div>
                <ArrowRight size={14} className={styles.actionArrow} />
              </button>

              <button
                type="button"
                className={styles.actionCard}
                onClick={() => {
                  onClose();
                  navigate('/incidents');
                }}
              >
                <div className={styles.actionCardIcon} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                  <ShieldCheck size={16} />
                </div>
                <div className={styles.actionCardText}>
                  <strong>Yedekleme &amp; RPO Durumu</strong>
                  <span>Son alınan Full/Diff/Log yedekleri ve CHECKDB bütünlüğü</span>
                </div>
                <ArrowRight size={14} className={styles.actionArrow} />
              </button>
            </div>
          </div>

          {/* Active Live Sessions on this DB */}
          <div className={styles.sessionSection}>
            <div className={styles.sessionHeaderRow}>
              <h3 className={styles.sectionTitle}>
                Bağlı Canlı Oturumlar ({dbSessions.length})
              </h3>
              <span className={styles.livePulse}>● Canlı Telemetri</span>
            </div>

            {dbSessions.length > 0 ? (
              <div className={styles.sessionList}>
                {dbSessions.map((s) => (
                  <div key={s.spid} className={styles.sessionItem}>
                    <div className={styles.sessionItemTop}>
                      <span className={styles.spidTag}>SPID #{s.spid}</span>
                      <span
                        className={`${styles.sessionStatus} ${
                          s.status === 'running' ? styles.statusRunning : styles.statusSleep
                        }`}
                      >
                        {s.status === 'running' ? 'Çalışıyor' : 'Uyku'}
                      </span>
                      <span className={styles.loginName}>{s.login_name || 'app'}</span>
                      {s.blocked_by && (
                        <span className={styles.blockedBadge}>
                          Engellendi: #{s.blocked_by}
                        </span>
                      )}
                    </div>
                    {s.command && (
                      <div className={styles.cmdLine}>Komut: {s.command}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptySessions}>
                Bu veritabanına bağlı aktif bir oturum veya kilit kaynağı bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
