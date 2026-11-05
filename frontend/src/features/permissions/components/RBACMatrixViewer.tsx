import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Shield,
  Eye,
  Wrench,
  Check,
  X,
  Info,
  Lock,
} from 'lucide-react';
import { getRBACMatrix, switchUserRole } from '../../../lib/api';
import type { RBACMatrixResponse, UserRoleType } from '../../../lib/types';
import styles from './RBACMatrixViewer.module.css';

export default function RBACMatrixViewer() {
  const [data, setData] = useState<RBACMatrixResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [switching, setSwitching] = useState<boolean>(false);

  const fetchMatrix = () => {
    setLoading(true);
    getRBACMatrix()
      .then((res) => setData(res))
      .catch((err) => console.warn('Failed to load RBAC matrix:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const handleRoleChange = (newRole: UserRoleType) => {
    if (switching || data?.active_role === newRole) return;
    setSwitching(true);
    switchUserRole(newRole)
      .then(() => {
        fetchMatrix();
      })
      .catch((err) => console.error('Failed to switch role:', err))
      .finally(() => setSwitching(false));
  };

  if (!data && loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        RBAC yetki matrisi yükleniyor...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={styles.container}>
      {/* Role Switcher Cockpit Bar */}
      <div className={styles.roleSelectorBar}>
        <div className={styles.roleSelectorTitleArea}>
          <div className={styles.selectorTitle}>
            <ShieldCheck size={18} color="var(--accent)" aria-hidden="true" />
            <span>Aktif Platform Rolü & Güvenlik Kapsamı</span>
          </div>
          <span className={styles.selectorSub}>
            Platformdaki yetki düzeyinizi simüle edin veya operasyonel profilinizi seçin.
          </span>
        </div>

        <div className={styles.roleButtonsGroup} role="radiogroup" aria-label="Kullanıcı Rolü">
          <button
            type="button"
            role="radio"
            aria-checked={data.active_role === 'VIEWER'}
            className={`${styles.roleBtn} ${
              data.active_role === 'VIEWER' ? styles.roleBtnActiveViewer : ''
            }`}
            onClick={() => handleRoleChange('VIEWER')}
            disabled={switching}
          >
            <Eye size={13} aria-hidden="true" />
            <span>Viewer (Salt Okunur)</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={data.active_role === 'OPERATOR'}
            className={`${styles.roleBtn} ${
              data.active_role === 'OPERATOR' ? styles.roleBtnActiveOperator : ''
            }`}
            onClick={() => handleRoleChange('OPERATOR')}
            disabled={switching}
          >
            <Wrench size={13} aria-hidden="true" />
            <span>Operator (Operatör)</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={data.active_role === 'SENIOR_DBA'}
            className={`${styles.roleBtn} ${
              data.active_role === 'SENIOR_DBA' ? styles.roleBtnActiveAdmin : ''
            }`}
            onClick={() => handleRoleChange('SENIOR_DBA')}
            disabled={switching}
          >
            <Shield size={13} aria-hidden="true" />
            <span>Senior DBA (Yönetici)</span>
          </button>
        </div>
      </div>

      {/* Role Info Banner */}
      <div className={styles.roleInfoBanner}>
        <Info size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          {data.active_role === 'VIEWER' && (
            <span>
              <strong>Viewer Modu:</strong> Salt okunur gözlemci yetkisine sahipsiniz. Tüm canlı
              performans metriklerini, kilitlenmeleri ve olay günlüklerini görüntüleyebilirsiniz.
              Ancak güvenlik nedeniyle operasyonel T-SQL müdahale scriptleri ve Teşhis Dosyası dışa
              aktarma kısıtlanmıştır.
            </span>
          )}
          {data.active_role === 'OPERATOR' && (
            <span>
              <strong>Operator Modu:</strong> Operasyonel teşhis yetkisine sahipsiniz. Tüm analiz
              araçlarına, sanal indeks simülasyonuna ve review-only T-SQL onarım betiklerine
              erişebilirsiniz. Hassas sunucu bağlantı ayarları ve tam sistem arşivi kısıtlanmıştır.
            </span>
          )}
          {data.active_role === 'SENIOR_DBA' && (
            <span>
              <strong>Senior DBA Modu:</strong> Tam yetkili veritabanı mühendisi seviyesindesiniz.
              Platform üzerindeki tüm teşhis, T-SQL üretim, çoklu sunucu yönetimi ve mühendislik
              dosyası (Dossier) dışa aktarım izinleri açıktır.
            </span>
          )}
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <span>Kurumsal Rol Tabanlı Yetki & Fonksiyon Matrisi</span>
        </div>

        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Modül & Fonksiyon</th>
              <th style={{ width: '20%' }}>Viewer (Gözlemci)</th>
              <th style={{ width: '20%' }}>Operator (Operatör)</th>
              <th style={{ width: '25%' }}>Senior DBA (Yönetici)</th>
            </tr>
          </thead>
          <tbody>
            {data.permissions.map((p) => (
              <tr key={p.feature_id}>
                <td>
                  <div className={styles.featureTitle}>{p.feature_name}</div>
                  <div className={styles.featureCategory}>
                    {p.category} • {p.description}
                  </div>
                </td>
                <td>
                  {p.viewer_allowed ? (
                    <span className={styles.permIconAllowed}>
                      <Check size={13} aria-hidden="true" /> İzin Verildi
                    </span>
                  ) : (
                    <span className={styles.permIconDenied}>
                      <Lock size={12} aria-hidden="true" /> Kısıtlı
                    </span>
                  )}
                </td>
                <td>
                  {p.operator_allowed ? (
                    <span className={styles.permIconAllowed}>
                      <Check size={13} aria-hidden="true" /> İzin Verildi
                    </span>
                  ) : (
                    <span className={styles.permIconDenied}>
                      <Lock size={12} aria-hidden="true" /> Kısıtlı
                    </span>
                  )}
                </td>
                <td>
                  {p.senior_dba_allowed ? (
                    <span className={styles.permIconAllowed}>
                      <Check size={13} aria-hidden="true" /> Tam Yetki
                    </span>
                  ) : (
                    <span className={styles.permIconDenied}>
                      <X size={13} aria-hidden="true" /> Yok
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
