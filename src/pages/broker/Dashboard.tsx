import { format, startOfMonth } from 'date-fns'
import { CalendarCheck2, CalendarClock, CheckCheck, Clock, Hourglass, MousePointerClick, Share2, Trophy, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarList, TrendChart, trendBuckets } from '@/components/charts'
import { RangeFilter, rangeBounds, TextLink, type RangeKey } from '@/components/misc'
import { Avatar, ButtonLink, CopyButton, cn, EmptyState, Panel, Stat, StatusBadge } from '@/components/ui'
import { brokerBookings, brokerStats, inDateRange, metrics } from '@/data/queries'
import { useDb } from '@/data/store'
import { bookingLink, num, pct, slotRange, sourceLabel, whatsappLink } from '@/lib/format'
import { shareMessage, useBroker } from './useBroker'

const UPCOMING = ['pending', 'confirmed', 'rescheduled']

export default function BrokerDashboard() {
  const db = useDb()
  const broker = useBroker()
  const [range, setRange] = useState<RangeKey>('30d')
  const { from, to } = rangeBounds(range)

  const all = useMemo(() => brokerBookings(db, broker.id), [db, broker.id])
  const inRange = all.filter((b) => inDateRange(b.createdAt, from, to))
  const m = metrics(inRange)
  const clicks = db.clicks.filter((c) => c.refCode === broker.referralCode && inDateRange(c.at, from, to)).length
  const now = new Date()
  const upcomingVisits = all.filter((b) => UPCOMING.includes(b.status) && b.startsAt && b.startsAt > now)
  const confirmedUpcoming = upcomingVisits.filter((b) => b.status !== 'pending').length
  const nextFive = [...upcomingVisits].sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime()).slice(0, 5)

  const sources = (() => {
    const map = new Map<string, number>()
    for (const b of inRange) {
      const k = sourceLabel(b.source)
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ key: label, label, value }))
  })()

  const board = useMemo(() => {
    const stats = brokerStats(db, startOfMonth(now), now)
      .filter((s) => s.broker.status === 'active' || s.broker.id === broker.id)
      .sort((a, b) => b.metrics.completed - a.metrics.completed || b.metrics.total - a.metrics.total)
    const rank = stats.findIndex((s) => s.broker.id === broker.id) + 1
    return { stats, rank, active: stats.filter((s) => s.broker.status === 'active').length }
  }, [db, broker.id])

  const firstName = broker.name.split(' ')[0]
  const link = bookingLink(broker.referralCode)
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-[28px]">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {upcomingVisits.length
              ? `${upcomingVisits.length} of your customers have a site visit coming up.`
              : 'None of your customers have a visit coming up yet.'}
          </p>
        </div>
        <RangeFilter value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Bookings" value={num(m.total)} sub="Created through your link" icon={<CalendarClock />} tone="ink" />
        <Stat label="Confirmed visits" value={num(confirmedUpcoming)} sub="Upcoming, confirmed or moved" icon={<CalendarCheck2 />} tone="blue" />
        <Stat label="Completed visits" value={num(m.completed)} sub={`${pct(m.showRate)} of due visits showed up`} icon={<CheckCheck />} tone="green" />
        <Stat label="Pending" value={num(m.pending)} sub="Waiting for the site office" icon={<Hourglass />} tone="amber" />
        <Stat label="Cancelled & no-show" value={num(m.cancelled + m.noShow)} sub={`${m.cancelled} cancelled · ${m.noShow} no-show`} icon={<XCircle />} tone="red" />
        <Stat label="Link clicks" value={num(clicks)} sub={clicks ? `${pct(m.total / clicks)} became bookings` : 'No clicks in this period'} icon={<MousePointerClick />} tone="ink" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Bookings over time" description="Each booking is grouped by the day it was made and coloured by what happened next.">
          {inRange.length ? (
            <TrendChart data={trendBuckets(inRange, from, to)} />
          ) : (
            <EmptyState icon={<Share2 />} title="No bookings in this period" body="Share your link on WhatsApp to get your first booking." action={<ButtonLink to="/broker/share">Share your link</ButtonLink>} />
          )}
        </Panel>

        {broker.status === 'active' ? (
          <Panel title="Your booking link" description="Customers who book through this link are credited to you.">
            <div className="rounded-field border border-line-soft bg-paper px-3 py-2.5 text-[13px] font-medium break-all text-ink-2">{link}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <CopyButton value={link} label="Copy link" />
              <a href={whatsappLink(shareMessage(db.settings.project.name, link))} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-field bg-paddy-600 px-4 text-sm font-semibold text-white hover:bg-paddy-700">
                <Share2 className="size-4" />
                WhatsApp
              </a>
            </div>
            <p className="mt-3 text-[13px] text-ink-3">
              Need a QR code or campaign links? <TextLink to="/broker/share">Open the share page</TextLink>
            </p>
          </Panel>
        ) : (
          <Panel title="Your booking link">
            <div className="flex gap-3 rounded-field bg-turmeric-50 p-3 text-[13px] leading-relaxed text-turmeric-800">
              <Clock className="mt-0.5 size-4 shrink-0" />
              <p>
                The site office is reviewing your account. Your link is ready but will not give you credit until you are approved. You will get a notification here when that happens.
              </p>
            </div>
          </Panel>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Upcoming visits"
          className="lg:col-span-1"
          bodyClassName="p-0 sm:p-0"
          actions={upcomingVisits.length > 5 ? <TextLink to="/broker/bookings" className="text-[13px]">See all {upcomingVisits.length}</TextLink> : undefined}
        >
          {nextFive.length ? (
            <ul className="divide-y divide-line-soft">
              {nextFive.map((b) => (
                <li key={b.id}>
                  <Link to={`/broker/bookings?open=${b.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper sm:px-5">
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-[11px] font-semibold text-ink-3">{format(b.startsAt!, 'EEE')}</p>
                      <p className="font-display text-lg leading-tight font-semibold tabular">{b.startsAt!.getDate()}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{b.customerName}</p>
                      <p className="truncate text-xs text-ink-3">{b.slot ? slotRange(b.slot) : ''} · {b.visitors} {b.visitors === 1 ? 'visitor' : 'visitors'}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No visits coming up" body="When a customer books through your link, their visit shows up here." className="py-8" />
          )}
        </Panel>

        <Panel title="Where your bookings come from" description="Based on the link each customer used.">
          <BarList items={sources} empty="No bookings in this period yet." />
        </Panel>

        <Panel title="This month's ranking" description="Ranked by completed site visits among active brokers.">
          {broker.status === 'active' ? (
            <>
              <div className="flex items-center gap-3 rounded-field bg-ink px-4 py-3 text-paper">
                <Trophy className="size-5 text-turmeric-300" />
                <p className="text-sm">
                  You are <span className="font-display text-lg font-semibold">#{board.rank}</span> of {board.active} active brokers
                </p>
              </div>
              <ol className="mt-3 space-y-1">
                {board.stats.slice(0, 5).map((s, i) => (
                  <li key={s.broker.id} className={cn('flex items-center gap-3 rounded-field px-2 py-1.5 text-sm', s.broker.id === broker.id && 'bg-paddy-50')}>
                    <span className="w-5 text-right font-semibold text-ink-3 tabular">{i + 1}</span>
                    <Avatar name={s.broker.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">{s.broker.id === broker.id ? 'You' : s.broker.name}</span>
                    <span className="font-semibold tabular">{s.metrics.completed}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-sm text-ink-3">You will appear in the ranking once your account is approved.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
