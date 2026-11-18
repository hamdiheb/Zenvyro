import { useLocation } from 'react-router-dom'
import { BookOpen, Inbox, LayoutGrid, MessageSquare, PanelLeft, UserCheck, Workflow } from 'lucide-react'
import { BrandLogo } from '../../ui/BrandLogo'
import { IconButton } from '../../ui/IconButton'
import { SidebarNavItem } from '../SidebarNavItem'
import { UserMenu } from '../UserMenu'
import styles from './Sidebar.module.css'

// Left navigation from 1.jpeg. Rules and Knowledge base stay disabled until Weeks 2 and 3.
// Email and WhatsApp are post-MVP channels, so only Website Chat is listed.
export function Sidebar({ businessName, currentUser, isCollapsed, onToggleCollapsed, onSignOut }) {
  const { pathname, search } = useLocation()
  const isInboxRoute = pathname.startsWith('/agent')
  const isAssignedToMeView = isInboxRoute && new URLSearchParams(search).get('view') === 'mine'

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.brandRow}>
        <BrandLogo isWordmarkVisible={!isCollapsed} />
        <IconButton label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} size="small" onClick={onToggleCollapsed}>
          <PanelLeft size={18} aria-hidden="true" />
        </IconButton>
      </div>

      {!isCollapsed && (
        <div className={styles.businessName} title="Business">
          {businessName || 'Your workspace'}
        </div>
      )}

      <nav className={styles.navigation} aria-label="Main navigation">
        <p className={styles.sectionTitle}>{isCollapsed ? '' : 'Main'}</p>
        <SidebarNavItem to="/dashboard" icon={LayoutGrid} label="Overview" isCollapsed={isCollapsed} />
        <SidebarNavItem
          to="/agent"
          icon={Inbox}
          label="Inbox"
          isCollapsed={isCollapsed}
          isActive={isInboxRoute && !isAssignedToMeView}
        />
        <SidebarNavItem
          to="/agent?view=mine"
          icon={UserCheck}
          label="Assigned to me"
          isCollapsed={isCollapsed}
          isActive={isAssignedToMeView}
        />

        <p className={styles.sectionTitle}>{isCollapsed ? '' : 'Workspace'}</p>
        <SidebarNavItem icon={Workflow} label="Rules" tag="Soon" isDisabled isCollapsed={isCollapsed} />
        <SidebarNavItem icon={BookOpen} label="Knowledge base" tag="Soon" isDisabled isCollapsed={isCollapsed} />

        <p className={styles.sectionTitle}>{isCollapsed ? '' : 'Channels'}</p>
        <SidebarNavItem to="/agent" icon={MessageSquare} label="Website Chat" isCollapsed={isCollapsed} isActive={false} />
      </nav>

      <div className={styles.footer}>
        {currentUser && (
          <UserMenu
            userName={currentUser.name}
            userRole={currentUser.role}
            onSignOut={onSignOut}
            isCollapsed={isCollapsed}
          />
        )}
      </div>
    </aside>
  )
}
