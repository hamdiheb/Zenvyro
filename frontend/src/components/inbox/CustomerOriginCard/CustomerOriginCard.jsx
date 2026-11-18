import { MapPinOff } from 'lucide-react'
import { Card } from '../../ui/Card'
import { CountryFlag } from '../../ui/CountryFlag'
import { formatFullDateTime } from '../../../utils/dateFormatting.js'
import styles from './CustomerOriginCard.module.css'

function joinList(listValues) {
  return Array.isArray(listValues) && listValues.length > 0 ? listValues.join(', ') : '—'
}

// Where the visitor is writing from (roadmap item 7b). Private IPs and failed lookups are not
// "detected", so the card says so instead of guessing.
export function CustomerOriginCard({ origin }) {
  const isDetected = origin?.status === 'detected'

  return (
    <Card title="Customer origin" padding="small">
      {isDetected ? (
        <>
          <div className={styles.countryRow}>
            <CountryFlag
              size="large"
              flagImageUrl={origin.flagImageUrl}
              countryCode={origin.countryCode}
              countryName={origin.countryName}
            />
            <div>
              <p className={styles.countryName}>{origin.countryName || origin.countryCode}</p>
              {origin.region && <p className={styles.region}>{origin.region}</p>}
            </div>
          </div>
          <dl className={styles.facts}>
            <dt>Languages</dt>
            <dd>{joinList(origin.languages)}</dd>
            <dt>Currencies</dt>
            <dd>{joinList(origin.currencies)}</dd>
            <dt>Detected</dt>
            <dd>{origin.detectedAt ? formatFullDateTime(origin.detectedAt) : '—'}</dd>
          </dl>
        </>
      ) : (
        <div className={styles.unavailable}>
          <MapPinOff size={18} aria-hidden="true" />
          <div>
            <p className={styles.unavailableTitle}>Location unavailable</p>
            <p className={styles.unavailableText}>We could not detect where this visitor is writing from.</p>
          </div>
        </div>
      )}
    </Card>
  )
}
