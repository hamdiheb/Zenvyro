import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MessagesSquare } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { ConversationListPane } from '../components/inbox/ConversationListPane'
import { ConversationThreadPane } from '../components/inbox/ConversationThreadPane'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { postConversationMessage, updateConversation } from '../api/conversationsApi.js'
import { useConversation } from '../hooks/useConversation.js'
import { useConversationList } from '../hooks/useConversationList.js'
import { useConversationMessages } from '../hooks/useConversationMessages.js'
import { useCurrentUser } from '../hooks/useCurrentUser.jsx'
import { useConversationRoom, useMessageCreatedListener, useRealtimeSocket } from '../hooks/useRealtimeSocket.js'
import { useToast } from '../hooks/useToast.jsx'
import styles from './AgentInboxPage.module.css'

const LIST_VIEWS = ['mine', 'unassigned', 'all']
const LIST_STATUSES = ['open', 'pending', 'resolved', 'escalated']
const CONFLICT_STATUS_CODE = 409

const STATUS_CHANGE_MESSAGES = {
  open: 'Conversation reopened.',
  pending: 'Conversation marked as pending.',
  resolved: 'Conversation resolved.',
  escalated: 'Conversation escalated.',
}

// The three-pane agent inbox (3.jpeg). The view and status filters live in the query string,
// so "Assigned to me" in the sidebar is just /agent?view=mine.
export function AgentInboxPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const { currentUser } = useCurrentUser()
  const { showToast } = useToast()
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const requestedView = searchParameters.get('view')
  const requestedStatus = searchParameters.get('status')
  const view = LIST_VIEWS.includes(requestedView) ? requestedView : 'all'
  const status = LIST_STATUSES.includes(requestedStatus) ? requestedStatus : ''

  const conversationList = useConversationList(view, status)
  const selectedConversation = useConversation(conversationId)
  const conversationMessages = useConversationMessages(conversationId)
  const { replaceConversation, refresh: refreshConversationList } = conversationList
  const { setConversation, reloadConversation } = selectedConversation
  const { appendMessage } = conversationMessages

  const realtimeSocket = useRealtimeSocket()
  useConversationRoom(realtimeSocket, conversationId)
  useMessageCreatedListener(realtimeSocket, (realtimeEvent) => {
    appendMessage(realtimeEvent.message)
    // A visitor message can reopen a resolved conversation, so refresh what the agent sees.
    if (realtimeEvent.conversationId === conversationId && realtimeEvent.message.senderType === 'customer') {
      reloadConversation()
    }
    refreshConversationList()
  })

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

  const returnToList = () => {
    navigate({ pathname: '/agent', search: searchParameters.toString() })
  }

  const storeUpdatedConversation = useCallback(
    (updatedConversation) => {
      setConversation(updatedConversation)
      replaceConversation(updatedConversation)
    },
    [setConversation, replaceConversation],
  )

  const sendReply = async (replyText) => {
    try {
      const sendResponse = await postConversationMessage(conversationId, replyText)
      appendMessage(sendResponse.message)
      refreshConversationList()
      return true
    } catch (error) {
      if (error.statusCode === CONFLICT_STATUS_CODE) {
        reloadConversation()
      }
      showToast({ tone: 'error', message: error.message })
      return false
    }
  }

  const changeStatus = async (nextStatus) => {
    setIsUpdatingStatus(true)
    try {
      const updateResponse = await updateConversation(conversationId, { status: nextStatus })
      storeUpdatedConversation(updateResponse.conversation)
      showToast({ tone: 'success', message: STATUS_CHANGE_MESSAGES[nextStatus] })
    } catch (error) {
      showToast({ tone: 'error', message: error.message })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const renderThreadArea = () => {
    if (!conversationId) {
      return (
        <EmptyState
          icon={<MessagesSquare size={24} />}
          title="No conversation selected"
          description="Pick a conversation from the list to read it and reply."
        />
      )
    }
    if (selectedConversation.isLoading) {
      return <Spinner />
    }
    if (!selectedConversation.conversation) {
      return (
        <EmptyState
          icon={<MessagesSquare size={24} />}
          title="Conversation not found"
          description={selectedConversation.errorMessage || 'It may have been removed.'}
        />
      )
    }
    return (
      <ConversationThreadPane
        conversation={selectedConversation.conversation}
        messages={conversationMessages.messages}
        isLoadingMessages={conversationMessages.isLoading}
        hasOlderMessages={conversationMessages.hasOlder}
        isLoadingOlderMessages={conversationMessages.isLoadingOlder}
        onLoadOlderMessages={conversationMessages.loadOlder}
        messagesErrorMessage={conversationMessages.errorMessage}
        currentUserId={currentUser?.id}
        onSendReply={sendReply}
        onStatusChange={changeStatus}
        isUpdatingStatus={isUpdatingStatus}
        onBack={returnToList}
      />
    )
  }

  const hasOpenThread = Boolean(selectedConversation.conversation)

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
        <div className={`${styles.threadArea} ${hasOpenThread ? styles.threadAreaFilled : ''}`}>{renderThreadArea()}</div>
      </div>
    </AppShell>
  )
}
