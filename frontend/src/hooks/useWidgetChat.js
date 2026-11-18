import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { getWidgetSession, postWidgetMessage, startWidgetSession } from '../api/widgetApi.js'
import { MESSAGE_CREATED_EVENT } from './realtimeEventNames.js'
import { mergeMessagesById } from './messageListUpdates.js'

const UNAUTHORIZED_STATUS_CODE = 401
const WIDGET_KEY_PATTERN = /^wk_[0-9a-f]{32}$/

// The 30-day visitor session lives in the iframe's own localStorage, one entry per widget key.
function buildSessionStorageKey(widgetKey) {
  return `zenvyro.widgetSession.${widgetKey}`
}

function readStoredSessionToken(widgetKey) {
  try {
    return localStorage.getItem(buildSessionStorageKey(widgetKey))
  } catch {
    return null
  }
}

function storeSessionToken(widgetKey, sessionToken) {
  try {
    if (sessionToken) {
      localStorage.setItem(buildSessionStorageKey(widgetKey), sessionToken)
    } else {
      localStorage.removeItem(buildSessionStorageKey(widgetKey))
    }
  } catch {
    // Without storage the chat still works; it just will not resume after a reload.
  }
}

// Runs the visitor side of the chat: resume or start a session, load history, send messages,
// and receive agent replies live over a socket authenticated with the widget session token.
// phase: invalid-key | loading | pre-chat | ready
export function useWidgetChat(widgetKey) {
  const isWidgetKeyValid = WIDGET_KEY_PATTERN.test(widgetKey || '')
  const [sessionToken, setSessionToken] = useState(() => (isWidgetKeyValid ? readStoredSessionToken(widgetKey) : null))
  const [loadedToken, setLoadedToken] = useState(null)
  const [messages, setMessages] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  const endSession = useCallback(
    (endMessage) => {
      storeSessionToken(widgetKey, null)
      setSessionToken(null)
      setLoadedToken(null)
      setMessages([])
      setErrorMessage(endMessage || '')
    },
    [widgetKey],
  )

  // Loads the conversation history for the current token (a resumed or a brand-new session).
  useEffect(() => {
    if (!sessionToken) {
      return undefined
    }
    let isCancelled = false
    getWidgetSession(sessionToken)
      .then((sessionResponse) => {
        if (!isCancelled) {
          setMessages(sessionResponse.messages)
          setLoadedToken(sessionToken)
        }
      })
      .catch((error) => {
        if (isCancelled) {
          return
        }
        if (error.statusCode === UNAUTHORIZED_STATUS_CODE) {
          endSession('Your previous chat has ended. Start a new one below.')
        } else {
          setErrorMessage(error.message)
          setLoadedToken(sessionToken)
        }
      })
    return () => {
      isCancelled = true
    }
  }, [sessionToken, endSession])

  // The server puts a visitor socket straight into its own conversation room on connect.
  useEffect(() => {
    if (!loadedToken) {
      return undefined
    }
    const visitorSocket = io({ auth: { widgetSessionToken: loadedToken } })
    visitorSocket.on(MESSAGE_CREATED_EVENT, (realtimeEvent) => {
      setMessages((currentMessages) => mergeMessagesById(currentMessages, [realtimeEvent.message]))
    })
    return () => visitorSocket.disconnect()
  }, [loadedToken])

  const startChat = useCallback(
    async ({ name = '', email = '' } = {}) => {
      setIsStarting(true)
      setErrorMessage('')
      try {
        const startResponse = await startWidgetSession({ widgetKey, name, email })
        storeSessionToken(widgetKey, startResponse.sessionToken)
        setSessionToken(startResponse.sessionToken)
        return true
      } catch (error) {
        setErrorMessage(error.message)
        return false
      } finally {
        setIsStarting(false)
      }
    },
    [widgetKey],
  )

  const sendMessage = useCallback(
    async (messageText) => {
      try {
        const sendResponse = await postWidgetMessage(loadedToken, messageText)
        setMessages((currentMessages) => mergeMessagesById(currentMessages, [sendResponse.message]))
        setErrorMessage('')
        return true
      } catch (error) {
        if (error.statusCode === UNAUTHORIZED_STATUS_CODE) {
          endSession('Your chat session has ended. Start a new chat.')
        } else {
          setErrorMessage(error.message)
        }
        return false
      }
    },
    [loadedToken, endSession],
  )

  let phase = 'pre-chat'
  if (!isWidgetKeyValid) {
    phase = 'invalid-key'
  } else if (sessionToken && loadedToken !== sessionToken) {
    phase = 'loading'
  } else if (loadedToken) {
    phase = 'ready'
  }

  return { phase, messages, errorMessage, isStarting, startChat, sendMessage }
}
