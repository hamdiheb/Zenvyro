import { useState } from 'react'
import { Globe } from 'lucide-react'
import styles from './CountryFlag.module.css'

// Shows the flag image from the origin lookup. If there is no image, or it fails to load,
// it falls back to the two-letter country code, and to a globe when the country is unknown.
export function CountryFlag({ flagImageUrl, countryCode, countryName, size = 'small' }) {
  const [hasImageFailed, setHasImageFailed] = useState(false)
  const accessibleName = countryName || countryCode || 'Unknown country'

  if (flagImageUrl && !hasImageFailed) {
    return (
      <img
        className={`${styles.flag} ${styles[size]}`}
        src={flagImageUrl}
        alt={accessibleName}
        title={accessibleName}
        loading="lazy"
        onError={() => setHasImageFailed(true)}
      />
    )
  }
  if (countryCode) {
    return (
      <span className={`${styles.codeFallback} ${styles[size]}`} title={accessibleName}>
        {countryCode.toUpperCase()}
      </span>
    )
  }
  return (
    <span className={`${styles.unknown} ${styles[size]}`} title={accessibleName}>
      <Globe size={size === 'large' ? 28 : 12} aria-hidden="true" />
    </span>
  )
}
