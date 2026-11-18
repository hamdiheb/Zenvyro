import { useCallback, useEffect, useState } from 'react'
import { listConversationMessages } from '../api/conversationsApi.js'
import { mergeMessagesById } from './messageListUpdates.js'

const MESSAGE_PAGE_SIZE = 50
const EMPTY_HISTORY_STATE = { conversationId: null, messages: [], olderCursor: null, errorMessage: '' }

// Loads the newest page of a conversation's messages, older pages on demand, and live appends.
// The history is "loading" until a response for the current conversation arrives.
export function useConversationMessages(conversationId) {
  const [historyState, setHistoryState] = useState(EMPTY_HISTORY_STATE)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)

  useEffect(() => {
    if (!conversationId) {
      return undefined
    }
    let isCancelled = false
    listConversationMessages(conversationId, { limit: MESSAGE_PAGE_SIZE })
      .then((messagePage) => {
        if (!isCancelled) {
          setHistoryState({
            conversationId,
            messages: messagePage.messages,
            olderCursor: messagePage.nextCursor,
            errorMessage: '',
          })
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setHistoryState({ ...EMPTY_HISTORY_STATE, conversationId, errorMessage: error.message })
        }
      })
    return () => {
      isCancelled = true
    }
  }, [conversationId])

  const isCurrentHistory = historyState.conversationId === conversationId
  const olderCursor = isCurrentHistory ? historyState.olderCursor : null

  const loadOlder = useCallback(async () => {
    if (!olderCursor || isLoadingOlder) {
      return
    }
    setIsLoadingOlder(true)
    try {
      const messagePage = await listConversationMessages(conversationId, { cursor: olderCursor, limit: MESSAGE_PAGE_SIZE })
      setHistoryState((currentState) => ({
        ...currentState,
        messages: mergeMessagesById(currentState.messages, messagePage.messages),
        olderCursor: messagePage.nextCursor,
      }))
    } catch (error) {
      setHistoryState((currentState) => ({ ...currentState, errorMessage: error.message }))
    } finally {
      setIsLoadingOlder(false)
    }
  }, [conversationId, olderCursor, isLoadingOlder])

  // Ignores messages for any conversation other than the one on screen.
  const appendMessage = useCallback((message) => {
    setHistoryState((currentState) =>
      currentState.conversationId === message.conversationId
        ? { ...currentState, messages: mergeMessagesById(currentState.messages, [message]) }
        : currentState,
    )
  }, [])

  return {
    messages: isCurrentHistory ? historyState.messages : [],
    isLoading: Boolean(conversationId) && !isCurrentHistory,
    isLoadingOlder,
    hasOlder: Boolean(olderCursor),
    errorMessage: isCurrentHistory ? historyState.errorMessage : '',
    loadOlder,
    appendMessage,
  }
}
