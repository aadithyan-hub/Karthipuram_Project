import { LogOut, Menu, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo, NotificationBell } from '@/components/misc'
import { Avatar, cn } from '@/components/ui'
import { signOut } from '@/data/api'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  end?: boolean
  tag?: string
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-5" aria-label="Sections">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && <p className="mb-1.5 px-3 text-xs font-semibold text-paper/40">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group flex h-10 items-center gap-3 rounded-field px-3 text-sm font-semibold transition-colors',
                      isActive ? 'bg-paper text-ink' : 'text-paper/70 hover:bg-white/8 hover:text-paper',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-paddy-600' : 'text-paper/50 group-hover:text-paper/80')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.tag && <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', isActive ? 'bg-turmeric-100 text-turmeric-800' : 'bg-white/10 text-paper/60')}>{item.tag}</span>}
                      {!!item.badge && <span className={cn('min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-bold tabular', isActive ? 'bg-turmeric-400 text-ink' : 'bg-turmeric-400/90 text-ink')}>{item.badge}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function AppShell({
  groups,
  user,
  audience,
  bottomNav,
  banner,
  homeTo,
}: {
  groups: NavGroup[]
  user: { name: string; detail: string }
  audience: string
  bottomNav?: NavItem[]
  banner?: ReactNode
  homeTo: string
}) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    setOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const doSignOut = () => {
    signOut()
    navigate('/')
  }

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-ink px-3 pt-4 pb-3 text-paper">
      <Link to={homeTo} className="mb-7 px-2" onClick={onNavigate}>
        <Logo inverse />
      </Link>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <NavLinks groups={groups} onNavigate={onNavigate} />
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-field border border-white/10 p-2.5">
        <Avatar name={user.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-paper/50">{user.detail}</p>
        </div>
        <button type="button" onClick={doSignOut} aria-label="Sign out" title="Sign out" className="grid size-8 place-items-center rounded-md text-paper/60 hover:bg-white/10 hover:text-paper">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar()}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] animate-slide-in-left">
            {sidebar(() => setOpen(false))}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-4 -right-12 grid size-10 place-items-center rounded-full bg-paper text-ink">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line-soft bg-paper/90 px-3 backdrop-blur-md sm:px-5 lg:h-16 lg:px-8">
        <div className="flex items-center gap-2">
          <button type="button" className="grid size-10 place-items-center rounded-field text-ink lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </button>
          <Link to={homeTo} className="lg:hidden">
            <Logo compact />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell audience={audience} />
          <span className="ml-1 hidden lg:inline-flex">
            <Avatar name={user.name} size="sm" />
          </span>
        </div>
      </header>

      {banner}

      <main className={cn('mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8', bottomNav && 'pb-24 lg:pb-8')}>
        <Outlet />
      </main>

      {bottomNav && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Quick">
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${bottomNav.length}, minmax(0, 1fr))` }}>
            {bottomNav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-paddy-600' : 'text-ink-3')}>
                  <item.icon className="size-5" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
