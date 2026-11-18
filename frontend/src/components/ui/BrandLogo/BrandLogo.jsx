import styles from './BrandLogo.module.css'

// The Zenvyro mark (a "Z" on the brand gradient) and optional wordmark. Original art.
export function BrandLogo({ isWordmarkVisible = true, size = 'medium' }) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="zenvyroLogoGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5B5BF6" />
            <stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#zenvyroLogoGradient)" />
        <path
          d="M10 10.5h12L10.5 21.5H22"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {isWordmarkVisible ? <span className={styles.wordmark}>Zenvyro</span> : <span className="visuallyHidden">Zenvyro</span>}
    </span>
  )
}
