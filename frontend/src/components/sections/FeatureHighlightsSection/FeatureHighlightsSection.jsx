import styles from './FeatureHighlightsSection.module.css'

// features: [{ title, description, icon: LucideIcon }]
export function FeatureHighlightsSection({ features }) {
  return (
    <section className={styles.section}>
      <ul className={styles.grid}>
        {features.map((feature) => {
          const FeatureIcon = feature.icon
          return (
            <li key={feature.title} className={styles.feature}>
              <span className={styles.iconCircle}>
                <FeatureIcon size={20} aria-hidden="true" />
              </span>
              <div>
                <h3 className={styles.title}>{feature.title}</h3>
                <p className={styles.description}>{feature.description}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
