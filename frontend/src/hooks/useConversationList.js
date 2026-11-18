import { useCallback, useEffect, useRef, useState } from 'react'
import { listConversations } from '../api/conversationsApi.js'

// Realtime only reaches the open conversation's room, so the list also refetches on a timer.
const LIST_REFRESH_INTERVAL_MILLISECONDS = 20_000
const CONVERSATION_PAGE_SIZE = 25

const EMPTY_LIST_STATE = { listKey: null, conversations: [], nextCursor: null, errorMessage: '' }

// Loads the inbox list for a view (mine | unassigned | all) and an optional status, with cursor
// pagination. The list is "loading" until a response for the current view and status arrives.
export function useConversationList(view, status) {
  const listKey = `${view}|${status || ''}`
  const [listState, setListState] = useState(EMPTY_LIST_STATE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const latestListKeyReference = useRef(listKey)

  useEffect(() => {
    latestListKeyReference.current = listKey
  })

  const fetchFirstPage = useCallback(async () => {
    const requestedListKey = listKey
    try {
      const conversationPage = await listConversations({ view, status, limit: CONVERSATION_PAGE_SIZE })
      if (requestedListKey !== latestListKeyReference.current) {
        return
      }
      setListState((currentState) => {
        // A background refresh keeps conversations from pages the agent already loaded with "Load more".
        const isSameList = currentState.listKey === requestedListKey
        const firstPageIds = new Set(conversationPage.conversations.map((conversation) => conversation.id))
        const loadedExtraConversations = isSameList
          ? currentState.conversations.slice(CONVERSATION_PAGE_SIZE).filter((conversation) => !firstPageIds.has(conversation.id))
          : []
        const hasLoadedExtraPages = isSameList && currentState.conversations.length > CONVERSATION_PAGE_SIZE
        return {
          listKey: requestedListKey,
          conversations: [...conversationPage.conversations, ...loadedExtraConversations],
          nextCursor: hasLoadedExtraPages ? currentState.nextCursor : conversationPage.nextCursor,
          errorMessage: '',
        }
      })
    } catch (error) {
      if (requestedListKey === latestListKeyReference.current) {
        setListState((currentState) => ({ ...currentState, listKey: requestedListKey, errorMessage: error.message }))
      }
    }
  }, [listKey, view, status])

  useEffect(() => {
    const firstFetchId = setTimeout(fetchFirstPage, 0)
    const intervalId = setInterval(fetchFirstPage, LIST_REFRESH_INTERVAL_MILLISECONDS)
    return () => {
      clearTimeout(firstFetchId)
      clearInterval(intervalId)
    }
  }, [fetchFirstPage])

  const isCurrentList = listState.listKey === listKey
  const nextCursor = isCurrentList ? listState.nextCursor : null

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) {
      return
    }
    setIsLoadingMore(true)
    try {
      const conversationPage = await listConversations({ view, status, cursor: nextCursor, limit: CONVERSATION_PAGE_SIZE })
      setListState((currentState) => {
        const knownIds = new Set(currentState.conversations.map((conversation) => conversation.id))
        return {
          ...currentState,
          conversations: [
            ...currentState.conversations,
            ...conversationPage.conversations.filter((conversation) => !knownIds.has(conversation.id)),
          ],
          nextCursor: conversationPage.nextCursor,
        }
      })
    } catch (error) {
      setListState((currentState) => ({ ...currentState, errorMessage: error.message }))
    } finally {
      setIsLoadingMore(false)
    }
  }, [view, status, nextCursor, isLoadingMore])

  // Puts an updated conversation (after assign, label or status changes) straight into the list.
  const replaceConversation = useCallback((updatedConversation) => {
    setListState((currentState) => ({
      ...currentState,
      conversations: currentState.conversations.map((conversation) =>
        conversation.id === updatedConversation.id ? updatedConversation : conversation,
      ),
    }))
  }, [])

  return {
    conversations: isCurrentList ? listState.conversations : [],
    isLoading: !isCurrentList,
    isLoadingMore,
    hasMore: Boolean(nextCursor),
    errorMessage: isCurrentList ? listState.errorMessage : '',
    loadMore,
    refresh: fetchFirstPage,
    replaceConversation,
  }
}
