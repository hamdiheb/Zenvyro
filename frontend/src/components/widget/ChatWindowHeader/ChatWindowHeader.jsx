import { MessageCircle, Minus } from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import styles from './ChatWindowHeader.module.css'

// Business name with a green online dot, and the "Chat" tab ("Help center" is deferred).
export function ChatWindowHeader({ businessName, onMinimize }) {
  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <span className={styles.tab} aria-current="page">
          <MessageCircle size={14} aria-hidden="true" />
          Chat
        </span>
        <button type="button" className={styles.minimizeButton} onClick={onMinimize} aria-label="Minimize chat">
          <Minus size={18} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.identity}>
        <Avatar name={businessName} variant="brand" size="large" isOnline className={styles.businessAvatar} />
        <div>
          <p className={styles.businessName}>{businessName}</p>
          <p className={styles.status}>We typically reply in a few minutes</p>
        </div>
      </div>
    </header>
  )
}
