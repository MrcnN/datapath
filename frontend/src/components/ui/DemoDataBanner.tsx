import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './DemoDataBanner.module.css';

export default function DemoDataBanner() {
  return (
    <div className={styles.banner} role="alert">
      <AlertTriangle size={18} className={styles.icon} />
      <p className={styles.text}>
        ⚠ Demo Data — You are viewing simulated data. Connect a SQL Server instance to see live data.
      </p>
      <Link to="/instances" className={styles.link}>
        Connect Now →
      </Link>
    </div>
  );
}
