import React from 'react';
import EmptyState from '../../../components/ui/EmptyState';
import type { TimelineEvent } from '../../../lib/types';
import styles from './IncidentTimeline.module.css';

interface IncidentTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
}

export default function IncidentTimeline({ events }: IncidentTimelineProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="Olay Kaydı Yok"
        message="Son 24 saat içinde tespit edilmiş bir kilitlenme (deadlock), başarısız iş veya kritik hata olayı bulunmuyor."
      />
    );
  }

  return (
    <div className={styles.timeline}>
      {events.map((ev, idx) => (
        <div
          key={idx}
          className={`${styles.item} ${ev.severity === 'error' || ev.event_type === 'deadlock' ? styles.itemError : ''}`}
        >
          <div className={styles.itemHeader}>
            <span className={styles.itemTitle}>
              [{ev.event_type.toUpperCase()}] {ev.title}
            </span>
            <span className={styles.itemDate}>
              {new Date(
                (ev as any).event_time ?? ev.timestamp ?? Date.now()
              ).toLocaleString('tr-TR')}
            </span>
          </div>
          <p className={styles.itemDesc}>{ev.description}</p>
        </div>
      ))}
    </div>
  );
}
