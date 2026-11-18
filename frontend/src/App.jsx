import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { SessionProvider } from './hooks/useCurrentUser.jsx'
import { ProtectedRoute } from './auth/ProtectedRoute.jsx'
import { SignInPage } from './auth/SignInPage.jsx'
import { SignUpPage } from './auth/SignUpPage.jsx'
import { OverviewPage } from './dashboard/OverviewPage.jsx'
import { AgentInboxPage } from './agent/AgentInboxPage.jsx'
import { WidgetPage } from './widget/WidgetPage.jsx'
import { DemoStorePage } from './demoStore/DemoStorePage.jsx'

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
              <AgentInboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent/conversations/:conversationId"
          element={
            <ProtectedRoute>
              <AgentInboxPage />
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
      <Route path="/widget" element={<WidgetPage />} />
      <Route path="/demo-store" element={<DemoStorePage />} />
    </Routes>
  )
}
