import styles from './StatusPill.module.css'

const STATUS_LABELS = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  escalated: 'Escalated',
}

export function StatusPill({ status }) {
  return <span className={`${styles.pill} ${styles[status] || ''}`}>{STATUS_LABELS[status] || status}</span>
}
