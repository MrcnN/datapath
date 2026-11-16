import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  Layers,
  ShieldAlert,
  Clock,
  Flame,
  Check,
  Copy,
  Search,
  RefreshCw,
  X,
  ChevronRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Zap,
} from 'lucide-react';
import { getMemoryGrantsAnalysis } from '../../../lib/api';
import type {
  MemoryGrantResponse,
  LiveMemoryGrantItem,
  HistoricalMemoryWasterItem,
} from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import styles from './MemoryGrantStudio.module.css';

export default function MemoryGrantStudio() {
  const [data, setData] = useState<MemoryGrantResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'LIVE' | 'HISTORICAL'>('LIVE');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLive, setSelectedLive] = useState<LiveMemoryGrantItem | null>(null);
  const [selectedHist, setSelectedHist] = useState<HistoricalMemoryWasterItem | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMemoryGrantsAnalysis();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Bellek tahsis telemetrisi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLive = useMemo(() => {
    if (!data?.live_grants) return [];
    return data.live_grants.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        String(item.session_id).includes(searchQuery) ||
        item.query_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.status.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [data?.live_grants, searchQuery]);

  const filteredHist = useMemo(() => {
    if (!data?.historical_wasters) return [];
    return data.historical_wasters.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        item.query_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.diagnostic_verdict.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [data?.historical_wasters, searchQuery]);

  if (loading && !data) {
    return <LoadingSpinner message="sys.dm_exec_query_memory_grants ve kaynak semaforları taranıyor..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const summary = data?.summary;
  const isStarving = summary?.has_memory_starvation;

  return (
    <div className={styles.studio}>
      {/* Studio Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Bellek Tahsisleri &amp; RESOURCE_SEMAPHORE Darboğazı</h2>
            <span className={styles.badgeLive}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Canlı Workspace Telemetrisi
            </span>
          </div>
          <p className={styles.subtitle}>
            Sorgu yürütme çalışma belleğini (Workspace Memory), kuyrukta bekleyen RESOURCE_SEMAPHORE oturumlarını ve
            kardinalite sapmasından dolayı belleği israf eden veya TempDB'ye taşan sorguları adli düzeyde analiz eder.
          </p>
        </div>

        <div className={styles.actionsArea}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={fetchData}
            title="Telemetriyi Yenile"
          >
            <RefreshCw size={13} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard} data-status="optimal">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Toplam Workspace Bellek</span>
            <div className={styles.kpiIconWrap}>
              <Layers size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary?.total_workspace_memory_mb.toLocaleString()} MB
          </div>
          <span className={styles.kpiDesc}>Sorgu sıralama/hash işlemleri için ayrılan havuz</span>
        </div>

        <div className={styles.kpiCard} data-status="optimal">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Kullanılabilir Boş Bellek</span>
            <div className={styles.kpiIconWrap} style={{ color: '#10b981' }}>
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary?.available_workspace_memory_mb.toLocaleString()} MB
          </div>
          <span className={styles.kpiDesc}>Yeni sorgulara tahsis edilebilecek boş çalışma belleği</span>
        </div>

        <div className={styles.kpiCard} data-status="optimal">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Aktif Bellek Alan Sorgular</span>
            <div className={styles.kpiIconWrap}>
              <Activity size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary?.active_grants_count || 0}
          </div>
          <span className={styles.kpiDesc}>Şu anda belleği rezerve etmiş çalışan sorgu sayısı</span>
        </div>

        <div
          className={styles.kpiCard}
          data-status={isStarving ? 'critical' : 'optimal'}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>RESOURCE_SEMAPHORE Kuyruğu</span>
            <div className={styles.kpiIconWrap} style={{ color: isStarving ? '#ef4444' : undefined }}>
              <ShieldAlert size={14} />
            </div>
          </div>
          <div className={styles.kpiVal} style={{ color: isStarving ? '#ef4444' : undefined }}>
            {summary?.queued_waiters_count || 0}
          </div>
          <span className={styles.kpiDesc}>
            {isStarving ? 'Kritik: Bellek yetersizliği nedeniyle kuyrukta bekleyen sorgular var!' : 'Kuyrukta bekleyen oturum yok; bellek akışı sağlıklı'}
          </span>
        </div>
      </div>

      {/* Resource Semaphores Gauge Visualizer */}
      {data?.semaphores && data.semaphores.length > 0 && (
        <div className={styles.semaphoreGrid}>
          {data.semaphores.map((sem, idx) => {
            const isSmall = sem.semaphore_id === 1;
            const isHigh = sem.utilization_pct >= 80;

            return (
              <div key={idx} className={styles.semaphoreCard}>
                <div className={styles.semHeader}>
                  <span className={styles.semTitle}>
                    {isSmall ? 'Semafor #1 (Küçük Sorgular Havuzu)' : 'Semafor #0 (Normal / Ağır Sorgu Havuzu)'}
                  </span>
                  <span className={styles.semMeta}>
                    %{sem.utilization_pct.toFixed(1)} Doluluk
                  </span>
                </div>

                <div className={styles.gaugeBar}>
                  <div
                    className={styles.gaugeFill}
                    style={{
                      width: `${Math.min(100, sem.utilization_pct)}%`,
                      background: isHigh ? '#ef4444' : sem.utilization_pct > 50 ? '#f59e0b' : '#3b82f6',
                    }}
                  />
                </div>

                <div className={styles.semStatsRow}>
                  <span>Verilen: {sem.granted_memory_mb} MB / {sem.total_memory_mb} MB</span>
                  <span>Aktif: {sem.grantee_count} &bull; Bekleyen: {sem.waiter_count}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-View Switcher & Filter Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.viewGroup}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeSubTab === 'LIVE' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveSubTab('LIVE')}
          >
            <Activity size={13} />
            <span>Canlı Bellek Tahsisleri &amp; Kuyruk ({data?.live_grants.length || 0})</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeSubTab === 'HISTORICAL' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveSubTab('HISTORICAL')}
          >
            <Flame size={13} />
            <span>Tarihsel Bellek İsrafı &amp; Taşmalar (Plan Cache)</span>
          </button>
        </div>

        <div className={styles.searchBox}>
          <Search size={14} color="var(--text-tertiary)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={activeSubTab === 'LIVE' ? 'SPID, durum veya SQL ara...' : 'Sorgu metni veya teşhis ara...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table: Live Memory Grants */}
      {activeSubTab === 'LIVE' && (
        <div className={styles.tableCard}>
          {filteredLive.length === 0 ? (
            <EmptyState
              title="Aktif Bellek Kuyruğu Bulunmuyor"
              description="Şu anda SQL Server üzerinde bellek tahsisi (memory grant) talep eden veya RESOURCE_SEMAPHORE kuyruğunda bekleyen oturum tespit edilmedi."
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>SPID &amp; DOP</th>
                    <th>Durum</th>
                    <th>Talep / Verilen (MB)</th>
                    <th>Fiili Kullanım</th>
                    <th>Maliyet (Cost)</th>
                    <th>Bekleme</th>
                    <th>Sorgu Önizleme</th>
                    <th style={{ textAlign: 'right' }}>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLive.map((item, idx) => {
                    const isWaiting = item.status.includes('WAITING');
                    return (
                      <tr key={`${item.session_id}-${item.request_id}-${idx}`}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                              SPID {item.session_id}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                              DOP: {item.dop} &bull; Sched #{item.scheduler_id}
                            </span>
                          </div>
                        </td>
                        <td>
                          {isWaiting ? (
                            <span className={styles.badgeWaiting}>
                              <Clock size={11} /> Bekliyor
                            </span>
                          ) : (
                            <span className={styles.badgeGranted}>
                              <CheckCircle2 size={11} /> Verildi
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className={styles.numVal}>
                              {item.granted_memory_mb} MB Verildi
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                              {item.requested_memory_mb} MB Talep
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className={styles.numVal}>
                              {item.max_used_memory_mb} MB Maks
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                              {item.used_memory_mb} MB Anlık
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={styles.numVal}>{item.query_cost.toFixed(1)}</span>
                        </td>
                        <td>
                          <span
                            className={styles.numVal}
                            style={{ color: item.wait_time_ms > 0 ? '#ef4444' : 'var(--text-primary)' }}
                          >
                            {item.wait_time_ms} ms
                          </span>
                        </td>
                        <td>
                          <div className={styles.queryCell}>
                            <code className={styles.querySnippet} title={item.query_text}>
                              {item.query_text || '(Canlı sorgu metni taranıyor)'}
                            </code>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className={styles.btnInspect}
                            onClick={() => setSelectedLive(item)}
                          >
                            <span>Detay</span>
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
      )}

      {/* Table: Historical Wasters & Spills */}
      {activeSubTab === 'HISTORICAL' && (
        <div className={styles.tableCard}>
          {filteredHist.length === 0 ? (
            <EmptyState
              title="Bellek İsrafı Kaydı Bulunamadı"
              description="Plan önbelleğinde belirgin bellek israfına veya TempDB taşmasına yol açan sorgu kaydı mevcut değil."
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Sorgu</th>
                    <th>Yürütme</th>
                    <th>Verilen Bellek</th>
                    <th>Fiili Kullanım</th>
                    <th>İsraf Oranı</th>
                    <th>TempDB Taşma</th>
                    <th style={{ textAlign: 'right' }}>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHist.map((item, idx) => {
                    const isHighWaste = item.wasted_grant_pct >= 75.0;
                    const hasSpill = item.total_spills > 0;

                    return (
                      <tr key={idx}>
                        <td>
                          <div className={styles.queryCell}>
                            <code className={styles.querySnippet} title={item.query_text}>
                              {item.query_text}
                            </code>
                          </div>
                        </td>
                        <td>
                          <span className={styles.numVal}>{item.execution_count.toLocaleString()}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className={styles.numVal}>{item.max_grant_mb} MB Maks</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                              {item.avg_grant_mb} MB Ort.
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className={styles.numVal}>{item.max_used_grant_mb} MB Maks</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                              {item.avg_used_grant_mb} MB Ort.
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={styles.numVal}
                            style={{
                              color: isHighWaste ? '#ef4444' : 'var(--text-primary)',
                              fontWeight: isHighWaste ? 700 : 500,
                            }}
                          >
                            %{item.wasted_grant_pct.toFixed(1)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={styles.numVal}
                            style={{
                              color: hasSpill ? '#f59e0b' : 'var(--text-tertiary)',
                              fontWeight: hasSpill ? 700 : 400,
                            }}
                          >
                            {item.total_spills > 0 ? `${item.total_spills} spill` : '0'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className={styles.btnInspect}
                            onClick={() => setSelectedHist(item)}
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
      )}

      {/* Live Grant Drawer */}
      {selectedLive && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedLive(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitleArea}>
                <h3 className={styles.drawerTitle}>Canlı Bellek Tahsisi: SPID {selectedLive.session_id}</h3>
                <span className={styles.drawerSub}>
                  Durum: {selectedLive.status} &bull; DOP: {selectedLive.dop} &bull; Maliyet: {selectedLive.query_cost}
                </span>
              </div>
              <button
                type="button"
                className={styles.btnClose}
                onClick={() => setSelectedLive(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              <div className={styles.verdictBox}>
                <span className={styles.verdictTitle}>
                  <Info size={14} color="var(--accent)" />
                  Darboğaz Teşhisi ve İpucu
                </span>
                <p className={styles.verdictText}>{selectedLive.remediation_hint}</p>
              </div>

              <div className={styles.metricsGrid}>
                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Verilen Bellek</span>
                  <span className={styles.metricBlockVal}>{selectedLive.granted_memory_mb} MB</span>
                  <span className={styles.metricBlockSub}>{selectedLive.requested_memory_mb} MB talep edildi</span>
                </div>

                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Kullanılan Maksimum</span>
                  <span className={styles.metricBlockVal}>{selectedLive.max_used_memory_mb} MB</span>
                  <span className={styles.metricBlockSub}>{selectedLive.used_memory_mb} MB anlık kullanım</span>
                </div>

                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Bekleme Süresi</span>
                  <span className={styles.metricBlockVal} style={{ color: selectedLive.wait_time_ms > 0 ? '#ef4444' : undefined }}>
                    {selectedLive.wait_time_ms} ms
                  </span>
                  <span className={styles.metricBlockSub}>RESOURCE_SEMAPHORE kuyruğunda</span>
                </div>

                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Optimizer İdeal Tahmini</span>
                  <span className={styles.metricBlockVal}>{selectedLive.ideal_memory_mb} MB</span>
                  <span className={styles.metricBlockSub}>Gereken asgari: {selectedLive.required_memory_mb} MB</span>
                </div>
              </div>

              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span className={styles.codeTitle}>Çalışan SQL Metni</span>
                  <button
                    type="button"
                    className={styles.btnCopy}
                    onClick={() => handleCopyCode(selectedLive.query_text)}
                  >
                    {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
                  </button>
                </div>
                <pre className={styles.codeContent}>{selectedLive.query_text || '-- SQL metni bulunamadı.'}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Waster Drawer */}
      {selectedHist && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedHist(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitleArea}>
                <h3 className={styles.drawerTitle}>Bellek İsrafı &amp; Kardinalite Teşhisi</h3>
                <span className={styles.drawerSub}>
                  Toplam {selectedHist.execution_count} yürütme &bull; İsraf Oranı: %{selectedHist.wasted_grant_pct.toFixed(1)}
                </span>
              </div>
              <button
                type="button"
                className={styles.btnClose}
                onClick={() => setSelectedHist(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              <div className={styles.verdictBox}>
                <span className={styles.verdictTitle}>
                  <AlertTriangle size={14} color="var(--accent)" />
                  Kardinalite ve İstatistik Teşhisi
                </span>
                <p className={styles.verdictText}>{selectedHist.diagnostic_verdict}</p>
              </div>

              <div className={styles.metricsGrid}>
                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Verilen Maksimum Bellek</span>
                  <span className={styles.metricBlockVal} style={{ color: '#ef4444' }}>
                    {selectedHist.max_grant_mb} MB
                  </span>
                  <span className={styles.metricBlockSub}>Ortalama: {selectedHist.avg_grant_mb} MB</span>
                </div>

                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Fiilen Kullanılan Bellek</span>
                  <span className={styles.metricBlockVal} style={{ color: '#10b981' }}>
                    {selectedHist.max_used_grant_mb} MB
                  </span>
                  <span className={styles.metricBlockSub}>Ortalama: {selectedHist.avg_used_grant_mb} MB</span>
                </div>
              </div>

              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span className={styles.codeTitle}>Önerilen Düzeltme Betiği (Review-Only)</span>
                  <button
                    type="button"
                    className={styles.btnCopy}
                    onClick={() => handleCopyCode(selectedHist.remediation_tsql)}
                  >
                    {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{copied ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
                  </button>
                </div>
                <pre className={styles.codeContent}>{selectedHist.remediation_tsql}</pre>
              </div>

              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span className={styles.codeTitle}>Sorgu Metni</span>
                </div>
                <pre className={styles.codeContent}>{selectedHist.query_text}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
