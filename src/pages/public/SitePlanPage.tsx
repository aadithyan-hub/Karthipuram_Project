import { LandPlot } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlanLegend, SitePlan } from '@/components/SitePlan'
import { Badge, ButtonLink, cn, EmptyState, Segmented, Select } from '@/components/ui'
import { useDb } from '@/data/store'
import type { Facing, Plot, PlotStatus } from '@/data/types'
import { inr, inrCompact, num, PLOT_STATUS_LABEL } from '@/lib/format'

type StatusFilter = 'all' | PlotStatus

export default function SitePlanPage() {
  const db = useDb()
  const [params] = useSearchParams()
  const ref = params.get('ref')
  const { pricePerSqft } = db.settings.project
  const [status, setStatus] = useState<StatusFilter>('available')
  const [facing, setFacing] = useState<'' | Facing>('')
  const [block, setBlock] = useState('')
  const [minSize, setMinSize] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const blocks = useMemo(() => [...new Set(db.plots.map((p) => p.block))], [db.plots])
  const counts = useMemo(() => {
    const c = { available: 0, reserved: 0, sold: 0 }
    for (const p of db.plots) c[p.status]++
    return c
  }, [db.plots])

  const matches = (p: Plot) =>
    (status === 'all' || p.status === status) && (!facing || p.facing === facing) && (!block || p.block === block) && p.areaSqft >= minSize
  const filtered = db.plots.filter(matches)
  const selected = db.plots.find((p) => p.id === selectedId) ?? null
  const bookHref = (id: string) => `/book?plot=${id}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 lg:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-tight font-bold sm:text-[40px]">Site plan</h1>
          <p className="mt-2 max-w-xl text-[16px] text-ink-2">
            Every plot in the layout with its size, facing and status. Prices are about {inr(pricePerSqft)} per sq ft.
          </p>
        </div>
        <PlanLegend counts={counts} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'available', label: 'Available', count: counts.available },
            { value: 'reserved', label: 'Reserved', count: counts.reserved },
            { value: 'sold', label: 'Sold', count: counts.sold },
            { value: 'all', label: 'All', count: db.plots.length },
          ]}
        />
        <Select compact className="w-auto min-w-36" aria-label="Facing" value={facing} onChange={(e) => setFacing(e.target.value as '' | Facing)}>
          <option value="">Any facing</option>
          <option value="North">North facing</option>
          <option value="South">South facing</option>
        </Select>
        <Select compact className="w-auto min-w-32" aria-label="Block" value={block} onChange={(e) => setBlock(e.target.value)}>
          <option value="">All blocks</option>
          {blocks.map((b) => (
            <option key={b} value={b}>
              Block {b}
            </option>
          ))}
        </Select>
        <Select compact className="w-auto min-w-36" aria-label="Minimum size" value={minSize} onChange={(e) => setMinSize(Number(e.target.value))}>
          <option value={0}>Any size</option>
          <option value={1300}>1,300+ sq ft</option>
          <option value={1500}>1,500+ sq ft</option>
          <option value={1700}>1,700+ sq ft</option>
        </Select>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="overflow-x-auto rounded-panel border border-line bg-white p-2 survey-grid scrollbar-thin sm:p-3">
            <div className="min-w-[760px] lg:min-w-0">
              <SitePlan plots={db.plots} selected={filtered.filter((p) => p.id !== selectedId).map((p) => p.id)} activeId={selectedId} onPlotClick={(p) => setSelectedId(p.id)} />
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-3 lg:hidden">Scroll sideways to see the whole layout. Plots matching your filters are filled green.</p>
          <p className="mt-2 hidden text-xs text-ink-3 lg:block">Plots matching your filters are filled green. Select any plot for details.</p>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {selected ? (
            <div className="rounded-panel border border-line bg-white p-5 animate-pop">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-xl font-semibold">
                  Block {selected.block}, plot {selected.number}
                </p>
                <Badge tone={selected.status === 'available' ? 'green' : selected.status === 'reserved' ? 'amber' : 'neutral'}>{PLOT_STATUS_LABEL[selected.status]}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Spec label="Area" value={`${num(selected.areaSqft)} sq ft`} />
                <Spec label="Facing" value={selected.facing} />
                <Spec label="Position" value={selected.corner ? 'Corner plot' : 'Middle plot'} />
                <Spec label="Approx. price" value={selected.status === 'sold' ? 'Sold' : inrCompact(selected.areaSqft * pricePerSqft)} />
              </dl>
              {selected.status === 'available' ? (
                <ButtonLink to={bookHref(selected.id)} className="mt-5 w-full">
                  Book a visit for this plot
                </ButtonLink>
              ) : (
                <p className="mt-5 rounded-field bg-paper-2 px-3 py-2.5 text-[13px] text-ink-2">
                  {selected.status === 'reserved' ? 'Someone has reserved this plot. It may open up again — ask the site team during your visit.' : 'This plot is sold. Similar plots nearby are shown in green.'}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-panel border border-dashed border-line px-5 py-6 text-sm text-ink-3">Select a plot on the plan to see its size, facing and price.</div>
          )}

          <div className="rounded-panel border border-line bg-white">
            <p className="border-b border-line-soft px-4 py-3 text-sm font-semibold">
              {filtered.length} {filtered.length === 1 ? 'plot matches' : 'plots match'}
            </p>
            {filtered.length === 0 ? (
              <EmptyState icon={<LandPlot />} title="No plots match" body="Try another facing, block or size." className="py-8" />
            ) : (
              <ul className="max-h-80 divide-y divide-line-soft overflow-y-auto scrollbar-thin">
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setSelectedId(p.id)} className={cn('flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-paper', selectedId === p.id && 'bg-paddy-50')}>
                      <span className="font-semibold">Plot {p.id}</span>
                      <span className="text-ink-3 tabular">
                        {num(p.areaSqft)} sq ft, {p.facing}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular">{value}</dd>
    </div>
  )
}
