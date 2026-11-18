import { Sparkles } from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import { formatMessageTime } from '../../../utils/dateFormatting.js'
import styles from './ChatMessageBubble.module.css'

// Visitor view of one message. The visitor's own messages sit on the right in grey; the business
// (agent or AI) answers on the left in indigo next to the business avatar. AI keeps its gradient.
export function ChatMessageBubble({ message, businessName, isFirstInGroup }) {
  if (message.senderType === 'system') {
    return <p className={styles.system}>{message.body}</p>
  }

  const isVisitor = message.senderType === 'customer'
  const isAi = message.senderType === 'ai'

  if (isVisitor) {
    return (
      <div className={`${styles.row} ${styles.visitorRow}`}>
        <p className={`${styles.bubble} ${styles.visitor}`} title={formatMessageTime(message.createdAt)}>
          {message.body}
        </p>
      </div>
    )
  }

  return (
    <div className={`${styles.row} ${styles.businessRow}`}>
      <span className={styles.avatarSlot}>{isFirstInGroup && <Avatar name={businessName} variant="brand" size="small" />}</span>
      <div className={styles.businessContent}>
        {isFirstInGroup && (
          <p className={styles.senderName}>
            {businessName}
            {isAi && (
              <span className={styles.aiTag}>
                <Sparkles size={10} aria-hidden="true" />
                AI
              </span>
            )}
          </p>
        )}
        <p className={`${styles.bubble} ${isAi ? styles.ai : styles.business}`} title={formatMessageTime(message.createdAt)}>
          {message.body}
        </p>
      </div>
    </div>
  )
}
