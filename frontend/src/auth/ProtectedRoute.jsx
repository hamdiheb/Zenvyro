import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser.jsx'
import { Spinner } from '../components/ui/Spinner'

const loadingScreenStyle = { display: 'grid', placeItems: 'center', height: '100vh' }

// Sends signed-out visitors to /sign-in and remembers where they were going.
export function ProtectedRoute({ children }) {
  const { currentUser, isSessionLoading } = useCurrentUser()
  const location = useLocation()

  if (isSessionLoading) {
    return (
      <div style={loadingScreenStyle}>
        <Spinner size={28} label="Checking your session" />
      </div>
    )
  }
  if (!currentUser) {
    return <Navigate to="/sign-in" replace state={{ returnPath: `${location.pathname}${location.search}` }} />
  }
  return children
}
