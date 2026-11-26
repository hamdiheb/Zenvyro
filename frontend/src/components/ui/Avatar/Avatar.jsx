import styles from './Avatar.module.css'

// Soft background colours picked from the name, so the same person always gets the same colour.
const AVATAR_TINTS = ['#EEF0FF', '#E8F7EE', '#FEF5E4', '#EAF1FE', '#F1EFFF', '#FDECEC']
const AVATAR_INKS = ['#4A4AE0', '#15803D', '#B45309', '#1D4ED8', '#6D28D9', '#B91C1C']

function readInitials(fullName) {
  const nameParts = (fullName || '?').trim().split(/\s+/).filter(Boolean)
  const initials = nameParts.slice(0, 2).map((namePart) => namePart[0].toUpperCase())
  return initials.join('') || '?'
}

function pickTintIndex(fullName) {
  const characterTotal = [...(fullName || '')].reduce((total, character) => total + character.charCodeAt(0), 0)
  return characterTotal % AVATAR_TINTS.length
}

// size: small (28) | medium (36) | large (44). variant "brand" uses the primary colour (business avatar).
export function Avatar({ name, size = 'medium', variant = 'tinted', isOnline = false, className = '' }) {
  const tintIndex = pickTintIndex(name)
  const tintStyle =
    variant === 'brand' ? undefined : { background: AVATAR_TINTS[tintIndex], color: AVATAR_INKS[tintIndex] }

  return (
    <span className={`${styles.avatar} ${styles[size]} ${styles[variant]} ${className}`} style={tintStyle} aria-hidden="true">
      {readInitials(name)}
      {isOnline && <span className={styles.onlineDot} />}
    </span>
  )
}
