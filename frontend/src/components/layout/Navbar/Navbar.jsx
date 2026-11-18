import styles from './Navbar.module.css'

// The top bar. Staff pages pass a title (and an optional greeting line) plus actions on the right.
// The storefront passes its own brand and links through the same three slots.
export function Navbar({ title = '', subtitle = '', leading = null, center = null, trailing = null, variant = 'app' }) {
  return (
    <header className={`${styles.navbar} ${styles[variant]}`}>
      <div className={styles.leading}>
        {leading}
        {title && (
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        )}
      </div>
      {center && <div className={styles.center}>{center}</div>}
      <div className={styles.trailing}>{trailing}</div>
    </header>
  )
}
