import React, { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.titleArea}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h1 className={styles.title} title={subtitle || title}>{title}</h1>
          {badge}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
