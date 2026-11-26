import styles from './IconButton.module.css'

// An icon-only button. `label` is required: it becomes the accessible name and the tooltip.
export function IconButton({ label, variant = 'ghost', size = 'medium', className = '', children, ...buttonProperties }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[styles.iconButton, styles[variant], styles[size], className].join(' ')}
      {...buttonProperties}
    >
      {children}
    </button>
  )
}
