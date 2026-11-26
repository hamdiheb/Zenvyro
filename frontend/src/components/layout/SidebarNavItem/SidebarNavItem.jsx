import { NavLink } from 'react-router-dom'
import styles from './SidebarNavItem.module.css'

// A sidebar link. isActive can be forced when the active state depends on the query string
// (Inbox vs Assigned to me share /agent). A disabled item shows a "Soon" tag and is not a link.
export function SidebarNavItem({ to, icon: ItemIcon, label, isActive, isDisabled = false, isCollapsed = false, tag = '' }) {
  const content = (
    <>
      <ItemIcon size={18} aria-hidden="true" className={styles.icon} />
      {!isCollapsed && <span className={styles.label}>{label}</span>}
      {!isCollapsed && tag && <span className={styles.tag}>{tag}</span>}
    </>
  )

  if (isDisabled) {
    return (
      <span className={`${styles.item} ${styles.disabled}`} aria-disabled="true" title={isCollapsed ? `${label} (${tag})` : undefined}>
        {content}
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      end
      title={isCollapsed ? label : undefined}
      className={({ isActive: isRouteActive }) =>
        `${styles.item} ${(isActive ?? isRouteActive) ? styles.active : ''}`
      }
      aria-current={isActive ? 'page' : undefined}
    >
      {content}
    </NavLink>
  )
}
