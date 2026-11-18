import { forwardRef, useId } from 'react'
import styles from './TextArea.module.css'

export const TextArea = forwardRef(function TextArea(
  { label, errorMessage = '', className = '', id, ...textAreaProperties },
  forwardedRef,
) {
  const generatedId = useId()
  const textAreaId = id || generatedId
  return (
    <div className={`${styles.field} ${className}`}>
      {label && (
        <label className={styles.label} htmlFor={textAreaId}>
          {label}
        </label>
      )}
      <textarea
        ref={forwardedRef}
        id={textAreaId}
        className={`${styles.textArea} ${errorMessage ? styles.hasError : ''}`}
        aria-invalid={Boolean(errorMessage)}
        {...textAreaProperties}
      />
      {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
    </div>
  )
})
