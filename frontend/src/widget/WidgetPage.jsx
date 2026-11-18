import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChatLauncherButton } from '../components/widget/ChatLauncherButton'
import { ChatWindow } from '../components/widget/ChatWindow'
import { useWidgetChat } from '../hooks/useWidgetChat.js'
import styles from './WidgetPage.module.css'

// Messages shared with the embed loader (public/zenvyro-widget.js).
const WIDGET_READY_MESSAGE_TYPE = 'zenvyro:widget-ready'
const WIDGET_STATE_MESSAGE_TYPE = 'zenvyro:widget-state'
const HOST_VIEWPORT_MESSAGE_TYPE = 'zenvyro:host-viewport'
const COMPACT_LAYOUT_MAXIMUM_WIDTH = 480
const isEmbedded = window.parent !== window

function isOwnViewportCompact() {
  return window.innerWidth <= COMPACT_LAYOUT_MAXIMUM_WIDTH
}

// The page inside the widget iframe: /widget?key=wk_…&name=Business. The iframe keeps the host
// site's CSS out. The open state is sent to the parent page, which sizes the iframe to fit.
// The iframe is always narrow, so when embedded the host page decides the phone layout.
export function WidgetPage() {
  const [searchParameters] = useSearchParams()
  const widgetKey = searchParameters.get('key') || ''
  const businessName = searchParameters.get('name') || 'Support'
  const [isOpen, setIsOpen] = useState(searchParameters.get('open') === '1')
  const [hasUnread, setHasUnread] = useState(false)
  const [isCompactLayout, setIsCompactLayout] = useState(() => !isEmbedded && isOwnViewportCompact())
  const chat = useWidgetChat(widgetKey)
  const newestMessage = chat.messages[chat.messages.length - 1]

  // The iframe must be see-through around the launcher and the window.
  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    if (!isEmbedded) {
      const updateFromOwnViewport = () => setIsCompactLayout(isOwnViewportCompact())
      window.addEventListener('resize', updateFromOwnViewport)
      return () => window.removeEventListener('resize', updateFromOwnViewport)
    }
    const handleHostMessage = (messageEvent) => {
      if (messageEvent.source === window.parent && messageEvent.data?.type === HOST_VIEWPORT_MESSAGE_TYPE) {
        setIsCompactLayout(Boolean(messageEvent.data.isCompactLayout))
      }
    }
    window.addEventListener('message', handleHostMessage)
    window.parent.postMessage({ type: WIDGET_READY_MESSAGE_TYPE }, '*')
    return () => window.removeEventListener('message', handleHostMessage)
  }, [])

  // Only the open state is shared, never chat content, so any host origin may receive it.
  useEffect(() => {
    if (isEmbedded) {
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
    <div className={`${styles.widgetFrame} ${isOpen ? styles.isOpen : ''} ${isCompactLayout ? styles.compact : ''}`}>
      {isOpen && (
        <div className={styles.windowSlot}>
          <ChatWindow businessName={businessName} chat={chat} onMinimize={toggleOpen} isFullScreen={isCompactLayout} />
        </div>
      )}
      <div className={styles.launcherSlot}>
        <ChatLauncherButton isOpen={isOpen} onToggle={toggleOpen} hasUnread={hasUnread} />
      </div>
    </div>
  )
}
