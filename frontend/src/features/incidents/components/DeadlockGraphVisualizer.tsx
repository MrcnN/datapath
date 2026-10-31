import React, { useState } from 'react';
import {
  Skull,
  CheckCircle2,
  Lock,
  Database,
  Terminal,
  AlertTriangle,
  Lightbulb,
  X,
} from 'lucide-react';
import type { DeadlockResult, DeadlockProcess, DeadlockResource } from '../../../lib/types';
import styles from './DeadlockGraphVisualizer.module.css';

interface DeadlockGraphVisualizerProps {
  result: DeadlockResult;
}

export default function DeadlockGraphVisualizer({ result }: DeadlockGraphVisualizerProps) {
  const processes = result.processes || [];
  const resources = result.resources || [];
  const victims = result.victims || [];

  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(
    processes.length > 0 ? processes[0].process_id : null
  );

  if (processes.length === 0) {
    return null;
  }

  // 2-Process Standard Topology coordinates
  // Canvas width: 720, height: 340
  const isTwoProcesses = processes.length === 2;

  const proc1 = processes[0];
  const proc2 = processes[1] || processes[0];

  const p1IsVictim = victims.includes(proc1.process_id);
  const p2IsVictim = victims.includes(proc2.process_id);

  // Resource 1 & 2
  const res1 = resources[0] || {
    object_name: 'KeyLock / Index (PK_Orders)',
    mode: 'X',
    resource_type: 'KEY',
  };
  const res2 = resources[1] || {
    object_name: 'PageLock / Table (Orders)',
    mode: 'S',
    resource_type: 'PAGE',
  };

  const selectedProcess = processes.find((p) => p.process_id === selectedProcessId) || processes[0];

  return (
    <div className={styles.graphContainer}>
      {/* Header & Legend */}
      <div className={styles.graphHeader}>
        <div className={styles.headerTitle}>
          <Lock size={16} color="var(--accent)" />
          <span>İnteraktif Kilitlenme Döngüsü Şeması (Deadlock Dependency Graph)</span>
        </div>

        <div className={styles.legendBar}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotVictim}`} />
            <span>Kurban (Rollback)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotWinner}`} />
            <span>Hayatta Kalan (Survivor)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotResource}`} />
            <span>Kilit Kaynağı</span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <div className={styles.svgWrapper}>
        <svg
          viewBox="0 0 760 360"
          className={styles.svgCanvas}
          width="100%"
          height="360"
        >
          <defs>
            {/* Arrow Marker: Green (Holds Lock) */}
            <marker
              id="arrow-holds"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>

            {/* Arrow Marker: Red (Waiting for Lock) */}
            <marker
              id="arrow-wait"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
            </marker>
          </defs>

          {/* ── Directed Connectors (Circular Deadlock Cycle) ── */}

          {/* Arc 1: Process 1 HOLDS Resource 1 (Top Left Arc - Green) */}
          <path
            d="M 190 120 C 230 70, 270 70, 310 85"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            markerEnd="url(#arrow-holds)"
          />
          <text x="240" y="65" fill="#10b981" fontSize="11" fontWeight="700">
            TUTUYOR (Holds)
          </text>

          {/* Arc 2: Process 2 WAITING FOR Resource 1 (Top Right Arc - Red) */}
          <path
            d="M 570 120 C 530 70, 490 70, 450 85"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeDasharray="5 3"
            markerEnd="url(#arrow-wait)"
          />
          <text x="475" y="65" fill="#ef4444" fontSize="11" fontWeight="700">
            BEKLİYOR (Waits)
          </text>

          {/* Arc 3: Process 2 HOLDS Resource 2 (Bottom Right Arc - Green) */}
          <path
            d="M 570 240 C 530 290, 490 290, 450 275"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            markerEnd="url(#arrow-holds)"
          />
          <text x="475" y="305" fill="#10b981" fontSize="11" fontWeight="700">
            TUTUYOR (Holds)
          </text>

          {/* Arc 4: Process 1 WAITING FOR Resource 2 (Bottom Left Arc - Red) */}
          <path
            d="M 190 240 C 230 290, 270 290, 310 275"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeDasharray="5 3"
            markerEnd="url(#arrow-wait)"
          />
          <text x="240" y="305" fill="#ef4444" fontSize="11" fontWeight="700">
            BEKLİYOR (Waits)
          </text>

          {/* ── Process Node 1 (Left) ── */}
          <g
            className={styles.nodeProcess}
            onClick={() => setSelectedProcessId(proc1.process_id)}
          >
            <rect
              x="50"
              y="110"
              width="155"
              height="140"
              rx="10"
              fill={selectedProcessId === proc1.process_id ? '#1e293b' : '#111827'}
              stroke={p1IsVictim ? '#ef4444' : '#10b981'}
              strokeWidth={selectedProcessId === proc1.process_id ? 3 : 2}
            />
            {/* Status Pill */}
            <rect
              x="62"
              y="125"
              width="131"
              height="22"
              rx="4"
              fill={p1IsVictim ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}
            />
            <text
              x="127"
              y="140"
              textAnchor="middle"
              fill={p1IsVictim ? '#ef4444' : '#10b981'}
              fontSize="11"
              fontWeight="800"
            >
              {p1IsVictim ? 'KURBAN (VICTIM)' : 'KAZANAN (SURVIVOR)'}
            </text>

            <text x="65" y="172" fill="#ffffff" fontSize="13" fontWeight="700">
              SPID / ID: {proc1.process_id}
            </text>
            <text x="65" y="194" fill="#94a3b8" fontSize="11">
              Host: {proc1.hostname || 'Bilinmiyor'}
            </text>
            <text x="65" y="214" fill="#94a3b8" fontSize="11">
              User: {proc1.login || 'app_user'}
            </text>
            <text x="65" y="234" fill="#38bdf8" fontSize="10.5" fontWeight="600">
              {proc1.wait_type || 'LCK_M_X'}
            </text>
          </g>

          {/* ── Process Node 2 (Right) ── */}
          <g
            className={styles.nodeProcess}
            onClick={() => setSelectedProcessId(proc2.process_id)}
          >
            <rect
              x="555"
              y="110"
              width="155"
              height="140"
              rx="10"
              fill={selectedProcessId === proc2.process_id ? '#1e293b' : '#111827'}
              stroke={p2IsVictim ? '#ef4444' : '#10b981'}
              strokeWidth={selectedProcessId === proc2.process_id ? 3 : 2}
            />
            {/* Status Pill */}
            <rect
              x="567"
              y="125"
              width="131"
              height="22"
              rx="4"
              fill={p2IsVictim ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}
            />
            <text
              x="632"
              y="140"
              textAnchor="middle"
              fill={p2IsVictim ? '#ef4444' : '#10b981'}
              fontSize="11"
              fontWeight="800"
            >
              {p2IsVictim ? 'KURBAN (VICTIM)' : 'KAZANAN (SURVIVOR)'}
            </text>

            <text x="570" y="172" fill="#ffffff" fontSize="13" fontWeight="700">
              SPID / ID: {proc2.process_id}
            </text>
            <text x="570" y="194" fill="#94a3b8" fontSize="11">
              Host: {proc2.hostname || 'Bilinmiyor'}
            </text>
            <text x="570" y="214" fill="#94a3b8" fontSize="11">
              User: {proc2.login || 'report_user'}
            </text>
            <text x="570" y="234" fill="#38bdf8" fontSize="10.5" fontWeight="600">
              {proc2.wait_type || 'LCK_M_S'}
            </text>
          </g>

          {/* ── Resource Node 1 (Top Center Box) ── */}
          <g className={styles.nodeResource}>
            <rect
              x="300"
              y="60"
              width="160"
              height="65"
              rx="8"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            <text x="380" y="82" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="700">
              🔒 {res1.resource_type || 'KEY LOCK'} (Mode: {res1.mode || 'X'})
            </text>
            <text x="380" y="104" textAnchor="middle" fill="#f1f5f9" fontSize="11" fontWeight="600">
              {res1.object_name || 'Tablo / Nesne 1'}
            </text>
          </g>

          {/* ── Resource Node 2 (Bottom Center Box) ── */}
          <g className={styles.nodeResource}>
            <rect
              x="300"
              y="235"
              width="160"
              height="65"
              rx="8"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            <text x="380" y="257" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="700">
              🔒 {res2.resource_type || 'PAGE LOCK'} (Mode: {res2.mode || 'S'})
            </text>
            <text x="380" y="279" textAnchor="middle" fill="#f1f5f9" fontSize="11" fontWeight="600">
              {res2.object_name || 'Tablo / Nesne 2'}
            </text>
          </g>
        </svg>
      </div>

      {/* Selected Process Detail Card */}
      {selectedProcess && (
        <div className={styles.selectedDetailCard}>
          <div className={styles.detailCardHeader}>
            <div className={styles.detailTitle}>
              {victims.includes(selectedProcess.process_id) ? (
                <Skull size={15} color="#ef4444" />
              ) : (
                <CheckCircle2 size={15} color="#10b981" />
              )}
              <span>
                Seçili Süreç Detayı: <strong>{selectedProcess.process_id}</strong> (
                {victims.includes(selectedProcess.process_id)
                  ? 'Kurban Olarak Rollback Edildi'
                  : 'İşlemi Başarıyla Tamamlandı'}
                )
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Detayları incelemek için şemadaki diğer kutulara tıklayın
            </span>
          </div>

          <div className={styles.detailMeta}>
            <div className={styles.detailMetaItem}>
              Veritabanı: <strong>{selectedProcess.db_name || 'Varsayılan'}</strong>
            </div>
            <div className={styles.detailMetaItem}>
              Login: <strong>{selectedProcess.login || '—'}</strong>
            </div>
            <div className={styles.detailMetaItem}>
              İstemci / Uygulama: <strong>{selectedProcess.client_app || 'SQL Client'}</strong>
            </div>
            <div className={styles.detailMetaItem}>
              Bekleme Türü: <strong>{selectedProcess.wait_type || 'LCK_M_X'}</strong>
            </div>
          </div>

          {/* SQL Text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              Kilitlenme Anında Yürütülen T-SQL İfadesi:
            </span>
            <div className={styles.sqlPreview}>
              {selectedProcess.sql_text || '-- SQL metni XML içerisinde bulunamadı.'}
            </div>
          </div>

          {/* Root-cause Remediation Advice */}
          <div className={styles.recsBanner}>
            <Lightbulb size={15} style={{ flexShrink: 0 }} />
            <span>
              <strong>DBA Çözüm Tavsiyesi:</strong> İki sorgu nesneleri ters sırada güncelliyor. Her
              iki transaction içinde tablolara aynı sıralamayla (örn: önce Tablo A, sonra Tablo B)
              erişin veya eksik indeks ekleyerek kilit taramasını daraltın.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
