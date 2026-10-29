import React from 'react';
import { Server, Database, ShieldCheck, Sliders, Network } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import ConnectionForm from './components/ConnectionForm';
import InstanceMetadata from './components/InstanceMetadata';
import DatabaseTable from './components/DatabaseTable';
import ServerConfigurationAudit from './components/ServerConfigurationAudit';
import ServerProfilesManager from './components/ServerProfilesManager';
import styles from './InstancesPage.module.css';

export default function InstancesPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        title="Sunucular & Bağlantı Yönetimi"
        subtitle="Birden fazla SQL Server ortamı (Prod, AlwaysOn Replica, Staging, Dev) arasında geçiş yapın, bağlantı profillerini yönetin ve sunucu kaynaklarını denetleyin"
      />

      {/* Kayıtlı Sunucu Profilleri & Ortamlar */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Network size={16} color="var(--accent)" />
          Kayıtlı Sunucu Profilleri & Çoklu Ortam Yönetimi (Multi-Server Registry)
        </div>
        <ServerProfilesManager />
      </div>

      <div className={styles.grid}>
        {/* Sol: Bağlantı Yapılandırma Formu */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Server size={16} color="var(--accent)" />
            Bağlantı Yapılandırması (Connection Profile)
          </div>
          <ConnectionForm />
        </div>

        {/* Sağ: Sunucu Meta Verileri */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <ShieldCheck size={16} color="var(--accent)" />
            Sunucu Kaynak & Sürüm Bilgileri
          </div>
          <InstanceMetadata />
        </div>
      </div>

      {/* Sunucu sp_configure & En İyi Uygulama Denetimi */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Sliders size={16} color="var(--accent)" />
          Sunucu Yapılandırması & En İyi Uygulama Denetimi (sp_configure Audit)
        </div>
        <ServerConfigurationAudit />
      </div>

      {/* Veritabanı Tablosu */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Database size={16} color="var(--accent)" />
          Bağlı Sunucudaki Veritabanları
        </div>
        <DatabaseTable />
      </div>
    </div>
  );
}
