import { CheckCircle2, Split } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, Badge, Button, cn, EmptyState, PageHeader, Panel, StatusBadge } from '@/components/ui'
import { ApiError, resolveDispute } from '@/data/api'
import { bookingViews } from '@/data/queries'
import { useDb } from '@/data/store'
import type { Broker } from '@/data/types'
import { dateTime, dayLabel, phoneDisplay, shortDate, slotRange } from '@/lib/format'
import { BookingDrawer } from './BookingDrawer'

export default function AdminDisputes() {
  const db = useDb()
  const [busy, setBusy] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const open = useMemo(() => bookingViews(db, (b) => b.dispute === 'open'), [db])
  const resolved = useMemo(() => bookingViews(db, (b) => b.dispute === 'kept_first' || b.dispute === 'moved_to_claimant'), [db])
  const brokerById = useMemo(() => new Map(db.brokers.map((b) => [b.id, b])), [db.brokers])

  /** Earliest non-cancelled booking for the same mobile number by the credited broker. */
  const firstTouch = (phone: string, brokerId: string | null, excludeId: string) =>
    db.bookings
      .filter((b) => b.phone === phone && b.id !== excludeId && b.brokerId === brokerId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]

  async function decide(id: string, decision: 'kept_first' | 'moved_to_claimant', name: string) {
    setBusy(id + decision)
    try {
      await resolveDispute(id, decision)
      toast.success(`Credit ${decision === 'kept_first' ? 'kept with' : 'moved to'} ${name}`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save the decision. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Duplicate leads"
        description="When a customer who already came through one broker books again through another broker’s link, the first broker keeps the credit until you decide."
      />

      <div className="mb-5 rounded-panel border border-line-soft bg-white p-4 text-sm text-ink-2 sm:p-5">
        <p className="font-semibold text-ink">How credit is decided</p>
        <p className="mt-1 max-w-3xl leading-relaxed">
          The system matches customers by mobile number. The broker who brought the customer first is credited automatically. Move the credit only if the first broker’s
          contact had gone cold and the second broker did the real work, for example by bringing the customer to the site.
        </p>
      </div>

      {open.length === 0 ? (
        <Panel>
          <EmptyState icon={<CheckCircle2 />} title="No duplicate leads to review" body="When two brokers claim the same customer, the booking shows up here for a decision." />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {open.map((b) => {
            const first = b.broker
            const claimant = b.claimantBrokerId ? brokerById.get(b.claimantBrokerId) : undefined
            const earlier = firstTouch(b.phone, b.brokerId, b.id)
            return (
              <article key={b.id} className="rounded-panel border border-turmeric-300/70 bg-white">
                <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line-soft px-4 py-3.5 sm:px-5">
                  <button type="button" className="min-w-0 text-left" onClick={() => setOpenId(b.id)}>
                    <p className="font-display text-base font-semibold hover:underline">{b.customerName}</p>
                    <p className="text-[13px] text-ink-3 tabular">
                      {phoneDisplay(b.phone)} · {b.ref}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={b.status} />
                  </div>
                </header>
                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                  <BrokerSide
                    broker={first}
                    tag="Credited now"
                    tone="green"
                    detail={earlier ? `First booking ${shortDate(earlier.createdAt)} (${earlier.ref})` : 'Brought this customer first'}
                  />
                  <BrokerSide broker={claimant} tag="New link" tone="amber" detail={`Booked ${dateTime(b.createdAt)}${b.startsAt && b.slot ? ` for ${dayLabel(b.startsAt)}, ${slotRange(b.slot)}` : ''}`} />
                </div>
                <footer className="flex flex-wrap gap-2 border-t border-line-soft px-4 py-3 sm:px-5">
                  <Button size="sm" loading={busy === b.id + 'kept_first'} onClick={() => decide(b.id, 'kept_first', first?.name ?? 'the first broker')}>
                    Keep with {first?.name.split(' ')[0] ?? 'first broker'}
                  </Button>
                  {claimant && (
                    <Button size="sm" variant="secondary" loading={busy === b.id + 'moved_to_claimant'} onClick={() => decide(b.id, 'moved_to_claimant', claimant.name)}>
                      Move to {claimant.name.split(' ')[0]}
                    </Button>
                  )}
                </footer>
              </article>
            )
          })}
        </div>
      )}

      <Panel className="mt-6" title="Decided" description="Past decisions, newest booking first." bodyClassName="p-0">
        {resolved.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-3">Decisions you make appear here.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {resolved.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => setOpenId(b.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-paper sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{b.customerName}</span>
                    <span className="block text-[13px] text-ink-3 tabular">{b.ref}</span>
                  </span>
                  <span className="text-[13px] text-ink-2">
                    Credited to <span className="font-semibold text-ink">{b.broker?.name ?? 'Direct'}</span>
                  </span>
                  <Badge tone={b.dispute === 'kept_first' ? 'neutral' : 'blue'}>{b.dispute === 'kept_first' ? 'Kept with first broker' : 'Moved to new broker'}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <BookingDrawer key={openId ?? 'none'} bookingId={openId} onClose={() => setOpenId(null)} />
    </>
  )
}

function BrokerSide({ broker, tag, tone, detail }: { broker: Broker | undefined; tag: string; tone: 'green' | 'amber'; detail: string }) {
  return (
    <div className={cn('rounded-field border p-3', tone === 'green' ? 'border-paddy-200 bg-paddy-50/50' : 'border-turmeric-300/60 bg-turmeric-50/50')}>
      <div className="flex items-center justify-between gap-2">
        <Badge tone={tone}>{tag}</Badge>
        {tone === 'amber' && <Split className="size-4 text-turmeric-600" />}
      </div>
      {broker ? (
        <div className="mt-2.5 flex items-center gap-2.5">
          <Avatar name={broker.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{broker.name}</p>
            <p className="truncate text-xs text-ink-3">{broker.agency}</p>
          </div>
        </div>
      ) : (
        <p className="mt-2.5 text-sm text-ink-3">Broker record missing</p>
      )}
      <p className="mt-2 text-xs text-ink-3">{detail}</p>
    </div>
  )
}
