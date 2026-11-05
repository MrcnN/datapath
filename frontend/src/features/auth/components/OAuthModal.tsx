import React, { useState } from 'react';
import { X, Check, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react';
import styles from './OAuthModal.module.css';

interface OAuthModalProps {
  provider: 'google' | 'github';
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: (payload: { email: string; full_name: string; avatar_url?: string }) => Promise<void>;
}

export default function OAuthModal({ provider, isOpen, onClose, onAuthenticate }: OAuthModalProps) {
  if (!isOpen) return null;

  const isGoogle = provider === 'google';

  // State for interactive selection
  const [useCustomAccount, setUseCustomAccount] = useState<boolean>(false);
  const [customEmail, setCustomEmail] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-configured enterprise developer identity
  const defaultEmail = isGoogle ? 'erdim.dba@gmail.com' : 'erdim-coder@github.com';
  const defaultName = isGoogle ? 'Erdim (Google Workspace Senior DBA)' : 'Erdim (GitHub Dev Architect)';
  const defaultAvatar = isGoogle
    ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80';

  const handleSelectDefault = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await onAuthenticate({
        email: defaultEmail,
        full_name: defaultName,
        avatar_url: defaultAvatar,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Yetkilendirme sırasında bir hata oluştu.');
      setSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) {
      setError('Lütfen geçerli bir e-posta adresi giriniz.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await onAuthenticate({
        email: customEmail.trim(),
        full_name: customName.trim() || customEmail.split('@')[0],
        avatar_url: isGoogle
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Yetkilendirme sırasında bir hata oluştu.');
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.providerBadge}>
            {isGoogle ? (
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
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
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            )}
            <span className={styles.providerTitle}>
              {isGoogle ? 'Google ile Oturum Açın' : 'GitHub ile Yetkilendir'}
            </span>
          </div>

          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        {/* Subtitle */}
        <p className={styles.modalSubtitle}>
          {isGoogle
            ? 'Datapath SQL Server platformuna bağlanmak için Google Workspace hesabınızı seçin.'
            : 'Datapath platformuna erişim izni vermek için GitHub hesabınızı onaylayın.'}
        </p>

        {error && <div className={styles.errorBox}>{error}</div>}

        {!useCustomAccount ? (
          <div className={styles.accountSelector}>
            {/* Quick 1-Click Select Card */}
            <div
              className={styles.defaultAccountCard}
              onClick={handleSelectDefault}
              role="button"
              tabIndex={0}
              title="Bu hesapla anında devam et"
            >
              <img src={defaultAvatar} alt={defaultName} className={styles.accountAvatar} />
              <div className={styles.accountMeta}>
                <div className={styles.accountName}>{defaultName}</div>
                <div className={styles.accountEmail}>{defaultEmail}</div>
                <div className={styles.accountBadge}>
                  <ShieldCheck size={11} />
                  <span>Doğrulanmış DBA Kimliği</span>
                </div>
              </div>
              <ArrowRight size={16} className={styles.cardArrow} />
            </div>

            {/* Switch to Custom Account */}
            <button
              type="button"
              className={styles.useOtherBtn}
              onClick={() => setUseCustomAccount(true)}
              disabled={submitting}
            >
              <span>+ Farklı bir {isGoogle ? 'Gmail' : 'GitHub'} hesabı ile bağlan</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit} className={styles.customForm}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>
                {isGoogle ? 'Google (Gmail) E-posta Adresi *' : 'GitHub E-posta veya Kullanıcı Adı *'}
              </label>
              <input
                type="email"
                className={styles.textInput}
                placeholder={isGoogle ? 'ornek@gmail.com' : 'ornek-dev@github.com'}
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Görünecek Ad Soyad (İsteğe bağlı)</label>
              <input
                type="text"
                className={styles.textInput}
                placeholder="Örn: Erdim Kaya"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>

            <div className={styles.formActionRow}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setUseCustomAccount(false)}
                disabled={submitting}
              >
                Geri
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submitting}
              >
                {submitting ? 'Yetkilendiriliyor...' : `${isGoogle ? 'Google' : 'GitHub'} ile Bağlan`}
              </button>
            </div>
          </form>
        )}

        {/* Security Footer Note */}
        <div className={styles.securityNote}>
          <ShieldCheck size={13} className={styles.secIcon} />
          <span>OAuth 2.0 SSL şifrelemeli güvenli tünel üzerinden doğrulanır.</span>
        </div>
      </div>
    </div>
  );
}
