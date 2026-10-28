import { CalendarClock, Download, MessageCircle, Phone, Search, Share2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RangeFilter, rangeBounds, type RangeKey } from '@/components/misc'
import { Button, ButtonLink, cn, DetailList, Drawer, EmptyState, Input, PageHeader, Pagination, Panel, Segmented, Select, StatusBadge } from '@/components/ui'
import { brokerBookings, inDateRange, type BookingView } from '@/data/queries'
import { useDb } from '@/data/store'
import type { BookingStatus, StatusEvent } from '@/data/types'
import { dateTime, downloadFile, longDate, maskPhone, phoneDisplay, shortDate, slotRange, sourceLabel, STATUS_LABEL, toCsv, whatsappLink } from '@/lib/format'
import { useBroker } from './useBroker'

const PAGE_SIZE = 12
type StatusFilter = 'all' | BookingStatus
type Sort = 'visit' | 'booked'

const ACTOR: Record<StatusEvent['by'], string> = { customer: 'Customer', admin: 'Site office', system: 'Automatic', 'site-team': 'Site team' }

/** Brokers see full numbers only for live upcoming visits; everything else is masked. */
function canSeePhone(b: BookingView) {
  return ['pending', 'confirmed', 'rescheduled'].includes(b.status) && !!b.startsAt && b.startsAt > new Date()
}

