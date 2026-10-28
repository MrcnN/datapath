import { useState } from 'react';
import { CheckCircle2, XCircle, Wifi, Loader2 } from 'lucide-react';
import { testConnection } from '../../../lib/api';
import type { ConnectionConfig, ConnectionTestResult } from '../../../lib/types';
import styles from './ConnectionForm.module.css';

const DRIVERS = [
  'ODBC Driver 18 for SQL Server',
  'ODBC Driver 17 for SQL Server',
  'SQL Server Native Client 11.0',
  'SQL Server',
];

interface ConnectionFormProps {
  onConnected?: (result: ConnectionTestResult) => void;
}

export default function ConnectionForm({ onConnected }: ConnectionFormProps) {
  const [config, setConfig] = useState<ConnectionConfig>({
    server: '',
    database: 'master',
    username: '',
    password: '',
    use_windows_auth: false,
    driver: DRIVERS[0],
    port: 1433,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ConnectionConfig, string>>>({});
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!config.server.trim()) errs.server = 'Server is required';
    if (!config.database.trim()) errs.database = 'Database is required';
    if (!config.use_windows_auth) {
      if (!config.username?.trim()) errs.username = 'Username is required';
      if (!config.password?.trim()) errs.password = 'Password is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleTest = async () => {
    if (!validate()) return;
    setTesting(true);
    setResult(null);
    try {
      const res = await testConnection(config);
      setResult(res);
      if (res.success) onConnected?.(res);
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const update = <K extends keyof ConnectionConfig>(key: K, value: ConnectionConfig[K]) => {
    setConfig(c => ({ ...c, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label}>Server / Host</label>
        <input
          className={styles.input}
          type="text"
          placeholder="localhost or 192.168.1.1"
          value={config.server}
          onChange={e => update('server', e.target.value)}
        />
        {errors.server && <span className={styles.error}>{errors.server}</span>}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Database</label>
        <input
          className={styles.input}
          type="text"
          placeholder="master"
          value={config.database}
          onChange={e => update('database', e.target.value)}
        />
        {errors.database && <span className={styles.error}>{errors.database}</span>}
      </div>

      <div
        className={styles.toggle}
        onClick={() => update('use_windows_auth', !config.use_windows_auth)}
      >
        <div className={`${styles.toggleSwitch} ${config.use_windows_auth ? styles.on : ''}`} />
        <span className={styles.toggleLabel}>Use Windows Authentication</span>
      </div>

      {!config.use_windows_auth && (
        <>
          <div className={styles.field}>
            <label className={styles.label}>Username</label>
            <input
              className={styles.input}
              type="text"
              placeholder="sa"
              value={config.username ?? ''}
              onChange={e => update('username', e.target.value)}
            />
            {errors.username && <span className={styles.error}>{errors.username}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={config.password ?? ''}
              onChange={e => update('password', e.target.value)}
            />
            {errors.password && <span className={styles.error}>{errors.password}</span>}
          </div>
        </>
      )}

      <div className={styles.field}>
        <label className={styles.label}>ODBC Driver</label>
        <select
          className={styles.select}
          value={config.driver}
          onChange={e => update('driver', e.target.value)}
        >
          {DRIVERS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Port</label>
        <input
          className={styles.input}
          type="number"
          value={config.port ?? 1433}
          onChange={e => update('port', parseInt(e.target.value) || 1433)}
        />
      </div>

      <div className={styles.actions}>
        <button
          className={styles.btnPrimary}
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? (
            <><Loader2 size={16} className="spin" /> Testing...</>
          ) : (
            <><Wifi size={16} /> Test Connection</>
          )}
        </button>
      </div>

      {result && (
        <div className={`${styles.result} ${result.success ? styles.success : styles.error}`}>
          <span className={styles.resultIcon}>
            {result.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          </span>
          <div>
            <div>{result.message}</div>
            {result.server_version && (
              <div style={{ marginTop: '4px', opacity: 0.8 }}>
                {result.server_version} · {result.server_edition}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
