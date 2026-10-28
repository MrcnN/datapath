import { useApi } from '../../../lib/useApi';
import { getInstanceMetadata } from '../../../lib/api';
import { formatMB } from '../../../lib/utils';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import styles from './InstanceMetadata.module.css';

export default function InstanceMetadata() {
  const { data, loading, error, refetch } = useApi(getInstanceMetadata);

  if (loading) return <LoadingSpinner label="Fetching instance info..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const items = [
    { key: 'Server Name', val: data.server_name },
    { key: 'Version', val: data.product_version },
    { key: 'Edition', val: data.server_edition },
    { key: 'Service Pack', val: data.product_level },
    { key: 'Platform', val: data.platform },
    { key: 'OS', val: data.os },
    { key: 'CPU Count', val: String(data.cpu_count) },
    { key: 'Memory', val: formatMB(data.memory_mb) },
    { key: 'Collation', val: data.collation },
    { key: 'Clustered', val: data.is_clustered ? 'Yes' : 'No' },
    { key: 'HADR Enabled', val: data.is_hadr_enabled ? 'Yes' : 'No' },
  ];

  if (data.sql_service_account) {
    items.push({ key: 'Service Account', val: data.sql_service_account });
  }
  if (data.start_time) {
    items.push({ key: 'Start Time', val: data.start_time });
  }

  return (
    <div className={styles.meta}>
      {items.map(({ key, val }) => (
        <div key={key} className={styles.item}>
          <span className={styles.itemKey}>{key}</span>
          <span className={styles.itemVal}>{val}</span>
        </div>
      ))}
    </div>
  );
}
