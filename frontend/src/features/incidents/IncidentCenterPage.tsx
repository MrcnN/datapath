import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Flame,
  Briefcase,
  FileText,
  GitCommit,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import SessionsTable from './components/SessionsTable';
import BlockingChain from './components/BlockingChain';
import DeadlockViewer from './components/DeadlockViewer';
import AgentJobsTable from './components/AgentJobsTable';
import ErrorLogViewer from './components/ErrorLogViewer';
import IncidentTimeline from './components/IncidentTimeline';
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
import styles from './IncidentCenterPage.module.css';

type TabType = 'sessions' | 'blocking' | 'deadlocks' | 'agent-jobs' | 'error-log' | 'timeline';

interface TabItem {
  key: TabType;
  label: string;
  icon: LucideIcon;
}

const tabs: TabItem[] = [
  { key: 'sessions', label: 'Canlı Süreç & Oturumlar (WhoIsActive)', icon: Activity },
  { key: 'blocking', label: 'Engelleme Zincirleri', icon: AlertTriangle },
  { key: 'deadlocks', label: 'Kilitlenme Analizi', icon: Flame },
  { key: 'agent-jobs', label: 'Agent İşleri', icon: Briefcase },
  { key: 'error-log', label: 'Hata Günlüğü', icon: FileText },
  { key: 'timeline', label: 'Zaman Çizelgesi', icon: GitCommit },
];

export default function IncidentCenterPage() {
  const [activeTab, setActiveTab] = useState<TabType>('sessions');

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
      if (tab === 'sessions') {
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
        title="Olay Merkezi (Incident Center)"
        subtitle="Canlı oturumlar, engelleme zincirleri, kilitlenmeler, başarısız işler ve olay zaman çizelgesi"
        actions={
          <button
            className={styles.refreshBtn}
            onClick={() => fetchTabData(activeTab)}
            disabled={loading}
            title="Sekme verilerini yenile"
          >
            <RefreshCw size={13} className={loading ? styles.spinning : ''} />
            <span>Yenile</span>
          </button>
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
            {activeTab === 'blocking' && (
              <BlockingChain
                blockingResult={blocking}
                onRefresh={() => fetchTabData('blocking')}
              />
            )}
            {activeTab === 'deadlocks' && <DeadlockViewer />}
            {activeTab === 'agent-jobs' && <AgentJobsTable jobs={agentJobs} />}
            {activeTab === 'error-log' && <ErrorLogViewer entries={errorLogs} />}
            {activeTab === 'timeline' && <IncidentTimeline events={timeline} />}
          </>
        )}
      </div>
    </div>
  );
}
