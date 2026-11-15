import React, { useState } from 'react';
import {
  Server,
  Database,
  ShieldCheck,
  Sliders,
  Network,
  Activity,
  Cpu,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LiveSessionCockpit from './components/LiveSessionCockpit';
import ConnectionForm from './components/ConnectionForm';
import InstanceMetadata from './components/InstanceMetadata';
import DatabaseTable from './components/DatabaseTable';
import ServerConfigurationAudit from './components/ServerConfigurationAudit';
import ServerProfilesManager from './components/ServerProfilesManager';
import FleetOverviewStudio from './components/FleetOverviewStudio';
import styles from './InstancesPage.module.css';

type InstanceTab = 'fleet' | 'live-sessions' | 'profiles' | 'configuration' | 'databases';

export default function InstancesPage({ initialTab }: { initialTab?: InstanceTab } = {}) {
  const [activeTab, setActiveTab] = useState<InstanceTab>(initialTab || 'fleet');

  return (
    <div className={styles.page}>
      <PageHeader
        title="Canlı Oturumlar & Sunucular"
        subtitle="Canlı sp_whoisactive seviyesinde çalışan sorgular, kök kilit bloklayıcıları ve çoklu sunucu profilleri."
      />

      {/* Navigation Tabs Bar */}
      <div className={styles.tabsBar} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'fleet'}
          className={`${styles.tabBtn} ${activeTab === 'fleet' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('fleet')}
        >
          <Network size={14} />
          <span>Filo Panosu &amp; Sağlık Matrisi</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'live-sessions'}
          className={`${styles.tabBtn} ${activeTab === 'live-sessions' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('live-sessions')}
        >
          <Activity size={14} />
          <span>Canlı Süreçler &amp; sp_WhoIsActive</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profiles'}
          className={`${styles.tabBtn} ${activeTab === 'profiles' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('profiles')}
        >
          <Network size={14} />
          <span>Çoklu Sunucu Profilleri &amp; Bağlantı</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'configuration'}
          className={`${styles.tabBtn} ${activeTab === 'configuration' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('configuration')}
        >
          <Sliders size={14} />
          <span>Sunucu Yapılandırması (sp_configure Audit)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'databases'}
          className={`${styles.tabBtn} ${activeTab === 'databases' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('databases')}
        >
          <Database size={14} />
          <span>Veritabanları &amp; Kaynaklar</span>
        </button>
      </div>

      {/* TAB 0: Çoklu Sunucu Filo Panosu & Sağlık Matrisi */}
      {activeTab === 'fleet' && (
        <FleetOverviewStudio onInspectServer={() => setActiveTab('live-sessions')} />
      )}

      {/* TAB 1: Canlı Süreçler & sp_WhoIsActive */}
      {activeTab === 'live-sessions' && (
        <LiveSessionCockpit />
      )}

      {/* TAB 2: Kayıtlı Sunucu Profilleri & Çoklu Ortam Yönetimi */}
      {activeTab === 'profiles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <Network size={16} color="var(--accent)" />
              Kayıtlı Sunucu Profilleri &amp; Çoklu Ortam Yönetimi (Multi-Server Registry)
            </div>
            <ServerProfilesManager />
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <Server size={16} color="var(--accent)" />
              Yeni Bağlantı Profili Ekle
            </div>
            <ConnectionForm />
          </div>
        </div>
      )}

      {/* TAB 3: Sunucu sp_configure & En İyi Uygulama Denetimi */}
      {activeTab === 'configuration' && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Sliders size={16} color="var(--accent)" />
            Sunucu Yapılandırması &amp; En İyi Uygulama Denetimi (sp_configure Audit)
          </div>
          <ServerConfigurationAudit />
        </div>
      )}

      {/* TAB 4: Veritabanları & Kaynak Bilgisi */}
      {activeTab === 'databases' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <ShieldCheck size={16} color="var(--accent)" />
              Sunucu Kaynak &amp; Sürüm Bilgileri
            </div>
            <InstanceMetadata />
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <Database size={16} color="var(--accent)" />
              Bağlı Sunucudaki Veritabanları
            </div>
            <DatabaseTable />
          </div>
        </div>
      )}
    </div>
  );
}
