import styles from './EmptyState.module.css'

export function EmptyState({ icon = null, title, description = '', action = null, className = '' }) {
  return (
    <div className={`${styles.emptyState} ${className}`}>
      {icon && <div className={styles.iconCircle}>{icon}</div>}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
