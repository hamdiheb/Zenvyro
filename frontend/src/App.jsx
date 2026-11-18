import { Navigate, Route, Routes } from 'react-router-dom'

// Route map from Design.md section 2. Each placeholder is replaced by its page in a later commit.
function RoutePlaceholder({ title }) {
  return <main style={{ padding: 32 }}>{title}</main>
}

export function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<RoutePlaceholder title="Sign in" />} />
      <Route path="/sign-up" element={<RoutePlaceholder title="Sign up" />} />
      <Route path="/agent" element={<RoutePlaceholder title="Agent inbox" />} />
      <Route path="/agent/conversations/:conversationId" element={<RoutePlaceholder title="Agent inbox" />} />
      <Route path="/dashboard" element={<RoutePlaceholder title="Overview" />} />
      <Route path="/widget" element={<RoutePlaceholder title="Chat widget" />} />
      <Route path="/demo-store" element={<RoutePlaceholder title="Demo store" />} />
      <Route path="*" element={<Navigate to="/agent" replace />} />
    </Routes>
  )
}
