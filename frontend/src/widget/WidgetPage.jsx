import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChatLauncherButton } from '../components/widget/ChatLauncherButton'
import { ChatWindow } from '../components/widget/ChatWindow'
import { useWidgetChat } from '../hooks/useWidgetChat.js'
import styles from './WidgetPage.module.css'

// Message the embed loader (public/zenvyro-widget.js) listens for to resize the iframe.
const WIDGET_STATE_MESSAGE_TYPE = 'zenvyro:widget-state'

// The page inside the widget iframe: /widget?key=wk_…&name=Business. The iframe keeps the host
// site's CSS out. The open state is sent to the parent page, which sizes the iframe to fit.
export function WidgetPage() {
  const [searchParameters] = useSearchParams()
  const widgetKey = searchParameters.get('key') || ''
  const businessName = searchParameters.get('name') || 'Support'
  const [isOpen, setIsOpen] = useState(searchParameters.get('open') === '1')
  const [hasUnread, setHasUnread] = useState(false)
  const chat = useWidgetChat(widgetKey)
  const newestMessage = chat.messages[chat.messages.length - 1]

  // The iframe must be see-through around the launcher and the window.
  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: WIDGET_STATE_MESSAGE_TYPE, isOpen }, '*')
    }
  }, [isOpen])

  // A new reply from the business while the window is closed shows a dot on the launcher.
  useEffect(() => {
    if (!isOpen && newestMessage && newestMessage.senderType !== 'customer') {
      const unreadTimeoutId = setTimeout(() => setHasUnread(true), 0)
      return () => clearTimeout(unreadTimeoutId)
    }
    return undefined
  }, [newestMessage, isOpen])

  const toggleOpen = () => {
    setIsOpen((wasOpen) => !wasOpen)
    setHasUnread(false)
  }

  return (
    <div className={`${styles.widgetFrame} ${isOpen ? styles.isOpen : ''}`}>
      {isOpen && (
        <div className={styles.windowSlot}>
          <ChatWindow businessName={businessName} chat={chat} onMinimize={toggleOpen} />
        </div>
      )}
      <div className={styles.launcherSlot}>
        <ChatLauncherButton isOpen={isOpen} onToggle={toggleOpen} hasUnread={hasUnread} />
      </div>
    </div>
  )
}
