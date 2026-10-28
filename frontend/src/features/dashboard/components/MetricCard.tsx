import { ReactNode } from 'react';
import styles from './MetricCard.module.css';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconBg?: string;
  subtext?: string;
  trend?: { direction: 'up' | 'down' | 'neutral'; label: string };
}

export default function MetricCard({
  label,
  value,
  icon,
  iconBg = 'var(--bg-elevated)',
  subtext,
  trend,
}: MetricCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.icon} style={{ backgroundColor: iconBg }}>
          {icon}
        </div>
        {trend && (
          <span className={`${styles.trend} ${styles[trend.direction]}`}>
            {trend.label}
          </span>
        )}
      </div>
      <div>
        <div className={styles.value}>{value}</div>
        <div className={styles.label}>{label}</div>
      </div>
      {subtext && <div className={styles.subtext}>{subtext}</div>}
    </div>
  );
}
