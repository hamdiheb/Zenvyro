import styles from './Card.module.css'

// A white surface with the soft card shadow. title, subtitle and actions build an optional header.
export function Card({ title, subtitle, actions = null, padding = 'medium', className = '', children, ...sectionProperties }) {
  const hasHeader = Boolean(title || actions)
  return (
    <section className={`${styles.card} ${styles[padding]} ${className}`} {...sectionProperties}>
      {hasHeader && (
        <header className={styles.header}>
          <div>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}
