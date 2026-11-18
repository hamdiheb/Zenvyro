import { useLayoutEffect, useRef, useState } from 'react'
import { Lock, RotateCcw, SendHorizontal } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Tabs } from '../../ui/Tabs'
import styles from './ReplyComposer.module.css'

const COMPOSER_TABS = [
  { value: 'reply', label: 'Reply to customer' },
  { value: 'note', label: 'Private note', isDisabled: true, tag: 'Soon' },
]
const MAXIMUM_TEXTAREA_HEIGHT = 200
const MESSAGE_BODY_MAXIMUM_LENGTH = 5000

// Enter sends, Shift+Enter adds a new line. While the conversation is resolved the composer is
// locked and offers "Reopen", matching the backend's 409 rule. reviewPanel is the Week 2 slot for
// SuggestedReplyReviewPanel, which slides up above the text area.
export function ReplyComposer({ isResolved, onSend, onReopen, isReopening = false, reviewPanel = null }) {
  const [draftText, setDraftText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textAreaReference = useRef(null)

  useLayoutEffect(() => {
    const textArea = textAreaReference.current
    if (!textArea) {
      return
    }
    textArea.style.height = 'auto'
    textArea.style.height = `${Math.min(textArea.scrollHeight, MAXIMUM_TEXTAREA_HEIGHT)}px`
  }, [draftText])

  const trimmedDraft = draftText.trim()
  const canSend = trimmedDraft.length > 0 && !isSending && !isResolved

  const sendDraft = async () => {
    if (!canSend) {
      return
    }
    setIsSending(true)
    const isSent = await onSend(trimmedDraft)
    setIsSending(false)
    if (isSent) {
      setDraftText('')
      textAreaReference.current?.focus()
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      sendDraft()
    }
  }

  if (isResolved) {
    return (
      <div className={styles.lockedComposer}>
        <Lock size={16} aria-hidden="true" />
        <p className={styles.lockedText}>This conversation is resolved. Reopen it to send a message.</p>
        <Button
          size="small"
          variant="secondary"
          leadingIcon={<RotateCcw size={14} aria-hidden="true" />}
          onClick={onReopen}
          isLoading={isReopening}
        >
          Reopen
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.composer}>
      {reviewPanel}
      <Tabs tabs={COMPOSER_TABS} activeValue="reply" onChange={() => {}} label="Composer mode" className={styles.tabs} />
      <div className={styles.inputArea}>
        <textarea
          ref={textAreaReference}
          className={styles.textArea}
          rows={1}
          placeholder="Write a reply to the customer…"
          value={draftText}
          maxLength={MESSAGE_BODY_MAXIMUM_LENGTH}
          onChange={(event) => setDraftText(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Reply to customer"
        />
        <div className={styles.footer}>
          <span className={styles.hint}>Enter to send · Shift + Enter for a new line</span>
          <Button
            size="small"
            onClick={sendDraft}
            disabled={!canSend}
            isLoading={isSending}
            trailingIcon={<SendHorizontal size={14} aria-hidden="true" />}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
