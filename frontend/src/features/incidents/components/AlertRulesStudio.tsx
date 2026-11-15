import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Play,
  ShieldAlert,
  Server,
  Radio,
  Sliders,
  Send,
  X,
  ExternalLink,
} from 'lucide-react';
import styles from './AlertRulesStudio.module.css';
import {
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
  evaluateAlertRules,
  simulateAlert,
} from '../../../lib/api';
import type {
  AlertRule,
  AlertRuleCreate,
  AlertEvaluationResult,
  AlertMetric,
  AlertOperator,
  AlertSeverity,
  ActiveAlert,
} from '../../../lib/types';

const METRIC_LABELS: Record<AlertMetric, { label: string; defaultUnit: string }> = {
  CPU_UTILIZATION: { label: 'CPU Kullanımı (%)', defaultUnit: '%' },
  MEMORY_PRESSURE: { label: 'Bekleyen Bellek Talebi (Resource Semaphores)', defaultUnit: 'adet' },
  DISK_FREE_SPACE_PCT: { label: 'Disk Boş Alan Oranı (%)', defaultUnit: '%' },
  BLOCKING_DURATION_SEC: { label: 'Maksimum Engelleme Süresi (sn)', defaultUnit: 's' },
  DEADLOCK_RATE_PER_MIN: { label: 'Dakikalık Deadlock Sayısı', defaultUnit: 'adet' },
  CONNECTION_POOL_PCT: { label: 'Bağlantı Havuzu Tüketimi (%)', defaultUnit: '%' },
  TEMPDB_UTILIZATION_PCT: { label: 'TempDB Alan Tüketimi (%)', defaultUnit: '%' },
  LONGEST_TRANSACTION_SEC: { label: 'En Uzun Açık İşlem Süresi (sn)', defaultUnit: 's' },
  PAGE_LIFE_EXPECTANCY: { label: 'Page Life Expectancy (sn)', defaultUnit: 's' },
  BUFFER_CACHE_HIT_RATIO: { label: 'Buffer Cache Hit Ratio (%)', defaultUnit: '%' },
};

