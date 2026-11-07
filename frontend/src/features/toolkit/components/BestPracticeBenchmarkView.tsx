import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  Wrench,
  Server,
  Layers,
  ArrowRight,
  ShieldCheck,
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getBestPractices();
      setReport(data);

      // By default, expand only failed and warning rules so the user is not overwhelmed
      const initialExpanded = new Set<string>();
      data.items.forEach((item) => {
        if (item.status === 'FAIL' || item.status === 'WARN') {
          initialExpanded.add(item.id);
        }
      });
      setExpandedIds(initialExpanded);
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

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = (expandAll: boolean) => {
    if (!report) return;
    if (expandAll) {
      setExpandedIds(new Set(report.items.map((i) => i.id)));
    } else {
      setExpandedIds(new Set());
    }
  };

  const categories = useMemo(() => {
    if (!report) return ['ALL'];
    const cats = Array.from(new Set(report.items.map((i) => i.category)));
    return ['ALL', ...cats];
  }, [report]);

  const filteredItems = useMemo(() => {
    if (!report) return [];
    return report.items.filter((item) => {
      const matchSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

      const matchStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'ISSUES' && (item.status === 'FAIL' || item.status === 'WARN')) ||
        item.status === selectedStatus;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [report, searchQuery, selectedCategory, selectedStatus]);

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

  const score = Math.round(report.readiness_score);
  const scoreLevel =
    score >= 85
      ? { text: 'Mükemmel • Üretime Hazır', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' }
      : score >= 65
      ? { text: 'İyi • İyileştirme Gerekir', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' }
      : { text: 'Kritik Eksikler Var', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' };

  const allAreExpanded =
    filteredItems.length > 0 && filteredItems.every((item) => expandedIds.has(item.id));

  return (
    <div className={styles.container}>
      {/* 1. Executive Summary & Scorecard Hero */}
      <div className={styles.scoreHero}>
        <div className={styles.heroLeft}>
          <div
            className={styles.scoreCircle}
            style={{
              borderColor: scoreLevel.color,
              backgroundColor: scoreLevel.bg,
            }}
          >
            <span className={styles.scoreNumber} style={{ color: scoreLevel.color }}>
              {score}
            </span>
            <span className={styles.scoreOutOf}>/ 100</span>
          </div>

          <div className={styles.heroDetails}>
            <div className={styles.heroTitleRow}>
              <h2 className={styles.heroTitle}>SQL Server Mimari Uygunluk Karnesi</h2>
              <span
                className={styles.scoreBadge}
                style={{
                  color: scoreLevel.color,
                  backgroundColor: scoreLevel.bg,
                  borderColor: scoreLevel.color,
                }}
              >
                <ShieldCheck size={12} />
                {scoreLevel.text}
              </span>
            </div>
            <p className={styles.heroSubtitle}>
              <Server size={12} className={styles.subIcon} />
              <span>Sunucu: <strong>{report.server_name}</strong></span>
              <span className={styles.dotSep}>•</span>
              <span>Son Denetim: {report.evaluated_at}</span>
              <span className={styles.dotSep}>•</span>
              <span>16 Kritik Kural &amp; TempDB/Bellek Mimarisi</span>
            </p>
          </div>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.statChip}>
            <span className={styles.statCount}>{report.total_rules}</span>
            <span className={styles.statLabel}>Toplam Kural</span>
          </div>
          <div className={`${styles.statChip} ${styles.statChipPass}`}>
            <span className={styles.statCountPass}>{report.passed}</span>
            <span className={styles.statLabel}>Başarılı</span>
          </div>
          <div className={`${styles.statChip} ${styles.statChipWarn}`}>
            <span className={styles.statCountWarn}>{report.warnings}</span>
            <span className={styles.statLabel}>Uyarı</span>
          </div>
          <div className={`${styles.statChip} ${styles.statChipFail}`}>
            <span className={styles.statCountFail}>{report.failed}</span>
            <span className={styles.statLabel}>Kritik</span>
          </div>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={loadData}
            disabled={loading}
            title="Yeniden Değerlendir"
          >
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Toolbar (Search, Status Filter, Category Filter, Expand All) */}
      <div className={styles.toolbarCard}>
        <div className={styles.toolbarMain}>
          {/* Search Box */}
          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Kural adı, ID veya açıklama ara (örn: MAXDOP, TempDB, I/O)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className={styles.statusSegment} role="tablist">
            <button
              type="button"
              className={`${styles.segmentBtn} ${selectedStatus === 'ALL' ? styles.segmentBtnActive : ''}`}
              onClick={() => setSelectedStatus('ALL')}
            >
              Tümü <span className={styles.counterBadge}>{report.total_rules}</span>
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${selectedStatus === 'ISSUES' ? styles.segmentBtnActive : ''}`}
              onClick={() => setSelectedStatus('ISSUES')}
            >
              Sorunlar <span className={`${styles.counterBadge} ${styles.counterIssues}`}>{report.warnings + report.failed}</span>
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${selectedStatus === 'FAIL' ? styles.segmentBtnActive : ''}`}
              onClick={() => setSelectedStatus('FAIL')}
            >
              Kritik <span className={`${styles.counterBadge} ${styles.counterFail}`}>{report.failed}</span>
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${selectedStatus === 'WARN' ? styles.segmentBtnActive : ''}`}
              onClick={() => setSelectedStatus('WARN')}
            >
              Uyarılar <span className={`${styles.counterBadge} ${styles.counterWarn}`}>{report.warnings}</span>
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${selectedStatus === 'PASS' ? styles.segmentBtnActive : ''}`}
              onClick={() => setSelectedStatus('PASS')}
            >
              Başarılı <span className={`${styles.counterBadge} ${styles.counterPass}`}>{report.passed}</span>
            </button>
          </div>
        </div>

        {/* Category Chips & Expand/Collapse Toggle */}
        <div className={styles.toolbarSub}>
          <div className={styles.categoryChips}>
            <span className={styles.categoryLabel}>Kategori:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.catChipBtn} ${selectedCategory === cat ? styles.catChipActive : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'ALL' ? 'Tümü' : cat}
              </button>
            ))}
          </div>

          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.toggleAllBtn}
              onClick={() => toggleAll(!allAreExpanded)}
            >
              {allAreExpanded ? (
                <>
                  <ChevronUp size={13} /> Tümünü Daralt
                </>
              ) : (
                <>
                  <ChevronDown size={13} /> Tümünü Genişlet
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Streamlined Interactive Accordion List */}
      <div className={styles.rulesList}>
        {filteredItems.length === 0 ? (
          <div className={styles.noResultsBox}>
            <span>Filtrelere uygun kural bulunamadı.</span>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedIds.has(item.id);
            const isFail = item.status === 'FAIL';
            const isWarn = item.status === 'WARN';
            const isPass = item.status === 'PASS';

            return (
              <div
                key={item.id}
                className={`${styles.ruleRow} ${
                  isFail
                    ? styles.ruleRowFail
                    : isWarn
                    ? styles.ruleRowWarn
                    : styles.ruleRowPass
                }`}
              >
                {/* Clickable Header Row */}
                <div
                  className={styles.ruleRowHeader}
                  onClick={() => toggleExpand(item.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                >
                  {/* Status Icon */}
                  <div className={styles.rowIconArea}>
                    {isPass && <CheckCircle2 size={17} className={styles.iconPass} />}
                    {isWarn && <AlertTriangle size={17} className={styles.iconWarn} />}
                    {isFail && <XCircle size={17} className={styles.iconFail} />}
                  </div>

                  {/* ID & Title */}
                  <div className={styles.rowTitleArea}>
                    <div className={styles.rowMeta}>
                      <span className={styles.ruleIdBadge}>{item.id}</span>
                      <span className={styles.ruleCatBadge}>{item.category}</span>
                      <span
                        className={`${styles.impactBadge} ${
                          item.impact === 'CRITICAL'
                            ? styles.impactCritical
                            : item.impact === 'HIGH'
                            ? styles.impactHigh
                            : item.impact === 'MEDIUM'
                            ? styles.impactMedium
                            : styles.impactLow
                        }`}
                      >
                        {item.impact}
                      </span>
                    </div>
                    <span className={styles.ruleTitleText}>{item.title}</span>
                  </div>

                  {/* Quick Values Inline Preview */}
                  <div className={styles.valuesPreview}>
                    <div className={styles.previewValBox}>
                      <span className={styles.previewValLabel}>Mevcut:</span>
                      <span className={isFail ? styles.previewValBad : isWarn ? styles.previewValWarn : styles.previewValGood}>
                        {item.current_value}
                      </span>
                    </div>
                    <ArrowRight size={12} className={styles.arrowIcon} />
                    <div className={styles.previewValBox}>
                      <span className={styles.previewValLabel}>Hedef:</span>
                      <span className={styles.previewValTarget}>{item.recommended_value}</span>
                    </div>
                  </div>

                  {/* Right Status Pill & Chevron */}
                  <div className={styles.rowActions}>
                    <span
                      className={`${styles.statusPill} ${
                        isFail
                          ? styles.statusPillFail
                          : isWarn
                          ? styles.statusPillWarn
                          : styles.statusPillPass
                      }`}
                    >
                      {isPass ? 'BAŞARILI' : isWarn ? 'UYARI' : 'KRİTİK HATA'}
                    </span>
                    <button
                      type="button"
                      className={styles.chevronBtn}
                      aria-label={isExpanded ? 'Daralt' : 'Genişlet'}
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Detailed Content */}
                {isExpanded && (
                  <div className={styles.ruleDetails}>
                    <p className={styles.detailDesc}>{item.description}</p>

                    {/* Side-by-Side Comparison Grid */}
                    <div className={styles.compGrid}>
                      <div className={styles.compCardCurrent}>
                        <span className={styles.compCardLabel}>Sunucuda Tespit Edilen Değer</span>
                        <span className={isFail ? styles.compValFail : isWarn ? styles.compValWarn : styles.compValPass}>
                          {item.current_value}
                        </span>
                      </div>
                      <div className={styles.compCardTarget}>
                        <span className={styles.compCardLabel}>Önerilen Kurumsal Hedef (Best Practice)</span>
                        <span className={styles.compValTargetText}>{item.recommended_value}</span>
                      </div>
                    </div>

                    {/* Remediation T-SQL Block */}
                    {item.remediation_sql && (
                      <div className={styles.remediationBox}>
                        <div className={styles.remediationHead}>
                          <div className={styles.remediationTitle}>
                            <Wrench size={13} color="var(--accent, #38bdf8)" />
                            <span>Önerilen Düzeltme Reçetesi (Remediation T-SQL)</span>
                          </div>
                          <button
                            type="button"
                            className={`${styles.copyBtn} ${copiedId === item.id ? styles.copyBtnCopied : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySql(item.id, item.remediation_sql!);
                            }}
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check size={12} color="#4ade80" />
                                <span>Kopyalandı!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Scripti Kopyala</span>
                              </>
                            )}
                          </button>
                        </div>

                        <CodeBlock
                          code={item.remediation_sql}
                          language="sql"
                          showCopy={false}
                          maxLines={8}
                        />

                        <div className={styles.remediationFootnote}>
                          * Güvenlik ilkesi: Bu komut doğrudan çalıştırılmaz. DBA incelemesi sonrası SSMS üzerinde uygulanması önerilir.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
