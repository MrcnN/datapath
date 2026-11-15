import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  FileCode,
  Copy,
  Check,
  Search,
  RefreshCw,
  X,
  ChevronRight,
  Info,
  Server,
  Database,
  Layers,
} from 'lucide-react';
import { getConfigurationDrift } from '../../../lib/api';
import type {
  ConfigDriftResponse,
  ConfigDriftItem,
} from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import styles from './ConfigDriftStudio.module.css';

export default function ConfigDriftStudio() {
  const [data, setData] = useState<ConfigDriftResponse | null>(null);
  const [selectedBaseline, setSelectedBaseline] = useState<string>('ENTERPRISE_PROD_STANDARD');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Modals
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedItem, setSelectedItem] = useState<ConfigDriftItem | null>(null);
  const [showRunbookModal, setShowRunbookModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchData = async (baseline: string = selectedBaseline) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getConfigurationDrift(baseline);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Konfigürasyon sapması verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedBaseline);
  }, [selectedBaseline]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        item.setting_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.target_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchScope = scopeFilter === 'ALL' || item.scope === scopeFilter;

      let matchStatus = true;
      if (statusFilter === 'DRIFTED') {
        matchStatus = item.drift_status === 'DRIFTED_CRITICAL' || item.drift_status === 'DRIFTED_WARNING';
      } else if (statusFilter === 'IN_SYNC') {
        matchStatus = item.drift_status === 'IN_SYNC';
      } else if (statusFilter === 'REBOOT_REQUIRED') {
        matchStatus = item.drift_status === 'REBOOT_REQUIRED' || item.is_reboot_pending;
      }

      return matchSearch && matchScope && matchStatus;
    });
  }, [data?.items, searchQuery, scopeFilter, statusFilter]);

  if (loading && !data) {
    return <LoadingSpinner message="sp_configure ve veritabanı ayarları Golden Baseline ile karşılaştırılıyor..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={() => fetchData(selectedBaseline)} />;
  }

  const summary = data?.summary;
  const isHealthyScore = (summary?.drift_score_pct ?? 100) >= 80;

  return (
    <div className={styles.studio}>
      {/* Studio Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Konfigürasyon Sapması &amp; Drift Radarı</h2>
            <span className={styles.badgeLive}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Canlı Karşılaştırma
            </span>
          </div>
          <p className={styles.subtitle}>
            Canlı sunucu parametreleri (sp_configure) ve veritabanı seçeneklerini kurumsal altın standart (Golden Baseline) ile
            karşılaştırır; bellek/disk tutarsızlıklarını ve reboot bekleyen ayarları tespit eder.
          </p>
        </div>

        <div className={styles.actionsArea}>
          <select
            className={styles.selectBaseline}
            value={selectedBaseline}
            onChange={(e) => setSelectedBaseline(e.target.value)}
            title="Golden Baseline Profili Seç"
          >
            {data?.available_baselines.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setShowRunbookModal(true)}
          >
            <FileCode size={13} />
            <span>Tüm Düzeltme Betiği (T-SQL)</span>
          </button>

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => fetchData(selectedBaseline)}
            title="Yenile"
          >
            <RefreshCw size={13} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className={styles.kpiGrid}>
        <div
          className={styles.kpiCard}
          data-status={summary && summary.drift_score_pct >= 80 ? 'optimal' : summary && summary.drift_score_pct >= 60 ? 'warning' : 'critical'}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Baseline Uyum Skoru</span>
            <div className={styles.kpiIconWrap} style={{ color: isHealthyScore ? '#10b981' : '#ef4444' }}>
              <ShieldCheck size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            %{summary?.drift_score_pct.toFixed(1) || 100}
          </div>
          <span className={styles.kpiDesc}>
            {summary?.in_sync_count || 0} / {summary?.total_rules_evaluated || 0} kural tam senkronize
          </span>
        </div>

        <div
          className={styles.kpiCard}
          data-status={summary && summary.drifted_critical_count > 0 ? 'critical' : 'optimal'}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Kritik Sapmalar</span>
            <div className={styles.kpiIconWrap} style={{ color: summary && summary.drifted_critical_count > 0 ? '#ef4444' : undefined }}>
              <ShieldAlert size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary?.drifted_critical_count || 0}
          </div>
          <span className={styles.kpiDesc}>MAXDOP, Checksum, Auto Close gibi kritik riskler</span>
        </div>

        <div
          className={styles.kpiCard}
          data-status={summary && summary.drifted_warning_count > 0 ? 'warning' : 'optimal'}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Uyarı Seviyesi Sapma</span>
            <div className={styles.kpiIconWrap}>
              <AlertTriangle size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary?.drifted_warning_count || 0}
          </div>
          <span className={styles.kpiDesc}>Sıkıştırma, Ad-hoc önbellek ve eşik sapmaları</span>
        </div>

        <div
          className={styles.kpiCard}
          data-status={summary && summary.reboot_pending_count > 0 ? 'warning' : 'optimal'}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Reboot Bekleyen</span>
            <div className={styles.kpiIconWrap} style={{ color: summary && summary.reboot_pending_count > 0 ? '#a855f7' : undefined }}>
              <RotateCcw size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary?.reboot_pending_count || 0}
          </div>
          <span className={styles.kpiDesc}>Yapılandırılan ile bellekteki değeri farklı parametreler</span>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={14} color="var(--text-tertiary)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Parametre, kategori veya veritabanı adına göre ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <button
            type="button"
            className={`${styles.filterPill} ${scopeFilter === 'ALL' ? styles.filterPillActive : ''}`}
            onClick={() => setScopeFilter('ALL')}
          >
            Tüm Kapsamlar ({data?.items.length || 0})
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${scopeFilter === 'SERVER' ? styles.filterPillActive : ''}`}
            onClick={() => setScopeFilter('SERVER')}
          >
            Sunucu (sp_configure)
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${scopeFilter === 'DATABASE' ? styles.filterPillActive : ''}`}
            onClick={() => setScopeFilter('DATABASE')}
          >
            Veritabanı Seçenekleri
          </button>

          <span style={{ color: 'var(--border-color)', margin: '0 4px' }}>|</span>

          <button
            type="button"
            className={`${styles.filterPill} ${statusFilter === 'ALL' ? styles.filterPillActive : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Tüm Durumlar
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${statusFilter === 'DRIFTED' ? styles.filterPillActive : ''}`}
            onClick={() => setStatusFilter('DRIFTED')}
          >
            Sapmalar ({((summary?.drifted_critical_count || 0) + (summary?.drifted_warning_count || 0))})
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${statusFilter === 'IN_SYNC' ? styles.filterPillActive : ''}`}
            onClick={() => setStatusFilter('IN_SYNC')}
          >
            Senkronize ({summary?.in_sync_count || 0})
          </button>
        </div>
      </div>

      {/* Comparison Matrix Table */}
      <div className={styles.tableCard}>
        {filteredItems.length === 0 ? (
          <EmptyState
            title="Eşleşen Konfigürasyon Bulunamadı"
            description="Seçilen filtre kriterlerine veya arama sorgusuna uyan konfigürasyon parametresi bulunamadı."
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Parametre &amp; Kapsam</th>
                  <th>Kategori</th>
                  <th>Golden Baseline (Hedef)</th>
                  <th>Mevcut Değer</th>
                  <th>Bellekte Koşan</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'right' }}>Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const isSync = item.drift_status === 'IN_SYNC';
                  const isCritical = item.drift_status === 'DRIFTED_CRITICAL';
                  const isWarning = item.drift_status === 'DRIFTED_WARNING';
                  const isReboot = item.drift_status === 'REBOOT_REQUIRED';

                  return (
                    <tr key={`${item.scope}-${item.target_name}-${item.setting_name}-${idx}`}>
                      <td>
                        <div className={styles.settingCell}>
                          <span className={styles.settingName}>{item.setting_name}</span>
                          <span className={styles.settingScope}>
                            <span className={styles.scopeTag}>
                              {item.scope === 'SERVER' ? <Server size={10} style={{ display: 'inline', marginRight: 3 }} /> : <Database size={10} style={{ display: 'inline', marginRight: 3 }} />}
                              {item.target_name}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {item.category}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.valMono} ${styles.valTarget}`}>
                          {item.baseline_value}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.valMono} ${isSync ? styles.valCurrentSync : styles.valCurrentDrift}`}>
                          {item.current_value}
                        </span>
                      </td>
                      <td>
                        <span className={styles.valMono}>
                          {item.in_memory_value}
                          {item.is_reboot_pending && (
                            <span style={{ color: '#a855f7', marginLeft: 4 }} title="Reboot/Reconfigure Bekliyor">
                              (!)
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        {isCritical && (
                          <span className={`${styles.badgeStatus} ${styles.statusCritical}`}>
                            <ShieldAlert size={11} /> Kritik Sapma
                          </span>
                        )}
                        {isWarning && (
                          <span className={`${styles.badgeStatus} ${styles.statusWarning}`}>
                            <AlertTriangle size={11} /> Uyarı Sapması
                          </span>
                        )}
                        {isReboot && (
                          <span className={`${styles.badgeStatus} ${styles.statusReboot}`}>
                            <RotateCcw size={11} /> Reboot Gerekli
                          </span>
                        )}
                        {isSync && (
                          <span className={`${styles.badgeStatus} ${styles.statusSync}`}>
                            <ShieldCheck size={11} /> Senkronize
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={styles.btnInspect}
                          onClick={() => setSelectedItem(item)}
                        >
                          <span>İncele &amp; T-SQL</span>
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Single Item Forensic Drawer */}
      {selectedItem && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedItem(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitleArea}>
                <h3 className={styles.drawerTitle}>{selectedItem.setting_name}</h3>
                <span className={styles.drawerSub}>
                  Kapsam: {selectedItem.scope} &bull; Hedef: {selectedItem.target_name} &bull; Kategori: {selectedItem.category}
                </span>
              </div>
              <button
                type="button"
                className={styles.btnClose}
                onClick={() => setSelectedItem(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              {/* Risk Assessment Box */}
              <div className={styles.riskBox}>
                <span className={styles.riskTitle}>
                  <AlertTriangle size={14} color="var(--accent)" />
                  Risk ve Etki Analizi
                </span>
                <p className={styles.riskText}>{selectedItem.risk_assessment}</p>
              </div>

              {/* Compare Row */}
              <div className={styles.compareRow}>
                <div className={styles.compareBlock}>
                  <span className={styles.compareBlockLabel}>Golden Baseline (Hedef)</span>
                  <span className={styles.compareBlockVal} style={{ color: '#10b981' }}>
                    {selectedItem.baseline_value}
                  </span>
                </div>

                <div className={styles.compareBlock}>
                  <span className={styles.compareBlockLabel}>Mevcut Yapılandırma</span>
                  <span className={styles.compareBlockVal} style={{ color: selectedItem.drift_status === 'IN_SYNC' ? 'var(--text-primary)' : '#ef4444' }}>
                    {selectedItem.current_value}
                  </span>
                </div>

                <div className={styles.compareBlock}>
                  <span className={styles.compareBlockLabel}>Bellekte Koşan (In-Use)</span>
                  <span className={styles.compareBlockVal}>
                    {selectedItem.in_memory_value}
                  </span>
                </div>
              </div>

              {/* T-SQL Remediation Card */}
              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span className={styles.codeTitle}>Uyumlandırma T-SQL Betiği (Review-Only)</span>
                  <button
                    type="button"
                    className={styles.btnCopy}
                    onClick={() => handleCopyCode(selectedItem.remediation_tsql)}
                  >
                    {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{copied ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
                  </button>
                </div>
                <pre className={styles.codeContent}>{selectedItem.remediation_tsql}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Alignment Script Modal */}
      {showRunbookModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowRunbookModal(false)}>
          <div className={styles.drawer} style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitleArea}>
                <h3 className={styles.drawerTitle}>Tüm Konfigürasyon Sapması Düzeltme Betiği</h3>
                <span className={styles.drawerSub}>
                  Profil: {selectedBaseline} &bull; {data?.items.filter(i => i.drift_status !== 'IN_SYNC').length} adet sapma için üretildi
                </span>
              </div>
              <button
                type="button"
                className={styles.btnClose}
                onClick={() => setShowRunbookModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              <div className={styles.riskBox}>
                <span className={styles.riskTitle}>
                  <Info size={14} color="var(--accent)" />
                  DBA İnceleme &amp; Güvenlik Politikası
                </span>
                <p className={styles.riskText}>
                  Bu betik tüm sapan sp_configure seçeneklerini ve veritabanı ayarlarını seçili kurumsal standarda getirmek için
                  hazırlanmıştır. Üretim ortamında çalıştırmadan önce gözden geçirip bakım penceresinde uygulamanız önerilir.
                </p>
              </div>

              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span className={styles.codeTitle}>Düzeltme Betiği (T-SQL Runbook)</span>
                  <button
                    type="button"
                    className={styles.btnCopy}
                    onClick={() => handleCopyCode(data?.full_alignment_script || '')}
                  >
                    {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{copied ? 'Kopyalandı' : 'Tüm Betiği Kopyala'}</span>
                  </button>
                </div>
                <pre className={styles.codeContent} style={{ maxHeight: '450px' }}>
                  {data?.full_alignment_script}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
