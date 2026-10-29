import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileCode2,
  Copy,
  Check,
  UserX,
  Lock,
  Key,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import DemoDataBanner from '../../components/ui/DemoDataBanner';
import {
  getLogins,
  getDatabaseUsers,
  getRoles,
  getDatabases,
  getSecurityAudit,
} from '../../lib/api';
import type {
  Login,
  DbUser,
  Role,
  Database,
  SecurityAuditSummary,
  SecurityFinding,
} from '../../lib/types';
import styles from './PermissionsPage.module.css';

type TabType = 'logins' | 'users' | 'roles' | 'audit';

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('audit');
  const [logins, setLogins] = useState<Login[]>([]);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditData, setAuditData] = useState<SecurityAuditSummary | null>(null);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('master');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function init() {
      try {
        const dbs = await getDatabases().catch(() => []);
        setDatabases(dbs);
        if (dbs.length > 0) setSelectedDb(dbs[0].name);
      } catch {
        // ignore
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === 'audit') {
          const data = await getSecurityAudit();
          setAuditData(data);
        } else if (activeTab === 'logins') {
          const data = await getLogins();
          setLogins(data);
        } else if (activeTab === 'users') {
          const data = await getDatabaseUsers(selectedDb);
          setUsers(data);
        } else if (activeTab === 'roles') {
          const data = await getRoles();
          setRoles(data);
        }
      } catch (err: any) {
        setError(err.message || 'İzin ve güvenlik verileri alınamadı');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeTab, selectedDb]);

  const handleCopyScript = () => {
    if (!auditData?.hardening_script) return;
    navigator.clipboard.writeText(auditData.hardening_script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const loginColumns: Column<Login>[] = [
    {
      key: 'name',
      label: 'Login Adı',
      sortable: true,
      render: (l) => <strong>{l.name}</strong>,
    },
    {
      key: 'type_desc',
      label: 'Tür',
      render: (l) => l.type_desc || '—',
    },
    {
      key: 'is_disabled',
      label: 'Hesap Durumu',
      render: (l) => (
        <StatusBadge
          variant={l.is_disabled ? 'error' : 'success'}
          label={l.is_disabled ? 'Devre Dışı' : 'Aktif'}
        />
      ),
    },
    {
      key: 'has_sysadmin',
      label: 'Sysadmin Yetkisi',
      render: (l) => (
        <StatusBadge
          variant={l.has_sysadmin ? 'warning' : 'neutral'}
          label={l.has_sysadmin ? 'SYSADMIN' : 'Standart'}
        />
      ),
    },
    {
      key: 'default_database',
      label: 'Varsayılan DB',
      render: (l) => l.default_database || 'master',
    },
    {
      key: 'create_date',
      label: 'Oluşturulma Tarihi',
      render: (l) => (l.create_date ? new Date(l.create_date).toLocaleDateString('tr-TR') : '—'),
    },
  ];

  const userColumns: Column<DbUser>[] = [
    {
      key: 'username',
      label: 'Kullanıcı Adı',
      sortable: true,
      render: (u) => <strong>{u.username}</strong>,
    },
    {
      key: 'login_name',
      label: 'Eşleşen Login',
      render: (u) => u.login_name || '—',
    },
    {
      key: 'type_desc',
      label: 'Kullanıcı Türü',
      render: (u) => u.type_desc || '—',
    },
    {
      key: 'roles',
      label: 'Üye Olduğu Roller',
      render: (u) => {
        if (!u.roles || u.roles.length === 0) return '—';
        return u.roles.join(', ');
      },
    },
    {
      key: 'default_schema',
      label: 'Varsayılan Şema',
      render: (u) => u.default_schema || 'dbo',
    },
  ];

  const roleColumns: Column<Role>[] = [
    {
      key: 'role_name',
      label: 'Rol Adı',
      sortable: true,
      render: (r) => <strong>{r.role_name}</strong>,
    },
    {
      key: 'role_type',
      label: 'Rol Kapsamı',
      render: (r) => (
        <StatusBadge
          variant={r.role_type === 'server' ? 'info' : 'neutral'}
          label={r.role_type === 'server' ? 'Sunucu Rolü' : 'Veritabanı Rolü'}
        />
      ),
    },
    {
      key: 'members',
      label: 'Rol Üyeleri',
      render: (r) => {
        if (!r.members || r.members.length === 0) return '—';
        return r.members.map((m) => m.member_name).join(', ');
      },
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="İzinler, Güvenlik & Zafiyet Denetimi"
        subtitle="Sunucu loginleri, yetim kullanıcılar (orphan users), TRUSTWORTHY yetki yükseltme riskleri ve güvenlik sıkılaştırma"
      />

      {auditData?.is_demo && <DemoDataBanner />}

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'audit' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <ShieldAlert size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
          Güvenlik Denetimi & Zafiyetler
          {auditData && auditData.critical_count > 0 && (
            <span
              style={{
                marginLeft: '8px',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--status-danger)',
                fontWeight: 700,
              }}
            >
              {auditData.critical_count}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'logins' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('logins')}
        >
          Sunucu Loginleri ({logins.length})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'users' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Veritabanı Kullanıcıları
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'roles' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Rol Envanteri ({roles.length})
        </button>
      </div>

      {activeTab === 'users' && databases.length > 0 && (
        <div className={styles.controls}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Veritabanı Seçin:
          </label>
          <select
            className={styles.select}
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
          >
            {databases.map((db) => (
              <option key={db.name} value={db.name}>
                {db.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && <LoadingSpinner message="Güvenlik envanteri taranıyor..." />}
      {error && <ErrorState message={error} onRetry={() => setActiveTab(activeTab)} />}

      {!loading && !error && (
        <>
          {activeTab === 'audit' && auditData && (
            <div>
              {/* Score and summary header */}
              <div className={styles.scoreRow} style={{ marginBottom: '16px' }}>
                <div className={styles.scoreLeft}>
                  <div
                    className={`${styles.scorePill} ${
                      auditData.security_score >= 80
                        ? styles.scoreHigh
                        : auditData.security_score >= 60
                        ? styles.scoreMedium
                        : styles.scoreLow
                    }`}
                  >
                    <ShieldCheck size={16} />
                    Güvenlik Skoru: %{auditData.security_score}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {auditData.critical_count > 0 && (
                      <span
                        className={styles.badgeItem}
                        style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)' }}
                      >
                        {auditData.critical_count} Kritik Açık
                      </span>
                    )}
                    {auditData.warning_count > 0 && (
                      <span
                        className={styles.badgeItem}
                        style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}
                      >
                        {auditData.warning_count} Uyarı
                      </span>
                    )}
                    <span
                      className={styles.badgeItem}
                      style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)' }}
                    >
                      {auditData.passed_checks_count} Kriter Güvenli
                    </span>
                  </div>
                </div>

                <button className={styles.scriptBtn} onClick={() => setShowModal(true)}>
                  <FileCode2 size={15} />
                  Güvenlik Sıkılaştırma Scriptini İncele
                </button>
              </div>

              {/* Findings list */}
              <div className={styles.auditGrid}>
                {auditData.findings.map((f) => {
                  const isCrit = f.severity === 'CRITICAL';
                  const isWarn = f.severity === 'WARNING';
                  return (
                    <div
                      key={f.id}
                      className={`${styles.auditCard} ${
                        isCrit
                          ? styles.auditCardCritical
                          : isWarn
                          ? styles.auditCardWarning
                          : styles.auditCardInfo
                      }`}
                    >
                      <div className={styles.findingTop}>
                        <div className={styles.findingTitleWrap}>
                          <div className={styles.findingTitle}>
                            <AlertTriangle
                              size={16}
                              color={isCrit ? 'var(--status-danger)' : isWarn ? '#fbbf24' : 'var(--accent-blue)'}
                            />
                            <span>{f.title}</span>
                            {f.database_name && (
                              <span className={styles.findingDbTag}>{f.database_name}</span>
                            )}
                          </div>
                          <div className={styles.findingDetails}>{f.description}</div>
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: isCrit
                              ? 'rgba(239, 68, 68, 0.15)'
                              : isWarn
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(59, 130, 246, 0.15)',
                            color: isCrit
                              ? 'var(--status-danger)'
                              : isWarn
                              ? '#fbbf24'
                              : 'var(--accent-blue)',
                          }}
                        >
                          {f.severity}
                        </span>
                      </div>

                      {/* Risk impact box */}
                      <div className={styles.riskImpact}>
                        <strong>Güvenlik Riski:</strong> {f.risk_impact}
                      </div>

                      {/* Remediation T-SQL */}
                      <div className={styles.remediationSnippet}>
                        <code>{f.remediation_sql}</code>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Script Modal */}
              {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                  <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.modalHeader}>
                      <div>
                        <h3>SQL Server Güvenlik Sıkılaştırma Betiği</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                          Aşağıdaki scripti SSMS ortamına kopyalayarak gözden geçirdikten sonra çalıştırabilirsiniz.
                        </p>
                      </div>
                      <button className={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
                    </div>

                    <div className={styles.modalBody}>
                      <button className={styles.copyBtn} onClick={handleCopyScript}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Kopyalandı!' : 'T-SQL Scriptini Kopyala'}
                      </button>
                      <pre className={styles.scriptBox}>{auditData.hardening_script}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logins' && (
            <DataTable
              columns={loginColumns}
              data={logins}
              emptyMessage="Login kaydı bulunamadı."
            />
          )}
          {activeTab === 'users' && (
            <DataTable
              columns={userColumns}
              data={users}
              emptyMessage="Bu veritabanında kullanıcı bulunamadı."
            />
          )}
          {activeTab === 'roles' && (
            <DataTable
              columns={roleColumns}
              data={roles}
              emptyMessage="Rol kaydı bulunamadı."
            />
          )}
        </>
      )}
    </div>
  );
}
