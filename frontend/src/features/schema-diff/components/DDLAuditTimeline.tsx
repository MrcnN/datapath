import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  User,
  Clock,
  Terminal,
  ShieldAlert,
  Database,
  Copy,
  Layers,
  FileCode,
  Check,
} from 'lucide-react';
import styles from './DDLAuditTimeline.module.css';
import { getDDLAuditEvents } from '../../../lib/api';
import type {
  DDLAuditResponse,
  DDLEventItem,
  DDLActionType,
} from '../../../lib/types';

export default function DDLAuditTimeline() {
  const [auditData, setAuditData] = useState<DDLAuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getDDLAuditEvents();
      setAuditData(data);
    } catch (err) {
      console.error('Failed to load DDL audit events', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyRollback = (eventId: string, script: string) => {
    navigator.clipboard.writeText(script);
    setCopiedId(eventId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const summary = auditData?.summary;
  const events = auditData?.events || [];

  // Filter events
  const filteredEvents = events.filter((ev) => {
    const matchesAction =
      selectedAction === 'ALL' || ev.action_type === selectedAction;

    const matchesSearch =
      ev.object_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.login_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.application_name && ev.application_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      ev.database_name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesAction && matchesSearch;
  });

  return (
    <div className={styles.container}>
      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h3>
            <History size={18} /> DDL Değişiklik Takip &amp; Denetim İzi (DDL Audit Timeline)
          </h3>
          <p>
            Veritabanında yürütülen tüm CREATE, ALTER ve DROP şema operasyonları, bunları uygulayan kullanıcılar ve etki analizi.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.actionBtn}
            onClick={loadData}
            disabled={isLoading}
            title="Şema değişiklik günlüğünü yenile"
          >
            <RefreshCw size={14} className={isLoading ? styles.spinning : ''} />
            {isLoading ? 'Yenileniyor...' : 'Denetim İzini Yenile'}
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className={styles.summaryGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <History size={13} /> Kayıtlı DDL Olayları
          </div>
          <div className={styles.kpiValue}>
            {summary?.total_events ?? 0}
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
              değişiklik
            </span>
          </div>
          <div className={styles.kpiSub}>
            {summary?.create_count ?? 0} Create, {summary?.alter_count ?? 0} Alter, {summary?.drop_count ?? 0} Drop
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <AlertTriangle
              size={13}
              color={summary?.critical_changes_count ? '#ef4444' : '#10b981'}
            />
            Kritik / Yüksek Riskli
          </div>
          <div
            className={styles.kpiValue}
            style={{
              color: (summary?.critical_changes_count ?? 0) > 0 ? '#f87171' : '#34d399',
            }}
          >
            {summary?.critical_changes_count ?? 0}
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
              operasyon
            </span>
          </div>
          <div className={styles.kpiSub}>Drop ve Sch-M kilitlenmesi yaratan işlemler</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <User size={13} /> Değişiklik Yapan Hesaplar
          </div>
          <div className={styles.kpiValue}>
            {summary?.unique_users_count ?? 0}
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
              kullanıcı / bot
            </span>
          </div>
          <div className={styles.kpiSub}>CI/CD pipeline, DBA ve uygulama araçları</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <Clock size={13} /> Son Yapısal Değişiklik
          </div>
          <div className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>
            {summary?.last_change_time ? summary.last_change_time.split(' ')[1] : 'Yok'}
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>
              {summary?.last_change_time ? summary.last_change_time.split(' ')[0] : ''}
            </span>
          </div>
          <div className={styles.kpiSub}>
            Kaynak: {auditData?.source || 'DEFAULT_TRACE'}
          </div>
        </div>
      </div>

      {/* Timeline & Filters Container */}
      <div className={styles.timelineContainer}>
        <div className={styles.toolbar}>
          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterBtn} ${selectedAction === 'ALL' ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedAction('ALL')}
            >
              Tüm Eylemler ({events.length})
            </button>
            <button
              className={`${styles.filterBtn} ${selectedAction === 'ALTER' ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedAction('ALTER')}
            >
              Yalnızca ALTER ({summary?.alter_count ?? 0})
            </button>
            <button
              className={`${styles.filterBtn} ${selectedAction === 'CREATE' ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedAction('CREATE')}
            >
              Yalnızca CREATE ({summary?.create_count ?? 0})
            </button>
            <button
              className={`${styles.filterBtn} ${selectedAction === 'DROP' ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedAction('DROP')}
            >
              Yalnızca DROP ({summary?.drop_count ?? 0})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={14} color="#64748b" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Nesne, kullanıcı veya uygulama ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Event List */}
        <div className={styles.eventList}>
          {filteredEvents.length > 0 ? (
            filteredEvents.map((ev: DDLEventItem) => {
              const isDrop = ev.action_type === 'DROP';
              const isAlter = ev.action_type === 'ALTER';
              const isCrit = ev.risk_level === 'CRITICAL';
              const isHigh = ev.risk_level === 'HIGH';

              return (
                <div key={ev.event_id} className={styles.eventCard}>
                  <div className={styles.eventHeader}>
                    <div className={styles.eventMetaLeft}>
                      <span
                        className={`${styles.badge} ${
                          isDrop
                            ? styles.badgeDrop
                            : isAlter
                            ? styles.badgeAlter
                            : styles.badgeCreate
                        }`}
                      >
                        {ev.action_type}
                      </span>
                      <span className={styles.objTitle}>
                        {ev.schema_name ? `${ev.schema_name}.` : ''}
                        {ev.object_name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: '#94a3b8',
                          background: 'rgba(51, 65, 85, 0.4)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: 4,
                        }}
                      >
                        {ev.object_type}
                      </span>
                      <span className={styles.dbName}>
                        <Database size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                        {ev.database_name}
                      </span>
                    </div>

                    <div className={styles.eventTime}>
                      <Clock size={12} />
                      <span>{ev.event_time}</span>
                    </div>
                  </div>

                  <div className={styles.eventDetailsRow}>
                    <span className={styles.userTag}>
                      <User size={12} />
                      <strong>{ev.login_name}</strong>
                    </span>
                    {ev.host_name && <span>({ev.host_name})</span>}
                    {ev.application_name && (
                      <span className={styles.appTag}>
                        <Terminal size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                        {ev.application_name}
                      </span>
                    )}
                    {ev.session_id && (
                      <span style={{ color: '#64748b' }}>SPID: {ev.session_id}</span>
                    )}
                    <span
                      className={`${styles.badge} ${
                        isCrit
                          ? styles.badgeRiskCritical
                          : isHigh
                          ? styles.badgeRiskHigh
                          : styles.badgeRiskLow
                      }`}
                    >
                      {ev.risk_level} RİSK
                    </span>
                  </div>

                  <div
                    className={`${styles.impactBox} ${
                      isCrit ? styles.impactCritical : isHigh ? styles.impactWarning : ''
                    }`}
                  >
                    <span>{ev.impact_summary}</span>
                    {ev.remediation_or_rollback_hint && (
                      <button
                        className={styles.rollbackHint}
                        onClick={() => handleCopyRollback(ev.event_id, ev.remediation_or_rollback_hint!)}
                        title="Geri alma veya inceleme T-SQL betiğini kopyala"
                      >
                        {copiedId === ev.event_id ? (
                          <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={12} /> Kopyalandı
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Copy size={12} /> Betiği Kopyala
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              Filtre kriterlerine uygun DDL değişiklik olayı bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
