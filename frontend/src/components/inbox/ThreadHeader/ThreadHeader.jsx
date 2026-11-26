import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, Clock, PanelRight, RotateCcw } from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { CountryFlag } from '../../ui/CountryFlag'
import { IconButton } from '../../ui/IconButton'
import { ModeBadge } from '../../ui/ModeBadge'
import { StatusPill } from '../../ui/StatusPill'
import styles from './ThreadHeader.module.css'

// The actions offered depend on the current status: a resolved conversation can only be reopened.
function buildStatusActions(currentStatus) {
  if (currentStatus === 'resolved') {
    return [{ status: 'open', label: 'Reopen', icon: RotateCcw }]
  }
  const statusActions = [{ status: 'resolved', label: 'Resolve', icon: CheckCircle2 }]
  if (currentStatus !== 'pending') {
    statusActions.push({ status: 'pending', label: 'Mark as pending', icon: Clock })
  }
  if (currentStatus !== 'open') {
    statusActions.push({ status: 'open', label: 'Mark as open', icon: RotateCcw })
  }
  return statusActions
}

export function ThreadHeader({ conversation, onStatusChange, isUpdatingStatus, onBack, onToggleDetails, isDetailsOpen }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuReference = useRef(null)
  const statusActions = buildStatusActions(conversation.status)
  const [primaryAction, ...otherActions] = statusActions
  const PrimaryIcon = primaryAction.icon
  const origin = conversation.origin || {}

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined
    }
    const closeOnOutsideClick = (event) => {
      if (!menuReference.current?.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [isMenuOpen])

  const chooseStatus = (nextStatus) => {
    setIsMenuOpen(false)
    onStatusChange(nextStatus)
  }

  return (
    <header className={styles.threadHeader}>
      <IconButton label="Back to conversations" className={styles.backButton} onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
      </IconButton>
      <Avatar name={conversation.customerName} size="large" />
      <div className={styles.identity}>
        <h2 className={styles.customerName}>{conversation.customerName || 'Website visitor'}</h2>
        <p className={styles.meta}>
          <CountryFlag flagImageUrl={origin.flagImageUrl} countryCode={origin.countryCode} countryName={origin.countryName} />
          <span>{origin.status === 'detected' ? origin.countryName : 'Location unavailable'}</span>
          <StatusPill status={conversation.status} />
          <ModeBadge mode={conversation.mode} />
        </p>
      </div>

      <div className={styles.actions}>
        <div className={styles.splitButton} ref={menuReference}>
          <Button
            variant={primaryAction.status === 'resolved' ? 'primary' : 'secondary'}
            size="small"
            leadingIcon={<PrimaryIcon size={16} aria-hidden="true" />}
            onClick={() => chooseStatus(primaryAction.status)}
            isLoading={isUpdatingStatus}
            className={otherActions.length > 0 ? styles.splitMain : ''}
          >
            {primaryAction.label}
          </Button>
          {otherActions.length > 0 && (
            <button
              type="button"
              className={styles.splitToggle}
              aria-label="More status actions"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
              disabled={isUpdatingStatus}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
          {isMenuOpen && (
            <div className={styles.menu} role="menu">
              {otherActions.map((statusAction) => {
                const ActionIcon = statusAction.icon
                return (
                  <button
                    key={statusAction.status}
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    onClick={() => chooseStatus(statusAction.status)}
                  >
                    <ActionIcon size={16} aria-hidden="true" />
                    {statusAction.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {onToggleDetails && (
          <IconButton
            label={isDetailsOpen ? 'Hide details' : 'Show details'}
            variant={isDetailsOpen ? 'ghost' : 'outlined'}
            onClick={onToggleDetails}
          >
            <PanelRight size={18} aria-hidden="true" />
          </IconButton>
        )}
      </div>
    </header>
  )
}
