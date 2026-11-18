import { MessageCircle, X } from 'lucide-react'
import styles from './ChatLauncherButton.module.css'

// The 56px round button at the bottom-right that opens and closes the chat window.
export function ChatLauncherButton({ isOpen, onToggle, hasUnread = false }) {
  return (
    <button
      type="button"
      className={`${styles.launcher} ${isOpen ? styles.open : ''}`}
      onClick={onToggle}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      aria-expanded={isOpen}
    >
      <span className={styles.iconLayer} aria-hidden="true">
        {isOpen ? <X size={26} /> : <MessageCircle size={26} />}
      </span>
      {hasUnread && !isOpen && <span className={styles.unreadDot} aria-hidden="true" />}
    </button>
  )
}
