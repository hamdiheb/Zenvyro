import { useCallback, useEffect, useState } from 'react'
import { getConversation } from '../api/conversationsApi.js'

const EMPTY_CONVERSATION_STATE = { conversationId: null, conversation: null, errorMessage: '' }

// Loads one conversation for the thread header and details pane. setConversation stores the
// fresh copy the API returns after a PATCH or label change.
export function useConversation(conversationId) {
  const [conversationState, setConversationState] = useState(EMPTY_CONVERSATION_STATE)

  const loadConversation = useCallback(async (requestedId) => {
    try {
      const conversationResponse = await getConversation(requestedId)
      setConversationState({ conversationId: requestedId, conversation: conversationResponse.conversation, errorMessage: '' })
    } catch (error) {
      setConversationState({ ...EMPTY_CONVERSATION_STATE, conversationId: requestedId, errorMessage: error.message })
    }
  }, [])

  useEffect(() => {
    if (!conversationId) {
      return undefined
    }
    let isCancelled = false
    getConversation(conversationId)
      .then((conversationResponse) => {
        if (!isCancelled) {
          setConversationState({ conversationId, conversation: conversationResponse.conversation, errorMessage: '' })
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setConversationState({ ...EMPTY_CONVERSATION_STATE, conversationId, errorMessage: error.message })
        }
      })
    return () => {
      isCancelled = true
    }
  }, [conversationId])

  const setConversation = useCallback((updatedConversation) => {
    setConversationState((currentState) =>
      currentState.conversationId === updatedConversation.id
        ? { ...currentState, conversation: updatedConversation }
        : currentState,
    )
  }, [])

  const isCurrentConversation = conversationState.conversationId === conversationId
  return {
    conversation: isCurrentConversation ? conversationState.conversation : null,
    isLoading: Boolean(conversationId) && !isCurrentConversation,
    errorMessage: isCurrentConversation ? conversationState.errorMessage : '',
    setConversation,
    reloadConversation: () => conversationId && loadConversation(conversationId),
  }
}
