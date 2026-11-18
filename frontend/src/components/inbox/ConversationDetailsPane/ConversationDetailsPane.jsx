import { PackageSearch, X } from 'lucide-react'
import { Card } from '../../ui/Card'
import { IconButton } from '../../ui/IconButton'
import { ConversationActionsCard } from '../ConversationActionsCard'
import { CustomerOriginCard } from '../CustomerOriginCard'
import styles from './ConversationDetailsPane.module.css'

// The right inbox pane. Order history is a Week 3 slot (roadmap item 16).
export function ConversationDetailsPane({ conversation, onClose, ...actionsCardProperties }) {
  return (
    <aside className={styles.detailsPane} aria-label="Conversation details">
      <div className={styles.header}>
        <h3 className={styles.title}>Details</h3>
        <IconButton label="Hide details" size="small" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <div className={styles.cards}>
        <ConversationActionsCard conversation={conversation} {...actionsCardProperties} />
        <CustomerOriginCard origin={conversation.origin} />
        <Card title="Order history" padding="small">
          <div className={styles.placeholder}>
            <PackageSearch size={18} aria-hidden="true" />
            <p>Orders from your store will appear here in Week 3.</p>
          </div>
        </Card>
      </div>
    </aside>
  )
}
