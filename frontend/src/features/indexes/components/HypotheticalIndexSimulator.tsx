import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  Copy,
  Check,
  CheckCircle,
  AlertTriangle,
  Database,
  Layers,
  Sparkles,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import { simulateHypotheticalIndex } from '../../../lib/api';
import type { HypotheticalSimulationResult } from '../../../lib/types';
import styles from './HypotheticalIndexSimulator.module.css';

interface HypotheticalIndexSimulatorProps {
  initialDb?: string;
}

const SAMPLE_QUERY = `SELECT o.CustomerID, o.OrderDate, o.TotalAmount
FROM dbo.Orders o
WHERE o.CustomerID = 4500
  AND o.OrderDate >= '2026-01-01'
ORDER BY o.TotalAmount DESC;`;

export default function HypotheticalIndexSimulator({ initialDb }: HypotheticalIndexSimulatorProps) {
  const [dbName, setDbName] = useState<string>(initialDb || 'master');
  const [tableName, setTableName] = useState<string>('Orders');
  const [keyCols, setKeyCols] = useState<string>('CustomerID, OrderDate');
  const [incCols, setIncCols] = useState<string>('TotalAmount');
  const [queryText, setQueryText] = useState<string>(SAMPLE_QUERY);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HypotheticalSimulationResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleSimulate = async () => {
    if (!tableName.trim() || !keyCols.trim() || !queryText.trim()) return;
    try {
      setLoading(true);
      setError(null);

      const keysArray = keyCols.split(',').map((k) => k.trim()).filter(Boolean);
      const incsArray = incCols ? incCols.split(',').map((k) => k.trim()).filter(Boolean) : [];

      const res = await simulateHypotheticalIndex({
        database: dbName,
        table_name: tableName,
        key_columns: keysArray,
        include_columns: incsArray,
        test_query: queryText,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Sanal indeks simülasyonu çalıştırılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLoadSample = () => {
    setTableName('Orders');
    setKeyCols('CustomerID, OrderDate');
    setIncCols('TotalAmount');
    setQueryText(SAMPLE_QUERY);
  };

  return (
    <div className={styles.container}>
      {/* Top Banner */}
      <div className={styles.topBanner}>
        <div className={styles.bannerLeft}>
          <div className={styles.flaskIconBox}>
            <FlaskConical size={24} />
          </div>
          <div className={styles.bannerTitles}>
            <h3 className={styles.bannerTitle}>
              "What-If" Hipotetik (Sanal) İndeks Simülasyon Laboratuvarı
            </h3>
            <p className={styles.bannerDesc}>
              Diske tek bir bayt veri yazmadan (zero-disk impact), SQL Server'ın gizli <code>WITH STATISTICS_ONLY = -1</code> motoruyla aday indeksin sorgunuzu ne kadar hızlandıracağını canlı test edin.
            </p>
          </div>
        </div>

        <div className={styles.zeroDiskBadge}>
          <ShieldCheck size={14} />
          <span>Sıfır Disk Tahsisi • %100 Güvenli</span>
        </div>
      </div>

      {/* Form Input Grid */}
      <div className={styles.formGrid}>
        {/* Left: Index Configuration */}
        <div className={styles.formCard}>
          <h4 className={styles.cardTitle}>
            <Layers size={15} color="var(--accent-primary, #3b82f6)" />
            Aday İndeks Parametreleri
          </h4>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Hedef Veritabanı:</label>
            <input
              type="text"
              className={styles.textInput}
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="Örn: ProductionDB"
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Hedef Tablo:</label>
            <input
              type="text"
              className={styles.textInput}
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Örn: Orders"
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Anahtar Kolonlar (Key Columns):</label>
            <input
              type="text"
              className={styles.textInput}
              value={keyCols}
              onChange={(e) => setKeyCols(e.target.value)}
              placeholder="Virgülle ayırın: CustomerID, OrderDate"
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Kapsanan Kolonlar (INCLUDE Columns):</label>
            <input
              type="text"
              className={styles.textInput}
              value={incCols}
              onChange={(e) => setIncCols(e.target.value)}
              placeholder="Opsiyonel: TotalAmount, OrderID"
            />
          </div>

          <button
            type="button"
            className={styles.runBtn}
            onClick={handleSimulate}
            disabled={loading || !tableName.trim() || !keyCols.trim()}
          >
            <Play size={14} />
            <span>Simülasyonu Başlat</span>
          </button>
        </div>

        {/* Right: Target Query Textarea */}
        <div className={styles.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 className={styles.cardTitle}>
              <Database size={15} color="var(--accent-primary, #3b82f6)" />
              Test Edilecek T-SQL Sorgusu
            </h4>
            <button
              type="button"
              className={styles.copySqlBtn}
              onClick={handleLoadSample}
              title="Örnek alanları doldur"
            >
              <RotateCcw size={12} />
              <span>Örnek Doldur</span>
            </button>
          </div>

          <textarea
            className={styles.queryTextarea}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Aday indeksin hızlandırmasını istediğiniz SELECT sorgusunu buraya yapıştırın..."
          />
        </div>
      </div>

      {loading && <LoadingSpinner message="Sanal indeks istatistikleri oluşturuluyor ve ShowPlan maliyet düşüşü ölçülüyor..." />}
      {error && <ErrorState message={error} onRetry={handleSimulate} />}

      {/* Simulation Results View */}
      {result && (
        <div className={styles.resultCard}>
          <div
            className={`${styles.verdictBanner} ${
              result.cost_reduction_pct > 0 ? styles.verdictSuccess : styles.verdictNeutral
            }`}
          >
            {result.cost_reduction_pct > 0 ? (
              <CheckCircle size={20} style={{ flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            )}
            <div>{result.verdict}</div>
          </div>

          <div className={styles.metricsGrid}>
            <div className={styles.metricBox}>
              <span className={styles.metricLabel}>Mevcut Maliyet (Baseline)</span>
              <span className={styles.metricVal}>{result.baseline_cost.toFixed(4)}</span>
              <span className={styles.metricSub}>Erişim: {result.operator_before}</span>
            </div>

            <div className={styles.metricBox}>
              <span className={styles.metricLabel}>Sanal İndeksli Maliyet</span>
              <span className={styles.metricVal} style={{ color: '#10b981' }}>
                {result.simulated_cost.toFixed(4)}
              </span>
              <span className={styles.metricSub}>Erişim: {result.operator_after}</span>
            </div>

            <div className={styles.metricBox}>
              <span className={styles.metricLabel}>Maliyet Düşüş Oranı</span>
              <span
                className={styles.metricVal}
                style={{ color: result.cost_reduction_pct > 0 ? '#10b981' : 'var(--text-muted)' }}
              >
                %{result.cost_reduction_pct.toFixed(1)}
              </span>
              <span className={styles.metricSub}>
                {result.index_used_by_optimizer ? 'Optimizer Tarafından Seçildi' : 'Kullanılmadı'}
              </span>
            </div>
          </div>

          <div className={styles.realSqlBox}>
            <div className={styles.realSqlHeader}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Canlı Ortam İçin Gerçek CREATE INDEX Betiği
              </span>
              <button
                type="button"
                className={styles.copySqlBtn}
                onClick={() => handleCopy(result.real_create_index_tsql)}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Kopyalandı!' : 'Komutu Kopyala'}</span>
              </button>
            </div>
            <CodeBlock code={result.real_create_index_tsql} language="sql" />
          </div>
        </div>
      )}
    </div>
  );
}
