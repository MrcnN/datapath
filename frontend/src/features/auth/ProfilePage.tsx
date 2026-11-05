import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Shield,
  Key,
  Globe,
  Check,
  AlertCircle,
  Save,
  Briefcase,
  Phone,
  Mail,
  Building,
  FileText,
  ShieldCheck,
  Zap,
  Terminal,
  Activity,
  Server,
  Lock,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import { useAuth } from './AuthContext';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user, updateProfile, changePassword, loginOAuth } = useAuth();

  const [activeTab, setActiveTab] = useState<'edit' | 'permissions' | 'security' | 'social'>('edit');

  // Edit form state
  const [fullName, setFullName] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [role, setRole] = useState<string>('SENIOR_DBA');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // Password state
  const [currPassword, setCurrPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState<string>('');

  // Status
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setTitle(user.title || '');
      setDepartment(user.department || '');
      setPhone(user.phone || '');
      setBio(user.bio || '');
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
        title,
        department,
        phone,
        bio,
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
      setSaving(true);
      setStatusMsg(null);
      await changePassword(currPassword, newPassword);
      setStatusMsg({ type: 'success', text: 'Hesap şifreniz başarıyla değiştirildi.' });
      setCurrPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Şifre değiştirilemedi.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOAuth = async (provider: 'google' | 'github') => {
    try {
      setStatusMsg(null);
      await loginOAuth(provider);
      setStatusMsg({ type: 'success', text: `${provider.toUpperCase()} hesabı başarıyla bağlandı.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `${provider} bağlanırken hata oluştu.` });
    }
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DB';

  return (
    <div className={styles.container}>
      <PageHeader
        title="Profil & Yetki Yönetimi"
        subtitle="Kişisel DBA profilinizi düzenleyin, operasyonel yetki düzeyinizi belirleyin ve bağlı hesaplarınızı (Google / GitHub) yönetin."
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
                    ? 'Senior DBA'
                    : role === 'DB_ENGINEER'
                    ? 'Database Engineer'
                    : role === 'OPERATOR'
                    ? 'System Operator'
                    : 'Analyst / Viewer'}
                </span>
              </h2>
              <p className={styles.userTitle}>{user?.title || 'Veritabanı Yöneticisi'}</p>

              <div className={styles.userMeta}>
                <span><Mail size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />{user?.email}</span>
                <span>•</span>
                <span><Building size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />{user?.department}</span>
                <span>•</span>
                <span>Kayıt: {user?.created_at ? new Date(user.created_at).toLocaleDateString('tr-TR') : '2026'}</span>
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
            <User size={15} /> Profil Bilgilerini Düzenle
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'permissions' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            <ShieldCheck size={15} /> Aktif Rol &amp; Yetki Matrisi
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'security' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Key size={15} /> Şifre &amp; Güvenlik
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'social' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('social')}
          >
            <Globe size={15} /> Bağlı Hesaplar (Google / GitHub)
          </button>
        </div>

        {/* Tab 1: Edit Profile */}
        {activeTab === 'edit' && (
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
              <label className={styles.label}>Unvan (Title)</label>
              <input
                type="text"
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Departman</label>
              <input
                type="text"
                className={styles.input}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
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
                <option value="SENIOR_DBA">👑 Senior DBA (Tam Teşhis &amp; Reçete Üretimi)</option>
                <option value="DB_ENGINEER">⚡ Database Engineer (Sorgu &amp; İndeks Optimizasyonu)</option>
                <option value="OPERATOR">🛡️ System Operator (Alarm &amp; Kriz Gözlemi)</option>
                <option value="VIEWER">👁️ Viewer (Salt Okunur İzleyici)</option>
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

            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>Biyografi &amp; Sorumluluk Alanları</label>
              <textarea
                className={styles.textarea}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div className={`${styles.actionRow} ${styles.fullWidth}`}>
              <button type="submit" className={styles.saveBtn} disabled={saving}>
                <Save size={15} /> {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </form>
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
                <strong style={{ color: '#ffffff', fontSize: '13px' }}>👑 Tüm Rollerin İzinlerini Yönetmek İster misiniz?</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#94a3b8' }}>
                  Kıdemli DBA (Senior DBA) olarak tüm rollerin 18 granüler iznini açıp kapatabilir ve kullanıcılara rol atayabilirsiniz.
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

        {/* Tab 3: Security & Password */}
        {activeTab === 'security' && (
          <form onSubmit={handleSavePassword} style={{ maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

            <div style={{ marginTop: '6px' }}>
              <button type="submit" className={styles.saveBtn} disabled={saving}>
                <Lock size={15} /> {saving ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: Connected Accounts (OAuth) */}
        {activeTab === 'social' && (
          <div className={styles.socialList}>
            {/* Google */}
            <div className={styles.socialCard}>
              <div className={styles.socialLeft}>
                <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <div>
                  <h4 className={styles.socialTitle}>Google (Gmail / Google Workspace)</h4>
                  <p className={styles.socialSub}>
                    {user?.google_connected
                      ? 'Google hesabınız bağlı. Tek tıkla giriş yapabilirsiniz.'
                      : 'Google hesabınızı bağlayarak şifresiz hızlı giriş yapın.'}
                  </p>
                </div>
              </div>

              <div>
                {user?.google_connected ? (
                  <span className={styles.connectedBadge}>
                    <Check size={13} /> Bağlandı
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.connectBtn}
                    onClick={() => handleToggleOAuth('google')}
                  >
                    Google Hesabını Bağla
                  </button>
                )}
              </div>
            </div>

            {/* GitHub */}
            <div className={styles.socialCard}>
              <div className={styles.socialLeft}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <div>
                  <h4 className={styles.socialTitle}>GitHub (Geliştirici Hesabı)</h4>
                  <p className={styles.socialSub}>
                    {user?.github_connected
                      ? 'GitHub hesabınız bağlı. Developer yetkilendirmesi aktif.'
                      : 'GitHub hesabınızı bağlayarak tek tıkla yetkilenin.'}
                  </p>
                </div>
              </div>

              <div>
                {user?.github_connected ? (
                  <span className={styles.connectedBadge}>
                    <Check size={13} /> Bağlandı
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.connectBtn}
                    onClick={() => handleToggleOAuth('github')}
                  >
                    GitHub Hesabını Bağla
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
