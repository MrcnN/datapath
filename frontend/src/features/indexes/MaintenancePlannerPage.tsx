import React from 'react';
import PageHeader from '../../components/layout/PageHeader';
import SmartMaintenancePlanner from './components/SmartMaintenancePlanner';

export default function MaintenancePlannerPage() {
  return (
    <div style={{ padding: '0 var(--space-6) var(--space-8)' }}>
      <PageHeader
        title="İndeks Bakım Planlayıcı"
        subtitle="Parçalanma oranına göre REORGANIZE veya REBUILD işlemlerini belirler, istatistikleri günceller ve hazır SQL Agent bakım işi betiği üretir."
      />
      <SmartMaintenancePlanner />
    </div>
  );
}
