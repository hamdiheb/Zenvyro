import styles from './Button.module.css'

// variant: primary | secondary | ghost | danger. size: small | medium | large.
export function Button({
  variant = 'primary',
  size = 'medium',
  type = 'button',
  isFullWidth = false,
  isLoading = false,
  leadingIcon = null,
  trailingIcon = null,
  disabled = false,
  className = '',
  children,
  ...buttonProperties
}) {
  const classNames = [
    styles.button,
    styles[variant],
    styles[size],
    isFullWidth ? styles.fullWidth : '',
    className,
  ].join(' ')

  return (
    <button type={type} className={classNames} disabled={disabled || isLoading} {...buttonProperties}>
      {isLoading ? <span className={styles.loadingDot} aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  )
}
