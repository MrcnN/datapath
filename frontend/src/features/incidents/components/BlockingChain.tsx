import React from 'react';
import { useApi } from '../../../lib/useApi';
import { getBlocking } from '../../../lib/api';
import { formatDuration } from '../../../lib/utils';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import type { BlockingResult } from '../../../lib/types';
import styles from './BlockingChain.module.css';

interface BlockingChainProps {
  blockingResult?: BlockingResult | null;
  onRefresh?: () => void;
}

export default function BlockingChain({ blockingResult, onRefresh }: BlockingChainProps) {
  const { data: apiData, loading, error, refetch } = useApi(getBlocking);
  const data = blockingResult ?? apiData;

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
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryVal}>{blockersCount}</span>
          <span className={styles.summaryLabel}>Kök Engelleyiciler</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryVal}>{blockedCount}</span>
          <span className={styles.summaryLabel}>Engellenen Oturumlar</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryVal}>{chains.length}</span>
          <span className={styles.summaryLabel}>Engelleme Zincirleri</span>
        </div>
      </div>

      {!data.has_blocking || chains.length === 0 ? (
        <div className={styles.noBlocking}>
          ✓ Şu anda sunucuda tespit edilen bir engelleme (blocking) bulunmuyor.
        </div>
      ) : (
        chains.map((chain, i) => {
          const blocker = (chain as any).root_blocker || (chain as any).blocker;
          const blockedList = chain.blocked || [];
          return (
            <div key={i} className={styles.chainGroup}>
              <div className={styles.chainRoot}>
                <span className={styles.rootLabel}>Kök Engelleyici (Head Blocker)</span>
                <div className={styles.blockerInfo}>
                  <span className={styles.sessionId}>SPID {blocker?.session_id}</span>
                  {' · '}
                  {blocker?.login_name || 'Bilinmiyor'}
                  {' üzerinde '}
                  {blocker?.database_name || blocker?.db_name || 'master'}
                  {' — '}
                  {blocker?.command || 'COMMAND'}
                </div>
              </div>

              <div className={styles.blockedList}>
                {blockedList.map((b: any, j: number) => (
                  <div key={j} className={styles.blockedItem}>
                    <div className={styles.connector} />
                    <div className={styles.blockedContent}>
                      <span className={styles.blockedId}>SPID {b.session_id}</span>
                      <span className={styles.blockedMeta}>
                        bekliyor: <strong>{b.wait_type}</strong> (
                        {formatDuration(b.wait_time_ms ?? 0)})
                      </span>
                      {b.sql_text && (
                        <code className={styles.blockedSql}>{b.sql_text}</code>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
