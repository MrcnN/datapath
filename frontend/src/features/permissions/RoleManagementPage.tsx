import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Users,
  Key,
  RotateCcw,
  Save,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  UserCheck,
  Crown,
  Layers,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import { useAuth } from '../auth/AuthContext';
import {
  getPermissionsMatrix,
  updateRolePermissions,
  getAllUsers,
  updateUserRole,
  resetPermissionsToDefault,
} from '../../lib/api';
import type {
  PermissionDefinition,
  PermissionAuditLog,
  UserProfile,
} from '../../lib/types';
import styles from './RoleManagementPage.module.css';

export default function RoleManagementPage() {
  const { user, elevateToAdmin } = useAuth();
  const isSeniorDBA = user?.role === 'SENIOR_DBA';
  const isRootAdmin = user?.id === 'usr_admin_01' || user?.email?.includes('erdim');
  const canManage = isSeniorDBA || isRootAdmin;

  const [activeTab, setActiveTab] = useState<'matrix' | 'users' | 'audit'>('matrix');

  // Matrix State
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [rolePolicies, setRolePolicies] = useState<Record<string, string[]>>({});
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<PermissionAuditLog[]>([]);

  // Users State
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<string, string>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Loading & Feedback
  const [loading, setLoading] = useState<boolean>(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [matrixData, usersData] = await Promise.all([
        getPermissionsMatrix(),
        getAllUsers(),
      ]);
      setPermissions(matrixData.permissions || []);
      setRolePolicies(matrixData.role_policies || {});
      setRoleLabels(matrixData.role_labels || {});
      setAuditLogs(matrixData.audit_logs || []);
      setUsersList(usersData || []);

      const drafts: Record<string, string> = {};
      (usersData || []).forEach((u) => {
        drafts[u.id] = u.role;
      });
      setUserRoleDrafts(drafts);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Yetki matrisi yüklenemedi: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRestoreAdmin = async () => {
    try {
      await elevateToAdmin();
      setStatusMsg({ type: 'success', text: 'Yönetici yetkiniz başarıyla geri yüklendi.' });
      await loadData();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Yetki geri yüklenemedi: ' + err.message });
    }
  };

  // Unique categories for filter
  const categories = useMemo(() => {
    const set = new Set<string>();
    permissions.forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [permissions]);

  // Filtered permissions
  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [permissions, searchQuery, selectedCategory]);

  // Toggle permission for a role
  const handleTogglePermission = (role: string, permCode: string) => {
    if (!canManage) {
      setStatusMsg({ type: 'error', text: 'Yalnızca Yönetici rolündeki kullanıcılar izinleri değiştirebilir.' });
      return;
    }

    setRolePolicies((prev) => {
      const currentPerms = prev[role] || [];
      const exists = currentPerms.includes(permCode);
      const updated = exists
        ? currentPerms.filter((c) => c !== permCode)
        : [...currentPerms, permCode];
      return {
        ...prev,
        [role]: updated,
      };
    });
  };

  // Save changes for all modified roles
  const handleSaveAll = async () => {
    if (!canManage) return;
    try {
      setSavingRole('ALL');
      setStatusMsg(null);
      for (const roleKey of Object.keys(rolePolicies)) {
        await updateRolePermissions({
          role: roleKey,
          permissions: rolePolicies[roleKey],
        });
      }
      setStatusMsg({ type: 'success', text: 'Tüm rol ve yetki politikaları canlı sisteme başarıyla uygulandı.' });
      await loadData();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Politika kaydedilemedi: ' + err.message });
    } finally {
      setSavingRole(null);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (!canManage) return;
    if (!window.confirm('Tüm rollerin izinlerini kurumsal fabrika ayarlarına sıfırlamak istediğinize emin misiniz?')) {
      return;
    }
    try {
      setLoading(true);
      const res = await resetPermissionsToDefault();
      setRolePolicies(res.role_policies);
      setAuditLogs(res.audit_logs);
      setStatusMsg({ type: 'success', text: 'Tüm rol izinleri kurumsal varsayılan politikaya döndürüldü.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Sıfırlama başarısız: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Update a single user's role
  const handleApplyUserRole = async (targetUser: UserProfile) => {
    if (!canManage) return;
    const newRole = userRoleDrafts[targetUser.id];
    if (!newRole || newRole === targetUser.role) return;

    try {
      await updateUserRole({ user_id: targetUser.id, new_role: newRole });
      setStatusMsg({
        type: 'success',
        text: `${targetUser.full_name} kullanıcısının rolü başarıyla "${newRole === 'SENIOR_DBA' ? 'Yönetici' : newRole === 'OPERATOR' ? 'Operatör' : 'Görüntüleyici'}" olarak güncellendi.`,
      });
      await loadData();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Kullanıcı rolü güncellenemedi: ' + err.message });
    }
  };

  return (
    <div className={styles.pageContainer}>
      <PageHeader
        title="En Üst Yetki & İzin Yönetim Merkezi"
        subtitle="Platformdaki tüm rollerin (Yönetici, Operatör, Görüntüleyici) granüler izin matrisini ve kullanıcı delegasyonunu yönetin."
      />

      {/* Authority Banner */}
      {canManage ? (
        <div className={styles.seniorBanner}>
          <div className={styles.seniorBannerLeft}>
            <div className={styles.crownBadge}>
              <Crown size={20} />
            </div>
            <div>
              <h3 className={styles.seniorBannerTitle}>Yönetici Yetki Konsolu</h3>
              <p className={styles.seniorBannerDesc}>
                Sistemdeki en yüksek yetkiye sahipsiniz. Tüm rollerin (Yönetici, Operatör, Görüntüleyici) granüler izinlerini açıp kapatabilir, kullanıcılara rol atayabilir ve güvenlik denetim loglarını inceleyebilirsiniz.
              </p>
            </div>
          </div>
          {!isSeniorDBA && isRootAdmin ? (
            <button
              type="button"
              onClick={handleRestoreAdmin}
              style={{
                background: 'var(--accent)',
                color: '#080d1a',
                fontWeight: 700,
                fontSize: '12px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Yönetici Yetkisini Geri Yükle
            </button>
          ) : (
            <div className={styles.seniorPillBadge}>
              Tam Yetkili Yönetici
            </div>
          )}
        </div>
      ) : (
        <div className={styles.lockedBanner}>
          <Lock size={16} />
          <span>
            <strong>Salt-Okunur Görünüm:</strong> Mevcut rolünüz ({user?.role || 'VIEWER'}) bu ekranı düzenlemek için yetersizdir. Sistem izinlerini ve kullanıcı rollerini yalnızca <strong>Yönetici</strong> değiştirebilir.
          </span>
        </div>
      )}

      {/* Status Alert */}
      {statusMsg && (
        <div className={`${styles.statusAlert} ${statusMsg.type === 'success' ? styles.statusSuccess : styles.statusError}`}>
          {statusMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className={styles.tabsBar}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'matrix' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('matrix')}
        >
          <Layers size={14} />
          <span>Granüler İzin Matrisi ({permissions.length})</span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'users' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={14} />
          <span>Kullanıcı Rol Atama ({usersList.length})</span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'audit' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <Clock size={14} />
          <span>Güvenlik Denetim Günlüğü ({auditLogs.length})</span>
        </button>
      </div>

      {/* ── TAB 1: Granüler İzin Matrisi ── */}
      {activeTab === 'matrix' && (
        <>
          {/* Toolbar */}
          <div className={styles.controlToolbar}>
            <div className={styles.filterControls}>
              <div className={styles.searchBox}>
                <Search size={13} className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="İzin veya kod ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className={styles.categorySelect}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="ALL">Tüm Kategoriler ({permissions.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className={styles.actionButtonsRow}>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={handleReset}
                disabled={!canManage || loading}
                title="Tüm izinleri varsayılan ayarlara döndür"
              >
                <RotateCcw size={13} />
                <span>Fabrika Ayarlarına Dön</span>
              </button>

              <button
                type="button"
                className={styles.saveChangesBtn}
                onClick={handleSaveAll}
                disabled={!canManage || !!savingRole || loading}
              >
                <Save size={13} />
                <span>{savingRole ? 'Kaydediliyor...' : 'Değişiklikleri Canlıya Kaydet'}</span>
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className={styles.tableContainer}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th>İzin Adı &amp; Kapsamı</th>
                  <th>Kategori</th>
                  <th>Risk Seviyesi</th>
                  <th style={{ textAlign: 'center' }}>Yönetici</th>
                  <th style={{ textAlign: 'center' }}>Operatör</th>
                  <th style={{ textAlign: 'center' }}>Görüntüleyici</th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map((p) => {
                  const dbaHas = (rolePolicies['SENIOR_DBA'] || []).includes(p.code);
                  const opsHas = (rolePolicies['OPERATOR'] || []).includes(p.code);
                  const viewHas = (rolePolicies['VIEWER'] || []).includes(p.code);

                  const riskClass =
                    p.risk_level === 'CRITICAL'
                      ? styles.riskCritical
                      : p.risk_level === 'HIGH'
                      ? styles.riskHigh
                      : p.risk_level === 'MEDIUM'
                      ? styles.riskMedium
                      : styles.riskLow;

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className={styles.permNameCell}>
                          <span className={styles.permNameTitle}>{p.name}</span>
                          <span className={styles.permCodeTag}>{p.code}</span>
                          <span className={styles.permDescText}>{p.description}</span>
                        </div>
                      </td>

                      <td>
                        <span style={{ color: 'var(--text-secondary)' }}>{p.category}</span>
                      </td>

                      <td>
                        <span className={`${styles.riskBadge} ${riskClass}`}>
                          {p.risk_level}
                        </span>
                      </td>

                      {/* YÖNETİCİ Switch (Always ON and locked for safety) */}
                      <td style={{ textAlign: 'center' }}>
                        <label className={`${styles.switchLabel} ${styles.switchDisabled}`}>
                          <input type="checkbox" checked={dbaHas} disabled className={styles.switchInput} />
                          <span className={styles.switchSlider} />
                        </label>
                      </td>

                      {/* OPERATÖR Switch */}
                      <td style={{ textAlign: 'center' }}>
                        <label className={`${styles.switchLabel} ${!canManage ? styles.switchDisabled : ''}`}>
                          <input
                            type="checkbox"
                            checked={opsHas}
                            disabled={!canManage}
                            onChange={() => handleTogglePermission('OPERATOR', p.code)}
                            className={styles.switchInput}
                          />
                          <span className={styles.switchSlider} />
                        </label>
                      </td>

                      {/* GÖRÜNTÜLEYİCİ Switch */}
                      <td style={{ textAlign: 'center' }}>
                        <label className={`${styles.switchLabel} ${!canManage ? styles.switchDisabled : ''}`}>
                          <input
                            type="checkbox"
                            checked={viewHas}
                            disabled={!canManage}
                            onChange={() => handleTogglePermission('VIEWER', p.code)}
                            className={styles.switchInput}
                          />
                          <span className={styles.switchSlider} />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB 2: Kullanıcı Rol Atama ── */}
      {activeTab === 'users' && (
        <div className={styles.tableContainer}>
          <table className={styles.userTable}>
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>E-Posta &amp; Departman</th>
                <th>Bağlı Hesaplar</th>
                <th>Kayıt Tarihi</th>
                <th>Mevcut Rol</th>
                <th>Rol Değiştir</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((u) => {
                const currentDraft = userRoleDrafts[u.id] || u.role;
                const isChanged = currentDraft !== u.role;

                return (
                  <tr key={u.id}>
                    <td>
                      <div className={styles.userProfileCell}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.full_name} className={styles.userAvatar} />
                        ) : (
                          <div className={styles.userInitials}>
                            {u.full_name
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: '#ffffff' }}>{u.full_name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            @{u.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ color: '#ffffff' }}>{u.email}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        {u.title} • {u.department}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {u.google_connected && (
                          <span style={{ fontSize: '9px', background: '#1e293b', padding: '2px 6px', borderRadius: '3px', color: '#38bdf8' }}>
                            Google
                          </span>
                        )}
                        {u.github_connected && (
                          <span style={{ fontSize: '9px', background: '#1e293b', padding: '2px 6px', borderRadius: '3px', color: '#cbd5e1' }}>
                            GitHub
                          </span>
                        )}
                        {!u.google_connected && !u.github_connected && (
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Standart Parola</span>
                        )}
                      </div>
                    </td>

                    <td className={styles.timestampCell}>
                      {new Date(u.created_at).toLocaleDateString('tr-TR')}
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: u.role === 'SENIOR_DBA' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: u.role === 'SENIOR_DBA' ? 'var(--accent)' : '#cbd5e1',
                          border: u.role === 'SENIOR_DBA' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #1e293b',
                        }}
                      >
                        {u.role === 'SENIOR_DBA' ? 'Yönetici' : u.role === 'OPERATOR' ? 'Operatör' : 'Görüntüleyici'}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <select
                          className={styles.roleSelectDropdown}
                          value={currentDraft}
                          disabled={!canManage}
                          onChange={(e) =>
                            setUserRoleDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                        >
                          <option value="VIEWER">Görüntüleyici</option>
                          <option value="OPERATOR">Operatör</option>
                          <option value="SENIOR_DBA">Yönetici</option>
                        </select>

                        <button
                          type="button"
                          className={styles.applyRoleBtn}
                          disabled={!canManage || !isChanged}
                          onClick={() => handleApplyUserRole(u)}
                          title={isChanged ? 'Değişikliği uygula' : 'Rol henüz değiştirilmedi'}
                        >
                          Uygula
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 3: Güvenlik Denetim Günlüğü ── */}
      {activeTab === 'audit' && (
        <div className={styles.tableContainer}>
          <table className={styles.auditTable}>
            <thead>
              <tr>
                <th>Zaman Damgası</th>
                <th>İşlemi Yapan Yetkili</th>
                <th>İşlem Türü</th>
                <th>Operasyon Detayı</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className={styles.timestampCell}>
                    {new Date(log.timestamp).toLocaleString('tr-TR')}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>{log.operator_name}</div>
                    <span style={{ fontSize: '9.5px', color: 'var(--accent)' }}>{log.operator_role}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{log.action}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
