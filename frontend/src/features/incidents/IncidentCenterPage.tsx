import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Flame,
  Briefcase,
  FileText,
  GitCommit,
  RefreshCw,
  AlertOctagon,
  type LucideIcon,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import SessionsTable from './components/SessionsTable';
import BlockingChain from './components/BlockingChain';
import DeadlockViewer from './components/DeadlockViewer';
import AgentJobsTable from './components/AgentJobsTable';
import ErrorLogViewer from './components/ErrorLogViewer';
import IncidentTimeline from './components/IncidentTimeline';
import ConnectionSentinel from './components/ConnectionSentinel';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import {
  getSessions,
  getBlocking,
  getAgentJobs,
  getErrorLog,
  getIncidentTimeline,
} from '../../lib/api';
import type {
  Session,
  BlockingResult,
  AgentJob,
  ErrorLogEntry,
  TimelineEvent,
} from '../../lib/types';
import RCAReportModal from './components/RCAReportModal';
import IncidentSimulatorModal from './components/IncidentSimulatorModal';
import HAPage from '../high-availability/HAPage';
import BackupRecoveryPage from '../backups/BackupRecoveryPage';
import ExtendedEventsPage from '../extended-events/ExtendedEventsPage';
import PredictiveAnomalyRadar from './components/PredictiveAnomalyRadar';
import { Shield, Database, Radio, Layers, Zap, ShieldAlert } from 'lucide-react';

import styles from './IncidentCenterPage.module.css';

type TabType = 'sessions' | 'connection-sentinel' | 'radar' | 'blocking' | 'deadlocks' | 'alwayson' | 'backups' | 'extended-events' | 'agent-jobs' | 'error-log' | 'timeline';

interface TabItem {
  key: TabType;
  label: string;
  icon: LucideIcon;
}

const tabs: TabItem[] = [
  { key: 'sessions', label: 'Canlı Süreç & Oturumlar', icon: Activity },
  { key: 'connection-sentinel', label: 'Bağlantı Havuzu & Uyuyan İşlemler', icon: ShieldAlert },
  { key: 'radar', label: 'Anomali Radarı & Darboğaz', icon: Radio },
  { key: 'blocking', label: 'Engelleme Zincirleri', icon: AlertTriangle },
  { key: 'deadlocks', label: 'Kilitlenme Analizi', icon: Flame },
  { key: 'alwayson', label: 'AlwaysOn & Replikalar', icon: Shield },
  { key: 'backups', label: 'Yedekleme & RPO Riski', icon: Database },
  { key: 'extended-events', label: 'Genişletilmiş Olaylar (XE)', icon: Layers },
  { key: 'agent-jobs', label: 'Agent İşleri', icon: Briefcase },
  { key: 'error-log', label: 'Hata Günlüğü', icon: FileText },
  { key: 'timeline', label: 'Zaman Çizelgesi', icon: GitCommit },
];

export default function IncidentCenterPage({ initialTab }: { initialTab?: TabType } = {}) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'sessions');
  const [showRcaModal, setShowRcaModal] = useState<boolean>(false);
  const [showSimModal, setShowSimModal] = useState<boolean>(false);

  // Tab data states
  const [sessions, setSessions] = useState<Session[]>([]);
  const [blocking, setBlocking] = useState<BlockingResult | null>(null);
  const [agentJobs, setAgentJobs] = useState<AgentJob[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTabData = async (tab: TabType) => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'sessions' || tab === 'radar' || tab === 'extended-events') {
        // SessionsTable manages its own live data and auto-refresh interval
        setLoading(false);
        return;
      } else if (tab === 'blocking') {
        const data = await getBlocking();
        setBlocking(data);
      } else if (tab === 'agent-jobs') {
        const res = await getAgentJobs({ days_back: 7, failed_only: true });
        setAgentJobs(res.jobs || []);
      } else if (tab === 'error-log') {
        const data = await getErrorLog({ rows: 100 });
        setErrorLogs(data);
      } else if (tab === 'timeline') {
        const data = await getIncidentTimeline(24);
        setTimeline(data);
      }
    } catch (err: any) {
      setError(err.message || 'Veri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab]);

  return (
    <div className={styles.container}>
      <PageHeader
        title="Kilitlenmeler & Deadlock"
        subtitle="Canlı kilitlenme olayları, interaktif SVG Deadlock grafiği, SQL Server hata günlükleri ve kurumsal RCA Post-Mortem raporlayıcısı."
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => setShowSimModal(true)}
              title="Test ortamında canlı kilitlenme veya deadlock simülasyonu başlat"
              style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}
            >
              <Zap size={13} />
              <span>Kriz Simülatörü</span>
            </button>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => setShowRcaModal(true)}
              title="Olay Kök Neden Analizi (RCA Post-Mortem) Raporu Üret"
              style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
            >
              <AlertOctagon size={13} />
              <span>RCA Raporu Üret</span>
            </button>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => fetchTabData(activeTab)}
              disabled={loading}
              title="Sekme verilerini yenile"
            >
              <RefreshCw size={13} className={loading ? styles.spinning : ''} />
              <span>Yenile</span>
            </button>
          </div>
        }
      />

      {/* Modern Segmented Tab Bar */}
      <div className={styles.tabsWrapper}>
        <div className={styles.tabs}>
          {tabs.map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              type="button"
              className={`${styles.tabBtn} ${activeTab === key ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <TabIcon size={14} className={styles.tabIcon} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {loading && <LoadingSpinner message="SQL Server DMV sorgulanıyor..." />}
        {error && <ErrorState message={error} onRetry={() => fetchTabData(activeTab)} />}

        {!loading && !error && (
          <>
            {activeTab === 'sessions' && (
              <SessionsTable />
            )}
            {activeTab === 'connection-sentinel' && (
              <ConnectionSentinel />
            )}
            {activeTab === 'blocking' && (
              <BlockingChain
                blockingResult={blocking}
                onRefresh={() => fetchTabData('blocking')}
              />
            )}
                        {activeTab === 'radar' && <PredictiveAnomalyRadar />}
            {activeTab === 'deadlocks' && <DeadlockViewer />}
            {activeTab === 'alwayson' && <HAPage embedded />}
            {activeTab === 'backups' && <BackupRecoveryPage embedded />}
            {activeTab === 'extended-events' && <ExtendedEventsPage embedded />}
            {activeTab === 'agent-jobs' && <AgentJobsTable jobs={agentJobs} />}
            {activeTab === 'error-log' && <ErrorLogViewer entries={errorLogs} />}
            {activeTab === 'timeline' && <IncidentTimeline events={timeline} />}
          </>
        )}
      </div>
      {showSimModal && (
        <IncidentSimulatorModal
          onClose={() => setShowSimModal(false)}
          onSimulationStarted={() => {
            fetchTabData(activeTab);
          }}
        />
      )}
      {showRcaModal && (
        <RCAReportModal
          onClose={() => setShowRcaModal(false)}
          incidentType={activeTab === 'deadlocks' ? 'DEADLOCK' : activeTab === 'blocking' ? 'BLOCKING_STORM' : 'CUSTOM'}
        />
      )}
    </div>
  );
}
