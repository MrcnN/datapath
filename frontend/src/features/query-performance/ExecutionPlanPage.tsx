import React from 'react';
import PageHeader from '../../components/layout/PageHeader';
import ExecutionPlanViewer from './components/ExecutionPlanViewer';

export default function ExecutionPlanPage() {
  return (
    <div style={{ padding: '0 var(--space-6) var(--space-8)' }}>
      <PageHeader
        title="Sorgu Yürütme Planı (.sqlplan)"
        subtitle="SSMS gerektirmeden .sqlplan veya XML formatındaki sorgu planlarını ağaç yapısında görüntüler, maliyet yüzdelerini ve uyarıları analiz eder."
      />
      <ExecutionPlanViewer />
    </div>
  );
}
