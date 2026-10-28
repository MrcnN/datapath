import React from 'react';
import styles from './StatusBadge.module.css';

export type BadgeStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusBadgeProps {
  status?: BadgeStatus | string;
  variant?: BadgeStatus | string;
  label: string;
  showDot?: boolean;
}

export default function StatusBadge({
  status,
  variant,
  label,
  showDot = true,
}: StatusBadgeProps) {
  const finalStatus = (variant || status || 'neutral').toLowerCase() as BadgeStatus;
  const styleClass = styles[finalStatus] || styles.neutral;

  return (
    <span className={`${styles.badge} ${styleClass}`}>
      {showDot && <span className={styles.dot} />}
      {label}
    </span>
  );
}
