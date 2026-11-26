import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../../../hooks/useCurrentUser.jsx'
import { Avatar } from '../../ui/Avatar'
import { Navbar } from '../Navbar'
import { Sidebar } from '../Sidebar'
import styles from './AppShell.module.css'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'zenvyro.isSidebarCollapsed'

function readStoredCollapsedState() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

// The staff page frame: sidebar on the left, top bar and page body on the right.
// isBodyFlush removes the body padding for full-height layouts such as the three-pane inbox.
export function AppShell({ title, subtitle = '', navbarActions = null, isBodyFlush = false, children }) {
  const { currentUser, businessName, signOut } = useCurrentUser()
  const navigate = useNavigate()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(readStoredCollapsedState)

  const toggleSidebar = () => {
    setIsSidebarCollapsed((isCollapsed) => {
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(!isCollapsed))
      } catch {
        // The preference is optional; ignore blocked storage.
      }
      return !isCollapsed
    })
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/sign-in', { replace: true })
  }

  return (
    <div className={styles.appShell}>
      <Sidebar
        businessName={businessName}
        currentUser={currentUser}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        onSignOut={handleSignOut}
      />
      <div className={styles.mainColumn}>
        <Navbar
          title={title}
          subtitle={subtitle}
          trailing={
            <>
              {navbarActions}
              {currentUser && <Avatar name={currentUser.name} size="large" />}
            </>
          }
        />
        <main className={`${styles.body} ${isBodyFlush ? styles.flush : ''}`}>{children}</main>
      </div>
    </div>
  )
}
