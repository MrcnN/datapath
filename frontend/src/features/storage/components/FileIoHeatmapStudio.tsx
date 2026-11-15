import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Copy,
  Check,
  Zap,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  Layers,
  FileText,
  Sliders,
  X,
} from 'lucide-react';
import styles from './FileIoHeatmapStudio.module.css';
import { getFileIoHeatmap } from '../../../lib/api';
import type {
  IOHeatmapResponse,
  FileIOHeatmapItem,
  IOStatus,
} from '../../../lib/types';

export default function FileIoHeatmapStudio() {
  const [data, setData] = useState<IOHeatmapResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedFile, setSelectedFile] = useState<FileIOHeatmapItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getFileIoHeatmap();
      setData(res);
      if (res.all_files.length > 0 && !selectedFile) {
        setSelectedFile(res.all_files[0]);
      }
    } catch (err) {
      console.error('Failed to load File IO Heatmap', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyScript = (script: string, id: string) => {
    navigator.clipboard.writeText(script);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const summary = data?.summary;
  const drives = data?.drives || [];
  const allFiles = data?.all_files || [];

  const filteredFiles = allFiles.filter((f) => {
    const matchesSearch =
      f.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.database_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.physical_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || f.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className={styles.container}>
      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h3>
            <HardDrive size={18} /> Dosya Bazlı I/O Gecikme Isı Haritası &amp; Stall Forensic
          </h3>
          <p>
            sys.dm_io_virtual_file_stats üzerinden veritabanı dosyalarının (MDF, LDF) disk okuma/yazma gecikmesi ve stall analizi.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.actionBtn}
            onClick={loadData}
            disabled={isLoading}
            title="I/O telemetrisini yenile"
          >
            <RefreshCw size={14} className={isLoading ? styles.spinning : ''} />
            {isLoading ? 'Yenileniyor...' : 'I/O Verilerini Yenile'}
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className={styles.summaryGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <Layers size={13} /> İncelenen Dosyalar
          </div>
          <div className={styles.kpiValue}>
            {summary?.total_files ?? 0}
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
              dosya ({summary?.total_drives ?? 1} sürücü)
            </span>
          </div>
          <div className={styles.kpiSub}>MDF, NDF ve LDF dosya hacmi</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <AlertTriangle
              size={13}
              color={(summary?.critical_files_count ?? 0) > 0 ? '#ef4444' : '#10b981'}
            />
            Kritik / Yüksek Gecikme
          </div>
          <div
            className={styles.kpiValue}
            style={{
              color:
                (summary?.critical_files_count ?? 0) > 0
                  ? '#f87171'
                  : (summary?.warning_files_count ?? 0) > 0
                  ? '#fbbf24'
                  : '#34d399',
            }}
          >
            {summary?.critical_files_count ?? 0}
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
              kritik, {summary?.warning_files_count ?? 0} uyarı
            </span>
          </div>
          <div className={styles.kpiSub}>&gt;25 ms stall süresi yaşayan dosyalar</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <Activity size={13} /> Ort. Okuma / Yazma Gecikmesi
          </div>
          <div className={styles.kpiValue}>
            {summary?.avg_read_latency_ms?.toFixed(1) ?? '0.0'}
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 400 }}>
              ms / {summary?.avg_write_latency_ms?.toFixed(1) ?? '0.0'} ms
            </span>
          </div>
          <div className={styles.kpiSub}>Genel disk yanıt süresi</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <Zap size={13} /> En Yüksek Gecikmeli Dosya
          </div>
          <div className={styles.kpiValue} style={{ fontSize: '1.05rem' }}>
            {summary?.highest_latency_ms ? `${summary.highest_latency_ms.toFixed(1)} ms` : 'Normal'}
          </div>
          <div
            className={styles.kpiSub}
            style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
          >
            {summary?.highest_latency_file || 'Yok'}
          </div>
        </div>
      </div>

      {/* Recommendations Radar */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <div className={styles.recsBanner}>
          <div className={styles.recContent}>
            <div className={styles.recTitle}>
              <ShieldAlert size={16} /> Disk Performansı &amp; Dosya Dengeleme Tavsiyeleri
            </div>
            <ul className={styles.recList}>
              {data.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Latency Threshold Guide */}
      <div
        style={{
          display: 'flex',
          gap: '1.25rem',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          background: 'var(--bg-surface)',
          padding: '0.65rem 1rem',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <span>
          <strong>Gecikme Eşikleri:</strong>
        </span>
        <span style={{ color: '#34d399' }}>● &lt;5 ms: Mükemmel (NVMe / Enterprise SSD)</span>
        <span style={{ color: '#60a5fa' }}>● 5-15 ms: Normal Operasyonel</span>
        <span style={{ color: '#fbbf24' }}>● 15-25 ms: Yüksek Gecikme</span>
        <span style={{ color: '#f87171' }}>● &gt;25 ms: Kritik I/O Darboğazı (Stall)</span>
      </div>

      {/* Visual Heatmap Grid by Drive */}
      <div className={styles.heatmapSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
            Görsel I/O Gecikme Isı Haritası (Sürücü &amp; Dosya Matrisi)
          </h4>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            İncelemek istediğiniz dosya karosuna tıklayın
          </span>
        </div>

        {drives.map((d) => (
          <div key={d.drive_letter} className={styles.driveBlock}>
            <div className={styles.driveHeader}>
              <span className={styles.driveTitle}>
                <HardDrive size={15} color="#38bdf8" /> {d.drive_letter} Sürücüsü
              </span>
              <div className={styles.driveMetrics}>
                <span>{d.file_count} dosya</span>
                <span>•</span>
                <span>Ort. Okuma: {d.avg_read_latency_ms.toFixed(1)} ms</span>
                <span>•</span>
                <span>Ort. Yazma: {d.avg_write_latency_ms.toFixed(1)} ms</span>
                <span>•</span>
                <span
                  className={`${styles.badge} ${
                    d.status === 'EXCELLENT'
                      ? styles.badgeExcellent
                      : d.status === 'NORMAL'
                      ? styles.badgeNormal
                      : d.status === 'WARNING'
                      ? styles.badgeWarning
                      : styles.badgeCritical
                  }`}
                >
                  {d.status}
                </span>
              </div>
            </div>

            <div className={styles.tilesGrid}>
              {d.files.map((file) => {
                const isSelected = selectedFile?.file_name === file.file_name;
                const statusCls =
                  file.status === 'CRITICAL'
                    ? styles.tileCritical
                    : file.status === 'WARNING'
                    ? styles.tileWarning
                    : file.status === 'NORMAL'
                    ? styles.tileNormal
                    : styles.tileExcellent;

                const latColor =
                  file.status === 'CRITICAL'
                    ? '#f87171'
                    : file.status === 'WARNING'
                    ? '#fbbf24'
                    : file.status === 'NORMAL'
                    ? '#60a5fa'
                    : '#34d399';

                return (
                  <div
                    key={file.file_name}
                    className={`${styles.tile} ${statusCls} ${
                      isSelected ? styles.tileSelected : ''
                    }`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <div className={styles.tileHead}>
                      <span className={styles.tileFileName} title={file.file_name}>
                        {file.file_name}
                      </span>
                      <span className={styles.tileTypeBadge}>{file.file_type}</span>
                    </div>

                    <div className={styles.tileDb}>{file.database_name}</div>

                    <div className={styles.tileLatency} style={{ color: latColor }}>
                      {file.overall_latency_ms.toFixed(1)}
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#94a3b8' }}>
                        ms
                      </span>
                    </div>

                    <div className={styles.tileMetaRow}>
                      <span>Okuma: {file.read_latency_ms.toFixed(1)} ms</span>
                      <span>Yazma: {file.write_latency_ms.toFixed(1)} ms</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Selected File Detail Card */}
        {selectedFile && (
          <div className={styles.detailCard}>
            <div className={styles.detailHeader}>
              <div className={styles.detailTitle}>
                <Database size={16} color="#3b82f6" />
                <span>
                  {selectedFile.database_name}.{selectedFile.file_name} Detaylı I/O Teşhisi
                </span>
                <span
                  className={`${styles.badge} ${
                    selectedFile.status === 'CRITICAL'
                      ? styles.badgeCritical
                      : selectedFile.status === 'WARNING'
                      ? styles.badgeWarning
                      : selectedFile.status === 'NORMAL'
                      ? styles.badgeNormal
                      : styles.badgeExcellent
                  }`}
                >
                  {selectedFile.status}
                </span>
              </div>
              <button
                className={styles.actionBtn}
                style={{ padding: '0.2rem 0.5rem' }}
                onClick={() => setSelectedFile(null)}
              >
                <X size={13} /> Kapat
              </button>
            </div>

            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailItemLabel}>Fiziksel Disk Yolu</span>
                <span className={styles.detailItemVal} style={{ fontSize: '0.75rem' }}>
                  {selectedFile.physical_name}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailItemLabel}>Dosya Boyutu / Türü</span>
                <span className={styles.detailItemVal}>
                  {selectedFile.size_mb.toFixed(1)} MB ({selectedFile.file_type})
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailItemLabel}>Okuma / Yazma Sayısı</span>
                <span className={styles.detailItemVal}>
                  {selectedFile.num_of_reads.toLocaleString()} okuma /{' '}
                  {selectedFile.num_of_writes.toLocaleString()} yazma
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailItemLabel}>Toplam I/O Bekleme (Stall)</span>
                <span className={styles.detailItemVal} style={{ color: '#f87171' }}>
                  {(selectedFile.io_stall_total_ms / 1000).toFixed(1)} sn
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
              <strong>Teşhis:</strong> {selectedFile.bottleneck_verdict}
            </div>

            {selectedFile.recommendation && (
              <div style={{ fontSize: '0.8rem', color: '#93c5fd' }}>
                <strong>Öneri:</strong> {selectedFile.recommendation}
              </div>
            )}

            {selectedFile.rebalance_script && (
              <div style={{ marginTop: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  T-SQL Dosya Taşıma / Rebalance Betiği:
                </span>
                <div className={styles.scriptBox}>
                  <span>{selectedFile.rebalance_script}</span>
                  <button
                    className={styles.actionBtn}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                    onClick={() =>
                      handleCopyScript(selectedFile.rebalance_script!, selectedFile.file_name)
                    }
                  >
                    {copiedId === selectedFile.file_name ? (
                      <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Check size={11} /> Kopyalandı
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Copy size={11} /> Kopyala
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filterable Table */}
      <div className={styles.tableContainer}>
        <div className={styles.tableToolbar}>
          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterBtn} ${statusFilter === 'ALL' ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              Tüm Dosyalar ({allFiles.length})
            </button>
            <button
              className={`${styles.filterBtn} ${statusFilter === 'CRITICAL' ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter('CRITICAL')}
            >
              Kritik (&gt;25 ms) ({summary?.critical_files_count ?? 0})
            </button>
            <button
              className={`${styles.filterBtn} ${statusFilter === 'WARNING' ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter('WARNING')}
            >
              Yüksek Gecikme ({summary?.warning_files_count ?? 0})
            </button>
            <button
              className={`${styles.filterBtn} ${statusFilter === 'EXCELLENT' ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter('EXCELLENT')}
            >
              Mükemmel (&lt;5 ms) ({summary?.optimal_files_count ?? 0})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={14} color="#64748b" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Dosya veya veritabanı adı ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <table className={styles.fileTable}>
          <thead>
            <tr>
              <th>Veritabanı / Dosya</th>
              <th>Tür</th>
              <th>Sürücü</th>
              <th>Okuma Gecikmesi</th>
              <th>Yazma Gecikmesi</th>
              <th>Genel Gecikme</th>
              <th>Toplam Stall</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.length > 0 ? (
              filteredFiles.map((f) => (
                <tr
                  key={f.file_name}
                  onClick={() => setSelectedFile(f)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{f.file_name}</span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {f.database_name} • {f.size_mb.toFixed(1)} MB
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{f.file_type}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#38bdf8' }}>{f.drive_letter}</span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        color: f.read_latency_ms > 20 ? '#f87171' : '#cbd5e1',
                      }}
                    >
                      {f.read_latency_ms.toFixed(1)} ms
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        color: f.write_latency_ms > 20 ? '#f87171' : '#cbd5e1',
                      }}
                    >
                      {f.write_latency_ms.toFixed(1)} ms
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color:
                          f.status === 'CRITICAL'
                            ? '#f87171'
                            : f.status === 'WARNING'
                            ? '#fbbf24'
                            : '#34d399',
                      }}
                    >
                      {f.overall_latency_ms.toFixed(1)} ms
                    </span>
                  </td>
                  <td>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      {(f.io_stall_total_ms / 1000).toFixed(1)} s
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        f.status === 'CRITICAL'
                          ? styles.badgeCritical
                          : f.status === 'WARNING'
                          ? styles.badgeWarning
                          : f.status === 'NORMAL'
                          ? styles.badgeNormal
                          : styles.badgeExcellent
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  Arama kriterlerine uygun dosya bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
