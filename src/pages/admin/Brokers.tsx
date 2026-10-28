import { Download, Search, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { RangeFilter, rangeBounds, type RangeKey } from '@/components/misc'
import { Avatar, BrokerStatusBadge, Button, ConfirmModal, EmptyState, Input, PageHeader, Pagination, Panel, Segmented, Select, cn } from '@/components/ui'
import { ApiError, setBrokerStatus } from '@/data/api'
import { brokerStats, type BrokerStat } from '@/data/queries'
import { useDb } from '@/data/store'
import type { Broker, BrokerStatus } from '@/data/types'
import { ago, BROKER_STATUS_LABEL, downloadFile, pct, phoneDisplay, shortDate, toCsv } from '@/lib/format'
import { BrokerDrawer } from './mgmtBrokerDrawer'

type StatusFilter = 'all' | BrokerStatus
type SortKey = 'bookings' | 'completed' | 'newest' | 'name'
const PAGE_SIZE = 15

export default function Brokers() {
  const db = useDb()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as StatusFilter) || 'all'
  const focus = params.get('focus')
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('all')
  const [range, setRange] = useState<RangeKey>('all')
  const [sort, setSort] = useState<SortKey>('bookings')
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState<Broker | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const stats = useMemo(() => {
    const { from, to } = rangeBounds(range)
    return brokerStats(db, from ?? undefined, to ?? undefined)
  }, [db, range])
  const cities = useMemo(() => [...new Set(db.brokers.map((b) => b.city).filter(Boolean))].sort(), [db.brokers])
  const counts = useMemo(() => {
    const c = { all: db.brokers.length, pending: 0, active: 0, disabled: 0 }
    for (const b of db.brokers) c[b.status]++
    return c
  }, [db.brokers])
  const pending = db.brokers.filter((b) => b.status === 'pending')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = stats.filter(({ broker: b }) => {
      if (status !== 'all' && b.status !== status) return false
      if (city !== 'all' && b.city !== city) return false
      if (!q) return true
      return [b.name, b.phone, b.email, b.agency, b.referralCode].some((v) => v.toLowerCase().includes(q))
    })
    const by: Record<SortKey, (a: BrokerStat, b: BrokerStat) => number> = {
      bookings: (a, b) => b.metrics.total - a.metrics.total,
      completed: (a, b) => b.metrics.completed - a.metrics.completed,
      newest: (a, b) => b.broker.createdAt.localeCompare(a.broker.createdAt),
      name: (a, b) => a.broker.name.localeCompare(b.broker.name),
    }
    return list.sort(by[sort])
  }, [stats, status, city, query, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const focused = focus ? (db.brokers.find((b) => b.id === focus) ?? null) : null

  async function changeStatus(b: Broker, next: BrokerStatus) {
    setBusyId(b.id)
    try {
      await setBrokerStatus(b.id, next)
      toast.success(next === 'active' ? `${b.name} approved. Their link is live.` : `${b.name} rejected`)
      setRejecting(null)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  function exportCsv() {
    const csv = toCsv(
      filtered.map(({ broker: b, metrics: m, clicks }) => ({
        Name: b.name,
        Agency: b.agency,
        City: b.city,
        Mobile: b.phone,
        Email: b.email,
        'Referral code': b.referralCode,
        Status: BROKER_STATUS_LABEL[b.status],
        Bookings: m.total,
        Completed: m.completed,
        'No-shows': m.noShow,
        Cancelled: m.cancelled,
        'Show rate': pct(m.showRate),
        'Link clicks': clicks,
        Joined: shortDate(b.createdAt),
      })),
    )
    downloadFile(`brokers-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv')
    toast.success(`Exported ${filtered.length} brokers`)
  }

  return (
    <>
      <PageHeader
        title="Brokers"
        description="Everyone who refers visitors, how their links perform, and who is waiting for approval."
        actions={
          <Button variant="secondary" icon={<Download />} onClick={exportCsv} disabled={!filtered.length}>
            Export CSV
          </Button>
        }
      />

      {pending.length > 0 && (
        <section className="mb-5 rounded-panel border border-turmeric-300/70 bg-turmeric-50 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="size-[18px] text-turmeric-800" />
            <h2 className="text-[15px] font-semibold text-ink">
              {pending.length === 1 ? '1 broker is waiting for approval' : `${pending.length} brokers are waiting for approval`}
            </h2>
          </div>
          <ul className="grid gap-2 md:grid-cols-2">
            {pending.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-field border border-turmeric-300/50 bg-white px-3 py-2.5">
                <Avatar name={b.name} size="sm" />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setParam('focus', b.id)}>
                  <span className="block truncate text-sm font-semibold hover:underline">{b.name}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {b.agency}, {b.city || 'city not given'}. Signed up {ago(b.createdAt)}
                  </span>
                </button>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="danger" onClick={() => setRejecting(b)}>
                    Reject
                  </Button>
                  <Button size="sm" loading={busyId === b.id} onClick={() => changeStatus(b, 'active')}>
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Panel bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={status}
              onChange={(v) => {
                setParam('status', v === 'all' ? null : v)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'active', label: 'Active', count: counts.active },
                { value: 'pending', label: 'Awaiting approval', count: counts.pending },
                { value: 'disabled', label: 'Disabled', count: counts.disabled },
              ]}
            />
            <div className="flex items-center gap-2">
              <span className="hidden text-[13px] text-ink-3 sm:inline">Metrics for</span>
              <RangeFilter value={range} onChange={setRange} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="Search name, mobile, email, agency or code"
                className="h-10 pl-9 text-sm"
                aria-label="Search brokers"
              />
            </div>
            <Select compact value={city} onChange={(e) => (setCity(e.target.value), setPage(1))} aria-label="City" className="h-10">
              <option value="all">All cities</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select compact value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by" className="h-10">
              <option value="bookings">Most bookings</option>
              <option value="completed">Most completed visits</option>
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
            </Select>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Users />} title="No brokers match" body="Try a different search, or clear the status and city filters." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-left text-xs font-semibold text-ink-3">
                    <th className="px-5 py-2.5 font-semibold">Broker</th>
                    <th className="px-3 py-2.5 font-semibold">Contact</th>
                    <th className="px-3 py-2.5 font-semibold">Code</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Bookings</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Completed</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Show rate</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Clicks</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map(({ broker: b, metrics: m, clicks }) => (
                    <tr key={b.id} className="cursor-pointer hover:bg-paper" onClick={() => setParam('focus', b.id)}>
                      <td className="px-5 py-3">
                        <button type="button" className="flex items-center gap-3 text-left" onClick={(e) => (e.stopPropagation(), setParam('focus', b.id))}>
                          <Avatar name={b.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">{b.name}</span>
                            <span className="block text-xs text-ink-3">
                              {b.agency}
                              {b.city && `, ${b.city}`}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <span className="block tabular">{phoneDisplay(b.phone)}</span>
                        <span className="block max-w-48 truncate text-xs text-ink-3">{b.email}</span>
                      </td>
                      <td className="px-3 py-3 font-semibold tabular text-ink-2">{b.referralCode}</td>
                      <td className="px-3 py-3">
                        <BrokerStatusBadge status={b.status} />
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular">{m.total}</td>
                      <td className="px-3 py-3 text-right tabular">{m.completed}</td>
                      <td className={cn('px-3 py-3 text-right tabular', m.completed + m.noShow === 0 && 'text-ink-3')}>{m.completed + m.noShow ? pct(m.showRate) : '—'}</td>
                      <td className="px-3 py-3 text-right tabular">{clicks}</td>
                      <td className="px-5 py-3 text-right text-ink-3 tabular">{shortDate(b.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile and tablet cards */}
            <ul className="divide-y divide-line-soft lg:hidden">
              {rows.map(({ broker: b, metrics: m, clicks }) => (
                <li key={b.id}>
                  <button type="button" onClick={() => setParam('focus', b.id)} className="w-full px-4 py-3.5 text-left hover:bg-paper sm:px-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={b.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{b.name}</span>
                            <span className="block truncate text-xs text-ink-3">
                              {b.agency}
                              {b.city && `, ${b.city}`}
                            </span>
                          </span>
                          <BrokerStatusBadge status={b.status} />
                        </div>
                        <dl className="mt-2.5 grid grid-cols-4 gap-2 text-xs">
                          {[
                            ['Bookings', m.total],
                            ['Visited', m.completed],
                            ['Show rate', m.completed + m.noShow ? pct(m.showRate) : '—'],
                            ['Clicks', clicks],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <dt className="text-ink-3">{label}</dt>
                              <dd className="mt-0.5 text-sm font-semibold tabular">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={current} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
      </Panel>

      <BrokerDrawer broker={focused} onClose={() => setParam('focus', null)} />

      <ConfirmModal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.name ?? 'broker'}?`}
        body="Their account is disabled and their link will not give credit. You can re-enable the account later from their profile."
        confirmLabel="Reject broker"
        danger
        loading={!!rejecting && busyId === rejecting.id}
        onConfirm={() => rejecting && changeStatus(rejecting, 'disabled')}
      />
    </>
  )
}
