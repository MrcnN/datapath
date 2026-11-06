import React from 'react';
import PageHeader from '../../components/layout/PageHeader';
import BufferPoolTomographyViewer from './components/BufferPoolTomographyViewer';

export default function BufferPoolPage({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <div style={{ padding: embedded ? '0' : '0 var(--space-6) var(--space-8)' }}>
      {!embedded && (
        <PageHeader
          title="Buffer Pool Bellek Tomografisi & Kirli Sayfalar"
          subtitle="sys.dm_os_buffer_descriptors üzerinden veritabanı bazında RAM nesne röntgeni, diske yazılmayı bekleyen kirli sayfalar (dirty pages) ve hedefli CHECKPOINT reçeteleri."
        />
      )}
      <BufferPoolTomographyViewer />
    </div>
  );
}
