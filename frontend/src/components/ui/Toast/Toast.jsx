import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import styles from './Toast.module.css'

// tone: success | error | info. ToastProvider (hooks/useToast) positions and times these.
export function Toast({ tone = 'info', message, onDismiss }) {
  const ToneIcon = tone === 'error' ? AlertCircle : CheckCircle2
  return (
    <div className={`${styles.toast} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <ToneIcon size={18} aria-hidden="true" className={styles.icon} />
      <p className={styles.message}>{message}</p>
      <button type="button" className={styles.dismissButton} onClick={onDismiss} aria-label="Dismiss">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
