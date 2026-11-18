import { Sparkles, User } from 'lucide-react'
import styles from './ModeBadge.module.css'

// AI mode uses the AI gradient so it never looks like a human badge.
export function ModeBadge({ mode }) {
  const isAiMode = mode === 'ai'
  return (
    <span className={`${styles.badge} ${isAiMode ? styles.ai : styles.human}`}>
      {isAiMode ? <Sparkles size={12} aria-hidden="true" /> : <User size={12} aria-hidden="true" />}
      {isAiMode ? 'AI' : 'Human'}
    </span>
  )
}
