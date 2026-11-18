import { BrandLogo } from '../../ui/BrandLogo'
import styles from './AuthCardSection.module.css'

// The sign-in / sign-up frame: a centred card on the lavender backdrop with the Zenvyro wordmark.
export function AuthCardSection({ title, description, footer = null, children }) {
  return (
    <div className={styles.backdrop}>
      <section className={styles.card}>
        <div className={styles.logoRow}>
          <BrandLogo size="large" />
        </div>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </section>
    </div>
  )
}
