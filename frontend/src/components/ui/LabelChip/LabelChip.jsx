import { X } from 'lucide-react'
import styles from './LabelChip.module.css'

// The chip colour comes from the label's own colorHex. onRemove is optional.
export function LabelChip({ name, colorHex = '#5B5BF6', onRemove = null, isDisabled = false }) {
  return (
    <span className={styles.chip} style={{ '--label-color': colorHex }}>
      <span className={styles.swatch} aria-hidden="true" />
      <span className={styles.name}>{name}</span>
      {onRemove && (
        <button
          type="button"
          className={styles.removeButton}
          onClick={onRemove}
          disabled={isDisabled}
          aria-label={`Remove label ${name}`}
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
