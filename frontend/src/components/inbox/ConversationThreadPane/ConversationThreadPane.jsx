import { Fragment, useEffect, useLayoutEffect, useRef } from 'react'
import { MessageCircle } from 'lucide-react'
import { groupMessagesByDay } from '../../../utils/dateFormatting.js'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Spinner } from '../../ui/Spinner'
import { DaySeparator } from '../DaySeparator'
import { MessageBubble } from '../MessageBubble'
import { ReplyComposer } from '../ReplyComposer'
import { ThreadHeader } from '../ThreadHeader'
import styles from './ConversationThreadPane.module.css'

const NEAR_BOTTOM_PIXELS = 120

// The middle inbox pane: header, the message list grouped by day, and the reply composer.
export function ConversationThreadPane({
  conversation,
  messages,
  isLoadingMessages,
  hasOlderMessages,
  isLoadingOlderMessages,
  onLoadOlderMessages,
  messagesErrorMessage,
  currentUserId,
  onSendReply,
  onStatusChange,
  isUpdatingStatus,
  onBack,
  onToggleDetails,
  isDetailsOpen,
}) {
  const scrollAreaReference = useRef(null)
  const isNearBottomReference = useRef(true)
  const newestMessageId = messages[messages.length - 1]?.id

  // Follow new messages only when the agent is already reading the bottom of the thread.
  useLayoutEffect(() => {
    const scrollArea = scrollAreaReference.current
    if (scrollArea && isNearBottomReference.current) {
      scrollArea.scrollTop = scrollArea.scrollHeight
    }
  }, [newestMessageId])

  useEffect(() => {
    isNearBottomReference.current = true
  }, [conversation.id])

  const trackScrollPosition = () => {
    const scrollArea = scrollAreaReference.current
    isNearBottomReference.current =
      scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < NEAR_BOTTOM_PIXELS
  }

  const dayGroups = groupMessagesByDay(messages)

  return (
    <section className={styles.threadPane} aria-label="Conversation">
      <ThreadHeader
        conversation={conversation}
        onStatusChange={onStatusChange}
        isUpdatingStatus={isUpdatingStatus}
        onBack={onBack}
        onToggleDetails={onToggleDetails}
        isDetailsOpen={isDetailsOpen}
      />

      <div className={styles.messageArea} ref={scrollAreaReference} onScroll={trackScrollPosition}>
        {isLoadingMessages && (
          <div className={styles.centered}>
            <Spinner />
          </div>
        )}
        {!isLoadingMessages && messagesErrorMessage && (
          <p className={styles.errorMessage} role="alert">
            {messagesErrorMessage}
          </p>
        )}
        {!isLoadingMessages && hasOlderMessages && (
          <div className={styles.loadOlder}>
            <Button variant="ghost" size="small" onClick={onLoadOlderMessages} isLoading={isLoadingOlderMessages}>
              Load earlier messages
            </Button>
          </div>
        )}
        {!isLoadingMessages && !messagesErrorMessage && messages.length === 0 && (
          <EmptyState icon={<MessageCircle size={24} />} title="No messages yet" description="Say hello to start the conversation." />
        )}
        {dayGroups.map((dayGroup) => (
          <Fragment key={dayGroup.dayKey}>
            <DaySeparator label={dayGroup.dayLabel} />
            {dayGroup.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                customerName={conversation.customerName}
                currentUserId={currentUserId}
              />
            ))}
          </Fragment>
        ))}
      </div>

      <ReplyComposer
        key={conversation.id}
        isResolved={conversation.status === 'resolved'}
        onSend={onSendReply}
        onReopen={() => onStatusChange('open')}
        isReopening={isUpdatingStatus}
      />
    </section>
  )
}
