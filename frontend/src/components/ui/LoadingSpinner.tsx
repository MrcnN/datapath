import React from 'react';
import styles from './LoadingSpinner.module.css';

export interface LoadingSpinnerProps {
  label?: string;
  message?: string;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoadingSpinner({
  label,
  message,
  text,
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  const displayText = message || text || label || 'Yükleniyor...';

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`}>
      <div className={`${styles.spinner} ${size !== 'md' ? styles[size] : ''}`} />
      {displayText && <span className={styles.label}>{displayText}</span>}
    </div>
  );
}
