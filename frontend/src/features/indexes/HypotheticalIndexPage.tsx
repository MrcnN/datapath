import React from 'react';
import PageHeader from '../../components/layout/PageHeader';
import HypotheticalIndexSimulator from './components/HypotheticalIndexSimulator';

export default function HypotheticalIndexPage() {
  return (
    <div style={{ padding: '0 var(--space-6) var(--space-8)' }}>
      <PageHeader
        title="Sanal İndeks Simülatörü (What-If)"
        subtitle="Diske 1 bayt bile yazmadan (WITH STATISTICS_ONLY = -1) sanal indeks test eder ve sorgunun tahmini maliyetindeki düşüşü ölçer."
      />
      <HypotheticalIndexSimulator />
    </div>
  );
}
