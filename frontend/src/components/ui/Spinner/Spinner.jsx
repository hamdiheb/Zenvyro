import styles from './Spinner.module.css'

export function Spinner({ size = 20, label = 'Loading' }) {
  return (
    <span className={styles.spinner} style={{ width: size, height: size }} role="status">
      <span className="visuallyHidden">{label}</span>
    </span>
  )
}
