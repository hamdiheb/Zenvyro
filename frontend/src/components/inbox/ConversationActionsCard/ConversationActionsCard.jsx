import { useCallback, useState } from 'react'
import { ArrowRight, Plus, UserMinus } from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { LabelChip } from '../../ui/LabelChip'
import { LabelPickerPopover } from '../LabelPickerPopover'
import styles from './ConversationActionsCard.module.css'

// There is no staff list endpoint yet, so assignment offers only "Assign to me" and "Unassign",
// and another agent's name cannot be shown.
function describeAssignee(assignedAgentId, currentUser) {
  if (!assignedAgentId) {
    return { name: 'Unassigned', isAssigned: false }
  }
  if (assignedAgentId === currentUser?.id) {
    return { name: `${currentUser.name} (you)`, avatarName: currentUser.name, isAssigned: true }
  }
  return { name: 'Another agent', avatarName: 'Agent', isAssigned: true }
}

export function ConversationActionsCard({
  conversation,
  currentUser,
  allLabels,
  isSaving,
  onAssignToMe,
  onUnassign,
  onSetLabels,
  onCreateLabel,
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const assignee = describeAssignee(conversation.assignedAgentId, currentUser)
  const isAssignedToMe = conversation.assignedAgentId === currentUser?.id
  const appliedLabels = conversation.labels || []
  const appliedLabelIds = appliedLabels.map((label) => label.id)

  const closePicker = useCallback(() => setIsPickerOpen(false), [])

  const addLabel = (labelId) => {
    if (!appliedLabelIds.includes(labelId)) {
      onSetLabels([...appliedLabelIds, labelId])
    }
    setIsPickerOpen(false)
  }

  const removeLabel = (labelId) => {
    onSetLabels(appliedLabelIds.filter((appliedId) => appliedId !== labelId))
  }

  const createAndAddLabel = async (newLabelFields) => {
    const createdLabel = await onCreateLabel(newLabelFields)
    if (createdLabel) {
      addLabel(createdLabel.id)
      return true
    }
    return false
  }

  return (
    <Card title="Conversation actions" padding="small">
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Assigned agent</h4>
          {assignee.isAssigned && (
            <button type="button" className={styles.textAction} onClick={onUnassign} disabled={isSaving}>
              <UserMinus size={14} aria-hidden="true" />
              Unassign
            </button>
          )}
        </div>
        <div className={styles.assigneeBox}>
          {assignee.isAssigned ? (
            <Avatar name={assignee.avatarName} size="small" isOnline={isAssignedToMe} />
          ) : (
            <span className={styles.unassignedDot} aria-hidden="true" />
          )}
          <span className={assignee.isAssigned ? styles.assigneeName : styles.unassignedText}>{assignee.name}</span>
        </div>
        {!isAssignedToMe && (
          <Button
            variant="secondary"
            size="small"
            isFullWidth
            onClick={onAssignToMe}
            disabled={isSaving}
            trailingIcon={<ArrowRight size={14} aria-hidden="true" />}
          >
            Assign to me
          </Button>
        )}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Conversation labels</h4>
        <div className={styles.labelRow}>
          <div className={styles.pickerAnchor}>
            <button
              type="button"
              className={styles.addLabelButton}
              onClick={() => setIsPickerOpen((isOpen) => !isOpen)}
              aria-expanded={isPickerOpen}
              disabled={isSaving}
            >
              <Plus size={14} aria-hidden="true" />
              Add label
            </button>
            {isPickerOpen && (
              <LabelPickerPopover
                allLabels={allLabels}
                appliedLabelIds={appliedLabelIds}
                onPickLabel={addLabel}
                onCreateLabel={createAndAddLabel}
                onClose={closePicker}
              />
            )}
          </div>
          {appliedLabels.map((label) => (
            <LabelChip
              key={label.id}
              name={label.name}
              colorHex={label.colorHex}
              onRemove={() => removeLabel(label.id)}
              isDisabled={isSaving}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}
