import { useMemo, useState } from 'react'
import { Inbox, Search } from 'lucide-react'
import { Tabs } from '../../ui/Tabs'
import { Select } from '../../ui/Select'
import { TextInput } from '../../ui/TextInput'
import { Button } from '../../ui/Button'
import { Spinner } from '../../ui/Spinner'
import { EmptyState } from '../../ui/EmptyState'
import { ConversationListItem } from '../ConversationListItem'
import styles from './ConversationListPane.module.css'

const VIEW_TABS = [
  { value: 'mine', label: 'Mine' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'all', label: 'All' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
]

// The left inbox pane: search (client-side for the MVP), Mine / Unassigned / All tabs, a status
// filter and the paginated conversation list. The API has no counts, so only the active tab shows
// how many conversations are loaded ("25+" when more pages exist).
export function ConversationListPane({
  view,
  status,
  onViewChange,
  onStatusChange,
  conversations,
  isLoading,
  isLoadingMore,
  hasMore,
  errorMessage,
  onLoadMore,
  selectedConversationId,
  onSelectConversation,
}) {
  const [searchText, setSearchText] = useState('')

  const visibleConversations = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()
    if (!normalizedSearch) {
      return conversations
    }
    return conversations.filter((conversation) =>
      [
        conversation.customerName,
        conversation.customerEmail,
        conversation.origin?.countryName,
        conversation.lastMessage?.preview,
      ]
        .filter(Boolean)
        .some((searchableText) => searchableText.toLowerCase().includes(normalizedSearch)),
    )
  }, [conversations, searchText])

  const viewTabs = VIEW_TABS.map((tab) => ({
    ...tab,
    count: tab.value === view && !isLoading ? `${conversations.length}${hasMore ? '+' : ''}` : undefined,
  }))

  return (
    <section className={styles.pane} aria-label="Conversations">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Conversations</h2>
          <Select
            label="Filter by status"
            size="small"
            options={STATUS_OPTIONS}
            value={status}
            onChange={onStatusChange}
          />
        </div>
        <TextInput
          aria-label="Search conversations"
          placeholder="Search name, email, country or message"
          leadingIcon={<Search size={16} />}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <Tabs tabs={viewTabs} activeValue={view} onChange={onViewChange} label="Conversation views" />
      </div>

      <div className={styles.listArea}>
        {isLoading && (
          <div className={styles.centered}>
            <Spinner />
          </div>
        )}
        {!isLoading && errorMessage && (
          <p className={styles.errorMessage} role="alert">
            {errorMessage}
          </p>
        )}
        {!isLoading && !errorMessage && visibleConversations.length === 0 && (
          <EmptyState
            icon={<Inbox size={24} />}
            title="No conversations in this view"
            description={
              searchText ? 'No loaded conversation matches your search.' : 'New chats from your website will show up here.'
            }
          />
        )}
        {!isLoading && visibleConversations.length > 0 && (
          <ul>
            {visibleConversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                onSelect={onSelectConversation}
              />
            ))}
          </ul>
        )}
        {!isLoading && hasMore && (
          <div className={styles.loadMore}>
            <Button variant="ghost" size="small" onClick={onLoadMore} isLoading={isLoadingMore}>
              Load more conversations
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
