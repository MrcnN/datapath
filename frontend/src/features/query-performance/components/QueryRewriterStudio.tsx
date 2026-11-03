import React, { useState } from 'react';
import {
  Wand2,
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  Code2,
  FileText,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import { rewriteQuery } from '../../../lib/api';
import type { RewriteQueryResponse, DetectedAntiPattern } from '../../../lib/types';
import styles from './QueryRewriterStudio.module.css';

const SAMPLE_BAD_QUERY = `-- Yavaş çalışan ve indeksleri taramaya (Table Scan) zorlayan T-SQL örneği:
SELECT *
FROM dbo.Orders o
INNER JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
WHERE YEAR(o.OrderDate) = 2026
  AND LEFT(o.CustomerCode, 3) = 'TRX'
  AND ISNULL(o.PaymentStatus, 0) = 0
  AND o.Notes LIKE '%express delivery%'
ORDER BY o.TotalAmount DESC;`;

export default function QueryRewriterStudio() {
  const [queryInput, setQueryInput] = useState<string>(SAMPLE_BAD_QUERY);
  const [response, setResponse] = useState<RewriteQueryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleOptimize = async () => {
    if (!queryInput.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await rewriteQuery({ query_text: queryInput });
      setResponse(res);
    } catch (err: any) {
      setError(err.message || 'Sorgu optimize edilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getSeverityClass = (sev: string) => {
    switch (sev) {
      case 'HIGH':
        return styles.sevHigh;
      case 'MEDIUM':
        return styles.sevMedium;
      default:
        return styles.sevLow;
    }
  };

  const getCardBorderClass = (sev: string) => {
    switch (sev) {
      case 'HIGH':
        return styles.patternCardHigh;
      case 'MEDIUM':
        return styles.patternCardMedium;
      default:
        return styles.patternCardLow;
    }
  };

  return (
    <div className={styles.container}>
      {/* Top Banner */}
      <div className={styles.topBanner}>
        <div className={styles.bannerLeft}>
          <div className={styles.magicIconBox}>
            <Wand2 size={24} />
          </div>
          <div className={styles.bannerTitles}>
            <h3 className={styles.bannerTitle}>
              Akıllı T-SQL Sorgu İyileştirici & Yeniden Yazım Stüdyosu
            </h3>
            <p className={styles.bannerDesc}>
              Sorgudaki non-SARGable fonksiyonları, geniş projeksiyonları ve optimizasyon tuzaklarını tespit edip otomatik olarak Index Seek uyumlu optimize T-SQL üretir.
            </p>
          </div>
        </div>

        <div className={styles.bannerActions}>
          <button
            type="button"
            className={styles.sampleBtn}
            onClick={() => setQueryInput(SAMPLE_BAD_QUERY)}
            title="Test için örnek hatalı T-SQL doldur"
          >
            <RotateCcw size={13} />
            <span>Örnek Sorgu Yükle</span>
          </button>
          <button
            type="button"
            className={styles.optimizeBtn}
            onClick={handleOptimize}
            disabled={loading || !queryInput.trim()}
          >
            <Sparkles size={14} />
            <span>Sorguyu Optimize Et</span>
          </button>
        </div>
      </div>

      {/* Editors Comparison Grid */}
      <div className={styles.editorsGrid}>
        {/* Left: Original Query */}
        <div className={styles.editorCard}>
          <div className={styles.editorHeader}>
            <span className={styles.editorTitle}>
              <Code2 size={15} color="var(--text-muted)" />
              Orijinal T-SQL Sorgusu
            </span>
            <span className={`${styles.editorBadge} ${styles.badgeOrig}`}>Girdi (Orijinal)</span>
          </div>
          <textarea
            className={styles.queryTextarea}
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Analiz edilmesini istediğiniz T-SQL sorgusunu buraya yapıştırın..."
          />
        </div>

        {/* Right: Rewritten Query */}
        <div className={styles.editorCard}>
          <div className={styles.editorHeader}>
            <span className={styles.editorTitle}>
              <Sparkles size={15} color="#10b981" />
              Optimize Edilmiş T-SQL (Rewritten)
            </span>
            {response && response.rewritten_query && (
              <button
                type="button"
                className={styles.copyCodeBtn}
                onClick={() => handleCopy(response.rewritten_query)}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Kopyalandı!' : 'Optimize Kodu Kopyala'}</span>
              </button>
            )}
          </div>
          <div className={styles.optimizedResultBox}>
            {loading ? (
              <LoadingSpinner message="Anti-pattern kuralları taranıyor ve optimize T-SQL türetiliyor..." />
            ) : response?.rewritten_query ? (
              response.rewritten_query
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                Sorguyu analiz etmek ve yeniden yazılmış versiyonunu görmek için yukarıdaki "Sorguyu Optimize Et" butonuna tıklayın.
              </span>
            )}
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={handleOptimize} />}

      {/* Anti-Patterns & Explanation Section */}
      {response && (
        <div className={styles.resultsSection}>
          <div className={styles.resultsHeader}>
            <h4 className={styles.resultsTitle}>
              Tespit Edilen Anti-Pattern ve Optimizasyon Fırsatları ({response.anti_patterns_found})
            </h4>
            {response.estimated_improvement_pct > 0 && (
              <div className={styles.improvementPill}>
                <Sparkles size={13} />
                <span>~%{Math.round(response.estimated_improvement_pct)} Tahmini I/O İyileşmesi</span>
              </div>
            )}
          </div>

          <div className={styles.patternsGrid}>
            {response.detected_patterns.length === 0 ? (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '16px',
                  borderRadius: '8px',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                }}
              >
                <CheckCircle size={16} />
                <span>Sorguda belirgin bir performans anti-pattern'ı tespit edilmedi. Sözdizimi temiz ve indeks uyumlu görünüyor.</span>
              </div>
            ) : (
              response.detected_patterns.map((item, idx) => (
                <div key={idx} className={`${styles.patternCard} ${getCardBorderClass(item.severity)}`}>
                  <div className={styles.patternTop}>
                    <div className={styles.patternMeta}>
                      <span className={styles.ruleIdBadge}>{item.rule_id}</span>
                      <span className={styles.categoryTag}>{item.category}</span>
                      <span className={`${styles.severityTag} ${getSeverityClass(item.severity)}`}>
                        {item.severity}
                      </span>
                    </div>
                    <h5 className={styles.patternTitle}>{item.title}</h5>
                  </div>

                  <div className={styles.diffRow}>
                    <div className={styles.diffCol}>
                      <span className={styles.diffLabel}>Kötü / Yavaş Fragman:</span>
                      <span className={styles.fragBefore}>{item.original_fragment}</span>
                    </div>
                    <div className={styles.diffCol}>
                      <span className={styles.diffLabel}>Önerilen Hızlı Alternatif:</span>
                      <span className={styles.fragAfter}>{item.suggested_fragment}</span>
                    </div>
                  </div>

                  <p className={styles.patternExplanation}>{item.explanation}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
