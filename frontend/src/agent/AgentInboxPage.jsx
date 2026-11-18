import { useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MessagesSquare } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { ConversationListPane } from '../components/inbox/ConversationListPane'
import { EmptyState } from '../components/ui/EmptyState'
import { useConversationList } from '../hooks/useConversationList.js'
import styles from './AgentInboxPage.module.css'

const LIST_VIEWS = ['mine', 'unassigned', 'all']
const LIST_STATUSES = ['open', 'pending', 'resolved', 'escalated']

// The three-pane agent inbox (3.jpeg). The view and status filters live in the query string,
// so "Assigned to me" in the sidebar is just /agent?view=mine.
export function AgentInboxPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const requestedView = searchParameters.get('view')
  const requestedStatus = searchParameters.get('status')
  const view = LIST_VIEWS.includes(requestedView) ? requestedView : 'all'
  const status = LIST_STATUSES.includes(requestedStatus) ? requestedStatus : ''

  const conversationList = useConversationList(view, status)

  const updateFilter = useCallback(
    (filterName, filterValue) => {
      setSearchParameters((currentParameters) => {
        const nextParameters = new URLSearchParams(currentParameters)
        if (filterValue) {
          nextParameters.set(filterName, filterValue)
        } else {
          nextParameters.delete(filterName)
        }
        return nextParameters
      })
    },
    [setSearchParameters],
  )

  const selectConversation = (selectedId) => {
    navigate({ pathname: `/agent/conversations/${selectedId}`, search: searchParameters.toString() })
  }

  return (
    <AppShell title="Inbox" isBodyFlush>
      <div className={`${styles.inbox} ${conversationId ? styles.hasSelection : ''}`}>
        <ConversationListPane
          view={view}
          status={status}
          onViewChange={(nextView) => updateFilter('view', nextView)}
          onStatusChange={(nextStatus) => updateFilter('status', nextStatus)}
          conversations={conversationList.conversations}
          isLoading={conversationList.isLoading}
          isLoadingMore={conversationList.isLoadingMore}
          hasMore={conversationList.hasMore}
          errorMessage={conversationList.errorMessage}
          onLoadMore={conversationList.loadMore}
          selectedConversationId={conversationId}
          onSelectConversation={selectConversation}
        />
        <div className={styles.threadArea}>
          <EmptyState
            icon={<MessagesSquare size={24} />}
            title="No conversation selected"
            description="Pick a conversation from the list to read it and reply."
          />
        </div>
      </div>
    </AppShell>
  )
}
