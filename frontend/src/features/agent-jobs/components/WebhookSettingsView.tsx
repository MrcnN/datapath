import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Save,
  Radio,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { getWebhookConfig, updateWebhookConfig, testWebhook } from '../../../lib/api';
import type { WebhookConfig, WebhookServiceType, WebhookTestResponse } from '../../../lib/types';
import styles from './WebhookSettingsView.module.css';

const providerPlaceholders: Record<WebhookServiceType, string> = {
  slack: 'https://hooks.slack.com/services/T00/B00/XXXXX',
  teams: 'https://outlook.office.com/webhook/XXXX/IncomingWebhook/XXXX',
  discord: 'https://discord.com/api/webhooks/12345/XXXXX',
  generic: 'https://api.yourcompany.com/webhook/datapath-alerts',
};

export default function WebhookSettingsView() {
  const [config, setConfig] = useState<WebhookConfig>({
    enabled: false,
    url: '',
    service_type: 'slack',
    min_severity: 17,
    notify_on_deadlocks: true,
    notify_on_suspect_pages: true,
    notify_on_high_severity_errors: true,
    channel_name: '',
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<WebhookTestResponse | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await getWebhookConfig();
        setConfig(res);
      } catch (err) {
        console.warn('Could not load webhook config:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveStatus(null);
      await updateWebhookConfig(config);
      setSaveStatus('Ayarlar başarıyla kaydedildi.');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      alert('Ayarlar kaydedilemedi: ' + String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config.url) {
      alert('Lütfen önce geçerli bir Webhook URL girin.');
      return;
    }
    try {
      setTesting(true);
      setTestResult(null);
      const res = await testWebhook(config.url, config.service_type);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        status_code: 500,
        message: String(err.message || err),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        {/* Panel Header */}
        <div className={styles.panelHeader}>
          <div className={styles.titleArea}>
            <Send size={18} className={styles.titleIcon} />
            <h3 className={styles.titleText}>Canlı Kriz Bildirim Webhook'u (Slack / Teams / Discord)</h3>
          </div>

          <div
            className={styles.enableToggle}
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
          >
            <div className={`${styles.switch} ${config.enabled ? styles.switchActive : ''}`}>
              <div className={`${styles.handle} ${config.enabled ? styles.handleActive : ''}`} />
            </div>
            <span className={styles.toggleLabel}>
              {config.enabled ? 'Bildirimler Aktif' : 'Devre Dışı'}
            </span>
          </div>
        </div>

        {/* Configuration Form */}
        <div className={styles.formGrid}>
          {/* Provider Selection */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Bildirim Kanalı / Platform</label>
            <select
              className={styles.select}
              value={config.service_type}
              onChange={(e) =>
                setConfig({ ...config, service_type: e.target.value as WebhookServiceType })
              }
            >
              <option value="slack">Slack (Incoming Webhook / Block Kit)</option>
              <option value="teams">Microsoft Teams (MessageCard / Workflow)</option>
              <option value="discord">Discord (Channel Webhook / Embeds)</option>
              <option value="generic">Standart Webhook (JSON Payload)</option>
            </select>
            <span className={styles.hint}>
              Platforma özel optimize edilmiş kriz bildirim şablonu kullanılır.
            </span>
          </div>

          {/* Webhook URL */}
          <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
            <label className={styles.label}>Webhook URL Adresi</label>
            <input
              type="text"
              className={styles.input}
              placeholder={providerPlaceholders[config.service_type]}
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
            />
            <span className={styles.hint}>
              Slack/Teams/Discord yönetim panelinden oluşturulan gelen webhook (Incoming Webhook) URL'si.
            </span>
          </div>

          {/* Min Severity */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Minimum Hata Seviyesi (Severity Eşiği)</label>
            <select
              className={styles.select}
              value={config.min_severity}
              onChange={(e) => setConfig({ ...config, min_severity: Number(e.target.value) })}
            >
              <option value={17}>Severity 17 (Yetersiz Kaynaklar & Donanım Sınırları)</option>
              <option value={19}>Severity 19 (Önemli SQL Server Hataları)</option>
              <option value={20}>Severity 20 (Öldürücü Sistem & Bozulma Hataları)</option>
            </select>
            <span className={styles.hint}>
              Yalnızca bu seviye ve üzerindeki kritik olaylarda bildirim tetiklenir.
            </span>
          </div>

          {/* Channel Name */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Kanal veya Takım Etiketi (Opsiyonel)</label>
            <input
              type="text"
              className={styles.input}
              placeholder="#dba-critical-alerts veya On-Call DBA"
              value={config.channel_name || ''}
              onChange={(e) => setConfig({ ...config, channel_name: e.target.value })}
            />
            <span className={styles.hint}>Rapor başlığında görüntülenecek bilgilendirme etiketi.</span>
          </div>
        </div>

        {/* Trigger Events */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Tetiklenecek Kriz Olayları</label>
          <div className={styles.checkboxesSection}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={config.notify_on_deadlocks}
                onChange={(e) => setConfig({ ...config, notify_on_deadlocks: e.target.checked })}
              />
              <span>
                <strong>Kilitlenme (Deadlock) Patlamaları:</strong> <code>system_health</code> ring
                buffer üzerinde yeni bir kilitlenme tespit edildiğinde bildirim fırlat.
              </span>
            </label>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={config.notify_on_suspect_pages}
                onChange={(e) => setConfig({ ...config, notify_on_suspect_pages: e.target.checked })}
              />
              <span>
                <strong>Fiziksel Disk ve Sayfa Bozulması (Error 823/824):</strong>{' '}
                <code>msdb.dbo.suspect_pages</code> tablosuna bozuk sayfa yazıldığında anında alarm ver.
              </span>
            </label>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={config.notify_on_high_severity_errors}
                onChange={(e) =>
                  setConfig({ ...config, notify_on_high_severity_errors: e.target.checked })
                }
              />
              <span>
                <strong>Kritik Sistem Alarmları (sysalerts):</strong> Donanım arızası veya öldürücü
                motor durdurma alarmlarında mesaj ilet.
              </span>
            </label>
          </div>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div className={testResult.success ? styles.testResultSuccess : styles.testResultError}>
            {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}

        {saveStatus && (
          <div className={styles.testResultSuccess}>
            <CheckCircle2 size={16} />
            <span>{saveStatus}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.actionsRow}>
          <div className={styles.actionBtns}>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={14} />
              <span>{saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}</span>
            </button>

            <button
              type="button"
              className={styles.testBtn}
              onClick={handleTest}
              disabled={testing || !config.url}
            >
              <Send size={14} />
              <span>{testing ? 'Gönderiliyor...' : 'Test Bildirimi Gönder'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
