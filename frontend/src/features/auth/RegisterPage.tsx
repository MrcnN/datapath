import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Database, Lock, Mail, User, Shield, Briefcase, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthContext';
import OAuthModal from './components/OAuthModal';
import styles from './RegisterPage.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, loginOAuth } = useAuth();

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordConfirm, setPasswordConfirm] = useState<string>('');
  const [role, setRole] = useState<string>('DB_ENGINEER');
  const [department, setDepartment] = useState<string>('Veri & Altyapı Yönetimi');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // OAuth Modal state
  const [oauthProvider, setOauthProvider] = useState<'google' | 'github' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Lütfen tüm zorunlu alanları doldurunuz.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Girdiğiniz parolalar birbiriyle eşleşmiyor.');
      return;
    }
    if (password.length < 6) {
      setError('Parola güvenliğiniz için en az 6 karakter olmalıdır.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        department: department.trim(),
        title:
          role === 'SENIOR_DBA'
            ? 'Kıdemli Veritabanı Yöneticisi'
            : role === 'DB_ENGINEER'
            ? 'Veritabanı Güvenilirlik Mühendisi'
            : role === 'OPERATOR'
            ? 'Sistem & NOC Operatörü'
            : 'Sistem Gözlemcisi',
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Kayıt işlemi başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthAuthenticate = async (payload: { email: string; full_name: string; avatar_url?: string }) => {
    if (!oauthProvider) return;
    await loginOAuth(oauthProvider, payload);
    navigate('/');
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.authCard}>
        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <div className={styles.brandLogo}>
            <Database size={24} />
          </div>
          <h1 className={styles.brandTitle}>Yeni Hesap Oluştur</h1>
          <p className={styles.brandSubtitle}>Datapath Veritabanı Zekası Platformuna Katılın</p>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Ad Soyad *</label>
            <div className={styles.inputWrapper}>
              <User size={14} className={styles.inputIcon} />
              <input
                type="text"
                className={styles.input}
                placeholder="Örn: Erdim Kaya"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>E-Posta Adresi *</label>
            <div className={styles.inputWrapper}>
              <Mail size={14} className={styles.inputIcon} />
              <input
                type="email"
                className={styles.input}
                placeholder="ornek@sirket.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.inputRow}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Parola *</label>
              <div className={styles.inputWrapper}>
                <Lock size={14} className={styles.inputIcon} />
                <input
                  type="password"
                  className={styles.input}
                  placeholder="En az 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Parola Tekrarı *</label>
              <div className={styles.inputWrapper}>
                <Lock size={14} className={styles.inputIcon} />
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Tekrar giriniz"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className={styles.inputRow}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Operasyonel Rol</label>
              <div className={styles.inputWrapper}>
                <Shield size={14} className={styles.inputIcon} />
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
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Departman</label>
              <div className={styles.inputWrapper}>
                <Briefcase size={14} className={styles.inputIcon} />
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Veri & Altyapı Yönetimi"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            <span>{loading ? 'Hesap Oluşturuluyor...' : 'Hesap Oluştur & Giriş Yap'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className={styles.divider}>
          <span>veya sosyal hesapla kaydol</span>
        </div>

        {/* OAuth Buttons */}
        <div className={styles.oauthGroup}>
          <button
            type="button"
            className={styles.oauthBtn}
            onClick={() => setOauthProvider('google')}
          >
            {/* Google SVG */}
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
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
                d="M5.28 14.28c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.57H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.43l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.57l4.03 3.15c.95-2.83 3.6-4.97 6.72-4.97z"
              />
            </svg>
            <span>Google (Gmail) ile Kayıt Ol</span>
          </button>

          <button
            type="button"
            className={styles.oauthBtn}
            onClick={() => setOauthProvider('github')}
          >
            {/* GitHub SVG */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>GitHub ile Kayıt Ol</span>
          </button>
        </div>

        <p className={styles.footerText}>
          Zaten hesabınız var mı?{' '}
          <Link to="/login" className={styles.footerLink}>
            Giriş Yapın
          </Link>
        </p>
      </div>

      {/* OAuth Modal */}
      {oauthProvider && (
        <OAuthModal
          provider={oauthProvider}
          isOpen={!!oauthProvider}
          onClose={() => setOauthProvider(null)}
          onAuthenticate={handleOAuthAuthenticate}
        />
      )}
    </div>
  );
}
