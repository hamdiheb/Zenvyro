import styles from './HeroSection.module.css'

// A full-width hero with a headline card on the left and an illustration slot on the right.
export function HeroSection({ eyebrow = '', title, description, action = null, illustration = null }) {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
          {action && <div className={styles.action}>{action}</div>}
        </div>
        {illustration && <div className={styles.illustration}>{illustration}</div>}
      </div>
    </section>
  )
}
