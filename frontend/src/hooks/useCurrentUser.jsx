import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { disconnectStaffSocket } from './useRealtimeSocket.js'
import { fetchCurrentUser, signInStaffUser, signOutStaffUser, signUpBusinessOwner } from '../api/authenticationApi.js'

// GET /me does not return the business name yet, so the name from sign-up is remembered on this device.
const BUSINESS_NAME_STORAGE_KEY = 'zenvyro.businessName'

const SessionContext = createContext(null)

function readStoredBusinessName() {
  try {
    return localStorage.getItem(BUSINESS_NAME_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function storeBusinessName(businessName) {
  try {
    localStorage.setItem(BUSINESS_NAME_STORAGE_KEY, businessName)
  } catch {
    // Storage can be blocked (private mode). The sidebar then shows a generic workspace name.
  }
}

// Loads the signed-in staff user once (GET /me) and shares it with every staff page.
export function SessionProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [businessName, setBusinessName] = useState(readStoredBusinessName)

  useEffect(() => {
    let isCancelled = false
    fetchCurrentUser()
      .then((sessionResponse) => {
        if (!isCancelled) {
          setCurrentUser(sessionResponse.user)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCurrentUser(null)
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsSessionLoading(false)
        }
      })
    return () => {
      isCancelled = true
    }
  }, [])

  const signIn = useCallback(async (credentials) => {
    const signInResponse = await signInStaffUser(credentials)
    setCurrentUser(signInResponse.user)
    return signInResponse.user
  }, [])

  const signUp = useCallback(async (signUpFields) => {
    const signUpResponse = await signUpBusinessOwner(signUpFields)
    setCurrentUser(signUpResponse.user)
    setBusinessName(signUpResponse.business?.name || signUpFields.businessName)
    storeBusinessName(signUpResponse.business?.name || signUpFields.businessName)
    return signUpResponse.user
  }, [])

  const signOut = useCallback(async () => {
    try {
      await signOutStaffUser()
    } finally {
      disconnectStaffSocket()
      setCurrentUser(null)
    }
  }, [])

  const sessionValue = useMemo(
    () => ({ currentUser, isSessionLoading, businessName, signIn, signUp, signOut }),
    [currentUser, isSessionLoading, businessName, signIn, signUp, signOut],
  )

  return <SessionContext.Provider value={sessionValue}>{children}</SessionContext.Provider>
}

export function useCurrentUser() {
  const sessionValue = useContext(SessionContext)
  if (!sessionValue) {
    throw new Error('useCurrentUser must be used inside SessionProvider.')
  }
  return sessionValue
}
