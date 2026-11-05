import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Sun, Moon } from 'lucide-react';
import { useAuth } from './AuthContext';
import OAuthModal from './components/OAuthModal';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginOAuth } = useAuth();

  // Inputs start clean and empty (no demo prefill)
  const [emailOrUser, setEmailOrUser] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Theme toggle state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('datapath-theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  // OAuth Modal state
  const [oauthProvider, setOauthProvider] = useState<'google' | 'github' | null>(null);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('datapath-theme', next);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUser.trim() || !password) {
      setError('Lütfen e-posta adresinizi ve parolanızı giriniz.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await login({ email_or_username: emailOrUser.trim(), password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı. Bilgilerinizi kontrol ediniz.');
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
    <div className={styles.splitLayout}>
      {/* ── Left Column: Authentication Form (Matching Image 2) ── */}
      <div className={styles.formColumn}>
        {/* Top Header Row with Theme Toggle */}
        <div className={styles.topActionRow}>
          <button
            type="button"
            className={styles.themeToggleBtn}
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Aydınlık Temaya Geç' : 'Karanlık Temaya Geç'}
          >
            {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
            <span>{theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}</span>
          </button>
        </div>

        {/* Center Container */}
        <div className={styles.formCenter}>
          <div className={styles.brandHeader}>
            <h1 className={styles.brandTitle}>Datapath</h1>
            <p className={styles.brandSubtitle}>SQL Server Health Monitoring &amp; DBA Platform</p>
          </div>

          {error && (
            <div className={styles.errorBanner} role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.authForm}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>E-posta adresi</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  className={styles.textInput}
                  placeholder="E-posta veya kullanıcı adı"
                  value={emailOrUser}
                  onChange={(e) => setEmailOrUser(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Parola</label>
              <div className={styles.inputWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`${styles.textInput} ${styles.passwordInput}`}
                  placeholder="Parola"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className={styles.toggleEyeBtn}
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? 'Parolayı Gizle' : 'Parolayı Göster'}
                  aria-label={showPassword ? 'Parolayı Gizle' : 'Parolayı Göster'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              className={styles.primarySubmitBtn}
              disabled={loading}
            >
              {loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ'}
            </button>
          </form>

          {/* Divider */}
          <div className={styles.divider}>
            <span>veya sosyal hesapla devam et</span>
          </div>

          {/* Social Logins */}
          <div className={styles.socialButtonsStack}>
            <button
              type="button"
              className={styles.socialBtn}
              onClick={() => setOauthProvider('google')}
            >
              {/* Google multi-color G SVG icon */}
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
              <span>Google ile Giriş Yap</span>
            </button>

            <button
              type="button"
              className={styles.socialBtn}
              onClick={() => setOauthProvider('github')}
            >
              {/* GitHub White Octocat Icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span>GitHub ile Giriş Yap</span>
            </button>

            {/* Create Account Action */}
            <Link to="/register" className={styles.createAccountBtn}>
              Hesap Oluştur
            </Link>
          </div>
        </div>

        {/* Bottom Row (Status Badge & Forgot Password) */}
        <div className={styles.bottomRow}>
          <div className={styles.systemStatusPill}>
            <span className={styles.greenDot} aria-hidden="true" />
            <span>Tüm sistemler çalışıyor</span>
          </div>

          <button
            type="button"
            className={styles.forgotPasswordLink}
            onClick={() => setShowForgotModal(true)}
          >
            Şifremi Unuttum
          </button>
        </div>
      </div>

      {/* ── Right Column: High-End Geometric Diagonal Artwork (Exact Image 2) ── */}
      <div className={styles.visualColumn} aria-hidden="true">
        <svg
          className={styles.geometricSvg}
          viewBox="0 0 1200 900"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Background base gradient */}
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#070c18" />
              <stop offset="50%" stopColor="#0a1324" />
              <stop offset="100%" stopColor="#0e1b35" />
            </linearGradient>

            {/* Deep Navy Band 1 */}
            <linearGradient id="navyBand1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#091c3d" />
              <stop offset="100%" stopColor="#0e2a56" />
            </linearGradient>

            {/* Mid Navy Band 2 */}
            <linearGradient id="navyBand2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#123770" />
              <stop offset="100%" stopColor="#18498f" />
            </linearGradient>

            {/* Vibrant Blue Diamond/Band 3 */}
            <linearGradient id="blueBand3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a539e" />
              <stop offset="100%" stopColor="#256dc4" />
            </linearGradient>

            {/* Radiant Azure Highlight */}
            <linearGradient id="azureGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2e7edb" />
              <stop offset="100%" stopColor="#174f96" />
            </linearGradient>

            {/* Striking Crimson Red Stripe (Matching Image 2) */}
            <linearGradient id="redStripeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a82323" />
              <stop offset="50%" stopColor="#cf3838" />
              <stop offset="100%" stopColor="#e54848" />
            </linearGradient>

            {/* Shadow overlay gradient */}
            <linearGradient id="shadowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Deep Base Canvas */}
          <rect width="1200" height="900" fill="url(#bgGrad)" />

          {/* Diagonal Band 1 (Top-Left to Bottom-Right Base Slant) */}
          <polygon points="-200,-100 800,900 650,900 -350,-100" fill="url(#navyBand1)" opacity="0.85" />

          {/* Cross Diagonal Band 2 (Bottom-Left to Top-Right Slant) */}
          <polygon points="-100,950 900,-50 1150,-50 150,950" fill="url(#navyBand2)" opacity="0.9" />

          {/* Central Blue Diamond / Overlap Shape */}
          <polygon points="400,200 850,650 650,850 200,400" fill="url(#blueBand3)" opacity="0.75" />

          {/* Secondary Layered Blue Quadrant */}
          <polygon points="600,100 1100,600 950,750 450,250" fill="url(#azureGlow)" opacity="0.8" />

          {/* Deep Contrast Shadow Band */}
          <polygon points="50,900 850,100 950,100 150,900" fill="url(#shadowGrad)" opacity="0.5" />

          {/* High Energy Crimson Red Ribbon (Exact match to Image 2) */}
          <polygon
            points="-150,700 650,-100 780,-100 -20,700"
            fill="url(#redStripeGrad)"
            style={{ filter: 'drop-shadow(0 15px 35px rgba(0,0,0,0.65))' }}
          />

          {/* Red Ribbon Lower Accent */}
          <polygon
            points="1000,-50 1250,200 1250,80 1080,-50"
            fill="url(#redStripeGrad)"
            opacity="0.7"
          />

          {/* High Angle Vibrant Blue Intersecting Beam */}
          <polygon points="350,900 1050,200 1200,350 500,900" fill="url(#blueBand3)" opacity="0.65" />

          {/* Fine Grid Technical Texture Overlay */}
          <pattern id="diagGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 40 M 0 0 L 40 40" fill="none" stroke="rgba(255,255,255,0.015)" strokeWidth="1" />
          </pattern>
          <rect width="1200" height="900" fill="url(#diagGrid)" />
        </svg>
      </div>

      {/* ── Interactive OAuth Modal (Google / GitHub) ── */}
      {oauthProvider && (
        <OAuthModal
          provider={oauthProvider}
          isOpen={!!oauthProvider}
          onClose={() => setOauthProvider(null)}
          onAuthenticate={handleOAuthAuthenticate}
        />
      )}

      {/* ── Forgot Password Dialog ── */}
      {showForgotModal && (
        <div className={styles.forgotModalOverlay} onClick={() => setShowForgotModal(false)}>
          <div className={styles.forgotModalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.forgotModalTitle}>Şifremi Unuttum</h3>
            <p className={styles.forgotModalText}>
              Datapath platformu kurumsal veritabanı güvenliği nedeniyle parola sıfırlama işlemlerini Senior DBA onayıyla gerçekleştirmektedir.
            </p>
            <p className={styles.forgotModalText}>
              Lütfen kurum içi veritabanı yöneticiniz (Senior DBA) veya <strong>altyapi@sirket.com</strong> adresine talep iletiniz.
            </p>
            <button
              type="button"
              className={styles.forgotModalCloseBtn}
              onClick={() => setShowForgotModal(false)}
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
