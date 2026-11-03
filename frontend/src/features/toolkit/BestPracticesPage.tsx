import React from 'react';
import PageHeader from '../../components/layout/PageHeader';
import BestPracticeBenchmarkView from './components/BestPracticeBenchmarkView';

export default function BestPracticesPage() {
  return (
    <div style={{ padding: '0 var(--space-6) var(--space-8)' }}>
      <PageHeader
        title="Sistem Uygunluk Karnesi"
        subtitle="MAXDOP, Cost Threshold ve TempDB dahil 16 kritik mimari kurala göre sunucunuzu denetler ve ağırlıklı uygunluk skoru ile düzeltme kodları üretir."
      />
      <BestPracticeBenchmarkView />
    </div>
  );
}
