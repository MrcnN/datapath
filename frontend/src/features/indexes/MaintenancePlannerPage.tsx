import React, { useState } from 'react';
import { Wrench, CalendarClock } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import SmartMaintenancePlanner from './components/SmartMaintenancePlanner';
import MaintenanceJobGeneratorStudio from './components/MaintenanceJobGeneratorStudio';
import styles from './MaintenancePlannerPage.module.css';

export type MaintenanceTab = 'planner' | 'automation';

interface MaintenancePlannerPageProps {
  initialTab?: MaintenanceTab;
}

export default function MaintenancePlannerPage({ initialTab = 'planner' }: MaintenancePlannerPageProps = {}) {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>(initialTab);

  return (
    <div className={styles.container}>
      <PageHeader
        title="İndeks & Veritabanı Bakım Merkezi"
        subtitle="Parçalanma analizine göre dinamik REORGANIZE/REBUILD planlaması ve Ola Hallengren / SQL Agent otomatik bakım işleri üreticisi."
      />

      <div className={styles.tabsBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'planner' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('planner')}
        >
          <Wrench size={14} />
          İndeks Parçalanma Analizi & Bakım Planlayıcı
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'automation' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('automation')}
        >
          <CalendarClock size={14} />
          Ola Hallengren & SQL Agent Bakım Otomasyonu
        </button>
      </div>

      {activeTab === 'planner' ? (
        <SmartMaintenancePlanner />
      ) : (
        <MaintenanceJobGeneratorStudio />
      )}
    </div>
  );
}
