import { CalendarClock, CalendarRange, Clock3, Gauge, LandPlot, LayoutDashboard, ListChecks, ScanLine, Settings, Share2, Split, TrendingUp, UserRound, Users } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useDb, useSession } from '@/data/store'
import { AppShell, type NavGroup, type NavItem } from './AppShell'

function RedirectToSignIn({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${to}?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
}

export function BrokerLayout() {
  const session = useSession()
  const db = useDb()
  const broker = session?.role === 'broker' ? db.brokers.find((b) => b.id === session.id) : undefined
  if (!broker || broker.status === 'disabled') return <RedirectToSignIn to="/broker/sign-in" />

  const items: NavItem[] = [
    { to: '/broker', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/broker/bookings', label: 'My bookings', icon: ListChecks },
    { to: '/broker/share', label: 'Share link', icon: Share2 },
    { to: '/broker/site-plan', label: 'Plot availability', icon: LandPlot },
    { to: '/broker/profile', label: 'Profile', icon: UserRound },
  ]
  const groups: NavGroup[] = [{ items }]
  const bottom = items.filter((i) => i.to !== '/broker/site-plan').map((i) => (i.label === 'My bookings' ? { ...i, label: 'Bookings' } : i))

  return (
    <AppShell
      groups={groups}
      bottomNav={bottom}
      user={{ name: broker.name, detail: broker.agency }}
      audience={broker.id}
      homeTo="/broker"
      banner={
        broker.status === 'pending' ? (
          <div className="border-b border-turmeric-300/60 bg-turmeric-50 px-4 py-2.5 text-center text-[13px] font-medium text-turmeric-800">
            Your account is waiting for approval from the site office. Your link will start giving you credit once you are approved.
          </div>
        ) : null
      }
    />
  )
}

export function AdminLayout() {
  const session = useSession()
  const db = useDb()
  if (session?.role !== 'admin') return <RedirectToSignIn to="/admin/sign-in" />

  const pendingBookings = db.bookings.filter((b) => b.status === 'pending').length
  const pendingBrokers = db.brokers.filter((b) => b.status === 'pending').length
  const disputes = db.bookings.filter((b) => b.dispute === 'open').length

  const groups: NavGroup[] = [
    {
      items: [
        { to: '/admin', label: 'Overview', icon: Gauge, end: true },
        { to: '/admin/bookings', label: 'Bookings', icon: CalendarClock, badge: pendingBookings },
        { to: '/admin/check-in', label: 'Today & check-in', icon: ScanLine },
      ],
    },
    {
      label: 'Manage',
      items: [
        { to: '/admin/brokers', label: 'Brokers', icon: Users, badge: pendingBrokers },
        { to: '/admin/slots', label: 'Visit slots', icon: CalendarRange },
        { to: '/admin/disputes', label: 'Duplicate leads', icon: Split, badge: disputes },
        { to: '/admin/plots', label: 'Plot inventory', icon: LandPlot },
      ],
    },
    {
      label: 'Phase 2 preview',
      items: [{ to: '/admin/pipeline', label: 'Sales pipeline', icon: TrendingUp, tag: 'Preview' }],
    },
    {
      items: [
        { to: '/admin/activity', label: 'Activity log', icon: Clock3 },
        { to: '/admin/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]

  return <AppShell groups={groups} user={{ name: 'Site Admin', detail: 'Site office' }} audience="admin" homeTo="/admin" />
}
