import { Sparkles } from 'lucide-react'
import { formatMessageTime } from '../../../utils/dateFormatting.js'
import styles from './MessageBubble.module.css'

// Agent view of one message. Customer: left, grey. Agent: right, indigo. AI: right, AI gradient
// with a sparkle, so AI output never looks like a human reply. System: centred and muted.
export function MessageBubble({ message, customerName, currentUserId }) {
  if (message.senderType === 'system') {
    return (
      <div className={styles.systemRow}>
        <p className={styles.systemText}>{message.body}</p>
      </div>
    )
  }

  const isCustomer = message.senderType === 'customer'
  const isAi = message.senderType === 'ai'
  let senderLabel = customerName || 'Customer'
  if (isAi) {
    senderLabel = 'Zenvyro AI'
  } else if (!isCustomer) {
    senderLabel = message.senderId && message.senderId === currentUserId ? 'You' : 'Agent'
  }

  return (
    <div className={`${styles.row} ${isCustomer ? styles.incoming : styles.outgoing}`}>
      <div className={`${styles.bubble} ${isCustomer ? styles.customer : ''} ${isAi ? styles.ai : ''} ${!isCustomer && !isAi ? styles.agent : ''}`}>
        {isAi && (
          <span className={styles.aiTag}>
            <Sparkles size={12} aria-hidden="true" />
            AI reply
          </span>
        )}
        <p className={styles.body}>{message.body}</p>
      </div>
      <p className={styles.meta}>
        {senderLabel} · <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
      </p>
    </div>
  )
}
