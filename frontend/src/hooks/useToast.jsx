import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Toast } from '../components/ui/Toast'

const TOAST_DURATION_MILLISECONDS = 4500
const ToastContext = createContext(null)

const toastStackStyle = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextToastIdReference = useRef(1)

  const dismissToast = useCallback((toastId) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId))
  }, [])

  const showToast = useCallback(
    ({ tone = 'info', message }) => {
      const toastId = nextToastIdReference.current
      nextToastIdReference.current += 1
      setToasts((currentToasts) => [...currentToasts, { id: toastId, tone, message }])
      setTimeout(() => dismissToast(toastId), TOAST_DURATION_MILLISECONDS)
    },
    [dismissToast],
  )

  const toastValue = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={toastValue}>
      {children}
      <div style={toastStackStyle} aria-live="polite">
        {toasts.map((toast) => (
          <Toast key={toast.id} tone={toast.tone} message={toast.message} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const toastValue = useContext(ToastContext)
  if (!toastValue) {
    throw new Error('useToast must be used inside ToastProvider.')
  }
  return toastValue
}
