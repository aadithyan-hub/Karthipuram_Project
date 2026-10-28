import { endOfDay, format, startOfDay, subDays } from 'date-fns'
import { ArrowDownUp, CalendarSearch, Download, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Checkbox, cn, EmptyState, Input, PageHeader, Pagination, Segmented, Select, StatusBadge, Toggle } from '@/components/ui'
import { ApiError, setBookingStatus } from '@/data/api'
import { bookingViews, slotViews, type BookingView } from '@/data/queries'
import { useDb } from '@/data/store'
import type { BookingStatus } from '@/data/types'
import { dateTime, dayLabel, downloadFile, phoneDisplay, shortDate, slotRange, sourceLabel, STATUS_LABEL, toCsv } from '@/lib/format'
import { BookingDrawer } from './BookingDrawer'

const PAGE_SIZE = 15
const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'rescheduled', 'completed', 'no_show', 'cancelled']
type When = 'all' | 'upcoming' | 'today' | 'past7'
type SortKey = 'visit' | 'booked'

export default function AdminBookings() {
  const db = useDb()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState<BookingStatus | null>(null)

  const q = params.get('q') ?? ''
  const status = (params.get('status') ?? 'all') as BookingStatus | 'all'
  const broker = params.get('broker') ?? 'all'
  const date = params.get('date') ?? ''
  const slot = params.get('slot') ?? 'all'
  const when = (params.get('when') ?? 'all') as When
  const pickupOnly = params.get('pickup') === '1'
  const sort = (params.get('sort') ?? 'booked') as SortKey
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number(params.get('page') ?? 1))
  const openId = params.get('open')

  const update = (patch: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || v === 'all') next.delete(k)
      else next.set(k, v)
    }
    if (!keepPage) next.delete('page')
    setParams(next, { replace: true })
    if (!keepPage) setSelected([])
  }

  const all = useMemo(() => bookingViews(db), [db])

  // Everything except the status filter, so the status tabs can show counts.
  const baseFiltered = useMemo(() => {
    const now = new Date()
    const term = q.trim().toLowerCase()
    const digits = term.replace(/\D/g, '')
    return all.filter((b) => {
      if (term && !(b.customerName.toLowerCase().includes(term) || b.ref.toLowerCase().includes(term) || (digits.length >= 3 && b.phone.includes(digits)))) return false
      if (broker === 'direct' ? b.brokerId !== null : broker !== 'all' && b.brokerId !== broker) return false
      if (date && b.slot?.date !== date) return false
      if (slot !== 'all' && b.slotId !== slot) return false
      if (pickupOnly && !b.pickup) return false
      if (!date && when !== 'all' && b.startsAt) {
        if (when === 'upcoming' && b.startsAt < now) return false
        if (when === 'today' && (b.startsAt < startOfDay(now) || b.startsAt > endOfDay(now))) return false
        if (when === 'past7' && (b.startsAt < startOfDay(subDays(now, 7)) || b.startsAt > now)) return false
      }
      return true
    })
  }, [all, q, broker, date, slot, pickupOnly, when])

  const filtered = useMemo(() => {
    const list = status === 'all' ? baseFiltered : baseFiltered.filter((b) => b.status === status)
    const key = (b: BookingView) => (sort === 'visit' ? (b.startsAt?.getTime() ?? 0) : new Date(b.createdAt).getTime())
    return [...list].sort((a, b) => (dir === 'asc' ? key(a) - key(b) : key(b) - key(a)))
  }, [baseFiltered, status, sort, dir])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: baseFiltered.length }
    for (const s of STATUSES) c[s] = 0
    for (const b of baseFiltered) c[b.status]++
    return c
  }, [baseFiltered])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const brokers = useMemo(() => [...db.brokers].sort((a, b) => a.name.localeCompare(b.name)), [db.brokers])
  const slotsOnDate = useMemo(() => (date ? slotViews(db).filter((s) => s.date === date) : []), [db, date])

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id))
  const someOnPageSelected = rows.some((r) => selected.includes(r.id))
  const toggleRow = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const togglePage = (v: boolean) => setSelected((s) => (v ? [...new Set([...s, ...rows.map((r) => r.id)])] : s.filter((id) => !rows.some((r) => r.id === id))))

  const activeFilters = [q, broker !== 'all', date, slot !== 'all', when !== 'all', pickupOnly].filter(Boolean).length

  async function bulk(next: BookingStatus) {
    setBulkBusy(next)
    try {
      const res = await setBookingStatus(selected, next, 'Bulk update')
      if (res.updated) toast.success(`${res.updated} booking${res.updated === 1 ? '' : 's'} marked ${STATUS_LABEL[next].toLowerCase()}`)
      if (res.skipped.length) toast.warning(`${res.skipped.length} skipped: their current status or visit time does not allow ${STATUS_LABEL[next].toLowerCase()}.`)
      setSelected([])
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not update the bookings. Try again.')
    } finally {
      setBulkBusy(null)
    }
  }

  function exportCsv() {
    const csv = toCsv(
      filtered.map((b) => ({
        reference: b.ref,
        customer: b.customerName,
        mobile: b.phone,
        email: b.email,
        visit_date: b.slot?.date ?? '',
        visit_time: b.slot ? slotRange(b.slot) : '',
        visitors: b.visitors,
        status: STATUS_LABEL[b.status],
        broker: b.broker?.name ?? 'Direct',
        broker_agency: b.broker?.agency ?? '',
        referral_code: b.refCode ?? '',
        source: sourceLabel(b.source),
        pickup_point: b.pickup ? b.pickupPoint : '',
        plots_of_interest: b.plotsOfInterest.join(' '),
        notes: b.notes,
        duplicate_lead: b.dispute === 'open' ? 'Open' : '',
        booked_on: dateTime(b.createdAt),
      })),
    )
    downloadFile(`karthipuram-bookings-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv, 'text/csv')
    toast.success(`Exported ${filtered.length} bookings`)
  }

  const setSort = (key: SortKey) => update({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc' })

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every site visit booked through the website, with the broker who referred it."
        actions={
          <Button variant="secondary" icon={<Download />} onClick={exportCsv} disabled={!filtered.length}>
            Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <label className="relative block">
            <span className="sr-only">Search bookings</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => update({ q: e.target.value })} placeholder="Search name, mobile or reference" className="h-10 pl-9 text-sm" />
          </label>
          <Select compact className="h-10" value={broker} onChange={(e) => update({ broker: e.target.value })} aria-label="Broker">
            <option value="all">All brokers</option>
            <option value="direct">Direct / no broker</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select compact className="h-10" value={date ? 'date' : when} onChange={(e) => (e.target.value === 'date' ? update({ date: format(new Date(), 'yyyy-MM-dd'), when: null, slot: null }) : update({ when: e.target.value, date: null, slot: null }))} aria-label="Visit date">
            <option value="all">Any visit date</option>
            <option value="upcoming">Upcoming visits</option>
            <option value="today">Today</option>
            <option value="past7">Past 7 days</option>
            <option value="date">Pick a date…</option>
          </Select>
          {date ? (
            <div className="flex gap-2">
              <Input type="date" value={date} onChange={(e) => update({ date: e.target.value, slot: null })} className="h-10 min-w-0 flex-1 text-sm" aria-label="Visit date" />
              <Select compact className="h-10 min-w-0 flex-1" value={slot} onChange={(e) => update({ slot: e.target.value })} aria-label="Slot" disabled={!slotsOnDate.length}>
                <option value="all">{slotsOnDate.length ? 'All slots' : 'No slots'}</option>
                {slotsOnDate.map((s) => (
                  <option key={s.id} value={s.id}>
                    {slotRange(s)} ({s.booked}/{s.capacity})
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="flex h-10 items-center rounded-field border border-line bg-white px-3">
              <div className="w-full">
                <Toggle checked={pickupOnly} onChange={(v) => update({ pickup: v ? '1' : null })} label="Needs pickup only" />
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            size="sm"
            value={status}
            onChange={(v) => update({ status: v })}
            options={[{ value: 'all' as const, label: 'All', count: counts.all }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], count: counts[s] }))]}
          />
          <div className="flex items-center gap-2">
            {date && (
              <Button variant={pickupOnly ? 'primary' : 'secondary'} size="sm" onClick={() => update({ pickup: pickupOnly ? null : '1' })} aria-pressed={pickupOnly}>
                Needs pickup only
              </Button>
            )}
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" icon={<X />} onClick={() => setParams(status !== 'all' ? { status } : {}, { replace: true })}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.length > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-panel bg-ink px-4 py-2.5 text-paper animate-pop">
          <span className="mr-auto text-sm font-semibold">
            {selected.length} selected
            <button type="button" className="ml-3 text-[13px] font-medium text-paper/60 hover:text-paper" onClick={() => setSelected([])}>
              Clear
            </button>
          </span>
          <Button size="sm" variant="inverse" loading={bulkBusy === 'confirmed'} onClick={() => bulk('confirmed')}>
            Confirm
          </Button>
          <Button size="sm" variant="inverse" loading={bulkBusy === 'completed'} onClick={() => bulk('completed')}>
            Mark completed
          </Button>
          <Button size="sm" variant="inverse" loading={bulkBusy === 'no_show'} onClick={() => bulk('no_show')}>
            Mark no-show
          </Button>
          <Button size="sm" variant="danger" loading={bulkBusy === 'cancelled'} onClick={() => bulk('cancelled')}>
            Cancel
          </Button>
        </div>
      )}

      <section className="overflow-hidden rounded-panel border border-line-soft bg-white">
        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarSearch />}
            title="No bookings match these filters"
            body="Change the search or filters, or clear them to see every booking."
            action={
              <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden max-h-[70vh] overflow-auto scrollbar-thin md:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-paper text-xs font-semibold text-ink-3">
                  <tr className="border-b border-line-soft">
                    <th className="w-10 py-3 pr-2 pl-4">
                      <Checkbox label="Select all on this page" checked={allOnPageSelected} indeterminate={!allOnPageSelected && someOnPageSelected} onChange={togglePage} />
                    </th>
                    <th className="px-3 py-3">Reference</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">
                      <SortButton active={sort === 'visit'} dir={dir} onClick={() => setSort('visit')}>
                        Visit
                      </SortButton>
                    </th>
                    <th className="px-3 py-3">Broker</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">
                      <SortButton active={sort === 'booked'} dir={dir} onClick={() => setSort('booked')}>
                        Booked on
                      </SortButton>
                    </th>
                    <th className="px-3 py-3 pr-4 text-right">Visitors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map((b) => (
                    <tr key={b.id} className={cn('cursor-pointer transition-colors hover:bg-paper/70', selected.includes(b.id) && 'bg-paddy-50/60')} onClick={() => update({ open: b.id }, true)}>
                      <td className="py-3 pr-2 pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox label={`Select ${b.ref}`} checked={selected.includes(b.id)} onChange={() => toggleRow(b.id)} />
                      </td>
                      <td className="px-3 py-3 font-semibold tabular">
                        {b.ref}
                        {b.dispute === 'open' && <span className="ml-1.5 inline-block size-2 rounded-full bg-turmeric-400" title="Duplicate lead to review" />}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink">{b.customerName}</p>
                        <p className="text-xs text-ink-3 tabular">{phoneDisplay(b.phone)}</p>
                      </td>
                      <td className="px-3 py-3">
                        {b.startsAt && b.slot ? (
                          <>
                            <p className="font-medium">{dayLabel(b.startsAt)}</p>
                            <p className="text-xs text-ink-3">{slotRange(b.slot)}</p>
                          </>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="max-w-44 px-3 py-3">
                        {b.broker ? (
                          <>
                            <p className="truncate font-medium">{b.broker.name}</p>
                            <p className="truncate text-xs text-ink-3">{sourceLabel(b.source)}</p>
                          </>
                        ) : (
                          <span className="text-ink-3">Direct</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-3 py-3 text-ink-2">{shortDate(b.createdAt)}</td>
                      <td className="px-3 py-3 pr-4 text-right tabular">{b.visitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line-soft md:hidden">
              {rows.map((b) => (
                <li key={b.id} className={cn('flex gap-3 px-4 py-3.5', selected.includes(b.id) && 'bg-paddy-50/60')}>
                  <Checkbox label={`Select ${b.ref}`} checked={selected.includes(b.id)} onChange={() => toggleRow(b.id)} className="mt-1" />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => update({ open: b.id }, true)}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold">{b.customerName}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-3 tabular">
                      {b.ref} · {phoneDisplay(b.phone)}
                    </p>
                    <p className="mt-1.5 text-[13px] text-ink-2">
                      {b.startsAt && b.slot ? `${dayLabel(b.startsAt)}, ${slotRange(b.slot)}` : 'Slot removed'} · {b.visitors} {b.visitors === 1 ? 'visitor' : 'visitors'}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-ink-3">{b.broker ? `via ${b.broker.name}` : 'Direct booking'}</p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={current} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={(p) => update({ page: String(p) }, true)} />
      </section>

      <BookingDrawer key={openId ?? 'none'} bookingId={openId} onClose={() => update({ open: null }, true)} />
    </>
  )
}

function SortButton({ active, dir, onClick, children }: { active: boolean; dir: 'asc' | 'desc'; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 font-semibold hover:text-ink', active && 'text-ink')} aria-label={`Sort by ${children}`}>
      {children}
      <ArrowDownUp className={cn('size-3.5', active ? 'opacity-100' : 'opacity-40', active && dir === 'asc' && 'rotate-180')} />
    </button>
  )
}
