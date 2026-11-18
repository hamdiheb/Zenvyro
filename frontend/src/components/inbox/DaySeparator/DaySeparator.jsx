import styles from './DaySeparator.module.css'

export function DaySeparator({ label }) {
  return (
    <div className={styles.daySeparator} role="separator">
      <span className={styles.label}>{label}</span>
    </div>
  )
}
