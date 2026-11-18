import { CornerUpLeft, MessageSquare, Sparkles } from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import { CountryFlag } from '../../ui/CountryFlag'
import { ModeBadge } from '../../ui/ModeBadge'
import { RelativeTime } from '../../ui/RelativeTime'
import { StatusPill } from '../../ui/StatusPill'
import styles from './ConversationListItem.module.css'

const CHANNEL_LABELS = { web_widget: 'Website chat' }

// The preview line starts with an icon when the newest message came from the business side,
// so agents can see at a glance which conversations are waiting on the customer.
function LastMessagePreview({ lastMessage }) {
  if (!lastMessage) {
    return <span className={`${styles.preview} ${styles.previewEmpty}`}>No messages yet</span>
  }
  const isAiReply = lastMessage.senderType === 'ai'
  const isTeamReply = lastMessage.senderType === 'agent'
  return (
    <span className={styles.preview}>
      {isAiReply && <Sparkles size={12} aria-label="AI replied:" className={styles.previewIcon} />}
      {isTeamReply && <CornerUpLeft size={12} aria-label="You replied:" className={styles.previewIcon} />}
      <span className={styles.previewText}>{lastMessage.preview}</span>
    </span>
  )
}

// One inbox row: avatar, channel, time, name, flag, last-message preview, status and mode.
export function ConversationListItem({ conversation, isSelected, onSelect }) {
  const channelLabel = CHANNEL_LABELS[conversation.channel] || 'Website chat'

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
          <LastMessagePreview lastMessage={conversation.lastMessage} />
          <span className={styles.badges}>
            <StatusPill status={conversation.status} />
            <ModeBadge mode={conversation.mode} />
          </span>
        </span>
      </button>
    </li>
  )
}
