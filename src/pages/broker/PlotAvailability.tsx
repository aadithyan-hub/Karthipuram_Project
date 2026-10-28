import { Compass, MessageCircle, MousePointerClick } from 'lucide-react'
import { useState } from 'react'
import { PlanLegend, SitePlan } from '@/components/SitePlan'
import { Badge, CopyButton, DetailList, EmptyState, PageHeader, Panel, Segmented, Select } from '@/components/ui'
import { useDb } from '@/data/store'
import type { Facing, Plot } from '@/data/types'
import { bookingLink, inrCompact, num, PLOT_STATUS_LABEL, whatsappLink } from '@/lib/format'
import { useBroker } from './useBroker'

type StatusFilter = 'all' | Plot['status']

export default function BrokerPlotAvailability() {
  const db = useDb()
  const broker = useBroker()
  const [status, setStatus] = useState<StatusFilter>('available')
  const [facing, setFacing] = useState<'all' | Facing>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const price = db.settings.project.pricePerSqft

  const counts = db.plots.reduce<Record<Plot['status'], number>>((acc, p) => ({ ...acc, [p.status]: acc[p.status] + 1 }), { available: 0, reserved: 0, sold: 0 })
  const matches = (p: Plot) => (status === 'all' || p.status === status) && (facing === 'all' || p.facing === facing)
  const matching = db.plots.filter(matches)
  const active = db.plots.find((p) => p.id === activeId) ?? null

  return (
    <>
      <PageHeader title="Plot availability" description="Live plot status from the site office. Tap a plot to see its size and send it to a customer." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All', count: db.plots.length },
            { value: 'available', label: 'Available', count: counts.available },
            { value: 'reserved', label: 'Reserved', count: counts.reserved },
            { value: 'sold', label: 'Sold', count: counts.sold },
          ]}
        />
        <Select compact value={facing} onChange={(e) => setFacing(e.target.value as typeof facing)} aria-label="Facing" className="w-auto">
          <option value="all">Any facing</option>
          <option value="North">North facing</option>
          <option value="South">South facing</option>
        </Select>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel bodyClassName="p-0 sm:p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[640px] p-3 survey-grid sm:p-4">
              <SitePlan plots={db.plots} activeId={activeId} selected={activeId ? [activeId] : []} onPlotClick={(p) => setActiveId(p.id === activeId ? null : p.id)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-4 py-3">
            <PlanLegend counts={counts} />
            <p className="text-xs text-ink-3 md:hidden">Scroll sideways to see the whole plan.</p>
          </div>
        </Panel>

        <div className="space-y-5">
          {active ? (
            <PlotCard plot={active} price={price} link={`${bookingLink(broker.referralCode, 'whatsapp')}&plot=${active.id}`} projectName={db.settings.project.name} canShare={broker.status === 'active'} />
          ) : (
            <Panel>
              <EmptyState icon={<MousePointerClick />} title="Pick a plot" body="Tap any plot on the plan to see its size, facing and price estimate." className="py-6" />
            </Panel>
          )}

          <Panel title={`${num(matching.length)} matching plots`} bodyClassName="p-0 sm:p-0">
            <ul className="max-h-80 divide-y divide-line-soft overflow-y-auto scrollbar-thin">
              {matching.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setActiveId(p.id)} className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-paper ${p.id === activeId ? 'bg-paddy-50' : ''}`}>
                    <span className="font-semibold">Plot {p.id}</span>
                    <span className="text-ink-3 tabular">
                      {num(p.areaSqft)} sq ft · {p.facing}
                    </span>
                  </button>
                </li>
              ))}
              {!matching.length && <li className="px-4 py-6 text-center text-sm text-ink-3">No plots match these filters.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}

function PlotCard({ plot, price, link, projectName, canShare }: { plot: Plot; price: number; link: string; projectName: string; canShare: boolean }) {
  const estimate = plot.areaSqft * price
  const message = `Plot ${plot.id} at ${projectName} is ${PLOT_STATUS_LABEL[plot.status].toLowerCase()}: ${num(plot.areaSqft)} sq ft, ${plot.facing} facing${plot.corner ? ', corner plot' : ''}. Approx. ${inrCompact(estimate)}. Book a free site visit to see it: ${link}`
  const tone = plot.status === 'available' ? 'green' : plot.status === 'reserved' ? 'amber' : 'neutral'
  return (
    <Panel title={`Plot ${plot.id}`} actions={<Badge tone={tone} dot>{PLOT_STATUS_LABEL[plot.status]}</Badge>}>
      <DetailList
        items={[
          { label: 'Size', value: `${num(plot.areaSqft)} sq ft` },
          { label: 'Facing', value: <span className="inline-flex items-center gap-1.5"><Compass className="size-4 text-ink-3" />{plot.facing}</span> },
          { label: 'Corner plot', value: plot.corner ? 'Yes' : 'No' },
          { label: 'Approx. price', value: `${inrCompact(estimate)} at ₹${num(price)}/sq ft` },
        ]}
      />
      {plot.status === 'sold' ? (
        <p className="mt-3 text-[13px] text-ink-3">This plot is sold. Suggest a nearby available plot instead.</p>
      ) : canShare ? (
        <div className="mt-4 grid gap-2">
          <a href={whatsappLink(message)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-field bg-paddy-600 px-4 text-sm font-semibold text-white hover:bg-paddy-700">
            <MessageCircle className="size-4" />
            Share this plot on WhatsApp
          </a>
          <CopyButton value={link} label="Copy booking link for this plot" />
          <p className="text-xs text-ink-3">The customer lands on the booking form with this plot already marked.</p>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-ink-3">You can share plots once your account is approved.</p>
      )}
    </Panel>
  )
}
