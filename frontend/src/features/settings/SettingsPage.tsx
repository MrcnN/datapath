import React from 'react';
import PageHeader from '../../components/layout/PageHeader';
import { brand } from '../../config/brand';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

  return (
    <div className={styles.container}>
      <PageHeader
        title="Uygulama Ayarları (Settings)"
        subtitle="Platform yapılandırması, merkezi marka kimliği ve bağlantı parametreleri"
      />

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Merkezi Marka Kimliği (Brand Configuration)</h2>
        <div className={styles.infoGrid}>
          <span className={styles.label}>Ürün Adı:</span>
          <span className={styles.value}>
            <span className={styles.brandBadge}>{brand.name}</span>
          </span>

          <span className={styles.label}>Ürün Tanımı:</span>
          <span className={styles.value}>{brand.descriptor}</span>

          <span className={styles.label}>Slogan:</span>
          <span className={styles.value}>"{brand.tagline}"</span>

          <span className={styles.label}>Kısa Kod / Versiyon:</span>
          <span className={styles.value}>{brand.shortName} v{brand.version}</span>

          <span className={styles.label}>Vurgu Rengi:</span>
          <span className={styles.value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: brand.accent,
                display: 'inline-block',
              }}
            />
            {brand.accent}
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Bağlantı & Altyapı Yapılandırması</h2>
        <div className={styles.infoGrid}>
          <span className={styles.label}>Backend API URL:</span>
          <span className={styles.value}>{apiUrl}</span>

          <span className={styles.label}>Arayüz Teması:</span>
          <span className={styles.value}>Karanlık Tema (Dark-First Slate / Teal)</span>

          <span className={styles.label}>Varsayılan ODBC Sürücüsü:</span>
          <span className={styles.value}>ODBC Driver 17 / 18 for SQL Server</span>

          <span className={styles.label}>Erişim Modu:</span>
          <span className={styles.value}>Salt Okunur (Read-Only By Default)</span>
        </div>
      </div>
    </div>
  );
}
