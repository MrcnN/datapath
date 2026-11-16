import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock,
  Layers,
  ShieldAlert,
  Clock,
  Flame,
  CheckCircle2,
  Search,
  RefreshCw,
  X,
  ChevronRight,
  Info,
  AlertTriangle,
  Cpu,
} from 'lucide-react';
import { getLatchSpinlockStats } from '../../../lib/api';
import type {
  LatchSpinlockResponse,
  LatchStatItem,
  SpinlockStatItem,
} from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import styles from './LatchSpinlockStudio.module.css';

interface LatchSpinlockStudioProps {
  initialSubTab?: 'latches' | 'spinlocks';
}

export default function LatchSpinlockStudio({ initialSubTab = 'latches' }: LatchSpinlockStudioProps) {
  const [data, setData] = useState<LatchSpinlockResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'latches' | 'spinlocks'>(initialSubTab);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLatch, setSelectedLatch] = useState<LatchStatItem | null>(null);
  const [selectedSpinlock, setSelectedSpinlock] = useState<SpinlockStatItem | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLatchSpinlockStats();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Mandal ve spinlock telemetrisi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLatches = useMemo(() => {
    if (!data?.latches) return [];
    return data.latches.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        item.latch_class.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [data?.latches, searchQuery]);

  const filteredSpinlocks = useMemo(() => {
    if (!data?.spinlocks) return [];
    return data.spinlocks.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [data?.spinlocks, searchQuery]);

  if (loading && !data) {
    return <LoadingSpinner message="Mandal (latch) ve spinlock çekirdek telemetrisi alınıyor..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const summary = data?.summary;
  const isHighPressure = summary?.has_cpu_spinlock_pressure;

  return (
    <div className={styles.studio}>
      {/* Studio Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Mandal Çakışmaları &amp; Spinlock Çarpışmaları</h2>
            <span className={styles.badgeLive}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Çekirdek Telemetrisi
            </span>
          </div>
          <p className={styles.subtitle}>
            Bellek içi veri sayfaları mandallarını (sys.dm_os_latch_stats) ve CPU'yu boşa döndüren mikro kilit çarpışmalarını
            (sys.dm_os_spinlock_stats) analiz ederek görünmeyen CPU ve I/O darboğazlarını açığa çıkarır.
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
        <div
          className={styles.kpiCard}
          data-status={summary && summary.total_latch_wait_ms > 10000 ? 'warning' : 'optimal'}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Toplam Mandal Beklemesi</span>
            <div className={styles.kpiIconWrap}>
              <Clock size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary ? (summary.total_latch_wait_ms / 1000).toFixed(2) : 0}s
          </div>
          <span className={styles.kpiDesc}>Bellek içi sayfa ve nesne koruma bekleme süresi</span>
        </div>

        <div className={styles.kpiCard} data-status="optimal">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>En Yoğun Mandal Sınıfı</span>
            <div className={styles.kpiIconWrap}>
              <Layers size={14} />
            </div>
          </div>
          <div className={styles.kpiVal} style={{ fontSize: '1.1rem' }}>
            {summary?.top_latch_class || 'Yok'}
          </div>
          <span className={styles.kpiDesc}>En yüksek bekleme süresine sahip mandal kaynağı</span>
        </div>

        <div className={styles.kpiCard} data-status="optimal">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Toplam Spinlock Çarpışması</span>
            <div className={styles.kpiIconWrap}>
              <Cpu size={14} />
            </div>
          </div>
          <div className={styles.kpiVal}>
            {summary?.total_spinlock_collisions.toLocaleString() || 0}
          </div>
          <span className={styles.kpiDesc}>Kilit alırken CPU'da beklemeye düşen mikro olaylar</span>
        </div>

        <div
          className={styles.kpiCard}
          data-status={isHighPressure ? 'critical' : 'optimal'}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Yüksek CPU Tüketen Spinlock</span>
            <div className={styles.kpiIconWrap} style={{ color: isHighPressure ? '#ef4444' : undefined }}>
              <ShieldAlert size={14} />
            </div>
          </div>
          <div className={styles.kpiVal} style={{ color: isHighPressure ? '#ef4444' : undefined }}>
            {summary?.high_collision_spinlocks_count || 0}
          </div>
          <span className={styles.kpiDesc}>
            {isHighPressure ? 'Kritik: Yüksek spins/collision oranı tespit edildi!' : 'Spinlock CPU döngüsü normal seviyede'}
          </span>
        </div>
      </div>

      {/* Sub-View Switcher & Filter Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.viewGroup}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeSubTab === 'latches' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveSubTab('latches')}
          >
            <Lock size={13} />
            <span>Mandal Çakışmaları (Latches - {data?.latches.length || 0})</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeSubTab === 'spinlocks' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveSubTab('spinlocks')}
          >
            <Cpu size={13} />
            <span>Spinlock Çarpışmaları (Spinlocks - {data?.spinlocks.length || 0})</span>
          </button>
        </div>

        <div className={styles.searchBox}>
          <Search size={14} color="var(--text-tertiary)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={activeSubTab === 'latches' ? 'Mandal sınıfı veya açıklama ara...' : 'Spinlock adı veya açıklama ara...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Latches Table */}
      {activeSubTab === 'latches' && (
        <div className={styles.tableCard}>
          {filteredLatches.length === 0 ? (
            <EmptyState
              title="Mandal Beklemesi Bulunamadı"
              description="Arama kriterlerine uyan herhangi bir aktif mandal (latch) kaydı bulunamadı."
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mandal Sınıfı (Latch Class)</th>
                    <th>Bekleyen İstek</th>
                    <th>Toplam Bekleme (ms)</th>
                    <th>Ortalama (ms)</th>
                    <th>Maksimum (ms)</th>
                    <th>Durum</th>
                    <th style={{ textAlign: 'right' }}>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLatches.map((item, idx) => (
                    <tr key={`${item.latch_class}-${idx}`}>
                      <td>
                        <div className={styles.nameCell}>
                          <span className={styles.nameText}>{item.latch_class}</span>
                          <span className={styles.descText}>{item.description}</span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.numVal}>{item.waiting_requests_count.toLocaleString()}</span>
                      </td>
                      <td>
                        <span className={styles.numVal}>{item.wait_time_ms.toLocaleString()} ms</span>
                      </td>
                      <td>
                        <span className={styles.numVal}>{item.avg_wait_ms} ms</span>
                      </td>
                      <td>
                        <span className={styles.numVal}>{item.max_wait_time_ms.toLocaleString()} ms</span>
                      </td>
                      <td>
                        {item.severity === 'CRITICAL' && (
                          <span className={styles.badgeCritical}>
                            <Flame size={11} /> Kritik
                          </span>
                        )}
                        {item.severity === 'WARNING' && (
                          <span className={styles.badgeWarning}>
                            <AlertTriangle size={11} /> Uyarı
                          </span>
                        )}
                        {item.severity === 'NORMAL' && (
                          <span className={styles.badgeNormal}>
                            <CheckCircle2 size={11} /> Normal
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={styles.btnInspect}
                          onClick={() => setSelectedLatch(item)}
                        >
                          <span>Detay</span>
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Spinlocks Table */}
      {activeSubTab === 'spinlocks' && (
        <div className={styles.tableCard}>
          {filteredSpinlocks.length === 0 ? (
            <EmptyState
              title="Spinlock Kaydı Bulunamadı"
              description="Arama kriterlerine uyan herhangi bir spinlock çarpışma kaydı bulunamadı."
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Spinlock Adı</th>
                    <th>Çarpışmalar</th>
                    <th>Toplam Dönüş (Spins)</th>
                    <th>Çarpışma Başına Dönüş</th>
                    <th>Backoff / Uyuma (ms)</th>
                    <th>Durum</th>
                    <th style={{ textAlign: 'right' }}>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSpinlocks.map((item, idx) => (
                    <tr key={`${item.name}-${idx}`}>
                      <td>
                        <div className={styles.nameCell}>
                          <span className={styles.nameText}>{item.name}</span>
                          <span className={styles.descText}>{item.description}</span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.numVal}>{item.collisions.toLocaleString()}</span>
                      </td>
                      <td>
                        <span className={styles.numVal}>{item.spins.toLocaleString()}</span>
                      </td>
                      <td>
                        <span
                          className={styles.numVal}
                          style={{
                            color: item.spins_per_collision >= 50.0 ? '#ef4444' : item.spins_per_collision >= 20.0 ? '#f59e0b' : 'var(--text-primary)',
                            fontWeight: item.spins_per_collision >= 20.0 ? 700 : 500,
                          }}
                        >
                          {item.spins_per_collision.toFixed(1)}
                        </span>
                      </td>
                      <td>
                        <span className={styles.numVal}>
                          {item.backoffs.toLocaleString()} ({item.sleep_time_ms} ms)
                        </span>
                      </td>
                      <td>
                        {item.severity === 'CRITICAL' && (
                          <span className={styles.badgeCritical}>
                            <Flame size={11} /> Kritik
                          </span>
                        )}
                        {item.severity === 'WARNING' && (
                          <span className={styles.badgeWarning}>
                            <AlertTriangle size={11} /> Uyarı
                          </span>
                        )}
                        {item.severity === 'NORMAL' && (
                          <span className={styles.badgeNormal}>
                            <CheckCircle2 size={11} /> Normal
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={styles.btnInspect}
                          onClick={() => setSelectedSpinlock(item)}
                        >
                          <span>Detay</span>
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Latch Drawer */}
      {selectedLatch && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedLatch(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitleArea}>
                <h3 className={styles.drawerTitle}>{selectedLatch.latch_class}</h3>
                <span className={styles.drawerSub}>Mandal Sınıfı Adli Analizi</span>
              </div>
              <button
                type="button"
                className={styles.btnClose}
                onClick={() => setSelectedLatch(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              <div className={styles.verdictBox}>
                <span className={styles.verdictTitle}>
                  <Info size={14} color="var(--accent)" />
                  Mandalın Amacı ve İşlevi
                </span>
                <p className={styles.verdictText}>{selectedLatch.description}</p>
              </div>

              <div className={styles.verdictBox} style={{ borderLeftColor: '#10b981' }}>
                <span className={styles.verdictTitle} style={{ color: '#10b981' }}>
                  <CheckCircle2 size={14} />
                  DBA İyileştirme Tavsiyesi
                </span>
                <p className={styles.verdictText}>{selectedLatch.remediation_hint}</p>
              </div>

              <div className={styles.metricsGrid}>
                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Toplam Bekleme</span>
                  <span className={styles.metricBlockVal}>{selectedLatch.wait_time_ms.toLocaleString()} ms</span>
                  <span className={styles.metricBlockSub}>{selectedLatch.waiting_requests_count.toLocaleString()} istek</span>
                </div>

                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Ortalama Bekleme</span>
                  <span className={styles.metricBlockVal}>{selectedLatch.avg_wait_ms} ms</span>
                  <span className={styles.metricBlockSub}>Maksimum: {selectedLatch.max_wait_time_ms} ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spinlock Drawer */}
      {selectedSpinlock && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedSpinlock(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitleArea}>
                <h3 className={styles.drawerTitle}>{selectedSpinlock.name}</h3>
                <span className={styles.drawerSub}>Spinlock Çekirdek Çarpışma Analizi</span>
              </div>
              <button
                type="button"
                className={styles.btnClose}
                onClick={() => setSelectedSpinlock(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              <div className={styles.verdictBox}>
                <span className={styles.verdictTitle}>
                  <AlertTriangle size={14} color="var(--accent)" />
                  Spinlock Amacı ve CPU Etkisi
                </span>
                <p className={styles.verdictText}>{selectedSpinlock.description}</p>
              </div>

              <div className={styles.verdictBox} style={{ borderLeftColor: '#10b981' }}>
                <span className={styles.verdictTitle} style={{ color: '#10b981' }}>
                  <CheckCircle2 size={14} />
                  DBA İyileştirme Tavsiyesi
                </span>
                <p className={styles.verdictText}>{selectedSpinlock.remediation_hint}</p>
              </div>

              <div className={styles.metricsGrid}>
                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Çarpışma Başına Dönüş</span>
                  <span
                    className={styles.metricBlockVal}
                    style={{
                      color: selectedSpinlock.spins_per_collision >= 50.0 ? '#ef4444' : undefined,
                    }}
                  >
                    {selectedSpinlock.spins_per_collision.toFixed(1)}
                  </span>
                  <span className={styles.metricBlockSub}>{selectedSpinlock.collisions.toLocaleString()} çarpışma</span>
                </div>

                <div className={styles.metricBlock}>
                  <span className={styles.metricBlockLabel}>Toplam CPU Dönüşü (Spins)</span>
                  <span className={styles.metricBlockVal}>{selectedSpinlock.spins.toLocaleString()}</span>
                  <span className={styles.metricBlockSub}>Backoff: {selectedSpinlock.backoffs.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
