import { MessageSquare } from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import { CountryFlag } from '../../ui/CountryFlag'
import { ModeBadge } from '../../ui/ModeBadge'
import { RelativeTime } from '../../ui/RelativeTime'
import { StatusPill } from '../../ui/StatusPill'
import styles from './ConversationListItem.module.css'

const CHANNEL_LABELS = { web_widget: 'Website chat' }

// One inbox row. The API has no last-message preview yet, so the second line shows the
// customer's email, or the channel when the visitor gave none.
export function ConversationListItem({ conversation, isSelected, onSelect }) {
  const channelLabel = CHANNEL_LABELS[conversation.channel] || 'Website chat'
  const previewText = conversation.customerEmail || 'Anonymous website visitor'

  return (
    <li>
      <button
        type="button"
        className={`${styles.item} ${isSelected ? styles.selected : ''}`}
        onClick={() => onSelect(conversation.id)}
        aria-current={isSelected ? 'true' : undefined}
      >
        <Avatar name={conversation.customerName} />
        <span className={styles.content}>
          <span className={styles.topRow}>
            <span className={styles.channelTag}>
              <MessageSquare size={11} aria-hidden="true" />
              {channelLabel}
            </span>
            <RelativeTime className={styles.time} timestamp={conversation.lastMessageAt || conversation.createdAt} />
          </span>
          <span className={styles.nameRow}>
            <span className={styles.customerName}>{conversation.customerName || 'Website visitor'}</span>
            <CountryFlag
              flagImageUrl={conversation.origin?.flagImageUrl}
              countryCode={conversation.origin?.countryCode}
              countryName={conversation.origin?.countryName}
            />
          </span>
          <span className={styles.preview}>{previewText}</span>
          <span className={styles.badges}>
            <StatusPill status={conversation.status} />
            <ModeBadge mode={conversation.mode} />
          </span>
        </span>
      </button>
    </li>
  )
}
