import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Server,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Layers,
  Terminal,
  ExternalLink,
  FileText,
  Clock,
  Database,
  Info,
} from 'lucide-react';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import { getMaintenanceStatus, generateMaintenanceJobs } from '../../../lib/api';
import type {
  MaintenanceStatusResponse,
  MaintenanceJobGenerateRequest,
  MaintenanceJobScriptResponse,
} from '../../../lib/types';
import styles from './MaintenanceJobGeneratorStudio.module.css';

type PresetType = 'ENTERPRISE_STANDARD' | 'HIGH_CONCURRENCY_OLTP' | 'LIGHTWEIGHT';

export default function MaintenanceJobGeneratorStudio() {
  const [status, setStatus] = useState<MaintenanceStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Form State
  const [preset, setPreset] = useState<PresetType>('ENTERPRISE_STANDARD');
  const [solutionType, setSolutionType] = useState<'OLA_HALLENGREN' | 'NATIVE_TSQL'>('OLA_HALLENGREN');
  const [targetDb, setTargetDb] = useState<string>('master');
  const [backupDir, setBackupDir] = useState<string>('C:\\SQLBackups');
  const [retentionHours, setRetentionHours] = useState<number>(168);
  const [backupCompress, setBackupCompress] = useState<boolean>(true);
  const [backupChecksum, setBackupChecksum] = useState<boolean>(true);
  const [backupVerify, setBackupVerify] = useState<boolean>(true);
  const [diffEnabled, setDiffEnabled] = useState<boolean>(true);
  const [logEnabled, setLogEnabled] = useState<boolean>(true);
  const [logFreqMin, setLogFreqMin] = useState<number>(15);

  const [indexOptimize, setIndexOptimize] = useState<boolean>(true);
  const [fragReorg, setFragReorg] = useState<number>(10);
  const [fragRebuild, setFragRebuild] = useState<number>(30);
  const [onlineRebuild, setOnlineRebuild] = useState<boolean>(true);
  const [resumableRebuild, setResumableRebuild] = useState<boolean>(false);
  const [maxdop, setMaxdop] = useState<number>(2);
  const [updateStats, setUpdateStats] = useState<'ALL' | 'INDEX' | 'COLUMNS' | 'NONE'>('ALL');
  const [onlyModifiedStats, setOnlyModifiedStats] = useState<boolean>(true);

  const [integrityEnabled, setIntegrityEnabled] = useState<boolean>(true);
  const [integrityMode, setIntegrityMode] = useState<'FULL' | 'PHYSICAL_ONLY'>('FULL');
  const [operatorName, setOperatorName] = useState<string>('DBA_Operator');
  const [operatorEmail, setOperatorEmail] = useState<string>('');

  // Generated Scripts State
  const [scriptResponse, setScriptResponse] = useState<MaintenanceJobScriptResponse | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [activeOutputTab, setActiveOutputTab] = useState<'jobs' | 'deployment' | 'verification' | 'cleanup'>('jobs');
  const [copied, setCopied] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      setStatusLoading(true);
      setStatusError(null);
      const data = await getMaintenanceStatus(targetDb);
      setStatus(data);
      if (data.supports_resumable_rebuild && preset === 'HIGH_CONCURRENCY_OLTP') {
        setResumableRebuild(true);
      }
    } catch (err: any) {
      setStatusError(err.message || 'Bakım durumu sorgulanırken hata oluştu.');
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [targetDb]);

  const handleApplyPreset = (p: PresetType) => {
    setPreset(p);
    if (p === 'ENTERPRISE_STANDARD') {
      setBackupCompress(true);
      setBackupChecksum(true);
      setBackupVerify(true);
      setDiffEnabled(true);
      setLogEnabled(true);
      setLogFreqMin(15);
      setRetentionHours(168);
      setIndexOptimize(true);
      setFragReorg(10);
      setFragRebuild(30);
      setOnlineRebuild(status?.supports_online_rebuild ?? true);
      setResumableRebuild(false);
      setMaxdop(2);
      setUpdateStats('ALL');
      setOnlyModifiedStats(true);
      setIntegrityEnabled(true);
      setIntegrityMode('FULL');
    } else if (p === 'HIGH_CONCURRENCY_OLTP') {
      setBackupCompress(true);
      setBackupChecksum(true);
      setBackupVerify(true);
      setDiffEnabled(true);
      setLogEnabled(true);
      setLogFreqMin(10);
      setRetentionHours(336);
      setIndexOptimize(true);
      setFragReorg(5);
      setFragRebuild(25);
      setOnlineRebuild(true);
      setResumableRebuild(status?.supports_resumable_rebuild ?? false);
      setMaxdop(2);
      setUpdateStats('ALL');
      setOnlyModifiedStats(true);
      setIntegrityEnabled(true);
      setIntegrityMode('FULL');
    } else if (p === 'LIGHTWEIGHT') {
      setBackupCompress(true);
      setBackupChecksum(true);
      setBackupVerify(false);
      setDiffEnabled(false);
      setLogEnabled(false);
      setRetentionHours(72);
      setIndexOptimize(true);
      setFragReorg(15);
      setFragRebuild(40);
      setOnlineRebuild(false);
      setResumableRebuild(false);
      setMaxdop(1);
      setUpdateStats('INDEX');
      setOnlyModifiedStats(true);
      setIntegrityEnabled(true);
      setIntegrityMode('PHYSICAL_ONLY');
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const req: MaintenanceJobGenerateRequest = {
        solution_type: solutionType,
        target_database: targetDb,
        backup_directory: backupDir,
        backup_retention_hours: retentionHours,
        backup_compress: backupCompress,
        backup_checksum: backupChecksum,
        backup_verify: backupVerify,
        backup_diff_enabled: diffEnabled,
        backup_log_enabled: logEnabled,
        backup_log_frequency_minutes: logFreqMin,
        index_optimize_enabled: indexOptimize,
        frag_reorganize_threshold: fragReorg,
        frag_rebuild_threshold: fragRebuild,
        online_rebuild: onlineRebuild,
        resumable_rebuild: resumableRebuild,
        maxdop: maxdop,
        update_statistics: updateStats,
        only_modified_statistics: onlyModifiedStats,
        integrity_check_enabled: integrityEnabled,
        integrity_mode: integrityMode,
        operator_name: operatorName || undefined,
        operator_email: operatorEmail || undefined,
      };
      const res = await generateMaintenanceJobs(req);
      setScriptResponse(res);
      setActiveOutputTab('jobs');
    } catch (err: any) {
      alert(err.message || 'Bakım işleri betiği üretilirken hata oluştu.');
    } finally {
      setGenerating(false);
    }
  };

  // Otomatik başlangıç üretimi
  useEffect(() => {
    handleGenerate();
  }, [preset, solutionType]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActiveScriptContent = (): string => {
    if (!scriptResponse) return '';
    if (activeOutputTab === 'jobs') return scriptResponse.agent_jobs_script;
    if (activeOutputTab === 'deployment') return scriptResponse.ola_deployment_script;
    if (activeOutputTab === 'verification') return scriptResponse.verification_script;
    if (activeOutputTab === 'cleanup') return scriptResponse.cleanup_script;
    return '';
  };

  return (
    <div className={styles.studio}>
      {/* 1. Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <CalendarClock size={20} color="var(--primary-color, #2563eb)" />
            <h3 className={styles.title}>Ola Hallengren & SQL Agent Bakım Otomasyon Stüdyosu</h3>
            <span className={styles.badgeLive}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Kurumsal Standart
            </span>
            {status && !status.is_ola_installed && (
              <span className={styles.badgeWarning}>
                <AlertTriangle size={12} />
                Ola Çözümü Eksik
              </span>
            )}
          </div>
          <p className={styles.subtitle}>
            Kurumsal SQL Server yedekleme (Full, Diff, Log), DBCC CHECKDB bütünlük kontrolü ve akıllı parçalanma/istatistik optimizasyon işlerini idempotent SQL Agent betiklerine dönüştürür.
          </p>
        </div>
        <div className={styles.actionsArea}>
          <button className={styles.btnSecondary} onClick={fetchStatus} disabled={statusLoading}>
            <RefreshCw size={14} className={statusLoading ? 'spin' : ''} />
            Sunucuyu Tara
          </button>
        </div>
      </div>

      {/* 2. Live Server Status Cards */}
      {statusLoading && !status ? (
        <LoadingSpinner message="Sunucu bakım altyapısı ve kurulu bileşenler taranıyor..." />
      ) : statusError ? (
        <ErrorState message={statusError} onRetry={fetchStatus} />
      ) : status ? (
        <div className={styles.statusGrid}>
          <div className={styles.statusCard}>
            <div className={styles.statusCardHeader}>
              <span>Ola Hallengren Çözümü</span>
              <ShieldCheck size={16} color={status.is_ola_installed ? '#10b981' : '#f59e0b'} />
            </div>
            <div className={styles.statusCardValue}>
              {status.installed_count} / {status.total_components}
              <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                {status.is_ola_installed ? 'Kurulu & Etkin' : 'Kısmi / Kurulu Değil'}
              </span>
            </div>
            <div className={styles.statusCardFooter}>
              Hedef Veritabanı: <code style={{ color: 'var(--text-primary)' }}>{status.target_database}</code>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {status.components.map((comp) => (
                <span
                  key={comp.name}
                  className={`${styles.componentPill} ${comp.is_installed ? styles.componentPillActive : ''}`}
                >
                  {comp.name}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.statusCard}>
            <div className={styles.statusCardHeader}>
              <span>SQL Server Sürümü & Yetenekler</span>
              <Server size={16} color="var(--primary-color, #2563eb)" />
            </div>
            <div className={styles.statusCardValue}>
              {status.sql_edition}
            </div>
            <div className={styles.statusCardFooter}>
              Online Rebuild: <strong style={{ color: status.supports_online_rebuild ? '#10b981' : '#f59e0b' }}>
                {status.supports_online_rebuild ? 'Destekleniyor' : 'Desteklenmiyor (Offline)'}
              </strong>
            </div>
            <div className={styles.statusCardFooter}>
              Resumable Rebuild: <strong style={{ color: status.supports_resumable_rebuild ? '#10b981' : 'var(--text-muted)' }}>
                {status.supports_resumable_rebuild ? 'Destekleniyor (2017+)' : 'Desteklenmiyor'}
              </strong>
            </div>
          </div>

          <div className={styles.statusCard}>
            <div className={styles.statusCardHeader}>
              <span>Mevcut Agent Bakım İşleri</span>
              <Clock size={16} color="#3b82f6" />
            </div>
            <div className={styles.statusCardValue}>
              {status.existing_maintenance_jobs.length}
              <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                İş Tanımlı
              </span>
            </div>
            <div className={styles.statusCardFooter}>
              CommandLog Hataları: <strong style={{ color: status.recent_errors_count > 0 ? '#ef4444' : '#10b981' }}>
                {status.recent_errors_count} Hata (Son 25 Log)
              </strong>
            </div>
          </div>
        </div>
      ) : null}

      {/* 3. Preset Selector Cards */}
      <div className={styles.presetsSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <Sliders size={15} />
            Kurumsal Bakım Şablonları (Presets)
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Tek tıkla sektörel en iyi uygulamalara göre yapılandırın
          </span>
        </div>
        <div className={styles.presetGrid}>
          <div
            className={`${styles.presetCard} ${preset === 'ENTERPRISE_STANDARD' ? styles.presetCardActive : ''}`}
            onClick={() => handleApplyPreset('ENTERPRISE_STANDARD')}
          >
            <div className={styles.presetCardTitle}>
              <span>Kurumsal Üretim Standardı</span>
              {preset === 'ENTERPRISE_STANDARD' && <CheckCircle2 size={16} color="var(--primary-color, #2563eb)" />}
            </div>
            <div className={styles.presetCardDesc}>
              Kritik iş uygulamaları için dengeli yedekleme, haftalık bütünlük denetimi ve parçalanma optimizasyonu.
            </div>
            <ul className={styles.presetFeatures}>
              <li className={styles.presetFeatureItem}>• Haftalık FULL + Günlük DIFF + 15 dk LOG yedeği</li>
              <li className={styles.presetFeatureItem}>• Pazar 03:00 DBCC CHECKDB tam bütünlük denetimi</li>
              <li className={styles.presetFeatureItem}>• %10 Reorganize, %30 Rebuild, Değişen İstatistikler</li>
            </ul>
          </div>

          <div
            className={`${styles.presetCard} ${preset === 'HIGH_CONCURRENCY_OLTP' ? styles.presetCardActive : ''}`}
            onClick={() => handleApplyPreset('HIGH_CONCURRENCY_OLTP')}
          >
            <div className={styles.presetCardTitle}>
              <span>7/24 Kesintisiz Yüksek İşlem Hacmi</span>
              {preset === 'HIGH_CONCURRENCY_OLTP' && <CheckCircle2 size={16} color="var(--primary-color, #2563eb)" />}
            </div>
            <div className={styles.presetCardDesc}>
              Kilitlenme ve blokaj riskini sıfıra indiren Online & Resumable indeks yenileme ve 10 dk Log sıklığı.
            </div>
            <ul className={styles.presetFeatures}>
              <li className={styles.presetFeatureItem}>• 10 dk LOG yedeği ile minimum RPO kaybı</li>
              <li className={styles.presetFeatureItem}>• ONLINE = ON ve MAXDOP = 2 ile CPU boğulmasını önleme</li>
              <li className={styles.presetFeatureItem}>• 14 gün (336 saat) genişletilmiş yedek saklama</li>
            </ul>
          </div>

          <div
            className={`${styles.presetCard} ${preset === 'LIGHTWEIGHT' ? styles.presetCardActive : ''}`}
            onClick={() => handleApplyPreset('LIGHTWEIGHT')}
          >
            <div className={styles.presetCardTitle}>
              <span>Kaynak Kısıtlı / Hafif Sunucu</span>
              {preset === 'LIGHTWEIGHT' && <CheckCircle2 size={16} color="var(--primary-color, #2563eb)" />}
            </div>
            <div className={styles.presetCardDesc}>
              Düşük disk ve CPU kapasiteli sunucular için optimize edilmiş, sadece fiziksel denetimli hafif profil.
            </div>
            <ul className={styles.presetFeatures}>
              <li className={styles.presetFeatureItem}>• PHYSICAL_ONLY hızlı bütünlük kontrolü (I/O dostu)</li>
              <li className={styles.presetFeatureItem}>• %15 ve %40 yüksek toleranslı indeks eşikleri</li>
              <li className={styles.presetFeatureItem}>• Sıkıştırılmış tekil yedekler ve 3 gün saklama</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 4. Configuration Form */}
      <div className={styles.configSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <Sliders size={15} />
            Gelişmiş Bakım Yapılandırması
          </span>
          <button className={styles.btnPrimary} onClick={handleGenerate} disabled={generating}>
            <Terminal size={14} />
            {generating ? 'Betikler Üretiliyor...' : 'T-SQL Betiklerini Yeniden Üret'}
          </button>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Çözüm Mimarisi</label>
            <select
              className={styles.select}
              value={solutionType}
              onChange={(e) => setSolutionType(e.target.value as any)}
            >
              <option value="OLA_HALLENGREN">Ola Hallengren Çözümü (Önerilen - Kurumsal Standart)</option>
              <option value="NATIVE_TSQL">Yerel T-SQL (Bağımsız - Prosedür Gerektirmez)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Hedef Yönetim Veritabanı</label>
            <input
              type="text"
              className={styles.input}
              value={targetDb}
              onChange={(e) => setTargetDb(e.target.value)}
              placeholder="master veya DBA"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Yedekleme Dizini (Disk / Paylaşım)</label>
            <input
              type="text"
              className={styles.input}
              value={backupDir}
              onChange={(e) => setBackupDir(e.target.value)}
              placeholder="C:\SQLBackups veya \\nas\backups"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Yedek Saklama Süresi (Saat)</label>
            <input
              type="number"
              className={styles.input}
              value={retentionHours}
              onChange={(e) => setRetentionHours(Number(e.target.value))}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Reorganize Eşiği (%)</label>
            <input
              type="number"
              className={styles.input}
              value={fragReorg}
              onChange={(e) => setFragReorg(Number(e.target.value))}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Rebuild Eşiği (%)</label>
            <input
              type="number"
              className={styles.input}
              value={fragRebuild}
              onChange={(e) => setFragRebuild(Number(e.target.value))}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Maksimum Paralellik (MAXDOP)</label>
            <input
              type="number"
              className={styles.input}
              value={maxdop}
              onChange={(e) => setMaxdop(Number(e.target.value))}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Bütünlük Kontrolü Derinliği</label>
            <select
              className={styles.select}
              value={integrityMode}
              onChange={(e) => setIntegrityMode(e.target.value as any)}
            >
              <option value="FULL">Tam Denetim (FULL DBCC CHECKDB)</option>
              <option value="PHYSICAL_ONLY">Fiziksel Hızlı Denetim (PHYSICAL_ONLY)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>SQL Agent Bildirim Operatörü</label>
            <input
              type="text"
              className={styles.input}
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="DBA_Operator"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Operatör E-Posta Adresi (Opsiyonel)</label>
            <input
              type="email"
              className={styles.input}
              value={operatorEmail}
              onChange={(e) => setOperatorEmail(e.target.value)}
              placeholder="dba@sirketiniz.com"
            />
          </div>
        </div>

        {/* Checkbox Toggles */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-3)' }}>
          <label className={styles.checkboxGroup}>
            <input
              type="checkbox"
              checked={backupCompress}
              onChange={(e) => setBackupCompress(e.target.checked)}
            />
            Yedek Sıkıştırma (COMPRESSION)
          </label>

          <label className={styles.checkboxGroup}>
            <input
              type="checkbox"
              checked={backupChecksum}
              onChange={(e) => setBackupChecksum(e.target.checked)}
            />
            Sağlama Toplamı (CHECKSUM)
          </label>

          <label className={styles.checkboxGroup}>
            <input
              type="checkbox"
              checked={backupVerify}
              onChange={(e) => setBackupVerify(e.target.checked)}
            />
            Yedek Doğrulama (VERIFYONLY)
          </label>

          <label className={styles.checkboxGroup}>
            <input
              type="checkbox"
              checked={onlineRebuild}
              onChange={(e) => setOnlineRebuild(e.target.checked)}
            />
            Online İndeks Yenileme (ONLINE = ON)
          </label>

          <label className={styles.checkboxGroup}>
            <input
              type="checkbox"
              checked={onlyModifiedStats}
              onChange={(e) => setOnlyModifiedStats(e.target.checked)}
            />
            Yalnızca Değişen İstatistikleri Güncelle
          </label>
        </div>
      </div>

      {/* 5. Generated Scripts Output Section */}
      {scriptResponse && (
        <div className={styles.outputSection}>
          <div className={styles.outputHeader}>
            <div className={styles.tabList}>
              <button
                className={`${styles.tabBtn} ${activeOutputTab === 'jobs' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveOutputTab('jobs')}
              >
                <Terminal size={14} />
                SQL Agent Bakım İşleri ({scriptResponse.jobs_created_count} İş)
              </button>
              <button
                className={`${styles.tabBtn} ${activeOutputTab === 'deployment' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveOutputTab('deployment')}
              >
                <FileText size={14} />
                Ola Dağıtım Yönergesi
              </button>
              <button
                className={`${styles.tabBtn} ${activeOutputTab === 'verification' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveOutputTab('verification')}
              >
                <ShieldCheck size={14} />
                Doğrulama ve Sağlık Sorguları
              </button>
              <button
                className={`${styles.tabBtn} ${activeOutputTab === 'cleanup' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveOutputTab('cleanup')}
              >
                <AlertTriangle size={14} />
                Geri Alma (Rollback Betiği)
              </button>
            </div>

            <div className={styles.outputActions}>
              <button className={styles.btnPrimary} onClick={() => handleCopy(getActiveScriptContent())}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Kopyalandı' : 'T-SQL Betiğini Kopyala'}
              </button>
            </div>
          </div>

          <div className={styles.codeArea}>
            <CodeBlock code={getActiveScriptContent()} language="sql" />
          </div>

          <div className={styles.noticeBanner}>
            <Info size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
            <span>
              <strong>Salt-Okunur Güvenlik Politikası:</strong> Datapath, sunucunuz üzerinde asla otomatik olarak DDL veya Agent işi oluşturmaz. 
              Yukarıdaki T-SQL betiğini inceledikten sonra kopyalayarak SQL Server Management Studio (SSMS) veya onaylı CI/CD boru hattınızda çalıştırabilirsiniz.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
