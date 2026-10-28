import { AlertCircle, RefreshCw } from 'lucide-react';
import styles from './ErrorState.module.css';

interface ErrorStateProps {
  message: string;
  title?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, title = 'Something went wrong', onRetry }: ErrorStateProps) {
  return (
    <div className={styles.wrapper}>
      <AlertCircle size={40} className={styles.icon} />
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button className={styles.retryBtn} onClick={onRetry}>
          <RefreshCw size={14} />
          Try Again
        </button>
      )}
    </div>
  );
}
