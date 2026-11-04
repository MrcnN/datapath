import React, { useState } from 'react';
import {
  GitMerge,
  List,
  RefreshCw,
  ShieldAlert,
  Clock,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { useApi } from '../../../lib/useApi';
import { getBlocking } from '../../../lib/api';
import { formatDuration } from '../../../lib/utils';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import type { BlockingResult } from '../../../lib/types';
import BlockingTreeVisualizer from './BlockingTreeVisualizer';
import styles from './BlockingChain.module.css';

interface BlockingChainProps {
  blockingResult?: BlockingResult | null;
  onRefresh?: () => void;
}

export default function BlockingChain({ blockingResult, onRefresh }: BlockingChainProps) {
  const { data: apiData, loading, error, refetch } = useApi(getBlocking);
  const data = blockingResult ?? apiData;
  const [viewMode, setViewMode] = useState<'TREE' | 'LIST'>('TREE');

  const handleRefresh = onRefresh || refetch;

  if (loading && !data) return <LoadingSpinner message="Engelleme zincirleri taranıyor..." />;
  if (error && !data) return <ErrorState message={error} onRetry={handleRefresh} />;
  if (!data) return null;

  const chains = data.chains ?? data.blocking_chains ?? [];
  const blockersCount = data.blockers?.length ?? chains.length;
  const blockedCount =
    data.blocked_sessions?.length ??
    chains.reduce((acc, c) => acc + (c.blocked?.length ?? 0), 0);

  return (
    <div className={styles.chain}>
      {/* Top Controls: KPI Summary + View Switcher */}
      <div className={styles.topControlRow}>
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryVal}>{blockersCount}</span>
            <span className={styles.summaryLabel}>Kök Engelleyici</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.summaryItem}>
            <span className={styles.summaryVal}>{blockedCount}</span>
            <span className={styles.summaryLabel}>Kilitlenen Oturum</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.summaryItem}>
            <span className={styles.summaryVal}>{chains.length}</span>
            <span className={styles.summaryLabel}>Kilit Zinciri</span>
          </div>
        </div>

        {/* View Mode Switcher */}
        {chains.length > 0 && (
          <div className={styles.viewSwitcher}>
            <button
              type="button"
              className={`${styles.switchBtn} ${viewMode === 'TREE' ? styles.switchBtnActive : ''}`}
              onClick={() => setViewMode('TREE')}
            >
              <GitMerge size={14} />
              <span>Hiyerarşi Ağacı (Tree)</span>
            </button>
            <button
              type="button"
              className={`${styles.switchBtn} ${viewMode === 'LIST' ? styles.switchBtnActive : ''}`}
              onClick={() => setViewMode('LIST')}
            >
              <List size={14} />
              <span>Klasik Liste</span>
            </button>
          </div>
        )}
      </div>

      {!data.has_blocking || chains.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={38} color="var(--status-success)" />}
          title="Kilitlenme Bulunmuyor"
          message="Şu anda SQL Server üzerinde birbirini bekleyen veya engelleyen oturum (blocking chain) tespit edilmedi. Oturum akışı sağlıklı."
        />
      ) : viewMode === 'TREE' ? (
        /* Interactive Lock Hierarchy Tree Visualizer */
        <BlockingTreeVisualizer data={data} onRefresh={handleRefresh} />
      ) : (
        /* Classic List View */
        <div className={styles.listContainer}>
          {chains.map((chain, i) => {
            const blocker = (chain as any).root_blocker || (chain as any).blocker;
            const blockedList = chain.blocked || [];
            return (
              <div key={i} className={styles.chainGroup}>
                <div className={styles.chainRoot}>
                  <div className={styles.rootBadge}>
                    <ShieldAlert size={12} />
                    <span>KÖK ENGELLEYİCİ</span>
                  </div>
                  <div className={styles.blockerInfo}>
                    <span className={styles.sessionId}>SPID {blocker?.session_id}</span>
                    <span className={styles.metaDot}>•</span>
                    <span className={styles.metaText}>{blocker?.login_name || 'Bilinmiyor'}</span>
                    <span className={styles.metaDot}>•</span>
                    <span className={styles.metaDb}>
                      {blocker?.database_name || blocker?.db_name || 'master'}
                    </span>
                    <span className={styles.metaDot}>•</span>
                    <code className={styles.metaCmd}>{blocker?.command || 'COMMAND'}</code>
                  </div>
                </div>

                <div className={styles.chainBlocked}>
                  {blockedList.map((b: any, j: number) => (
                    <div key={j} className={styles.blockedItem}>
                      <div className={styles.connectorLine} />
                      <div className={styles.blockedContent}>
                        <div className={styles.blockedHeader}>
                          <span className={styles.blockedId}>SPID {b.session_id}</span>
                          <span className={styles.blockedWaitBadge}>
                            <Clock size={11} />
                            <strong>{b.wait_type}</strong>
                            <span>({formatDuration(b.wait_time_ms ?? 0)})</span>
                          </span>
                        </div>
                        {b.sql_text && <code className={styles.blockedSql}>{b.sql_text}</code>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
