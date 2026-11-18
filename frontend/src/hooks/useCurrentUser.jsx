import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { disconnectStaffSocket } from './useRealtimeSocket.js'
import { fetchCurrentUser, signInStaffUser, signOutStaffUser, signUpBusinessOwner } from '../api/authenticationApi.js'

const SessionContext = createContext(null)

// Loads the signed-in staff user and their business once (GET /me) and shares them with every staff page.
// Sign-up, sign-in and /me all return { user, business }.
export function SessionProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [currentBusiness, setCurrentBusiness] = useState(null)

  useEffect(() => {
    let isCancelled = false
    fetchCurrentUser()
      .then((sessionResponse) => {
        if (!isCancelled) {
          setCurrentUser(sessionResponse.user)
          setCurrentBusiness(sessionResponse.business)
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
    setCurrentBusiness(signInResponse.business)
    return signInResponse.user
  }, [])

  const signUp = useCallback(async (signUpFields) => {
    const signUpResponse = await signUpBusinessOwner(signUpFields)
    setCurrentUser(signUpResponse.user)
    setCurrentBusiness(signUpResponse.business)
    return signUpResponse.user
  }, [])

  const signOut = useCallback(async () => {
    try {
      await signOutStaffUser()
    } finally {
      disconnectStaffSocket()
      setCurrentUser(null)
      setCurrentBusiness(null)
    }
  }, [])

  const businessName = currentBusiness?.name || ''
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
