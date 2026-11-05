import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Check,
  Copy,
  Zap,
  Info,
} from 'lucide-react';
import { getCardinalityDrift } from '../../../lib/api';
import type { CardinalityDriftResponse } from '../../../lib/types';
import styles from './CardinalityDriftViewer.module.css';

export default function CardinalityDriftViewer() {
  const [data, setData] = useState<CardinalityDriftResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchDrift = () => {
    setLoading(true);
    getCardinalityDrift()
      .then((res) => setData(res))
      .catch((err) => console.warn('Failed to load cardinality drift:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDrift();
  }, []);

  const handleCopy = (hash: string, tsql: string) => {
    navigator.clipboard.writeText(tsql);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (!data && loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Kardinalite sapması ve parameter sniffing analiz ediliyor...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiTitle}>Analiz Edilen Ağır Sorgular</span>
          <div className={styles.kpiValue}>{data.total_analyzed_queries}</div>
          <span className={styles.kpiSub}>Execution stats üzerinden taranan</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiTitle}>Kardinalite Sapması Yaşayanlar</span>
          <div className={styles.kpiValue} style={{ color: '#ef4444' }}>
            {data.drift_queries_count} Sorgu
          </div>
          <span className={styles.kpiSub}>Tahmin vs Gerçek satır farkı &gt;10x</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiTitle}>Parameter Sniffing Şüphelileri</span>
          <div className={styles.kpiValue} style={{ color: '#f59e0b' }}>
            {data.parameter_sniffing_candidates_count} Sorgu
          </div>
          <span className={styles.kpiSub}>Parametreye duyarlı dengesiz planlar</span>
        </div>
      </div>

      {/* Query Cards List */}
      <div className={styles.itemsList}>
        {data.items.map((item) => {
          const isUnder = item.drift_direction === 'UNDER_ESTIMATION';

          return (
            <div key={item.query_hash} className={styles.driftCard}>
              {/* Header */}
              <div className={styles.cardHeader}>
                <div className={styles.headerLeft}>
                  <GitCompare size={16} color="var(--accent)" aria-hidden="true" />
                  <span className={styles.dbBadge}>{item.database_name}</span>
                  <span className={styles.queryHash}>{item.query_hash}</span>
                  {item.parameter_sniffing_suspect && (
                    <span
                      style={{
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#fbbf24',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      Parameter Sniffing
                    </span>
                  )}
                </div>

                <div
                  className={`${styles.ratioBadge} ${
                    isUnder ? styles.badgeUnder : styles.badgeOver
                  }`}
                >
                  {isUnder
                    ? `${item.drift_ratio.toLocaleString()}x Eksik Tahmin (Under-Estimate)`
                    : `${item.drift_ratio.toLocaleString()}x Fazla Tahmin (Over-Estimate)`}
                </div>
              </div>

              {/* Body */}
              <div className={styles.cardBody}>
                {/* SQL Snippet */}
                <pre className={styles.sqlSnippet}>
                  <code>{item.query_text_snippet}</code>
                </pre>

                {/* Comparison Grid */}
                <div className={styles.comparisonGrid}>
                  <div className={styles.compareBox}>
                    <span className={styles.compareLabel}>Tahmini Satır Sayısı (Estimated)</span>
                    <span className={styles.compareVal}>
                      {item.estimated_rows.toLocaleString()} satır
                    </span>
                  </div>

                  <div className={styles.compareBox}>
                    <span className={styles.compareLabel}>Gerçek Satır Sayısı (Actual Rows)</span>
                    <span
                      className={styles.compareVal}
                      style={{ color: isUnder ? '#f87171' : '#fbbf24' }}
                    >
                      {item.actual_rows.toLocaleString()} satır
                    </span>
                  </div>
                </div>

                {/* Impact */}
                <p className={styles.impactText}>{item.impact_summary}</p>

                {/* Root Cause */}
                <div className={styles.rootCauseBox}>
                  <strong>Kök Neden & Mekanizma:</strong> {item.root_cause}
                </div>

                {/* Surgical Remediation Code */}
                <div className={styles.codeArea}>
                  <div className={styles.codeHeader}>
                    <span>Önerilen İyileştirme Stratejisi ({item.remediation_strategy})</span>
                    <button
                      type="button"
                      className={styles.copyCodeBtn}
                      onClick={() => handleCopy(item.query_hash, item.surgical_tsql)}
                    >
                      {copiedHash === item.query_hash ? (
                        <>
                          <Check size={11} color="#4ade80" aria-hidden="true" />
                          <span>Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} aria-hidden="true" />
                          <span>T-SQL Kopyala</span>
                        </>
                      )}
                    </button>
                  </div>
                  <code>{item.surgical_tsql}</code>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
