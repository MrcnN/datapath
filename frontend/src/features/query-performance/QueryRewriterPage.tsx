import React from 'react';
import PageHeader from '../../components/layout/PageHeader';
import QueryRewriterStudio from './components/QueryRewriterStudio';

export default function QueryRewriterPage() {
  return (
    <div style={{ padding: '0 var(--space-6) var(--space-8)' }}>
      <PageHeader
        title="Sorgu Düzeltici & İyileştirici"
        subtitle="SARGable olmayan anti-desenleri (YEAR, LEFT, COUNT, SELECT *) analiz eder ve Index Seek uyumlu optimize edilmiş T-SQL varyantını oluşturur."
      />
      <QueryRewriterStudio />
    </div>
  );
}
