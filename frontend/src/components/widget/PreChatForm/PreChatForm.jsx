import { useState } from 'react'
import { Button } from '../../ui/Button'
import { TextInput } from '../../ui/TextInput'
import styles from './PreChatForm.module.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Optional name and email before the chat starts. "Skip" starts as "Website visitor".
export function PreChatForm({ businessName, onStart, isStarting, errorMessage }) {
  const [visitorName, setVisitorName] = useState('')
  const [visitorEmail, setVisitorEmail] = useState('')
  const [emailError, setEmailError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedEmail = visitorEmail.trim()
    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError('Enter a valid email, or leave it empty.')
      return
    }
    onStart({ name: visitorName.trim(), email: trimmedEmail })
  }

  return (
    <form className={styles.preChatForm} onSubmit={handleSubmit} noValidate>
      <div>
        <h2 className={styles.title}>Hi there 👋</h2>
        <p className={styles.description}>
          Tell {businessName} who you are so they can follow up. Both fields are optional.
        </p>
      </div>
      <TextInput
        label="Name"
        autoComplete="name"
        placeholder="Your name"
        maxLength={120}
        value={visitorName}
        onChange={(event) => setVisitorName(event.target.value)}
      />
      <TextInput
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={visitorEmail}
        onChange={(event) => {
          setVisitorEmail(event.target.value)
          setEmailError('')
        }}
        errorMessage={emailError}
      />
      {errorMessage && (
        <p className={styles.errorMessage} role="alert">
          {errorMessage}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" isFullWidth isLoading={isStarting}>
          Start chat
        </Button>
        <Button variant="ghost" isFullWidth onClick={() => onStart({})} disabled={isStarting}>
          Skip
        </Button>
      </div>
    </form>
  )
}
