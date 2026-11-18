import styles from './Footer.module.css'

// A simple site footer: brand line, link columns and a bottom note.
export function Footer({ brandName, tagline, linkColumns = [], bottomNote = '' }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <p className={styles.brandName}>{brandName}</p>
          {tagline && <p className={styles.tagline}>{tagline}</p>}
        </div>
        {linkColumns.map((linkColumn) => (
          <nav key={linkColumn.title} className={styles.column} aria-label={linkColumn.title}>
            <p className={styles.columnTitle}>{linkColumn.title}</p>
            <ul>
              {linkColumn.links.map((linkLabel) => (
                <li key={linkLabel}>
                  <a href="#top" className={styles.link}>
                    {linkLabel}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      {bottomNote && <p className={styles.bottomNote}>{bottomNote}</p>}
    </footer>
  )
}
