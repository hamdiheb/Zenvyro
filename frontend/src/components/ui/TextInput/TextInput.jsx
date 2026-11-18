import { useId } from 'react'
import styles from './TextInput.module.css'

// A labelled input with an optional leading icon and an inline error under the field.
export function TextInput({ label, errorMessage = '', hint = '', leadingIcon = null, className = '', id, ...inputProperties }) {
  const generatedId = useId()
  const inputId = id || generatedId
  const messageId = `${inputId}-message`
  const hasError = Boolean(errorMessage)

  return (
    <div className={`${styles.field} ${className}`}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className={`${styles.control} ${hasError ? styles.hasError : ''}`}>
        {leadingIcon && <span className={styles.leadingIcon}>{leadingIcon}</span>}
        <input
          id={inputId}
          className={styles.input}
          aria-invalid={hasError}
          aria-describedby={hasError || hint ? messageId : undefined}
          {...inputProperties}
        />
      </div>
      {(hasError || hint) && (
        <p id={messageId} className={hasError ? styles.errorMessage : styles.hint}>
          {errorMessage || hint}
        </p>
      )}
    </div>
  )
}