export default function BrokerBookings() {
  const db = useDb()
  const broker = useBroker()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [range, setRange] = useState<RangeKey>('all')
  const [sort, setSort] = useState<Sort>('visit')
  const [page, setPage] = useState(1)

  const all = useMemo(() => brokerBookings(db, broker.id), [db, broker.id])
  const { from, to } = rangeBounds(range)
  const query = q.trim().toLowerCase()

  const scoped = all.filter((b) => {
    if (!inDateRange(b.createdAt, from, to)) return false
    if (!query) return true
    return b.customerName.toLowerCase().includes(query) || b.ref.toLowerCase().includes(query) || (query.replace(/\D/g, '').length >= 3 && b.phone.endsWith(query.replace(/\D/g, '')))
  })
  const counts = scoped.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.status]: (acc[b.status] ?? 0) + 1 }), {})
  const filtered = scoped
    .filter((b) => status === 'all' || b.status === status)
    .sort((a, b) => (sort === 'booked' ? b.createdAt.localeCompare(a.createdAt) : (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0)))

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const openId = params.get('open')
  const open = openId ? all.find((b) => b.id === openId) : undefined
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('open', id)
    else next.delete('open')
    setParams(next, { replace: true })
  }

  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(1)
  }

  function exportCsv() {
    const csv = toCsv(
      filtered.map((b) => ({
        Reference: b.ref,
        Customer: b.customerName,
        Mobile: maskPhone(b.phone),
        'Visit date': b.slot?.date ?? '',
        'Visit time': b.slot ? slotRange(b.slot) : '',
        Visitors: b.visitors,
        Status: STATUS_LABEL[b.status],
        'Booked on': shortDate(b.createdAt),
        Source: sourceLabel(b.source),
      })),
    )
    downloadFile(`my-bookings-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv')
  }

  const statusOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: scoped.length },
    ...(['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show'] as BookingStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s], count: counts[s] ?? 0 })),
  ]

  return (
    <>
      <PageHeader
        title="My bookings"
        description="Every booking made through your link. The site office confirms visits and marks them completed."
        actions={
          <Button variant="secondary" icon={<Download />} onClick={exportCsv} disabled={!filtered.length}>
            Export CSV
          </Button>
        }
      />

      <Panel bodyClassName="p-0 sm:p-0">
        <div className="space-y-3 border-b border-line-soft p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <Input value={q} onChange={(e) => resetPage(setQ)(e.target.value)} placeholder="Search name, reference or last digits of mobile" className="h-10 pl-9" aria-label="Search bookings" />
            </div>
            <div className="flex items-center gap-2">
              <RangeFilter value={range} onChange={resetPage(setRange)} />
              <Select compact value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by" className="w-auto">
                <option value="visit">Visit date</option>
                <option value="booked">Booking date</option>
              </Select>
            </div>
          </div>
          <Segmented size="sm" value={status} onChange={resetPage(setStatus)} options={statusOptions} />
        </div>

        {rows.length === 0 ? (
          all.length === 0 ? (
            <EmptyState icon={<Share2 />} title="No bookings yet" body="Share your link to get your first booking. It shows up here the moment a customer books." action={<ButtonLink to="/broker/share">Share your link</ButtonLink>} />
          ) : (
            <EmptyState icon={<Search />} title="No bookings match" body="Try another search, status or date range." />
          )
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-left text-xs font-semibold text-ink-3">
                    <th className="px-5 py-2.5 font-semibold">Customer</th>
                    <th className="px-3 py-2.5 font-semibold">Reference</th>
                    <th className="px-3 py-2.5 font-semibold">Visit</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Booked on</th>
                    <th className="px-5 py-2.5 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map((b) => (
                    <tr key={b.id} className="cursor-pointer hover:bg-paper" onClick={() => setOpen(b.id)}>
                      <td className="px-5 py-3">
                        <button type="button" className="text-left font-semibold text-ink hover:underline" onClick={(e) => (e.stopPropagation(), setOpen(b.id))}>
                          {b.customerName}
                        </button>
                        <p className="text-xs text-ink-3">
                          {b.visitors} {b.visitors === 1 ? 'visitor' : 'visitors'}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-semibold tabular text-ink-2">{b.ref}</td>
                      <td className="px-3 py-3">
                        <p className="font-medium tabular">{b.startsAt ? shortDate(b.startsAt) : '—'}</p>
                        <p className="text-xs text-ink-3">{b.slot ? slotRange(b.slot) : ''}</p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-3 py-3 text-ink-2 tabular">{shortDate(b.createdAt)}</td>
                      <td className="px-5 py-3 text-ink-2">{sourceLabel(b.source)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone cards */}
            <ul className="divide-y divide-line-soft md:hidden">
              {rows.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => setOpen(b.id)} className="flex w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-paper">
                    <div className="flex w-full items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{b.customerName}</p>
                        <p className="text-xs text-ink-3 tabular">{b.ref}</p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-ink-2">
                      <CalendarClock className="size-4 text-ink-3" />
                      <span className="tabular">{b.startsAt ? shortDate(b.startsAt) : '—'}</span>
                      <span className="text-ink-3">{b.slot ? slotRange(b.slot) : ''}</span>
                    </div>
                    <p className="text-xs text-ink-3">
                      Booked {shortDate(b.createdAt)} · {sourceLabel(b.source)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={current} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
      </Panel>

      <BookingDrawer booking={open} projectName={db.settings.project.name} brokerName={broker.name} onClose={() => setOpen(null)} />
    </>
  )
}

function BookingDrawer({ booking, onClose, projectName, brokerName }: { booking: BookingView | undefined; onClose: () => void; projectName: string; brokerName: string }) {
  if (!booking) return <Drawer open={false} onClose={onClose} title="">{null}</Drawer>
  const b = booking
  const showPhone = canSeePhone(b)
  const when = b.startsAt && b.slot ? `${longDate(b.startsAt)}, ${slotRange(b.slot)}` : 'Slot removed'
  const reminder = `Hello ${b.customerName.split(' ')[0]}, this is ${brokerName}. A reminder about your site visit to ${projectName} on ${when}. Your booking reference is ${b.ref}. Please let me know if you need any help getting there.`

  return (
    <Drawer
      open
      onClose={onClose}
      title={b.customerName}
      subtitle={
        <span className="flex items-center gap-2">
          <span className="font-semibold tabular">{b.ref}</span>
          <StatusBadge status={b.status} />
        </span>
      }
      footer={
        showPhone ? (
          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:+91${b.phone}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-field border border-line bg-white text-sm font-semibold hover:bg-paper-2">
              <Phone className="size-4" />
              Call
            </a>
            <a href={whatsappLink(reminder, b.phone)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-field bg-paddy-600 text-sm font-semibold text-white hover:bg-paddy-700">
              <MessageCircle className="size-4" />
              Message on WhatsApp
            </a>
          </div>
        ) : (
          <p className="text-[13px] text-ink-3">Contact details are hidden once a visit is over or cancelled. Ask the site office if you need them.</p>
        )
      }
    >
      <div className="space-y-5 p-5">
        <div className="rounded-panel border border-line-soft bg-white px-4">
          <DetailList
            items={[
              { label: 'Visit', value: when },
              { label: 'Visitors', value: b.visitors },
              { label: 'Mobile', value: <span className="tabular">{showPhone ? phoneDisplay(b.phone) : maskPhone(b.phone)}</span> },
              { label: 'Pickup', value: b.pickup ? b.pickupPoint : 'Not needed' },
              { label: 'Plots of interest', value: b.plotsOfInterest.length ? b.plotsOfInterest.join(', ') : 'None marked' },
              { label: 'Notes', value: b.notes || '—' },
              { label: 'Source', value: sourceLabel(b.source) },
              { label: 'Booked on', value: dateTime(b.createdAt) },
            ]}
          />
        </div>

        {b.dispute === 'open' && (
          <p className="rounded-field bg-turmeric-50 p-3 text-[13px] text-turmeric-800">
            This customer may also have been referred by another broker. The site office is reviewing who gets credit.
          </p>
        )}

        <div>
          <h3 className="mb-3 text-sm font-semibold">Status history</h3>
          <ol className="relative space-y-4 border-l border-line pl-5">
            {[...b.history].reverse().map((e, i) => (
              <li key={i} className="relative">
                <span className={cn('absolute top-1 -left-6.25 size-2.5 rounded-full ring-4 ring-paper', i === 0 ? 'bg-paddy-600' : 'bg-line')} />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={e.status} />
                  <span className="text-xs text-ink-3">
                    {dateTime(e.at)} by {ACTOR[e.by]}
                  </span>
                </div>
                {e.note && <p className="mt-1 text-[13px] text-ink-2">{e.note}</p>}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-ink-3">Only the site office can change a booking's status.</p>
        </div>
      </div>
    </Drawer>
  )
}
