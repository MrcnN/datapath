import { Inbox } from 'lucide-react';
import { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: ReactNode;
}

export default function EmptyState({
  title = 'No data found',
  message = 'There is nothing to display here.',
  icon,
}: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.icon}>{icon ?? <Inbox size={40} />}</div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
