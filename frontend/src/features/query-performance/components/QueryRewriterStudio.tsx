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
  Terminal,
  ShieldAlert,
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

interface QueryHintOption {
  hint: string;
  label: string;
  desc: string;
}

const HINT_OPTIONS: QueryHintOption[] = [
  {
    hint: 'OPTION (RECOMPILE)',
    label: 'Anlık Yeniden Derleme (RECOMPILE)',
    desc: 'Parameter Sniffing sorununu çözer. Her çağrıda parametreye özel anlık optimal plan üretir.',
  },
  {
    hint: 'OPTION (OPTIMIZE FOR UNKNOWN)',
    label: 'Ortalama İstatistik Modeli (OPTIMIZE FOR UNKNOWN)',
    desc: 'Uç değer (skewed) veri dağılımında ortalama yoğunluk kullanarak tahmin sapmasını önler.',
  },
  {
    hint: 'OPTION (MAXDOP 1)',
    label: 'Tek Çekirdeğe Kilitle (MAXDOP 1)',
    desc: 'Sorgunun tüm CPU çekirdeklerini tüketmesini ve CXPACKET darboğazını engeller.',
  },
  {
    hint: 'OPTION (MAXDOP 4)',
    label: 'Kontrollü Paralellik (MAXDOP 4)',
    desc: 'CPU fırtınasını dizginler, sorguyu en fazla 4 çekirdekle sınırlar.',
  },
  {
    hint: 'OPTION (FAST 50)',
    label: 'Hızlı İlk 50 Kayıt (FAST 50)',
    desc: 'UI/Grid sayfalamalarında ilk 50 kaydın gecikmesiz ekrana dönmesini sağlar.',
  },
  {
    hint: "OPTION (USE HINT('FORCE_LEGACY_CARDINALITY_ESTIMATION'))",
    label: 'Eski Kardinalite Motoru (Legacy CE)',
    desc: 'SQL Server 2014+ yeni CE motorunun yaptığı yanlış tahminleri eski stabil motora geri çeker.',
  },
];

export default function QueryRewriterStudio() {
  const [mode, setMode] = useState<'REWRITE' | 'PLAN_GUIDE'>('REWRITE');
  const [queryInput, setQueryInput] = useState<string>(SAMPLE_BAD_QUERY);
  const [response, setResponse] = useState<RewriteQueryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedGuide, setCopiedGuide] = useState<boolean>(false);

  // Plan Guide state
  const [guideName, setGuideName] = useState<string>('PG_Orders_ParamSniffingFix');
  const [selectedHint, setSelectedHint] = useState<string>('OPTION (OPTIMIZE FOR UNKNOWN)');

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

  const handleCopyGuide = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedGuide(true);
    setTimeout(() => setCopiedGuide(false), 2500);
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

  // Generate Plan Guide T-SQL
  const cleanStatement = queryInput.trim().replace(/'/g, "''");
  const generatedPlanGuideScript = `-- =========================================================================
-- PLAN GUIDE OLUŞTURMA BETİĞİ (Vendor / Paket Yazılım Uyumlu)
-- Uygulama kodunu değiştirmeden SQL Server motoruna enjekte edilir.
-- =========================================================================
EXEC sp_create_plan_guide
    @name = N'${guideName}',
    @stmt = N'${cleanStatement}',
    @type = N'SQL',
    @module_or_batch = NULL,
    @params = NULL,
    @hints = N'${selectedHint}';
GO

-- Plan Guide Durumunu Kontrol Et:
SELECT name, is_disabled, query_text, hints 
FROM sys.plan_guides 
WHERE name = N'${guideName}';
GO

-- Geri Alma (Rollback / Silme) İhtiyacı Durumunda:
-- EXEC sp_control_plan_guide @operation = N'DROP', @name = N'${guideName}';
-- GO`;

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
              Akıllı T-SQL Sorgu İyileştirici &amp; Plan Guide Stüdyosu
            </h3>
            <p className={styles.bannerDesc}>
              Sorgudaki non-SARGable fonksiyonları, geniş projeksiyonları tespit eder; doğrudan optimize T-SQL veya paket yazılımlar (ERP) için kod değiştirmeden çalışan <strong>Plan Guide</strong> üretir.
            </p>
          </div>
        </div>

        <div className={styles.bannerActions}>
          <div className={styles.modeTabs}>
            <button
              type="button"
              className={`${styles.modeTabBtn} ${mode === 'REWRITE' ? styles.modeTabBtnActive : ''}`}
              onClick={() => setMode('REWRITE')}
            >
              <Sparkles size={13} />
              <span>T-SQL Yeniden Yazım</span>
            </button>
            <button
              type="button"
              className={`${styles.modeTabBtn} ${mode === 'PLAN_GUIDE' ? styles.modeTabBtnActive : ''}`}
              onClick={() => setMode('PLAN_GUIDE')}
            >
              <Terminal size={13} />
              <span>Plan Guide Üretici</span>
            </button>
          </div>

          {mode === 'REWRITE' && (
            <>
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
            </>
          )}
        </div>
      </div>

      {mode === 'REWRITE' ? (
        <>
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
        </>
      ) : (
        /* Plan Guide Generator Mode */
        <div className={styles.planGuideContainer}>
          <div className={styles.planGuideConfigCard}>
            <div className={styles.configRow}>
              <span className={styles.configLabel}>Plan Guide Adı:</span>
              <input
                type="text"
                className={styles.guideNameInput}
                value={guideName}
                onChange={(e) => setGuideName(e.target.value)}
                placeholder="Örn: PG_Orders_Fix"
              />
            </div>

            <div className={styles.configRow} style={{ alignItems: 'flex-start' }}>
              <span className={styles.configLabel} style={{ marginTop: '6px' }}>Hedef Sorgu İpucu (Hint):</span>
              <div className={styles.hintsGrid}>
                {HINT_OPTIONS.map((opt) => (
                  <div
                    key={opt.hint}
                    className={`${styles.hintCard} ${selectedHint === opt.hint ? styles.hintCardActive : ''}`}
                    onClick={() => setSelectedHint(opt.hint)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className={styles.hintCode}>{opt.label}</span>
                    <span className={styles.hintDesc}>{opt.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Generated Plan Guide Script */}
          <div className={styles.generatedScriptBlock}>
            <div className={styles.scriptHeader}>
              <span>SQL Server Motoruna Doğrudan Uygulanacak Betik</span>
              <button
                type="button"
                className={styles.copyCodeBtn}
                onClick={() => handleCopyGuide(generatedPlanGuideScript)}
              >
                {copiedGuide ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedGuide ? 'Kopyalandı!' : 'Betiği Kopyala'}</span>
              </button>
            </div>
            <pre className={styles.scriptPre}>{generatedPlanGuideScript}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
