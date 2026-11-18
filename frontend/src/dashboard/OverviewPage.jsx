import { BarChart3 } from 'lucide-react'
import { useCurrentUser } from '../hooks/useCurrentUser.jsx'
import { AppShell } from '../components/layout/AppShell'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { readGreeting } from '../utils/dateFormatting.js'

// Week 3 (roadmap item 18) fills this page with KPI cards, volume chart, AI Activity and CSAT.
export function OverviewPage() {
  const { currentUser } = useCurrentUser()
  const firstName = currentUser?.name?.split(' ')[0] || ''

  return (
    <AppShell
      title={`${readGreeting()}, ${firstName}`}
      subtitle="Here's what's happening with your support team today."
    >
      <Card>
        <EmptyState
          icon={<BarChart3 size={24} />}
          title="Your overview is on its way"
          description="KPI cards, conversation volume, AI activity and customer satisfaction arrive in Week 3. Head to the inbox to answer customers now."
        />
      </Card>
    </AppShell>
  )
}
