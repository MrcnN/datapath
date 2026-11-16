import React, { useState } from 'react';
import { Database, Layers } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import BufferPoolTomographyViewer from './components/BufferPoolTomographyViewer';
import MemoryClerksStudio from './components/MemoryClerksStudio';
import styles from './BufferPoolPage.module.css';

export type BufferPoolTab = 'buffer_pool' | 'memory_clerks';

interface BufferPoolPageProps {
  embedded?: boolean;
  initialTab?: BufferPoolTab;
}

export default function BufferPoolPage({ embedded = false, initialTab = 'buffer_pool' }: BufferPoolPageProps = {}) {
  const [activeTab, setActiveTab] = useState<BufferPoolTab>(initialTab);

  return (
    <div style={{ padding: embedded ? '0' : '0 var(--space-6) var(--space-8)' }} className={styles.container}>
      {!embedded && (
        <PageHeader
          title="Buffer Pool & Bellek Katipleri Merkezi"
          subtitle="sys.dm_os_buffer_descriptors üzerinden RAM nesne dağılım analizi, kirli sayfalar ve sys.dm_os_memory_clerks ile ad-hoc plan cache şişkinliği tespiti."
        />
      )}

      <div className={styles.tabsBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'buffer_pool' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('buffer_pool')}
        >
          <Database size={14} />
          Buffer Pool &amp; Kirli Sayfalar (Pages)
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'memory_clerks' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('memory_clerks')}
        >
          <Layers size={14} />
          Bellek Katipleri &amp; Plan Cache Şişkinliği
        </button>
      </div>

      {activeTab === 'buffer_pool' ? (
        <BufferPoolTomographyViewer />
      ) : (
        <MemoryClerksStudio />
      )}
    </div>
  );
}
