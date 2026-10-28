import { LandPlot, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BarList } from '@/components/charts'
import { PlanLegend, SitePlan } from '@/components/SitePlan'
import { Badge, EmptyState, IconButton, PageHeader, Panel, Segmented, Select, Stat, cn } from '@/components/ui'
import { ApiError, setPlotStatus } from '@/data/api'
import { useDb } from '@/data/store'
import type { Facing, Plot, PlotStatus } from '@/data/types'
import { inr, inrCompact, num, PLOT_STATUS_LABEL } from '@/lib/format'

const STATUS_TONE = { available: 'green', reserved: 'amber', sold: 'neutral' } as const

export default function Plots() {
  const db = useDb()
  const { plots, settings } = db
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hover, setHover] = useState<Plot | null>(null)
  const [block, setBlock] = useState('all')
  const [status, setStatus] = useState<'all' | PlotStatus>('all')
  const [facing, setFacing] = useState<'all' | Facing>('all')
  const [saving, setSaving] = useState<PlotStatus | null>(null)

  const interest = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of db.bookings) for (const id of b.plotsOfInterest) map.set(id, (map.get(id) ?? 0) + 1)
    return map
  }, [db.bookings])

  const counts = useMemo(() => {
    const c = { available: 0, reserved: 0, sold: 0 }
    for (const p of plots) c[p.status]++
    return c
  }, [plots])
  const soldArea = plots.filter((p) => p.status === 'sold').reduce((s, p) => s + p.areaSqft, 0)
  const availableValue = plots.filter((p) => p.status === 'available').reduce((s, p) => s + p.areaSqft * settings.project.pricePerSqft, 0)
  const blocks = [...new Set(plots.map((p) => p.block))].sort()

  const filtered = plots.filter((p) => (block === 'all' || p.block === block) && (status === 'all' || p.status === status) && (facing === 'all' || p.facing === facing))
  const active = plots.find((p) => p.id === activeId) ?? null
  const shown = active ?? hover

  const topInterest = [...interest.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, value]) => {
      const p = plots.find((x) => x.id === id)
      return { key: id, label: `Plot ${id}${p ? `, ${num(p.areaSqft)} sq ft ${p.facing.toLowerCase()} facing` : ''}`, value, hint: p ? PLOT_STATUS_LABEL[p.status].toLowerCase() : undefined }
    })

  async function change(next: PlotStatus) {
    if (!active || active.status === next) return
    setSaving(next)
    try {
      await setPlotStatus(active.id, next)
      toast.success(`Plot ${active.id} marked ${PLOT_STATUS_LABEL[next].toLowerCase()}`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <PageHeader title="Plot inventory" description="Keep plot availability current. Brokers and visitors see the same plan, so a plot marked sold here disappears from their choices." />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total plots" value={plots.length} tone="ink" />
        <Stat label="Available" value={counts.available} tone="green" onClick={() => setStatus('available')} active={status === 'available'} />
        <Stat label="Reserved" value={counts.reserved} tone="amber" onClick={() => setStatus('reserved')} active={status === 'reserved'} />
        <Stat label="Sold" value={counts.sold} tone="blue" onClick={() => setStatus('sold')} active={status === 'sold'} />
        <Stat label="Area sold" value={num(soldArea)} sub="Square feet" tone="ink" />
        <Stat label="Unsold value" value={inrCompact(availableValue)} sub={`At ${inr(settings.project.pricePerSqft)} per sq ft`} tone="green" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Site plan" description="Select a plot to change its status." actions={<PlanLegend counts={counts} />}>
          <div className="-mx-1 overflow-x-auto scrollbar-thin">
            <div className="min-w-140 px-1">
              <SitePlan plots={plots} activeId={activeId} onPlotClick={(p) => setActiveId(p.id === activeId ? null : p.id)} onPlotHover={setHover} selected={active ? [active.id] : []} />
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel
            title={shown ? `Plot ${shown.id}` : 'Plot details'}
            actions={
              active ? (
                <IconButton label="Clear selection" onClick={() => setActiveId(null)} className="-my-1">
                  <X />
                </IconButton>
              ) : undefined
            }
          >
            {!shown ? (
              <EmptyState icon={<LandPlot />} title="No plot selected" body="Select a plot on the plan to see its details and change its status." className="py-6" />
            ) : (
              <div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-ink-3">Area</dt>
                    <dd className="font-semibold tabular">{num(shown.areaSqft)} sq ft</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Facing</dt>
                    <dd className="font-semibold">
                      {shown.facing}
                      {shown.corner && ', corner'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Indicative price</dt>
                    <dd className="font-semibold tabular">{inrCompact(shown.areaSqft * settings.project.pricePerSqft)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Visitor interest</dt>
                    <dd className="font-semibold tabular">{interest.get(shown.id) ?? 0} bookings</dd>
                  </div>
                </dl>
                {active ? (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-semibold">Status</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['available', 'reserved', 'sold'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={active.status === s}
                          disabled={!!saving}
                          onClick={() => change(s)}
                          className={cn(
                            'h-10 rounded-field border text-sm font-semibold transition-colors disabled:cursor-wait',
                            active.status === s ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink-2 hover:border-ink-3/50',
                            saving === s && 'opacity-60',
                          )}
                        >
                          {PLOT_STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-[13px] text-ink-3">Select this plot to change its status.</p>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Most requested plots" description="How often visitors named a plot when booking. Useful for pricing and holds.">
            <BarList items={topInterest} empty="Visitors have not named any plots yet." />
          </Panel>
        </div>
      </div>

      <Panel
        className="mt-5"
        bodyClassName="p-0"
        title={`Plots (${filtered.length})`}
        actions={
          <>
            <Select compact value={block} onChange={(e) => setBlock(e.target.value)} aria-label="Block" className="w-auto">
              <option value="all">All blocks</option>
              {blocks.map((b) => (
                <option key={b} value={b}>
                  Block {b}
                </option>
              ))}
            </Select>
            <Select compact value={facing} onChange={(e) => setFacing(e.target.value as 'all' | Facing)} aria-label="Facing" className="w-auto">
              <option value="all">Any facing</option>
              <option value="North">North</option>
              <option value="South">South</option>
            </Select>
          </>
        }
      >
        <div className="border-b border-line-soft px-4 py-3 sm:px-5">
          <Segmented
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: plots.length },
              { value: 'available', label: 'Available', count: counts.available },
              { value: 'reserved', label: 'Reserved', count: counts.reserved },
              { value: 'sold', label: 'Sold', count: counts.sold },
            ]}
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<LandPlot />} title="No plots match" body="Change the block, facing or status filter." />
        ) : (
          <ul className="grid grid-cols-2 gap-px bg-line-soft sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {filtered.map((p) => (
              <li key={p.id} className="bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(p.id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className={cn('block w-full px-4 py-3 text-left hover:bg-paper', p.id === activeId && 'bg-paddy-50')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display font-semibold">Plot {p.id}</span>
                    <Badge tone={STATUS_TONE[p.status]}>{PLOT_STATUS_LABEL[p.status]}</Badge>
                  </span>
                  <span className="mt-1 block text-xs text-ink-3 tabular">
                    {num(p.areaSqft)} sq ft, {p.facing.toLowerCase()}
                    {p.corner && ', corner'}
                  </span>
                  {(interest.get(p.id) ?? 0) > 0 && <span className="mt-0.5 block text-xs font-medium text-paddy-700">{interest.get(p.id)} interested</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
