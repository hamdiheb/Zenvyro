import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { SessionProvider } from './hooks/useCurrentUser.jsx'
import { ProtectedRoute } from './auth/ProtectedRoute.jsx'
import { SignInPage } from './auth/SignInPage.jsx'
import { SignUpPage } from './auth/SignUpPage.jsx'
import { OverviewPage } from './dashboard/OverviewPage.jsx'
import { AppShell } from './components/layout/AppShell'

// Placeholder for routes whose page lands in a later commit.
function RoutePlaceholder({ title }) {
  return <main style={{ padding: 32 }}>{title}</main>
}

// Staff routes share one session. The widget and demo store never load the staff session.
function StaffSessionLayout() {
  return (
    <SessionProvider>
      <Outlet />
    </SessionProvider>
  )
}

export function App() {
  return (
    <Routes>
      <Route element={<StaffSessionLayout />}>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route
          path="/agent"
          element={
            <ProtectedRoute>
              <AppShell title="Inbox" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <OverviewPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Route>
      <Route path="/widget" element={<RoutePlaceholder title="Chat widget" />} />
      <Route path="/demo-store" element={<RoutePlaceholder title="Demo store" />} />
    </Routes>
  )
}
