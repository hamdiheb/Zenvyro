import styles from './Tabs.module.css'

// tabs: [{ value, label, count?, isDisabled? }]. Renders an underlined tab strip with optional counts.
export function Tabs({ tabs, activeValue, onChange, label, className = '' }) {
  return (
    <div className={`${styles.tabList} ${className}`} role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const isActive = tab.value === activeValue
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.isDisabled}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.count !== undefined && tab.count !== null && <span className={styles.count}>{tab.count}</span>}
            {tab.tag && <span className={styles.tag}>{tab.tag}</span>}
          </button>
        )
      })}
    </div>
  )
}
