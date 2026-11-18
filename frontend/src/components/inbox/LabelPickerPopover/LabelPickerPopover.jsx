import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import styles from './LabelPickerPopover.module.css'

// New labels get the next colour in this palette, so neighbouring labels look different.
const NEW_LABEL_COLORS = ['#5B5BF6', '#06B6D4', '#16A34A', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9']
const LABEL_NAME_MAXIMUM_LENGTH = 40

// A small popover to add an existing label or create a new one from the search text.
export function LabelPickerPopover({ allLabels, appliedLabelIds, onPickLabel, onCreateLabel, onClose }) {
  const [searchText, setSearchText] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const popoverReference = useRef(null)

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!popoverReference.current?.contains(event.target)) {
        onClose()
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  const trimmedSearch = searchText.trim()
  const matchingLabels = useMemo(
    () => allLabels.filter((label) => label.name.toLowerCase().includes(trimmedSearch.toLowerCase())),
    [allLabels, trimmedSearch],
  )
  const hasExactMatch = allLabels.some((label) => label.name.toLowerCase() === trimmedSearch.toLowerCase())
  const canCreate = trimmedSearch.length > 0 && !hasExactMatch && trimmedSearch.length <= LABEL_NAME_MAXIMUM_LENGTH

  const createFromSearch = async () => {
    if (!canCreate || isCreating) {
      return
    }
    setIsCreating(true)
    const colorHex = NEW_LABEL_COLORS[allLabels.length % NEW_LABEL_COLORS.length]
    const isCreated = await onCreateLabel({ name: trimmedSearch, colorHex })
    setIsCreating(false)
    if (isCreated) {
      setSearchText('')
    }
  }

  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    const firstUnappliedMatch = matchingLabels.find((label) => !appliedLabelIds.includes(label.id))
    if (firstUnappliedMatch && hasExactMatch) {
      onPickLabel(firstUnappliedMatch.id)
    } else if (canCreate) {
      createFromSearch()
    }
  }

  return (
    <div className={styles.popover} ref={popoverReference} role="dialog" aria-label="Add label">
      <div className={styles.searchRow}>
        <Search size={14} aria-hidden="true" />
        <input
          className={styles.searchInput}
          placeholder="Search or create a label"
          value={searchText}
          maxLength={LABEL_NAME_MAXIMUM_LENGTH}
          onChange={(event) => setSearchText(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          autoFocus
          aria-label="Search or create a label"
        />
      </div>
      <ul className={styles.labelList}>
        {matchingLabels.map((label) => {
          const isApplied = appliedLabelIds.includes(label.id)
          return (
            <li key={label.id}>
              <button
                type="button"
                className={styles.labelOption}
                onClick={() => onPickLabel(label.id)}
                disabled={isApplied}
              >
                <span className={styles.swatch} style={{ background: label.colorHex }} aria-hidden="true" />
                <span className={styles.labelName}>{label.name}</span>
                {isApplied && <Check size={14} aria-label="Already added" />}
              </button>
            </li>
          )
        })}
        {matchingLabels.length === 0 && !canCreate && <li className={styles.emptyText}>No labels yet. Type a name to create one.</li>}
      </ul>
      {canCreate && (
        <button type="button" className={styles.createOption} onClick={createFromSearch} disabled={isCreating}>
          <Plus size={14} aria-hidden="true" />
          Create “{trimmedSearch}”
        </button>
      )}
    </div>
  )
}
