import { endOfDay, startOfDay, subDays } from 'date-fns'
import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { markNotificationsRead } from '@/data/api'
import { useDb } from '@/data/store'
import { ago } from '@/lib/format'
import { cn, Segmented } from './ui'

export function Logo({ inverse, compact }: { inverse?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill={inverse ? 'var(--color-paper)' : 'var(--color-ink)'} />
        <path d="M14 46V18h12v14h12V18h12v28H38V36H26v10z" fill="none" stroke="var(--color-turmeric-400)" strokeWidth="3.2" strokeLinejoin="round" />
        <circle cx="32" cy="27" r="3" fill={inverse ? 'var(--color-ink)' : 'var(--color-paper)'} />
      </svg>
      {!compact && (
        <span className={cn('font-display text-[17px] leading-none font-bold tracking-tight', inverse ? 'text-paper' : 'text-ink')}>
          Karthipuram
          <span className={cn('block text-[11px] font-medium tracking-normal', inverse ? 'text-paper/60' : 'text-ink-3')}>Plots &amp; site visits</span>
        </span>
      )}
    </span>
  )
}

export type RangeKey = '7d' | '30d' | '90d' | 'all'
export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
]

export function rangeBounds(key: RangeKey): { from: Date | null; to: Date | null } {
  const to = endOfDay(new Date())
  if (key === 'all') return { from: null, to: null }
  const days = key === '7d' ? 6 : key === '30d' ? 29 : 89
  return { from: startOfDay(subDays(new Date(), days)), to }
}

export function RangeFilter({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  return <Segmented size="sm" value={value} onChange={onChange} options={RANGE_OPTIONS} />
}

export function NotificationBell({ audience, inverse }: { audience: string; inverse?: boolean }) {
  const db = useDb()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const mine = db.notifications.filter((n) => n.audience === audience).slice(0, 12)
  const unread = mine.filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => setOpen((o) => !o)}
        className={cn('relative grid size-9 place-items-center rounded-field transition-colors [&_svg]:size-[18px]', inverse ? 'text-paper/80 hover:bg-white/10 hover:text-paper' : 'text-ink-2 hover:bg-ink/5')}
      >
        <Bell />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-turmeric-400 px-1 text-[10px] leading-4 font-bold text-ink tabular">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-panel border border-line bg-white shadow-xl animate-pop">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" className="text-[13px] font-semibold text-paddy-600 hover:underline" onClick={() => markNotificationsRead(audience)}>
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line-soft overflow-y-auto scrollbar-thin">
            {mine.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-3">Nothing new. Updates about bookings show up here.</li>}
            {mine.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="flex w-full gap-3 px-4 py-3 text-left hover:bg-paper"
                  onClick={() => {
                    setOpen(false)
                    if (n.link) navigate(n.link)
                  }}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-turmeric-400')} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{n.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{n.body}</span>
                    <span className="mt-1 block text-xs text-ink-3/80">{ago(n.at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function TextLink({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('font-semibold text-paddy-600 underline-offset-2 hover:underline', className)}>
      {children}
    </Link>
  )
}
