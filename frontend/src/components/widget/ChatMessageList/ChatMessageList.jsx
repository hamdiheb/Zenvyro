import { Fragment, useLayoutEffect, useRef } from 'react'
import { groupMessagesByDay } from '../../../utils/dateFormatting.js'
import { ChatMessageBubble } from '../ChatMessageBubble'
import styles from './ChatMessageList.module.css'

// Scrolls to the newest message and shows a day label above each day's messages.
export function ChatMessageList({ messages, businessName, welcomeText }) {
  const scrollAreaReference = useRef(null)
  const newestMessageId = messages[messages.length - 1]?.id

  useLayoutEffect(() => {
    const scrollArea = scrollAreaReference.current
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight
    }
  }, [newestMessageId])

  const dayGroups = groupMessagesByDay(messages)

  return (
    <div className={styles.messageList} ref={scrollAreaReference} aria-live="polite">
      <div className={styles.welcome}>
        <p>{welcomeText}</p>
      </div>
      {dayGroups.map((dayGroup) => (
        <Fragment key={dayGroup.dayKey}>
          <p className={styles.dayLabel}>{dayGroup.dayLabel}</p>
          {dayGroup.messages.map((message, messageIndex) => {
            const previousMessage = dayGroup.messages[messageIndex - 1]
            const isFirstInGroup = !previousMessage || previousMessage.senderType !== message.senderType
            return (
              <ChatMessageBubble
                key={message.id}
                message={message}
                businessName={businessName}
                isFirstInGroup={isFirstInGroup}
              />
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
