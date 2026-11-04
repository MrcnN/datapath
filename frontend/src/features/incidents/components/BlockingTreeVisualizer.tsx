import React, { useState, useMemo } from 'react';
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
  Lock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileCode,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import type { BlockingResult, BlockingChain, BlockedSession } from '../../../lib/types';
import { formatDuration, truncate } from '../../../lib/utils';
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
  blocked_count: number;
}

interface SvgLayoutChain {
  rootNode: TreeNode;
  rootX: number;
  rootY: number;
  rootW: number;
  rootH: number;
  waiters: Array<{
    node: TreeNode;
    x: number;
    y: number;
    w: number;
    h: number;
    pathD: string;
    midX: number;
    midY: number;
    waitType: string;
    waitTimeMs: number;
  }>;
}

export default function BlockingTreeVisualizer({ data }: BlockingTreeVisualizerProps) {
  const chains: BlockingChain[] = data.chains ?? data.blocking_chains ?? [];

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedSpid, setSelectedSpid] = useState<number | null>(null);
  const [copiedKill, setCopiedKill] = useState<boolean>(false);
  const [copiedDiag, setCopiedDiag] = useState<boolean>(false);
  const [copiedLocks, setCopiedLocks] = useState<boolean>(false);

  // Compute layout coordinates for SVG topology
  const { layoutChains, allNodes, canvasWidth, canvasHeight } = useMemo(() => {
    const nodes: TreeNode[] = [];
    const layout: SvgLayoutChain[] = [];

    const rootWidth = 230;
    const rootHeight = 108;
    const waiterWidth = 240;
    const waiterHeight = 94;

    const startXRoot = 50;
    const startXWaiter = 490;
    let currentY = 30;

    chains.forEach((chain) => {
      const blocker = (chain as any).root_blocker || chain.blocker || {};
      const blockedList: BlockedSession[] = chain.blocked || [];

      const rootNode: TreeNode = {
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
        blocked_count: blockedList.length,
      };
      nodes.push(rootNode);

      const waiterCount = Math.max(1, blockedList.length);
      const chainHeight = Math.max(160, waiterCount * 125);
      const rootY = currentY + (chainHeight / 2) - (rootHeight / 2);

      const waiterLayouts: SvgLayoutChain['waiters'] = [];

      blockedList.forEach((b, wIdx) => {
        const waiterY = currentY + 15 + wIdx * 125;
        const waiterNode: TreeNode = {
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
          blocked_count: 0,
        };
        nodes.push(waiterNode);

        const startPtX = startXRoot + rootWidth;
        const startPtY = rootY + (rootHeight / 2);
        const endPtX = startXWaiter;
        const endPtY = waiterY + (waiterHeight / 2);

        // Smooth cubic bezier with midpoint
        const cp1X = startPtX + (endPtX - startPtX) * 0.45;
        const cp1Y = startPtY;
        const cp2X = startPtX + (endPtX - startPtX) * 0.55;
        const cp2Y = endPtY;

        const pathD = `M ${startPtX} ${startPtY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endPtX} ${endPtY}`;
        const midX = (startPtX + endPtX) / 2;
        const midY = (startPtY + endPtY) / 2;

        waiterLayouts.push({
          node: waiterNode,
          x: startXWaiter,
          y: waiterY,
          w: waiterWidth,
          h: waiterHeight,
          pathD,
          midX,
          midY,
          waitType: b.wait_type || 'LCK_M_X',
          waitTimeMs: b.wait_time_ms ?? 0,
        });
      });

      layout.push({
        rootNode,
        rootX: startXRoot,
        rootY,
        rootW: rootWidth,
        rootH: rootHeight,
        waiters: waiterLayouts,
      });

      currentY += chainHeight + 40;
    });

    const cWidth = 780;
    const cHeight = Math.max(420, currentY);

    return { layoutChains: layout, allNodes: nodes, canvasWidth: cWidth, canvasHeight: cHeight };
  }, [chains]);

  // Set default selected node
  const activeNode = useMemo(() => {
    if (selectedSpid) {
      const found = allNodes.find((n) => n.session_id === selectedSpid);
      if (found) return found;
    }
    return allNodes[0] || null;
  }, [selectedSpid, allNodes]);

  if (!activeNode || layoutChains.length === 0) {
    return null;
  }

  // T-SQL action generators
  const handleCopyKill = (spid: number) => {
    const sql = `-- İnceleme amaçlı T-SQL sonlandırma reçetesi (Review-Only)\n-- DİKKAT: Üretim ortamında onay almadan çalıştırmayınız!\nKILL ${spid};`;
    navigator.clipboard.writeText(sql);
    setCopiedKill(true);
    setTimeout(() => setCopiedKill(false), 2000);
  };

  const handleCopyDiag = (spid: number) => {
    const diagSql = `-- SPID ${spid} Kök Neden & İstek Teşhisi\nSELECT \n  s.session_id, s.login_name, s.host_name, s.program_name, s.status,\n  r.command, r.wait_type, r.wait_time, r.blocking_session_id,\n  t.text AS current_sql_text\nFROM sys.dm_exec_sessions s\nLEFT JOIN sys.dm_exec_requests r ON s.session_id = r.session_id\nOUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t\nWHERE s.session_id = ${spid};`;
    navigator.clipboard.writeText(diagSql);
    setCopiedDiag(true);
    setTimeout(() => setCopiedDiag(false), 2000);
  };

  const handleCopyLocks = (spid: number) => {
    const lockSql = `-- SPID ${spid} Açık Kilit Kaynakları Analizi\nSELECT \n  request_session_id AS spid,\n  resource_type,\n  resource_database_id,\n  DB_NAME(resource_database_id) AS database_name,\n  resource_description,\n  request_mode AS lock_mode,\n  request_status\nFROM sys.dm_tran_locks\nWHERE request_session_id = ${spid}\nORDER BY request_status, request_mode;`;
    navigator.clipboard.writeText(lockSql);
    setCopiedLocks(true);
    setTimeout(() => setCopiedLocks(false), 2000);
  };

  return (
    <div className={styles.container}>
      {/* Header & Controls Toolbar */}
      <div className={styles.headerBar}>
        <div className={styles.headerTitle}>
          <GitMerge size={16} color="var(--accent)" />
          <span>Canlı Kilit Hiyerarşi Topolojisi (Lock Hierarchy Map)</span>
          <span className={styles.titleBadge}>{layoutChains.length} Aktif Zincir</span>
        </div>

        <div className={styles.toolbarActions}>
          <div className={styles.legendBar}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotRoot}`} />
              <span>Root Blocker</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotWaiter}`} />
              <span>Kilitlenen (Waiter)</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotLock}`} />
              <span>Lock Akışı</span>
            </div>
          </div>

          <div className={styles.zoomControls}>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
              title="Uzaklaştır"
            >
              <ZoomOut size={13} />
            </button>
            <span className={styles.zoomLevel}>{Math.round(zoomLevel * 100)}%</span>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
              title="Yakınlaştır"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => setZoomLevel(1)}
              title="Sıfırla"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Two-column layout: Canvas on Left, Telemetry Inspector on Right */}
      <div className={styles.layoutGrid}>
        {/* SVG Topology Canvas */}
        <div className={styles.canvasWrapper}>
          <svg
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            width={canvasWidth}
            height={canvasHeight}
            className={styles.svgElement}
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <defs>
              {/* Subtle Blueprint Grid Pattern */}
              <pattern id="blocker-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="rgba(56, 189, 248, 0.08)" />
              </pattern>

              {/* Glowing Drop Shadows */}
              <filter id="glow-root" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(244, 63, 94, 0.35)" />
              </filter>
              <filter id="glow-selected" x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="rgba(56, 189, 248, 0.75)" />
              </filter>

              {/* Card Background Gradients */}
              <linearGradient id="root-card-bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e1422" />
                <stop offset="100%" stopColor="#121828" />
              </linearGradient>

              <linearGradient id="waiter-card-bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a1c24" />
                <stop offset="100%" stopColor="#0f1522" />
              </linearGradient>

              {/* Arrowhead Marker */}
              <marker
                id="arrow-flow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
              </marker>
            </defs>

            {/* Background Grid */}
            <rect width="100%" height="100%" fill="url(#blocker-grid)" />

            {/* Render Each Chain */}
            {layoutChains.map((chain, cIdx) => (
              <g key={`chain-group-${cIdx}`}>
                {/* 1. Curved Animated Connector Lines & Lock Pills */}
                {chain.waiters.map((w, wIdx) => (
                  <g key={`connector-${cIdx}-${wIdx}`}>
                    {/* Background Static Path */}
                    <path
                      d={w.pathD}
                      fill="none"
                      stroke="rgba(245, 158, 11, 0.25)"
                      strokeWidth="2.5"
                    />

                    {/* Animated Dashed Flow Path */}
                    <path
                      d={w.pathD}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      markerEnd="url(#arrow-flow)"
                      className={styles.animatedFlow}
                    />

                    {/* Midpoint Lock Pill Badge */}
                    <g transform={`translate(${w.midX - 48}, ${w.midY - 12})`}>
                      <rect
                        width="96"
                        height="24"
                        rx="12"
                        fill="#0a0f1d"
                        stroke="#f59e0b"
                        strokeWidth="1.2"
                      />
                      <text
                        x="48"
                        y="16"
                        textAnchor="middle"
                        fill="#f59e0b"
                        fontSize="10"
                        fontWeight="700"
                        fontFamily="var(--font-mono)"
                      >
                        {w.waitType}
                      </text>
                    </g>
                  </g>
                ))}

                {/* 2. Root Blocker Card Node */}
                {(() => {
                  const isSelected = activeNode.session_id === chain.rootNode.session_id;
                  return (
                    <g
                      className={styles.interactiveNode}
                      onClick={() => setSelectedSpid(chain.rootNode.session_id)}
                      transform={`translate(${chain.rootX}, ${chain.rootY})`}
                    >
                      {/* Selection Aura */}
                      {isSelected && (
                        <rect
                          x="-4"
                          y="-4"
                          width={chain.rootW + 8}
                          height={chain.rootH + 8}
                          rx="12"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          
                        />
                      )}

                      {/* Main Card Rect */}
                      <rect
                        width={chain.rootW}
                        height={chain.rootH}
                        rx="8"
                        fill="url(#root-card-bg)"
                        stroke="#ef4444"
                        strokeWidth="1.8"
                        
                      />

                      {/* Danger Left Stripe */}
                      <path
                        d="M 2 8 Q 2 2 8 2 L 8 106 Q 2 106 2 100 Z"
                        fill="#ef4444"
                      />

                      {/* Role Badge */}
                      <rect
                        x="14"
                        y="12"
                        width="100"
                        height="18"
                        rx="4"
                        fill="rgba(239, 68, 68, 0.2)"
                        stroke="rgba(239, 68, 68, 0.45)"
                      />
                      <text
                        x="64"
                        y="25"
                        textAnchor="middle"
                        fill="#ef4444"
                        fontSize="9.5"
                        fontWeight="700"
                        letterSpacing="0.4"
                      >
                        ROOT BLOCKER
                      </text>

                      {/* SPID Title */}
                      <text
                        x={chain.rootW - 14}
                        y="26"
                        textAnchor="end"
                        fill="#ffffff"
                        fontSize="13"
                        fontWeight="800"
                        fontFamily="var(--font-mono)"
                      >
                        SPID {chain.rootNode.session_id}
                      </text>

                      {/* Login Name */}
                      <text
                        x="14"
                        y="52"
                        fill="#f8fafc"
                        fontSize="12"
                        fontWeight="600"
                      >
                        {truncate(chain.rootNode.login_name, 19)}
                      </text>

                      {/* Database & Command */}
                      <text
                        x="14"
                        y="71"
                        fill="#94a3b8"
                        fontSize="10.5"
                        fontFamily="var(--font-mono)"
                      >
                        DB: {chain.rootNode.db_name}
                      </text>

                      <text
                        x="14"
                        y="91"
                        fill="#38bdf8"
                        fontSize="10.5"
                        fontWeight="600"
                        fontFamily="var(--font-mono)"
                      >
                        CMD: {chain.rootNode.command}
                      </text>

                      {/* Pulsing Danger Dot */}
                      <circle
                        cx={chain.rootW - 18}
                        cy="90"
                        r="4"
                        fill="#ef4444"
                        className={styles.pulsingDot}
                      />
                    </g>
                  );
                })()}

                {/* 3. Waiter Node Cards */}
                {chain.waiters.map((w, wIdx) => {
                  const isSelected = activeNode.session_id === w.node.session_id;
                  return (
                    <g
                      key={`waiter-card-${cIdx}-${wIdx}`}
                      className={styles.interactiveNode}
                      onClick={() => setSelectedSpid(w.node.session_id)}
                      transform={`translate(${w.x}, ${w.y})`}
                    >
                      {/* Selection Aura */}
                      {isSelected && (
                        <rect
                          x="-4"
                          y="-4"
                          width={w.w + 8}
                          height={w.h + 8}
                          rx="12"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          
                        />
                      )}

                      {/* Main Waiter Card */}
                      <rect
                        width={w.w}
                        height={w.h}
                        rx="8"
                        fill="url(#waiter-card-bg)"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                      />

                      {/* Warning Left Stripe */}
                      <path
                        d="M 2 8 Q 2 2 8 2 L 8 92 Q 2 92 2 86 Z"
                        fill="#f59e0b"
                      />

                      {/* Waiter Badge */}
                      <rect
                        x="14"
                        y="10"
                        width="76"
                        height="18"
                        rx="4"
                        fill="rgba(245, 158, 11, 0.18)"
                        stroke="rgba(245, 158, 11, 0.4)"
                      />
                      <text
                        x="52"
                        y="23"
                        textAnchor="middle"
                        fill="#f59e0b"
                        fontSize="9.5"
                        fontWeight="700"
                        letterSpacing="0.4"
                      >
                        WAITER
                      </text>

                      {/* SPID */}
                      <text
                        x={w.w - 14}
                        y="24"
                        textAnchor="end"
                        fill="#ffffff"
                        fontSize="12.5"
                        fontWeight="700"
                        fontFamily="var(--font-mono)"
                      >
                        SPID {w.node.session_id}
                      </text>

                      {/* Login */}
                      <text
                        x="14"
                        y="48"
                        fill="#f1f5f9"
                        fontSize="11.5"
                        fontWeight="600"
                      >
                        {truncate(w.node.login_name, 22)}
                      </text>

                      {/* DB Name */}
                      <text
                        x="14"
                        y="64"
                        fill="#94a3b8"
                        fontSize="10"
                        fontFamily="var(--font-mono)"
                      >
                        DB: {w.node.db_name}
                      </text>

                      {/* Wait Time Pill */}
                      <rect
                        x="14"
                        y="72"
                        width="110"
                        height="16"
                        rx="4"
                        fill="rgba(245, 158, 11, 0.12)"
                        stroke="rgba(245, 158, 11, 0.3)"
                      />
                      <text
                        x="69"
                        y="84"
                        textAnchor="middle"
                        fill="#f59e0b"
                        fontSize="9.5"
                        fontWeight="700"
                        fontFamily="var(--font-mono)"
                      >
                        ⏳ {formatDuration(w.waitTimeMs)}
                      </text>
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>

        {/* Right Side: Selected Session Deep Inspector */}
        <div className={styles.inspectorPane}>
          <div className={styles.inspectorHeader}>
            <div className={styles.inspectorTitleGroup}>
              <Monitor size={15} color="var(--accent)" />
              <span className={styles.inspectorTitle}>
                Oturum Telemetrisi (SPID {activeNode.session_id})
              </span>
            </div>
            {activeNode.is_root ? (
              <span className={styles.rootBadge}>ROOT BLOCKER</span>
            ) : (
              <span className={styles.waiterBadge}>KİLİTLİ (WAITER)</span>
            )}
          </div>

          <div className={styles.inspectorBody}>
            {/* KPI Telemetry Grid */}
            <div className={styles.telemetryGrid}>
              <div className={styles.telemetryItem}>
                <span className={styles.telemetryLabel}>Kullanıcı (Login)</span>
                <span className={styles.telemetryVal}>{activeNode.login_name}</span>
              </div>
              <div className={styles.telemetryItem}>
                <span className={styles.telemetryLabel}>İstemci (Host)</span>
                <span className={styles.telemetryVal}>{activeNode.host_name}</span>
              </div>
              <div className={styles.telemetryItem}>
                <span className={styles.telemetryLabel}>Veritabanı</span>
                <span className={styles.telemetryVal}>{activeNode.db_name}</span>
              </div>
              <div className={styles.telemetryItem}>
                <span className={styles.telemetryLabel}>Komut / Durum</span>
                <span className={styles.telemetryVal}>
                  {activeNode.command} ({activeNode.status})
                </span>
              </div>
              <div className={styles.telemetryItem}>
                <span className={styles.telemetryLabel}>Bekleme Türü (Wait)</span>
                <span className={`${styles.telemetryVal} ${activeNode.is_root ? styles.dangerValue : styles.waitValue}`}>
                  {activeNode.wait_type}
                </span>
              </div>
              <div className={styles.telemetryItem}>
                <span className={styles.telemetryLabel}>Kilitlenme Süresi</span>
                <span className={`${styles.telemetryVal} ${activeNode.is_root ? styles.dangerValue : styles.waitValue}`}>
                  {formatDuration(activeNode.wait_time_ms ?? 0)}
                </span>
              </div>
            </div>

            {/* SQL Preview */}
            <div className={styles.querySection}>
              <div className={styles.queryHeader}>
                <Terminal size={13} color="var(--accent)" />
                <span>Çalıştırılan T-SQL Sorgu Metni / İstek:</span>
              </div>

              {activeNode.sql_text ? (
                <CodeBlock code={activeNode.sql_text} showCopy maxHeight="130px" />
              ) : (
                <div className={styles.noSqlCard}>
                  <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    {activeNode.is_root
                      ? 'Kök engelleyici oturum şu anda açık bir transaction (Open Tran) tutuyor ve uyku (sleeping) modunda bekliyor olabilir veya sorgu tamamlanmış ancak henüz COMMIT/ROLLBACK edilmemiştir.'
                      : 'Oturum kilit kuyruğunda bekletilmektedir; sorgu önbelleğinden metin henüz çekilemedi.'}
                  </span>
                </div>
              )}
            </div>

            {/* Review-Only Cerrahi Reçeteler */}
            <div className={styles.recipeSection}>
              <div className={styles.recipeTitle}>Cerrahi Müdahale & Teşhis Reçeteleri:</div>

              <div className={styles.recipeButtons}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => handleCopyDiag(activeNode.session_id)}
                >
                  {copiedDiag ? <Check size={13} color="#10b981" /> : <FileCode size={13} />}
                  <span>{copiedDiag ? 'Teşhis SQL Kopyalandı' : 'Kök Neden Teşhis SQL'}</span>
                </button>

                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => handleCopyLocks(activeNode.session_id)}
                >
                  {copiedLocks ? <Check size={13} color="#10b981" /> : <Layers size={13} />}
                  <span>{copiedLocks ? 'Kilit SQL Kopyalandı' : 'sys.dm_tran_locks Sorgusu'}</span>
                </button>

                <button
                  type="button"
                  className={styles.btnDanger}
                  onClick={() => handleCopyKill(activeNode.session_id)}
                  title="Güvenli Review-Only Reçete: Oturumu doğrudan sonlandırmaz, inceleyip çalıştırmanız için T-SQL üretir."
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
