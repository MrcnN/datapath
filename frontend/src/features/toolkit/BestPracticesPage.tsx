import React, { useState } from 'react';
import { ShieldCheck, Sliders, HardDrive } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import BestPracticeBenchmarkView from './components/BestPracticeBenchmarkView';
import ConfigDriftStudio from './components/ConfigDriftStudio';
import AutoGrowthRiskStudio from './components/AutoGrowthRiskStudio';
import styles from './BestPracticesPage.module.css';

type BestPracticesTab = 'benchmark' | 'drift' | 'autogrowth';

export default function BestPracticesPage({ initialTab }: { initialTab?: BestPracticesTab } = {}) {
  const [activeTab, setActiveTab] = useState<BestPracticesTab>(initialTab || 'benchmark');

  return (
    <div className={styles.page}>
      <PageHeader
        title="Sistem Uygunluk Karnesi &amp; Konfigürasyon Radarı"
        subtitle="16 kritik mimari kural denetimi, kurumsal Golden Baseline karşılaştırması ve sunucu konfigürasyon sapma (drift) analizi."
      />

      {/* Segmented Switcher */}
      <div className={styles.tabsBar} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'benchmark'}
          className={`${styles.tabBtn} ${activeTab === 'benchmark' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('benchmark')}
        >
          <ShieldCheck size={14} />
          <span>16 Kural Mimari Uygunluk Karnesi</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'drift'}
          className={`${styles.tabBtn} ${activeTab === 'drift' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('drift')}
        >
          <Sliders size={14} />
          <span>Konfigürasyon Sapması &amp; Drift Radarı</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'autogrowth'}
          className={`${styles.tabBtn} ${activeTab === 'autogrowth' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('autogrowth')}
        >
          <HardDrive size={14} />
          <span>Auto-Growth &amp; Auto-Shrink Riskleri</span>
        </button>
      </div>

      {/* Tab 1: Mimari Uygunluk Karnesi */}
      {activeTab === 'benchmark' && <BestPracticeBenchmarkView />}

      {/* Tab 2: Konfigürasyon Drift & Baseline Radarı */}
      {activeTab === 'drift' && <ConfigDriftStudio />}

      {/* Tab 3: Auto-Growth & Auto-Shrink Risk Denetimi */}
      {activeTab === 'autogrowth' && <AutoGrowthRiskStudio />}
    </div>
  );
}
