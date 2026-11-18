import { AlertTriangle } from 'lucide-react'
import { Spinner } from '../../ui/Spinner'
import { ChatComposer } from '../ChatComposer'
import { ChatMessageList } from '../ChatMessageList'
import { ChatWindowHeader } from '../ChatWindowHeader'
import { PreChatForm } from '../PreChatForm'
import styles from './ChatWindow.module.css'

// 370×560 on desktop, full screen on phones. The body depends on the chat phase.
export function ChatWindow({ businessName, chat, onMinimize }) {
  const renderBody = () => {
    if (chat.phase === 'invalid-key') {
      return (
        <div className={styles.notice}>
          <AlertTriangle size={20} aria-hidden="true" />
          <p>This chat is not set up correctly. Please contact the website owner.</p>
        </div>
      )
    }
    if (chat.phase === 'loading') {
      return (
        <div className={styles.notice}>
          <Spinner />
        </div>
      )
    }
    if (chat.phase === 'pre-chat') {
      return (
        <PreChatForm
          businessName={businessName}
          onStart={chat.startChat}
          isStarting={chat.isStarting}
          errorMessage={chat.errorMessage}
        />
      )
    }
    return (
      <>
        <ChatMessageList
          messages={chat.messages}
          businessName={businessName}
          welcomeText={`Welcome to ${businessName}! Ask us anything and we'll reply here.`}
        />
        {chat.errorMessage && (
          <p className={styles.errorMessage} role="alert">
            {chat.errorMessage}
          </p>
        )}
        <ChatComposer onSend={chat.sendMessage} />
      </>
    )
  }

  return (
    <section className={styles.chatWindow} aria-label={`Chat with ${businessName}`}>
      <ChatWindowHeader businessName={businessName} onMinimize={onMinimize} />
      {renderBody()}
      <p className={styles.poweredBy}>
        Powered by <strong>Zenvyro</strong>
      </p>
    </section>
  )
}
