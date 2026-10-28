import { History, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, Input, PageHeader, Pagination, Select, StatusBadge } from '@/components/ui'
import { useDb } from '@/data/store'
import type { Actor, BookingStatus } from '@/data/types'
import { ago, dateTime, STATUS_LABEL } from '@/lib/format'
import { BookingDrawer } from './BookingDrawer'

const PAGE_SIZE = 25
const ACTORS: { value: Actor; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'admin', label: 'Site office' },
  { value: 'site-team', label: 'Site team' },
  { value: 'system', label: 'System' },
]
const ACTOR_LABEL = Object.fromEntries(ACTORS.map((a) => [a.value, a.label])) as Record<Actor, string>
const STATUSES = Object.keys(STATUS_LABEL) as BookingStatus[]

/** What an event means in plain words, depending on who did it. */
function describe(status: BookingStatus, by: Actor, first: boolean) {
  if (first && status === 'pending') return 'Booked a site visit'
  switch (status) {
    case 'confirmed':
      return by === 'system' ? 'Visit auto-confirmed' : 'Confirmed the visit'
    case 'rescheduled':
      return 'Moved the visit to a new slot'
    case 'cancelled':
      return 'Cancelled the visit'
    case 'completed':
      return by === 'site-team' ? 'Checked in at the site' : 'Marked the visit completed'
    case 'no_show':
      return 'Marked as no-show'
    default:
      return 'Set back to pending'
  }
}

export default function AdminActivity() {
  const db = useDb()
  const [q, setQ] = useState('')
  const [actor, setActor] = useState<Actor | 'all'>('all')
  const [status, setStatus] = useState<BookingStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  const events = useMemo(() => {
    const list = db.bookings.flatMap((b) => b.history.map((h, i) => ({ ...h, key: `${b.id}-${i}`, first: i === 0, bookingId: b.id, ref: b.ref, customer: b.customerName })))
    return list.sort((a, b) => b.at.localeCompare(a.at))
  }, [db.bookings])

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase()
    return events.filter((e) => (actor === 'all' || e.by === actor) && (status === 'all' || e.status === status) && (!term || e.ref.includes(term) || e.customer.toUpperCase().includes(term)))
  }, [events, q, actor, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  return (
    <>
      <PageHeader title="Activity log" description="Every change to every booking: who made it, when, and why." />

      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="relative block">
          <span className="sr-only">Search by reference or customer</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="Search reference or customer"
            className="h-10 pl-9 text-sm"
          />
        </label>
        <Select
          compact
          className="h-10"
          value={actor}
          aria-label="Who"
          onChange={(e) => {
            setActor(e.target.value as Actor | 'all')
            setPage(1)
          }}
        >
          <option value="all">Everyone</option>
          {ACTORS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
        <Select
          compact
          className="h-10"
          value={status}
          aria-label="Status"
          onChange={(e) => {
            setStatus(e.target.value as BookingStatus | 'all')
            setPage(1)
          }}
        >
          <option value="all">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <section className="overflow-hidden rounded-panel border border-line-soft bg-white">
        {rows.length === 0 ? (
          <EmptyState icon={<History />} title="No activity matches" body="Change the search or filters to see more of the log." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((e) => (
              <li key={e.key}>
                <button type="button" onClick={() => setOpenId(e.bookingId)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left hover:bg-paper sm:flex-nowrap sm:px-5">
                  <span className="w-full shrink-0 text-xs text-ink-3 sm:w-32" title={dateTime(e.at)}>
                    {ago(e.at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">
                      <span className="font-semibold">{ACTOR_LABEL[e.by]}</span> {describe(e.status, e.by, e.first).toLowerCase()}
                      <span className="text-ink-3"> for </span>
                      <span className="font-semibold">{e.customer}</span>
                    </span>
                    <span className="block text-[13px] text-ink-3">
                      <span className="tabular">{e.ref}</span>
                      {e.note && ` · ${e.note}`}
                    </span>
                  </span>
                  <StatusBadge status={e.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={current} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </section>

      <BookingDrawer key={openId ?? 'none'} bookingId={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
