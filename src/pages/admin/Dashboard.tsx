import { addDays, format, getDay, startOfDay } from 'date-fns'
import { AlertCircle, CalendarCheck2, ChevronRight, ClipboardCheck, Split, UserPlus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BarList, Funnel, trendBuckets, TrendChart } from '@/components/charts'
import { RangeFilter, rangeBounds, TextLink, type RangeKey } from '@/components/misc'
import { cn, PageHeader, Panel, Stat } from '@/components/ui'
import { brokerStats, inDateRange, metrics, slotViews } from '@/data/queries'
import { useDb } from '@/data/store'
import { num, pct, slotRange, time12 } from '@/lib/format'

export default function AdminDashboard() {
  const db = useDb()
  const [range, setRange] = useState<RangeKey>('30d')

  const data = useMemo(() => {
    const now = new Date()
    const { from, to } = rangeBounds(range)
    const inRange = db.bookings.filter((b) => inDateRange(b.createdAt, from, to))
    const m = metrics(inRange)
    const clicks = db.clicks.filter((c) => inDateRange(c.at, from, to)).length
    const referred = inRange.filter((b) => b.brokerId).length
    const won = inRange.filter((b) => b.salesStage === 'token' || b.salesStage === 'sold').length
    const views = slotViews(db)
    const slotById = new Map(views.map((s) => [s.id, s]))

    const unclosed = db.bookings.filter((b) => {
      if (b.status !== 'confirmed' && b.status !== 'rescheduled') return false
      const s = slotById.get(b.slotId)
      if (!s) return false
      const [h, mi] = s.end.split(':').map(Number)
      const end = new Date(s.startsAt)
      end.setHours(h, mi)
      return end < now
    })

    const top = brokerStats(db, from ?? undefined, to ?? undefined)
      .filter((s) => s.metrics.total > 0)
      .sort((a, b) => b.metrics.completed - a.metrics.completed || b.metrics.total - a.metrics.total)
      .slice(0, 6)

    const todayKey = format(now, 'yyyy-MM-dd')
    const today = views.filter((s) => s.date === todayKey).sort((a, b) => a.start.localeCompare(b.start))

    return { m, clicks, referred, won, unclosed, top, today, views, trend: trendBuckets(inRange, from, to) }
  }, [db, range])

  const brokersActive = db.brokers.filter((b) => b.status === 'active').length
  const brokersPending = db.brokers.filter((b) => b.status === 'pending').length
  const disputes = db.bookings.filter((b) => b.dispute === 'open').length
  const pendingAll = db.bookings.filter((b) => b.status === 'pending').length
  const { m } = data

  const attention: { icon: ReactNode; title: string; body: string; to: string; tone: string }[] = []
  if (pendingAll) attention.push({ icon: <CalendarCheck2 />, title: `${pendingAll} booking${pendingAll === 1 ? '' : 's'} to confirm`, body: 'Call the customer, then confirm the visit.', to: '/admin/bookings?status=pending&sort=visit&dir=asc', tone: 'text-turmeric-600' })
  if (data.unclosed.length) attention.push({ icon: <ClipboardCheck />, title: `${data.unclosed.length} past visit${data.unclosed.length === 1 ? '' : 's'} not closed out`, body: 'Mark each one completed or no-show so broker numbers stay right.', to: '/admin/bookings?when=past7&status=confirmed', tone: 'text-brick-600' })
  if (brokersPending) attention.push({ icon: <UserPlus />, title: `${brokersPending} broker${brokersPending === 1 ? '' : 's'} awaiting approval`, body: 'Their links give no credit until you approve them.', to: '/admin/brokers?status=pending', tone: 'text-sky-600' })
  if (disputes) attention.push({ icon: <Split />, title: `${disputes} duplicate lead${disputes === 1 ? '' : 's'}`, body: 'Decide which broker gets credit.', to: '/admin/disputes', tone: 'text-turmeric-600' })

  return (
    <>
      <PageHeader title="Overview" description="Bookings, visits and broker activity across the venture." actions={<RangeFilter value={range} onChange={setRange} />} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Brokers" value={num(brokersActive)} sub={brokersPending ? `${brokersPending} awaiting approval` : 'All approved'} tone="ink" />
        <Stat label="Bookings" value={num(m.total)} sub={`${pct(m.total ? data.referred / m.total : 0)} via brokers`} tone="blue" />
        <Stat label="Confirmed visits" value={num(m.confirmed + m.rescheduled)} sub={m.rescheduled ? `${m.rescheduled} rescheduled` : 'Upcoming and due'} tone="green" />
        <Stat label="Completed visits" value={num(m.completed)} sub={`${pct(m.showRate)} show-up rate`} tone="green" />
        <Stat label="Pending" value={num(m.pending)} sub="Waiting for confirmation" tone="amber" />
        <Stat label="Cancelled or no-show" value={num(m.cancelled + m.noShow)} sub={`${m.cancelled} cancelled · ${m.noShow} no-show`} tone="red" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Bookings over time" description="Grouped by the day the booking was made, coloured by what happened next.">
          <TrendChart data={data.trend} />
        </Panel>

        <Panel title="Needs attention" bodyClassName="p-0">
          {attention.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-3">All caught up. New bookings and approvals will show here.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {attention.map((a) => (
                <li key={a.title}>
                  <Link to={a.to} className="flex items-start gap-3 px-4 py-3.5 hover:bg-paper sm:px-5">
                    <span className={cn('mt-0.5 [&_svg]:size-[18px]', a.tone)}>{a.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{a.title}</span>
                      <span className="mt-0.5 block text-[13px] text-ink-3">{a.body}</span>
                    </span>
                    <ChevronRight className="mt-0.5 size-4 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="From link to sale" description="How referral clicks turn into visits.">
          <Funnel
            steps={[
              { label: 'Referral link opens', value: data.clicks },
              { label: 'Bookings', value: m.total },
              { label: 'Completed visits', value: m.completed },
              { label: 'Token paid or sold', value: data.won, note: 'Phase 2 preview: sales stage is set by the site office after the visit.' },
            ]}
          />
        </Panel>

        <Panel title="Top brokers" description="Ranked by completed visits." actions={<TextLink to="/admin/brokers" className="text-[13px]">All brokers</TextLink>}>
          <BarList
            empty="No broker bookings in this period."
            items={data.top.map((s) => ({
              key: s.broker.id,
              label: (
                <Link to={`/admin/bookings?broker=${s.broker.id}`} className="hover:underline">
                  {s.broker.name}
                </Link>
              ),
              value: s.metrics.completed,
              hint: `of ${s.metrics.total}`,
            }))}
          />
        </Panel>

        <Panel title="Today’s visits" actions={<TextLink to="/admin/check-in" className="text-[13px]">Open check-in</TextLink>} bodyClassName="p-0">
          {data.today.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-3">No visit slots today. The site office is closed or slots have not been opened.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {data.today.map((s) => {
                const ended = s.startsAt < new Date()
                return (
                  <li key={s.id}>
                    <Link to={`/admin/bookings?date=${s.date}&slot=${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper sm:px-5">
                      <span className={cn('w-28 shrink-0 text-sm font-semibold', ended ? 'text-ink-3' : 'text-ink')}>{slotRange(s)}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2">
                        <span className="block h-full rounded-full bg-paddy-500" style={{ width: `${Math.min(100, (s.booked / s.capacity) * 100)}%` }} />
                      </span>
                      <span className="w-12 shrink-0 text-right text-[13px] text-ink-2 tabular">
                        {s.booked}/{s.capacity}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      <CapacityHeatmap views={data.views} slotTimes={db.settings.slotTimes} operatingDays={db.settings.operatingDays} />
    </>
  )
}

const RAMP = ['#ecf5ef', '#c5e3d0', '#8fc6a5', '#4f9e72', '#1f6b45']

function cellColor(ratio: number) {
  if (ratio <= 0) return RAMP[0]
  return RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(ratio * (RAMP.length - 1) - 0.0001))]
}

function CapacityHeatmap({ views, slotTimes, operatingDays }: { views: ReturnType<typeof slotViews>; slotTimes: { start: string; end: string }[]; operatingDays: number[] }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i))
  const times = [...new Set([...slotTimes.map((t) => t.start), ...views.filter((v) => days.some((d) => format(d, 'yyyy-MM-dd') === v.date)).map((v) => v.start)])].sort()
  const byKey = new Map(views.map((v) => [`${v.date} ${v.start}`, v]))

  return (
    <Panel
      className="mt-5"
      title="Seats booked, next 14 days"
      description="Each cell is one visit slot. Darker means fuller. Select a day to see its bookings."
      actions={
        <div className="flex items-center gap-2 text-xs text-ink-3" aria-label="Legend">
          Empty
          <span className="flex">
            {RAMP.map((c) => (
              <span key={c} className="h-3 w-5 first:rounded-l last:rounded-r" style={{ background: c }} />
            ))}
          </span>
          Full
        </div>
      }
    >
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="w-16">
                <span className="sr-only">Time</span>
              </th>
              {days.map((d) => (
                <th key={d.toISOString()} className="pb-1 font-semibold text-ink-3">
                  <Link to={`/admin/bookings?date=${format(d, 'yyyy-MM-dd')}`} className="flex flex-col items-center hover:text-ink">
                    <span>{format(d, 'EEE')}</span>
                    <span className="text-[13px] text-ink tabular">{format(d, 'd')}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((t) => (
              <tr key={t}>
                <th className="pr-2 text-right font-medium whitespace-nowrap text-ink-3">{time12(t)}</th>
                {days.map((d) => {
                  const key = format(d, 'yyyy-MM-dd')
                  const v = byKey.get(`${key} ${t}`)
                  const closed = !operatingDays.includes(getDay(d))
                  if (!v || !v.active) {
                    return (
                      <td key={key} title={closed ? 'Closed' : 'No slot'} className="h-9 rounded-md bg-[repeating-linear-gradient(-45deg,var(--color-paper-2)_0_3px,#fff_3px_6px)]" />
                    )
                  }
                  const ratio = v.booked / v.capacity
                  return (
                    <td key={key} className="h-9 p-0">
                      <Link
                        to={`/admin/bookings?date=${key}&slot=${v.id}`}
                        title={`${format(d, 'EEE d MMM')}, ${slotRange(v)}: ${v.booked} of ${v.capacity} booked`}
                        className={cn('grid h-9 place-items-center rounded-md font-semibold tabular ring-inset hover:ring-2 hover:ring-ink', ratio >= 0.6 ? 'text-white' : 'text-ink-2')}
                        style={{ background: cellColor(ratio) }}
                      >
                        {v.booked}
                      </Link>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3">
        <AlertCircle className="size-3.5" /> Hatched cells are closed days or times with no slot.
      </p>
    </Panel>
  )
}
