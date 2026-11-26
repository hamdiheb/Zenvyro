import { useEffect, useRef, useState } from 'react'
import { ChevronUp, LogOut } from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import styles from './UserMenu.module.css'

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', agent: 'Agent' }

// The user card at the bottom of the sidebar. Clicking it opens a small menu with "Sign out".
export function UserMenu({ userName, userRole, onSignOut, isCollapsed = false }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuReference = useRef(null)

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined
    }
    const closeOnOutsideClick = (event) => {
      if (!menuReference.current?.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isMenuOpen])

  return (
    <div className={styles.userMenu} ref={menuReference}>
      <button
        type="button"
        className={`${styles.userCard} ${isCollapsed ? styles.collapsed : ''}`}
        onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        title={isCollapsed ? userName : undefined}
      >
        <Avatar name={userName} size="medium" isOnline />
        {!isCollapsed && (
          <>
            <span className={styles.identity}>
              <span className={styles.userName}>{userName}</span>
              <span className={styles.userRole}>{ROLE_LABELS[userRole] || userRole}</span>
            </span>
            <ChevronUp size={16} aria-hidden="true" className={`${styles.chevron} ${isMenuOpen ? '' : styles.chevronClosed}`} />
          </>
        )}
      </button>
      {isMenuOpen && (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.menuItem} onClick={onSignOut}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
