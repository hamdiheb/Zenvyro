import { useLayoutEffect, useRef, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import styles from './ChatComposer.module.css'

const MAXIMUM_TEXTAREA_HEIGHT = 120
const MESSAGE_BODY_MAXIMUM_LENGTH = 5000

// The visitor's message box. Enter sends, Shift+Enter adds a new line.
export function ChatComposer({ onSend, isDisabled = false }) {
  const [draftText, setDraftText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textAreaReference = useRef(null)

  useLayoutEffect(() => {
    const textArea = textAreaReference.current
    textArea.style.height = 'auto'
    textArea.style.height = `${Math.min(textArea.scrollHeight, MAXIMUM_TEXTAREA_HEIGHT)}px`
  }, [draftText])

  const trimmedDraft = draftText.trim()
  const canSend = trimmedDraft.length > 0 && !isSending && !isDisabled

  const sendDraft = async () => {
    if (!canSend) {
      return
    }
    setIsSending(true)
    const isSent = await onSend(trimmedDraft)
    setIsSending(false)
    if (isSent) {
      setDraftText('')
    }
    textAreaReference.current?.focus()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      sendDraft()
    }
  }

  return (
    <div className={styles.composer}>
      <textarea
        ref={textAreaReference}
        className={styles.textArea}
        rows={1}
        placeholder="Compose your message…"
        value={draftText}
        maxLength={MESSAGE_BODY_MAXIMUM_LENGTH}
        onChange={(event) => setDraftText(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        aria-label="Message"
      />
      <button type="button" className={styles.sendButton} onClick={sendDraft} disabled={!canSend} aria-label="Send message">
        <SendHorizontal size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
