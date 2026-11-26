import { ChevronDown } from 'lucide-react'
import styles from './Select.module.css'

// options: [{ value, label }]. A native select keeps keyboard and screen reader support for free.
export function Select({ label, options, value, onChange, size = 'medium', className = '', ...selectProperties }) {
  return (
    <label className={`${styles.wrapper} ${styles[size]} ${className}`}>
      {label && <span className="visuallyHidden">{label}</span>}
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...selectProperties}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
    </label>
  )
}
