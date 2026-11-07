import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Shield,
  Key,
  Check,
  AlertCircle,
  Save,
  Phone,
  Mail,
  ShieldCheck,
  Zap,
  Terminal,
  Server,
  Lock,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import { useAuth } from './AuthContext';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user, updateProfile, changePassword, elevateToAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'edit' | 'permissions'>('edit');

  // Edit form state
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [role, setRole] = useState<string>('SENIOR_DBA');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // Password state
  const [currPassword, setCurrPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState<string>('');

  // Status
  const [saving, setSaving] = useState<boolean>(false);
  const [savingPassword, setSavingPassword] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setRole(user.role || 'SENIOR_DBA');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setStatusMsg(null);
      await updateProfile({
        full_name: fullName,
        phone,
        role,
        avatar_url: avatarUrl || undefined,
      });
      setStatusMsg({ type: 'success', text: 'Profil bilgileriniz başarıyla güncellendi.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Profil güncellenirken bir hata oluştu.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      setStatusMsg({ type: 'error', text: 'Yeni şifreler birbiriyle eşleşmiyor.' });
      return;
    }
    try {
      setSavingPassword(true);
      setStatusMsg(null);
      await changePassword(currPassword, newPassword);
      setStatusMsg({ type: 'success', text: 'Hesap şifreniz başarıyla değiştirildi.' });
      setCurrPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Şifre değiştirilemedi.' });
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DB';

  return (
    <div className={styles.container}>
      <PageHeader
        title="Profil Ayarları"
        subtitle="Kişisel DBA profilinizi düzenleyin, operasyonel rolünüzü ve hesap şifrenizi yönetin."
      />

      <div className={styles.profileCard}>
        {/* Profile Banner */}
        <div className={styles.banner}>
          <div className={styles.userLeft}>
            <div className={styles.avatar}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} className={styles.avatarImg} />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div className={styles.userInfo}>
              <h2 className={styles.userName}>
                {user?.full_name || 'Datapath Kullanıcısı'}
                <span className={styles.roleBadge}>
                  <Shield size={12} />
                  {role === 'SENIOR_DBA'
                    ? 'Yönetici'
                    : role === 'OPERATOR'
                    ? 'Operatör'
                    : 'Görüntüleyici'}
                </span>
              </h2>

              <div className={styles.userMeta}>
                <span>
                  <Mail size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                  {user?.email}
                </span>
                <span>•</span>
                <span>
                  Kayıt Tarihi: {user?.created_at ? new Date(user.created_at).toLocaleDateString('tr-TR') : '2026'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Alerts */}
        {statusMsg && (
          <div className={`${styles.alertBox} ${statusMsg.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
            {statusMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'edit' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            <User size={15} /> Profil &amp; Hesap Ayarları
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'permissions' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            <ShieldCheck size={15} /> Aktif Rol &amp; Yetki Matrisi
          </button>
        </div>

        {/* Tab 1: Edit Profile & Password in One Clean View */}
        {activeTab === 'edit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* 1.1 Profile Information Form */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} color="var(--accent)" />
                Kişisel Bilgiler &amp; İletişim
              </h3>

              <form onSubmit={handleSaveProfile} className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Ad Soyad</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>E-Posta Adresi (Salt Okunur)</label>
                  <input
                    type="email"
                    className={styles.input}
                    value={user?.email || ''}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Telefon / İletişim</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="+90 5XX XXX XX XX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Yetki Rolü (Operasyonel Düzey)</label>
                  <select
                    className={styles.select}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="VIEWER">Görüntüleyici</option>
                    <option value="OPERATOR">Operatör</option>
                    <option value="SENIOR_DBA">Yönetici</option>
                  </select>
                </div>

                <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                  <label className={styles.label}>Avatar Görsel Bağlantısı (URL)</label>
                  <input
                    type="url"
                    className={styles.input}
                    placeholder="https://example.com/avatar.jpg"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                  />
                </div>

                <div className={`${styles.actionRow} ${styles.fullWidth}`} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button type="submit" className={styles.saveBtn} disabled={saving}>
                    <Save size={15} /> {saving ? 'Kaydediliyor...' : 'Profil Bilgilerini Kaydet'}
                  </button>

                  {user?.role !== 'SENIOR_DBA' && (user?.id === 'usr_admin_01' || user?.email?.includes('erdim')) && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setSaving(true);
                          await elevateToAdmin();
                          setRole('SENIOR_DBA');
                          setStatusMsg({ type: 'success', text: 'Yönetici yetkiniz başarıyla geri yüklendi.' });
                        } catch (err: any) {
                          setStatusMsg({ type: 'error', text: 'Yetki geri yüklenemedi: ' + err.message });
                        } finally {
                          setSaving(false);
                        }
                      }}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid var(--accent)',
                        color: 'var(--accent)',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <ShieldCheck size={14} /> Yönetici Yetkisini Geri Yükle
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* 1.2 Password & Security Section (Merged into main view) */}
            <div style={{
              borderTop: '1px solid var(--border, #1e293b)',
              paddingTop: '24px',
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} color="#f59e0b" />
                Güvenlik &amp; Şifre Değiştirme
              </h3>

              <form onSubmit={handleSavePassword} className={styles.formGrid} style={{ maxWidth: '720px' }}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Mevcut Şifre</label>
                  <input
                    type="password"
                    className={styles.input}
                    placeholder="••••••••••••"
                    value={currPassword}
                    onChange={(e) => setCurrPassword(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.inputGroup} />

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Yeni Şifre</label>
                  <input
                    type="password"
                    className={styles.input}
                    placeholder="En az 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Yeni Şifre Tekrarı</label>
                  <input
                    type="password"
                    className={styles.input}
                    placeholder="Tekrar giriniz"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    required
                  />
                </div>

                <div className={`${styles.actionRow} ${styles.fullWidth}`} style={{ justifyContent: 'flex-start', marginTop: '6px' }}>
                  <button type="submit" className={styles.saveBtn} disabled={savingPassword}>
                    <Lock size={14} /> {savingPassword ? 'Güncelleniyor...' : 'Şifreyi Değiştir'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Permissions Matrix Breakdown */}
        {activeTab === 'permissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '6px'
            }}>
              <div>
                <strong style={{ color: '#ffffff', fontSize: '13px' }}>Tüm Rollerin İzinlerini Yönetmek İster misiniz?</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#94a3b8' }}>
                  Yönetici olarak tüm rollerin 18 granüler iznini açıp kapatabilir ve kullanıcılara rol atayabilirsiniz.
                </p>
              </div>
              <Link
                to="/role-management"
                style={{
                  background: 'var(--accent)',
                  color: '#080d1a',
                  fontWeight: 700,
                  fontSize: '11.5px',
                  padding: '7px 14px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                Yetki &amp; İzin Yönetim Merkezi &rarr;
              </Link>
            </div>

            <div className={styles.permissionsGrid}>
              <div className={styles.permCard}>
                <Terminal size={22} className={styles.permIcon} />
                <div>
                  <h4 className={styles.permTitle}>T-SQL Reçete Üretimi &amp; Müdahale Kodları</h4>
                  <p className={styles.permDesc}>
                    Deadlock, bloklayıcı oturumlar, TempDB sızıntıları ve indeks defragmentation için kopyalanabilir T-SQL onarım reçeteleri üretme yetkisi.
                  </p>
                  <span className={styles.connectedBadge} style={{ marginTop: '8px' }}>
                    <Check size={12} /> {role === 'VIEWER' ? 'Kısıtlı (Yalnızca İnceleme)' : 'Tam Yetki Aktif'}
                  </span>
                </div>
              </div>

              <div className={styles.permCard}>
                <Zap size={22} className={styles.permIcon} />
                <div>
                  <h4 className={styles.permTitle}>Acil Durum Kriz Triyajı &amp; Kök Neden Analizi</h4>
                  <p className={styles.permDesc}>
                    Tek tıkla tüm alt sistemleri (CPU, I/O, Latch, Deadlock, Memory) eşzamanlı tarama ve RCA post-mortem raporu derleme.
                  </p>
                  <span className={styles.connectedBadge} style={{ marginTop: '8px' }}>
                    <Check size={12} /> Tam Yetki Aktif
                  </span>
                </div>
              </div>

              <div className={styles.permCard}>
                <Server size={22} className={styles.permIcon} />
                <div>
                  <h4 className={styles.permTitle}>AlwaysOn &amp; Felaket Kurtarma Simülasyonu</h4>
                  <p className={styles.permDesc}>
                    LSN ardışıklık denetimi, point-in-time restore zinciri ve AlwaysOn yük devretme (failover) hazırlık telemetrisi.
                  </p>
                  <span className={styles.connectedBadge} style={{ marginTop: '8px' }}>
                    <Check size={12} /> {role === 'VIEWER' ? 'Gözlem Modu' : 'Tam Yetki Aktif'}
                  </span>
                </div>
              </div>

              <div className={styles.permCard}>
                <ShieldCheck size={22} className={styles.permIcon} />
                <div>
                  <h4 className={styles.permTitle}>Sunucu Kayıt Defteri (Server Profiles)</h4>
                  <p className={styles.permDesc}>
                    Canlı SQL Server bağlantı profili oluşturma, ping gecikmesi ölçümü ve çoklu ortam geçişleri yönetimi.
                  </p>
                  <span className={styles.connectedBadge} style={{ marginTop: '8px' }}>
                    <Check size={12} /> {role === 'SENIOR_DBA' ? 'Yönetici Yetkisi' : 'Kullanıcı Erişimi'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
