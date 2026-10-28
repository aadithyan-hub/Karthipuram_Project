import { Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, Button, EmptyState, Field, Input, PageHeader, Panel, Select, cn } from '@/components/ui'
import { ApiError, setSalesStage } from '@/data/api'
import { bookingViews, type BookingView } from '@/data/queries'
import { useDb } from '@/data/store'
import type { SalesStage } from '@/data/types'
import { inr, inrCompact, pct, shortDate, STAGE_LABEL } from '@/lib/format'

const COLUMNS: { stage: SalesStage; title: string; hint: string; accent: string }[] = [
  { stage: 'none', title: 'To follow up', hint: 'Visited, no follow-up logged yet', accent: 'bg-ink-3/40' },
  { stage: 'interested', title: 'Interested', hint: 'Wants a second look or details', accent: 'bg-sky-600' },
  { stage: 'negotiation', title: 'Negotiating', hint: 'Discussing price or plot', accent: 'bg-turmeric-400' },
  { stage: 'token', title: 'Token paid', hint: 'Advance received, plot held', accent: 'bg-paddy-500' },
  { stage: 'sold', title: 'Sold', hint: 'Sale registered', accent: 'bg-paddy-700' },
  { stage: 'dropped', title: 'Dropped', hint: 'Not buying for now', accent: 'bg-brick-500' },
]
const STAGES = COLUMNS.map((c) => c.stage)
const DEFAULT_AREA = 1500
const PER_COLUMN = 25

