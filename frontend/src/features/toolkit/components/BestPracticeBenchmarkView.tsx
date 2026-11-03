import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Cpu,
  HardDrive,
  Database,
  Layers,
  Wrench,
} from 'lucide-react';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import { getBestPractices } from '../../../lib/api';
import type { BestPracticeReport, BestPracticeItem } from '../../../lib/types';
import styles from './BestPracticeBenchmarkView.module.css';

export default function BestPracticeBenchmarkView() {
  const [report, setReport] = useState<BestPracticeReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getBestPractices();
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Best practice denetimi gerçekleştirilemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopySql = (id: string, sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2500);
  };

  if (loading) {
    return <LoadingSpinner message="SQL Server mimarisi ve Best Practice kuralları denetleniyor..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  if (!report || report.items.length === 0) {
    return (
      <EmptyState
        title="Best Practice Raporu Alınamadı"
        message="Canlı SQL Server bağlantısı kurulu değil veya denetim sonucu veri dönmedi."
      />
    );
  }

  const categories = [
    'ALL',
    'Memory & CPU',
    'Storage & I/O',
    'TempDB Architecture',
    'Database Engine',
    'Reliability & Safety',
  ];

  const filteredItems = report.items.filter((item) => {
    const matchCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'ISSUES' && (item.status === 'FAIL' || item.status === 'WARN')) ||
      item.status === selectedStatus;
    return matchCategory && matchStatus;
  });

  const getScoreCircleClass = (score: number) => {
    if (score >= 85) return styles.scoreCircle;
    if (score >= 60) return `${styles.scoreCircle} ${styles.scoreCircleWarn}`;
    return `${styles.scoreCircle} ${styles.scoreCircleDanger}`;
  };

  const getImpactBadgeClass = (impact: string) => {
    switch (impact) {
      case 'CRITICAL':
        return styles.impactCritical;
      case 'HIGH':
        return styles.impactHigh;
      case 'MEDIUM':
        return styles.impactMedium;
      default:
        return styles.impactLow;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return (
          <span className={`${styles.statusBadge} ${styles.badgePass}`}>
            <CheckCircle size={12} /> BAŞARILI
          </span>
        );
      case 'WARN':
        return (
          <span className={`${styles.statusBadge} ${styles.badgeWarn}`}>
            <AlertTriangle size={12} /> UYARI
          </span>
        );
      case 'FAIL':
        return (
          <span className={`${styles.statusBadge} ${styles.badgeFail}`}>
            <XCircle size={12} /> KRİTİK HATA
          </span>
        );
      default:
        return <span className={styles.statusBadge}>{status}</span>;
    }
  };

  const getRuleCardClass = (status: string) => {
    switch (status) {
      case 'FAIL':
        return `${styles.ruleCard} ${styles.ruleCardFail}`;
      case 'WARN':
        return `${styles.ruleCard} ${styles.ruleCardWarn}`;
      default:
        return `${styles.ruleCard} ${styles.ruleCardPass}`;
    }
  };

  return (
    <div className={styles.container}>
      {/* Top Banner / Summary */}
      <div className={styles.scoreBanner}>
        <div className={styles.scoreLeft}>
          <div className={getScoreCircleClass(report.readiness_score)}>
            <span className={styles.scoreNumber}>{Math.round(report.readiness_score)}</span>
            <span className={styles.scoreOutOf}>/ 100</span>
          </div>

          <div className={styles.scoreDetails}>
            <h2 className={styles.bannerTitle}>
              SQL Server Üretime Hazırlık & Mimarî Karnesi
            </h2>
            <p className={styles.bannerSubtitle}>
              Sunucu: <strong>{report.server_name}</strong> • Son Değerlendirme: {report.evaluated_at}
              <br />
              16 kritik kurumsal kural, TempDB dağılımı, I/O ayarları ve bellek mimarisi denetlendi.
            </p>
          </div>
        </div>

        <div className={styles.scoreStats}>
          <div className={`${styles.statPill} ${styles.statPillPass}`}>
            <span className={`${styles.statVal} ${styles.statValPass}`}>{report.passed}</span>
            <span className={styles.statLabel}>Başarılı</span>
          </div>
          <div className={`${styles.statPill} ${styles.statPillWarn}`}>
            <span className={`${styles.statVal} ${styles.statValWarn}`}>{report.warnings}</span>
            <span className={styles.statLabel}>Uyarı</span>
          </div>
          <div className={`${styles.statPill} ${styles.statPillFail}`}>
            <span className={`${styles.statVal} ${styles.statValFail}`}>{report.failed}</span>
            <span className={styles.statLabel}>Hatalı</span>
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={loadData}
            title="Yeniden Değerlendir"
          >
            <RefreshCw size={13} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.filterRow}>
          <div className={styles.categoryPills}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.pillBtn} ${selectedCategory === cat ? styles.pillBtnActive : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'ALL' ? 'Tüm Kategoriler' : cat}
              </button>
            ))}
          </div>

          <div className={styles.statusPills}>
            <button
              type="button"
              className={`${styles.statusPillBtn} ${selectedStatus === 'ALL' ? styles.statusPillBtnActive : ''}`}
              onClick={() => setSelectedStatus('ALL')}
            >
              Tümü ({report.total_rules})
            </button>
            <button
              type="button"
              className={`${styles.statusPillBtn} ${selectedStatus === 'ISSUES' ? styles.statusPillBtnActive : ''}`}
              onClick={() => setSelectedStatus('ISSUES')}
            >
              Sorunlar ({report.warnings + report.failed})
            </button>
            <button
              type="button"
              className={`${styles.statusPillBtn} ${selectedStatus === 'FAIL' ? styles.statusPillBtnActive : ''}`}
              onClick={() => setSelectedStatus('FAIL')}
            >
              Kritik ({report.failed})
            </button>
            <button
              type="button"
              className={`${styles.statusPillBtn} ${selectedStatus === 'PASS' ? styles.statusPillBtnActive : ''}`}
              onClick={() => setSelectedStatus('PASS')}
            >
              Başarılı ({report.passed})
            </button>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className={styles.rulesGrid}>
        {filteredItems.map((item) => (
          <div key={item.id} className={getRuleCardClass(item.status)}>
            <div className={styles.ruleTop}>
              <div className={styles.ruleHeaderLeft}>
                <div className={styles.ruleBadges}>
                  <span className={styles.ruleId}>{item.id}</span>
                  <span className={styles.categoryTag}>{item.category}</span>
                  <span className={`${styles.impactBadge} ${getImpactBadgeClass(item.impact)}`}>
                    ÖNEM: {item.impact}
                  </span>
                </div>
                <h3 className={styles.ruleTitle}>{item.title}</h3>
              </div>
              <div className={styles.ruleHeaderRight}>{getStatusBadge(item.status)}</div>
            </div>

            <p className={styles.ruleDesc}>{item.description}</p>

            <div className={styles.comparisonGrid}>
              <div className={styles.compCol}>
                <span className={styles.compLabel}>Mevcut Değer</span>
                <span className={styles.compValCurrent}>{item.current_value}</span>
              </div>
              <div className={styles.compCol}>
                <span className={styles.compLabel}>Önerilen Kurumsal Değer</span>
                <span className={styles.compValRec}>{item.recommended_value}</span>
              </div>
            </div>

            {item.remediation_sql && (
              <div className={styles.remediationBox}>
                <div className={styles.remediationHeader}>
                  <span className={styles.remediationTitle}>
                    <Wrench size={13} color="var(--accent-primary, #3b82f6)" />
                    Önerilen Düzeltme (Remediation T-SQL)
                  </span>
                  <button
                    type="button"
                    className={`${styles.copyBtn} ${copiedId === item.id ? styles.copyBtnCopied : ''}`}
                    onClick={() => handleCopySql(item.id, item.remediation_sql!)}
                    title="T-SQL Düzeltme Komutunu Kopyala"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check size={12} /> Kopyalandı!
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Scripti Kopyala
                      </>
                    )}
                  </button>
                </div>
                <CodeBlock code={item.remediation_sql} language="sql" maxLines={6} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