export default function AlertRulesStudio() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [evaluation, setEvaluation] = useState<AlertEvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'breached' | 'active'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AlertRuleCreate>({
    name: '',
    metric: 'CPU_UTILIZATION',
    operator: '>',
    threshold: 85,
    unit: '%',
    severity: 'WARNING',
    duration_seconds: 60,
    cooldown_minutes: 15,
    is_enabled: true,
    notify_channels: ['webhook', 'in_app'],
    description: '',
    remediation_hint: '',
  });

  // Simulation Feedback
  const [simulationMsg, setSimulationMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rulesData, evalData] = await Promise.all([
        getAlertRules(),
        evaluateAlertRules(false),
      ]);
      setRules(rulesData);
      setEvaluation(evalData);
    } catch (err) {
      console.error('Failed to load alert rules or evaluation', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      const evalData = await evaluateAlertRules(false);
      setEvaluation(evalData);
    } catch (err) {
      console.error('Failed to re-evaluate rules', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleToggle = async (ruleId: string, currentStatus: boolean) => {
    try {
      const updated = await toggleAlertRule(ruleId, !currentStatus);
      setRules((prev) => prev.map((r) => (r.id === ruleId ? updated : r)));
      // Re-evaluate in background
      handleEvaluate();
    } catch (err) {
      console.error('Failed to toggle rule', err);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!window.confirm('Bu alarm kuralını silmek istediğinizden emin misiniz?')) return;
    try {
      await deleteAlertRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      handleEvaluate();
    } catch (err) {
      console.error('Failed to delete rule', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingRuleId(null);
    setFormData({
      name: '',
      metric: 'CPU_UTILIZATION',
      operator: '>',
      threshold: 85,
      unit: '%',
      severity: 'WARNING',
      duration_seconds: 60,
      cooldown_minutes: 15,
      is_enabled: true,
      notify_channels: ['webhook', 'in_app'],
      description: '',
      remediation_hint: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: AlertRule) => {
    setEditingRuleId(rule.id);
    setFormData({
      name: rule.name,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      unit: rule.unit,
      severity: rule.severity,
      duration_seconds: rule.duration_seconds,
      cooldown_minutes: rule.cooldown_minutes,
      is_enabled: rule.is_enabled,
      notify_channels: rule.notify_channels,
      description: rule.description || '',
      remediation_hint: rule.remediation_hint || '',
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRuleId) {
        const updated = await updateAlertRule(editingRuleId, formData);
        setRules((prev) => prev.map((r) => (r.id === editingRuleId ? updated : r)));
      } else {
        const created = await createAlertRule(formData);
        setRules((prev) => [...prev, created]);
      }
      setIsModalOpen(false);
      handleEvaluate();
    } catch (err) {
      console.error('Failed to save alert rule', err);
    }
  };

  const handleSimulate = async (rule: AlertRule) => {
    try {
      const mockVal = rule.operator === '<' || rule.operator === '<='
        ? rule.threshold - 5
        : rule.threshold + 10;

      const res = await simulateAlert({
        rule_id: rule.id,
        metric: rule.metric,
        mock_value: mockVal,
        send_webhook: false,
      });

      setSimulationMsg(`[${rule.name}] Test: ${res.message}`);
      setTimeout(() => setSimulationMsg(null), 6000);
    } catch (err) {
      console.error('Simulation error', err);
    }
  };

  // Telemetry map from evaluation summaries
  const liveTelemetryMap = new Map<string, { value: number; isBreached: boolean }>();
  if (evaluation?.evaluations) {
    for (const ev of evaluation.evaluations) {
      liveTelemetryMap.set(ev.rule_id, { value: ev.current_value, isBreached: ev.is_breached });
    }
  }

  // Filtered Rules
  const filteredRules = rules.filter((r) => {
    if (filter === 'active') return r.is_enabled;
    if (filter === 'breached') {
      const t = liveTelemetryMap.get(r.id);
      return t?.isBreached;
    }
    return true;
  });

  return (
    <div className={styles.container}>
      {/* Top Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h3>
            <Bell size={18} /> Özel Alarm Kuralları & Eşik Motoru
          </h3>
          <p>
            SQL Server sistem metrikleri, gecikmeler ve işlem kuyrukları için dinamik eşik kuralları yönetimi.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.actionBtn} ${styles.primaryBtn}`}
            onClick={handleOpenCreate}
          >
            <Plus size={14} /> Yeni Kural Ekle
          </button>
          <button
            className={styles.actionBtn}
            onClick={handleEvaluate}
            disabled={isEvaluating}
            title="Canlı DMV telemetrisiyle kuralları yeniden değerlendir"
          >
            <RefreshCw size={14} className={isEvaluating ? styles.spinning : ''} />
            {isEvaluating ? 'Ölçülüyor...' : 'Canlı Değerlendir'}
          </button>
        </div>
      </div>

      {/* Simulation Alert Banner if any */}
      {simulationMsg && (
        <div className={styles.allNormalBox} style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
          <Play size={16} />
          <span>{simulationMsg}</span>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className={styles.summaryGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <Sliders size={13} /> Tanımlı Kurallar
          </div>
          <div className={styles.kpiValue}>
            {rules.length}
            <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 400 }}>
              / {rules.filter((r) => r.is_enabled).length} aktif
            </span>
          </div>
          <div className={styles.kpiSub}>İzlenen DMV ve Sayaç Sayısı</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <AlertTriangle size={13} color={evaluation?.triggered_count ? '#ef4444' : '#10b981'} />
            Tetiklenen İhlaller
          </div>
          <div
            className={styles.kpiValue}
            style={{ color: evaluation?.triggered_count ? '#f87171' : '#34d399' }}
          >
            {evaluation?.triggered_count ?? 0}
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
              ({evaluation?.critical_count ?? 0} kritik, {evaluation?.warning_count ?? 0} uyarı)
            </span>
          </div>
          <div className={styles.kpiSub}>Anlık eşik sınırını aşan durumlar</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <Server size={13} /> Hedef Sunucu
          </div>
          <div className={styles.kpiValue} style={{ fontSize: '1.15rem' }}>
            {evaluation?.server_name || 'SQL-INSTANCE'}
          </div>
          <div className={styles.kpiSub}>
            Son ölçüm: {evaluation?.evaluated_at?.split(' ')[1] || 'Henüz yapılmadı'}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <Send size={13} /> Kriz Webhook Kanalı
          </div>
          <div className={styles.kpiValue} style={{ fontSize: '1.05rem' }}>
            {evaluation?.webhook_enabled ? (
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> {evaluation.webhook_service?.toUpperCase() || 'AKTİF'}
              </span>
            ) : (
              <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                DEVRE DIŞI
              </span>
            )}
          </div>
          <div className={styles.kpiSub}>Slack / Teams / Generic Webhook</div>
        </div>
      </div>

      {/* Active Triggered Alerts Banner */}
      <div className={styles.alertsSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <Radio size={16} color={evaluation?.alerts && evaluation.alerts.length > 0 ? '#ef4444' : '#10b981'} />
            Canlı İhlal Radarı & Operasyonel Bildirimler
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {evaluation?.alerts?.length || 0} aktif ihlal tespit edildi
          </span>
        </div>

        {evaluation?.alerts && evaluation.alerts.length > 0 ? (
          evaluation.alerts.map((alert: ActiveAlert) => (
            <div
              key={alert.rule_id}
              className={`${styles.alertCard} ${
                alert.severity === 'CRITICAL' ? styles.criticalAlert : styles.warningAlert
              }`}
            >
              <div className={styles.alertLeft}>
                <div className={styles.alertHead}>
                  <span
                    className={`${styles.badge} ${
                      alert.severity === 'CRITICAL' ? styles.badgeCritical : styles.badgeWarning
                    }`}
                  >
                    {alert.severity}
                  </span>
                  <span className={styles.alertName}>{alert.rule_name}</span>
                </div>
                <div className={styles.alertMsg}>{alert.message}</div>
                {alert.remediation_hint && (
                  <div className={styles.remediation}>
                    <ShieldAlert size={13} />
                    <span>Öneri: {alert.remediation_hint}</span>
                  </div>
                )}
              </div>
              <div className={styles.alertRight}>
                <span className={styles.alertTime}>{alert.triggered_at}</span>
                <span className={styles.liveValueBreached}>
                  {alert.current_value.toFixed(1)} {alert.unit}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.allNormalBox}>
            <CheckCircle2 size={18} />
            <span>Tüm sistem metrikleri yapılandırılmış eşik sınırları dahilinde stabil seyrediyor.</span>
          </div>
        )}
      </div>

      {/* Rules Table Container */}
      <div className={styles.tableContainer}>
        <div className={styles.tableToolbar}>
          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter('all')}
            >
              Tüm Kurallar ({rules.length})
            </button>
            <button
              className={`${styles.filterBtn} ${filter === 'breached' ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter('breached')}
            >
              Yalnızca İhlal Edilenler ({evaluation?.triggered_count ?? 0})
            </button>
            <button
              className={`${styles.filterBtn} ${filter === 'active' ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter('active')}
            >
              Yalnızca Etkinler ({rules.filter((r) => r.is_enabled).length})
            </button>
          </div>
        </div>

        <table className={styles.rulesTable}>
          <thead>
            <tr>
              <th style={{ width: '50px' }}>Durum</th>
              <th>Kural Adı & Tanım</th>
              <th>Metrik</th>
              <th>Eşik Değeri</th>
              <th>Canlı Ölçüm</th>
              <th>Ciddiyet</th>
              <th style={{ width: '110px', textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.length > 0 ? (
              filteredRules.map((rule) => {
                const telemetry = liveTelemetryMap.get(rule.id);
                return (
                  <tr key={rule.id}>
                    <td>
                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={rule.is_enabled}
                          onChange={() => handleToggle(rule.id, rule.is_enabled)}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </td>
                    <td>
                      <div className={styles.ruleNameCell}>
                        <span className={styles.ruleTitle}>{rule.name}</span>
                        {rule.description && (
                          <span className={styles.ruleDesc}>{rule.description}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles.badgeMetric}`}>
                        {rule.metric}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#f1f5f9' }}>
                        {rule.operator} {rule.threshold} {rule.unit}
                      </span>
                    </td>
                    <td>
                      {!rule.is_enabled ? (
                        <span className={styles.liveValueDisabled}>Kapalı</span>
                      ) : telemetry ? (
                        <span
                          className={
                            telemetry.isBreached
                              ? styles.liveValueBreached
                              : styles.liveValueNormal
                          }
                        >
                          {telemetry.isBreached && <AlertTriangle size={13} />}
                          {telemetry.value.toFixed(1)} {rule.unit}
                        </span>
                      ) : (
                        <span className={styles.liveValueDisabled}>--</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          rule.severity === 'CRITICAL'
                            ? styles.badgeCritical
                            : rule.severity === 'WARNING'
                            ? styles.badgeWarning
                            : styles.badgeInfo
                        }`}
                      >
                        {rule.severity}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.rowActions} style={{ justifyContent: 'flex-end' }}>
                        <button
                          className={styles.iconBtn}
                          onClick={() => handleSimulate(rule)}
                          title="Simüle Test Et"
                        >
                          <Play size={13} />
                        </button>
                        <button
                          className={styles.iconBtn}
                          onClick={() => handleOpenEdit(rule)}
                          title="Düzenle"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={() => handleDelete(rule.id)}
                          title="Sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  Filtreye uygun alarm kuralı bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>{editingRuleId ? 'Alarm Kuralını Düzenle' : 'Yeni Özel Alarm Kuralı'}</h4>
              <button
                className={styles.iconBtn}
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Kural Adı</label>
                  <input
                    className={styles.input}
                    type="text"
                    required
                    placeholder="Örn: Kritik Bellek Tüketimi"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>İzlenecek Metrik</label>
                    <select
                      className={styles.select}
                      value={formData.metric}
                      onChange={(e) => {
                        const m = e.target.value as AlertMetric;
                        setFormData({
                          ...formData,
                          metric: m,
                          unit: METRIC_LABELS[m]?.defaultUnit || '%',
                        });
                      }}
                    >
                      {Object.entries(METRIC_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Operatör & Eşik Değeri</label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <select
                        className={styles.select}
                        style={{ width: '70px' }}
                        value={formData.operator}
                        onChange={(e) =>
                          setFormData({ ...formData, operator: e.target.value as AlertOperator })
                        }
                      >
                        <option value=">">&gt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<">&lt;</option>
                        <option value="<=">&lt;=</option>
                        <option value="==">==</option>
                      </select>
                      <input
                        className={styles.input}
                        type="number"
                        step="0.1"
                        required
                        style={{ flex: 1 }}
                        value={formData.threshold}
                        onChange={(e) =>
                          setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })
                        }
                      />
                      <input
                        className={styles.input}
                        type="text"
                        style={{ width: '50px' }}
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Kriz Ciddiyeti</label>
                    <select
                      className={styles.select}
                      value={formData.severity}
                      onChange={(e) =>
                        setFormData({ ...formData, severity: e.target.value as AlertSeverity })
                      }
                    >
                      <option value="CRITICAL">CRITICAL (Kritik - Kırmızı)</option>
                      <option value="WARNING">WARNING (Uyarı - Sarı)</option>
                      <option value="INFO">INFO (Bilgi - Mavi)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Min. Aşılma Süresi (Saniye)</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      value={formData.duration_seconds}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_seconds: parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Açıklama / Tetiklenme Senaryosu</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Bu kural ne zaman tetiklenmeli?"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>DBA Operasyonel Çözüm Önerisi (Remediation Hint)</label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    placeholder="Kural ihlal edildiğinde nöbetçi DBA'ya gösterilecek aksiyon önerisi..."
                    value={formData.remediation_hint || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, remediation_hint: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className={`${styles.actionBtn} ${styles.primaryBtn}`}
                >
                  {editingRuleId ? 'Güncelle' : 'Kuralı Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