export default function Pipeline() {
  const db = useDb()
  const price = db.settings.project.pricePerSqft
  const [query, setQuery] = useState('')
  const [brokerId, setBrokerId] = useState('all')
  const [rate, setRate] = useState(2)
  const [expanded, setExpanded] = useState<SalesStage[]>([])

  const visited = useMemo(() => bookingViews(db, (b) => b.status === 'completed').sort((a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0)), [db])
  const plotArea = useMemo(() => new Map(db.plots.map((p) => [p.id, p.areaSqft])), [db.plots])

  const filtered = visited.filter((b) => {
    if (brokerId !== 'all' && (brokerId === 'direct' ? b.brokerId : b.brokerId !== brokerId)) return false
    const q = query.trim().toLowerCase()
    return !q || b.customerName.toLowerCase().includes(q) || b.ref.toLowerCase().includes(q)
  })

  const conversion = useMemo(() => {
    const rows = new Map<string, { id: string; name: string; agency: string; visited: number; active: number; sold: number; value: number }>()
    for (const b of visited) {
      if (!b.broker) continue
      const r = rows.get(b.broker.id) ?? { id: b.broker.id, name: b.broker.name, agency: b.broker.agency, visited: 0, active: 0, sold: 0, value: 0 }
      r.visited++
      if (['interested', 'negotiation', 'token'].includes(b.salesStage)) r.active++
      if (b.salesStage === 'sold') {
        r.sold++
        r.value += (plotArea.get(b.plotsOfInterest[0]) ?? DEFAULT_AREA) * price
      }
      rows.set(b.broker.id, r)
    }
    return [...rows.values()].sort((a, b) => b.sold - a.sold || b.visited - a.visited)
  }, [visited, plotArea, price])

  const totalSold = conversion.reduce((s, r) => s + r.sold, 0)
  const totalValue = conversion.reduce((s, r) => s + r.value, 0)
  const brokersWithVisits = conversion.map((r) => ({ id: r.id, name: r.name }))

  async function move(b: BookingView, stage: SalesStage) {
    try {
      await setSalesStage(b.id, stage)
      toast.success(`${b.customerName} moved to ${STAGE_LABEL[stage].toLowerCase()}`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <>
      <PageHeader title="Sales pipeline" description="What happens after a site visit, and which brokers bring buyers rather than just visitors." />

      <div className="mb-5 flex gap-3 rounded-panel border border-turmeric-300/70 bg-turmeric-50 p-4">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-turmeric-800" />
        <div className="text-sm text-ink-2">
          <p className="font-semibold text-ink">Phase 2 preview, not part of the first release</p>
          <p className="mt-0.5 leading-relaxed">
            The agreed scope ends at a completed site visit. This screen shows how sales follow-up and broker commissions could work next, using the same bookings. Stages here are sample data and can be changed freely.
          </p>
        </div>
      </div>

      <Panel
        bodyClassName="p-0"
        title={`Completed visits (${filtered.length})`}
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Customer or reference" aria-label="Search visits" className="h-9 w-48 pl-8 text-sm" />
            </div>
            <Select compact value={brokerId} onChange={(e) => setBrokerId(e.target.value)} aria-label="Broker" className="w-auto max-w-48">
              <option value="all">All brokers</option>
              <option value="direct">Direct (no broker)</option>
              {brokersWithVisits.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </>
        }
      >
        <div className="overflow-x-auto scrollbar-thin">
          <div className="grid min-w-270 grid-cols-6 divide-x divide-line-soft">
            {COLUMNS.map((col) => {
              const cards = filtered.filter((b) => b.salesStage === col.stage)
              const open = expanded.includes(col.stage)
              return (
                <div key={col.stage} className="flex min-w-0 flex-col">
                  <div className="border-b border-line-soft px-3 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span className={cn('size-2 rounded-full', col.accent)} />
                      {col.title}
                      <span className="ml-auto text-ink-3 tabular">{cards.length}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-3">{col.hint}</p>
                  </div>
                  <ul className="max-h-140 flex-1 space-y-2 overflow-y-auto bg-paper/60 p-2 scrollbar-thin">
                    {cards.length === 0 && <li className="px-2 py-6 text-center text-xs text-ink-3">No visits here</li>}
                    {(open ? cards : cards.slice(0, PER_COLUMN)).map((b) => (
                      <li key={b.id} className="rounded-field border border-line-soft bg-white p-2.5">
                        <Link to={`/admin/bookings?open=${b.id}`} className="block truncate text-sm font-semibold hover:underline">
                          {b.customerName}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-3 tabular">
                          {b.ref}, visited {b.startsAt ? shortDate(b.startsAt) : '—'}
                        </p>
                        <p className="mt-1 truncate text-xs text-ink-2">{b.broker ? b.broker.name : 'Direct booking'}</p>
                        {b.plotsOfInterest.length > 0 && <p className="mt-0.5 text-xs text-paddy-700">Plot {b.plotsOfInterest.join(', ')}</p>}
                        <Select compact value={b.salesStage} onChange={(e) => move(b, e.target.value as SalesStage)} aria-label={`Stage for ${b.customerName}`} className="mt-2 h-8 text-xs">
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s === 'none' ? 'To follow up' : STAGE_LABEL[s]}
                            </option>
                          ))}
                        </Select>
                      </li>
                    ))}
                    {!open && cards.length > PER_COLUMN && (
                      <li>
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded((x) => [...x, col.stage])}>
                          Show {cards.length - PER_COLUMN} more
                        </Button>
                      </li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Visit-to-sale conversion by broker" description="Completed visits that became a registered sale." bodyClassName="p-0">
          {conversion.length === 0 ? (
            <EmptyState title="No completed visits yet" body="Conversion appears once brokers' customers finish a site visit." />
          ) : (
            <div className="max-h-105 overflow-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-line-soft text-left text-xs text-ink-3">
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Broker</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Visited</th>
                    <th className="hidden px-2 py-2.5 text-right font-semibold sm:table-cell">In progress</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Sold</th>
                    <th className="px-4 py-2.5 text-right font-semibold sm:px-5">Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {conversion.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5 sm:px-5">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={r.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{r.name}</span>
                            <span className="block truncate text-xs text-ink-3">{r.agency}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular">{r.visited}</td>
                      <td className="hidden px-2 py-2.5 text-right tabular sm:table-cell">{r.active}</td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular">{r.sold}</td>
                      <td className="px-4 py-2.5 text-right tabular sm:px-5">
                        <span className="inline-flex items-center gap-2">
                          <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-paper-2 sm:block">
                            <span className="block h-full rounded-full bg-paddy-500" style={{ width: `${(r.sold / r.visited) * 100}%` }} />
                          </span>
                          {pct(r.sold / r.visited)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Commission estimate"
          description="Estimate for discussion, not a payout. Sale value uses the plot the customer asked about, or 1,500 sq ft when none was named."
          bodyClassName="p-0"
        >
          <div className="flex flex-wrap items-end gap-4 border-b border-line-soft px-4 py-4 sm:px-5">
            <Field label="Commission rate (%)" className="w-40">
              <Input type="number" min={0} max={10} step={0.25} value={rate} onChange={(e) => setRate(Math.max(0, Math.min(10, Number(e.target.value))))} />
            </Field>
            <div className="text-sm">
              <p className="text-ink-3">Estimated total for {totalSold} sales</p>
              <p className="font-display text-2xl font-semibold tabular">{inr((totalValue * rate) / 100)}</p>
              <p className="text-xs text-ink-3">On {inrCompact(totalValue)} of sales at {inr(price)} per sq ft</p>
            </div>
          </div>
          <ul className="max-h-75 divide-y divide-line-soft overflow-y-auto scrollbar-thin">
            {conversion.filter((r) => r.sold > 0).length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-3">No sales logged yet. Move a visit to Sold to see an estimate.</li>}
            {conversion
              .filter((r) => r.sold > 0)
              .sort((a, b) => b.value - a.value)
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.name}</span>
                    <span className="block text-xs text-ink-3 tabular">
                      {r.sold} {r.sold === 1 ? 'sale' : 'sales'}, {inrCompact(r.value)}
                    </span>
                  </span>
                  <span className="font-semibold tabular">{inr((r.value * rate) / 100)}</span>
                </li>
              ))}
          </ul>
        </Panel>
      </div>
    </>
  )
}
