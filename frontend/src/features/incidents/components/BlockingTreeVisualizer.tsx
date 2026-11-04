import React, { useState } from 'react';
import {
  GitMerge,
  ShieldAlert,
  Clock,
  Terminal,
  Database,
  User,
  Monitor,
  Copy,
  Check,
  Zap,
  Info,
  ChevronRight,
  AlertTriangle,
  PlayCircle,
  FileCode,
} from 'lucide-react';
import type { BlockingResult, BlockingChain, BlockedSession, Session } from '../../../lib/types';
import { formatDuration } from '../../../lib/utils';
import CodeBlock from '../../../components/ui/CodeBlock';
import styles from './BlockingTreeVisualizer.module.css';

interface BlockingTreeVisualizerProps {
  data: BlockingResult;
  onRefresh?: () => void;
}

interface TreeNode {
  session_id: number;
  login_name: string;
  host_name: string;
  db_name: string;
  command?: string;
  status?: string;
  wait_type?: string;
  wait_time_ms?: number;
  sql_text?: string;
  is_root: boolean;
  blocked_children: TreeNode[];
}

export default function BlockingTreeVisualizer({ data }: BlockingTreeVisualizerProps) {
  const chains: BlockingChain[] = data.chains ?? data.blocking_chains ?? [];

  // Build root tree structures
  const treeRoots: TreeNode[] = chains.map((chain) => {
    const blocker = (chain as any).root_blocker || chain.blocker || {};
    const blockedList = chain.blocked || [];

    const children: TreeNode[] = blockedList.map((b: BlockedSession) => ({
      session_id: b.session_id,
      login_name: b.login_name || 'Bilinmiyor',
      host_name: b.host_name || '-',
      db_name: b.db_name || 'master',
      command: (b as any).command || 'AWAITING_LOCK',
      status: (b as any).status || 'suspended',
      wait_type: b.wait_type || 'LCK_M_X',
      wait_time_ms: b.wait_time_ms ?? 0,
      sql_text: b.sql_text || undefined,
      is_root: false,
      blocked_children: [],
    }));

    return {
      session_id: blocker.session_id || 0,
      login_name: blocker.login_name || 'Bilinmiyor',
      host_name: blocker.host_name || '-',
      db_name: blocker.database_name || blocker.db_name || 'master',
      command: blocker.command || 'COMMAND',
      status: blocker.status || 'running',
      wait_type: blocker.wait_type || 'NONE (Lock Owner)',
      wait_time_ms: blocker.wait_time_ms ?? 0,
      sql_text: blocker.sql_text || undefined,
      is_root: true,
      blocked_children: children,
    };
  });

  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(
    treeRoots.length > 0 ? treeRoots[0] : null
  );
  const [copiedKill, setCopiedKill] = useState<boolean>(false);
  const [copiedTsql, setCopiedTsql] = useState<boolean>(false);

  if (treeRoots.length === 0) {
    return null;
  }

  const handleCopyKill = (spid: number) => {
    const sql = `-- İnceleme amaçlı T-SQL sonlandırma reçetesi\n-- DİKKAT: Üretim ortamında onay almadan çalıştırmayınız!\nKILL ${spid};`;
    navigator.clipboard.writeText(sql);
    setCopiedKill(true);
    setTimeout(() => setCopiedKill(false), 2000);
  };

  const handleCopyDiag = (spid: number) => {
    const diagSql = `-- SPID ${spid} Kök Neden Teşhis Sorgusu\nSELECT \n  s.session_id, s.login_name, s.host_name, s.program_name, s.status,\n  r.command, r.wait_type, r.wait_time, r.blocking_session_id,\n  t.text AS current_sql_text\nFROM sys.dm_exec_sessions s\nLEFT JOIN sys.dm_exec_requests r ON s.session_id = r.session_id\nOUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t\nWHERE s.session_id = ${spid};`;
    navigator.clipboard.writeText(diagSql);
    setCopiedTsql(true);
    setTimeout(() => setCopiedTsql(false), 2000);
  };

  const activeNode = selectedNode || treeRoots[0];

  return (
    <div className={styles.container}>
      {/* Visualizer Top Bar & Legend */}
      <div className={styles.headerBar}>
        <div className={styles.headerTitle}>
          <GitMerge size={17} color="var(--accent)" />
          <span>Canlı Kilit & Blocker Hiyerarşi Ağacı (Lock Hierarchy Tree)</span>
        </div>

        <div className={styles.legendGroup}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendPill} ${styles.pillRoot}`} />
            <span>Kök Engelleyici (Root Blocker)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendPill} ${styles.pillBlocked}`} />
            <span>Kilitlenen Kurban (Waiter)</span>
          </div>
        </div>
      </div>

      <div className={styles.treeLayout}>
        {/* Left Side: Interactive Tree Canvas */}
        <div className={styles.treeCanvas}>
          {treeRoots.map((root, rootIdx) => (
            <div key={`root-${root.session_id}-${rootIdx}`} className={styles.treeChain}>
              {/* Root Blocker Card */}
              <div
                className={`${styles.nodeCard} ${styles.nodeRoot} ${
                  activeNode.session_id === root.session_id ? styles.nodeSelected : ''
                }`}
                onClick={() => setSelectedNode(root)}
              >
                <div className={styles.nodeCardHeader}>
                  <div className={styles.nodeBadgeRoot}>
                    <ShieldAlert size={12} />
                    <span>ROOT BLOCKER</span>
                  </div>
                  <span className={styles.spidTag}>SPID {root.session_id}</span>
                </div>

                <div className={styles.nodeMeta}>
                  <div className={styles.metaRow}>
                    <User size={11} className={styles.metaIcon} />
                    <span>{root.login_name}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <Database size={11} className={styles.metaIcon} />
                    <span>{root.db_name}</span>
                  </div>
                </div>

                <div className={styles.nodeCommand}>
                  <code>{root.command}</code>
                </div>

                <div className={styles.nodeImpact}>
                  {root.blocked_children.length} oturumu kilitliyor
                </div>
              </div>

              {/* Connector lines to children */}
              {root.blocked_children.length > 0 && (
                <div className={styles.childrenBranch}>
                  <div className={styles.connectorTrunk} />

                  <div className={styles.childrenList}>
                    {root.blocked_children.map((child, childIdx) => {
                      const isChildSelected = activeNode.session_id === child.session_id;
                      return (
                        <div key={`child-${child.session_id}-${childIdx}`} className={styles.childRow}>
                          <div className={styles.connectorBranch} />

                          <div
                            className={`${styles.nodeCard} ${styles.nodeChild} ${
                              isChildSelected ? styles.nodeSelected : ''
                            }`}
                            onClick={() => setSelectedNode(child)}
                          >
                            <div className={styles.nodeCardHeader}>
                              <div className={styles.nodeBadgeBlocked}>
                                <Clock size={11} />
                                <span>WAITER</span>
                              </div>
                              <span className={styles.spidTag}>SPID {child.session_id}</span>
                            </div>

                            <div className={styles.nodeMeta}>
                              <div className={styles.metaRow}>
                                <User size={11} className={styles.metaIcon} />
                                <span>{child.login_name}</span>
                              </div>
                              <div className={styles.metaRow}>
                                <Database size={11} className={styles.metaIcon} />
                                <span>{child.db_name}</span>
                              </div>
                            </div>

                            <div className={styles.waitBadge}>
                              <span>{child.wait_type}</span>
                              <strong>({formatDuration(child.wait_time_ms ?? 0)})</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right Side: Selected Session Deep Inspector */}
        <div className={styles.inspectorPanel}>
          <div className={styles.inspectorHeader}>
            <div className={styles.inspectorTitle}>
              <Monitor size={15} color="var(--accent)" />
              <span>Oturum Teşhis Müfettişi (SPID {activeNode.session_id})</span>
            </div>
            {activeNode.is_root ? (
              <span className={styles.rootPillSmall}>KÖK BLOKLAYICI</span>
            ) : (
              <span className={styles.waiterPillSmall}>BEKLEYEN OTURUM</span>
            )}
          </div>

          <div className={styles.inspectorBody}>
            {/* Meta Properties Grid */}
            <div className={styles.metaGrid}>
              <div className={styles.metaField}>
                <span className={styles.fieldLabel}>Kullanıcı (Login)</span>
                <span className={styles.fieldVal}>{activeNode.login_name}</span>
              </div>
              <div className={styles.metaField}>
                <span className={styles.fieldLabel}>İstemci Makine (Host)</span>
                <span className={styles.fieldVal}>{activeNode.host_name}</span>
              </div>
              <div className={styles.metaField}>
                <span className={styles.fieldLabel}>Hedef Veritabanı</span>
                <span className={styles.fieldVal}>{activeNode.db_name}</span>
              </div>
              <div className={styles.metaField}>
                <span className={styles.fieldLabel}>Komut / Durum</span>
                <span className={styles.fieldVal}>
                  {activeNode.command} ({activeNode.status})
                </span>
              </div>
              <div className={styles.metaField}>
                <span className={styles.fieldLabel}>Bekleme Türü (Wait)</span>
                <span className={styles.fieldVal}>{activeNode.wait_type}</span>
              </div>
              <div className={styles.metaField}>
                <span className={styles.fieldLabel}>Toplam Kilit Süresi</span>
                <span className={styles.fieldVal}>
                  {formatDuration(activeNode.wait_time_ms ?? 0)}
                </span>
              </div>
            </div>

            {/* SQL Text Box */}
            <div className={styles.sqlSection}>
              <div className={styles.sqlSectionTitle}>
                <Terminal size={13} color="var(--accent)" />
                <span>Çalıştırılan T-SQL Sorgusu / Girdi Tamponu:</span>
              </div>

              {activeNode.sql_text ? (
                <CodeBlock code={activeNode.sql_text} showCopy maxHeight="130px" />
              ) : (
                <div className={styles.noSqlNotice}>
                  <Info size={13} />
                  <span>
                    {activeNode.is_root
                      ? 'Kök engelleyici şu an açık bir transaction (Open Tran) içinde uyku (sleeping) durumunda olabilir veya sorgu tamamlanmış fakat commit/rollback edilmemiştir.'
                      : 'Sorgu metni DMV arabelleğinden henüz çekilemedi.'}
                  </span>
                </div>
              )}
            </div>

            {/* Cerrahi Müdahale & Teşhis Reçeteleri */}
            <div className={styles.actionSection}>
              <div className={styles.actionTitle}>Cerrahi Müdahale Reçeteleri (Review-Only):</div>

              <div className={styles.actionButtons}>
                <button
                  type="button"
                  className={styles.diagBtn}
                  onClick={() => handleCopyDiag(activeNode.session_id)}
                >
                  {copiedTsql ? <Check size={13} color="#10b981" /> : <FileCode size={13} />}
                  <span>{copiedTsql ? 'Teşhis SQL Kopyalandı' : 'Kök Neden Teşhis SQL'}</span>
                </button>

                <button
                  type="button"
                  className={styles.killBtn}
                  onClick={() => handleCopyKill(activeNode.session_id)}
                  title="Güvenli Review-Only: Oturumu doğrudan sonlandırmaz, onaylayıp çalıştırmanız için T-SQL üretir."
                >
                  {copiedKill ? <Check size={13} color="#10b981" /> : <AlertTriangle size={13} />}
                  <span>{copiedKill ? 'KILL Reçetesi Kopyalandı' : `KILL ${activeNode.session_id} Reçetesi`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
