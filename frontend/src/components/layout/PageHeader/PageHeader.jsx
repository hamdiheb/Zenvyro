import styles from './PageHeader.module.css'

// A section heading inside a page body, with optional actions on the right.
export function PageHeader({ title, description = '', actions = null }) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
