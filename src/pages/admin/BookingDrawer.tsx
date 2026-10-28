import { CalendarClock, MessageCircle, Phone, Split } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { SlotPicker } from '@/components/SlotPicker'
import { Badge, Button, cn, DetailList, Drawer, Field, Modal, Select, StatusBadge, Textarea } from '@/components/ui'
import { adminReschedule, ApiError, NEXT_STATUSES, setBookingStatus, setSalesStage } from '@/data/api'
import { slotStart, slotViews } from '@/data/queries'
import { useDb } from '@/data/store'
import type { Actor, BookingStatus, SalesStage } from '@/data/types'
import { dateTime, longDate, phoneDisplay, slotRange, sourceLabel, STAGE_LABEL, STATUS_LABEL, whatsappLink } from '@/lib/format'

const ACTOR_LABEL: Record<Actor, string> = { customer: 'Customer', admin: 'Site office', system: 'System', 'site-team': 'Site team' }

const ACTION_LABEL: Record<BookingStatus, string> = {
  pending: 'Mark pending',
  confirmed: 'Confirm visit',
  rescheduled: 'Reschedule',
  cancelled: 'Cancel visit',
  completed: 'Mark completed',
  no_show: 'Mark no-show',
}

const REOPEN_LABEL = 'Reopen as confirmed'

const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Try again.')

export function BookingDrawer({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  const db = useDb()
  const booking = bookingId ? db.bookings.find((b) => b.id === bookingId) : undefined
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<BookingStatus | null>(null)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [newSlot, setNewSlot] = useState<string | null>(null)
  const [rescheduleNote, setRescheduleNote] = useState('')
  const [rescheduling, setRescheduling] = useState(false)

  if (!booking) return <Drawer open={!!bookingId} onClose={onClose} title="Booking not found"><p className="p-5 text-sm text-ink-3">This booking no longer exists. It may have been removed when the sample data was reset.</p></Drawer>

  const slot = db.slots.find((s) => s.id === booking.slotId)
  const start = slot ? slotStart(slot) : null
  const started = start ? start <= new Date() : false
  const broker = booking.brokerId ? db.brokers.find((b) => b.id === booking.brokerId) : undefined
  const claimant = booking.claimantBrokerId ? db.brokers.find((b) => b.id === booking.claimantBrokerId) : undefined
  const project = db.settings.project
  const plots = db.plots.filter((p) => booking.plotsOfInterest.includes(p.id))
  const canReschedule = ['pending', 'confirmed', 'rescheduled'].includes(booking.status)

  const message = [
    `Hello ${booking.customerName.split(' ')[0]},`,
    `your site visit to ${project.name} is ${booking.status === 'pending' ? 'booked' : 'confirmed'}.`,
    '',
    `Reference: ${booking.ref}`,
    start && slot ? `When: ${longDate(start)}, ${slotRange(slot)}` : '',
    `Where: ${project.address}`,
    `Directions: ${project.mapsUrl}`,
    booking.pickup ? `Pickup: ${booking.pickupPoint}` : '',
    '',
    `Questions? Call ${project.phone}.`,
  ]
    .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')
    .join('\n')

  async function changeStatus(status: BookingStatus) {
    setBusy(status)
    try {
      const res = await setBookingStatus([booking!.id], status, note.trim() || undefined)
      if (res.skipped.length) toast.error(`${booking!.ref} cannot move to ${STATUS_LABEL[status].toLowerCase()} from its current status.`)
      else {
        toast.success(`${booking!.ref} marked ${STATUS_LABEL[status].toLowerCase()}`)
        setNote('')
      }
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function reschedule() {
    if (!newSlot) return
    setRescheduling(true)
    try {
      await adminReschedule(booking!.id, newSlot, rescheduleNote.trim())
      toast.success(`${booking!.ref} rescheduled`)
      setRescheduleOpen(false)
      setNewSlot(null)
      setRescheduleNote('')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setRescheduling(false)
    }
  }

  async function changeStage(stage: SalesStage) {
    try {
      await setSalesStage(booking!.id, stage)
      toast.success(`Sales stage set to ${STAGE_LABEL[stage].toLowerCase()}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const next = NEXT_STATUSES[booking.status]

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={booking.customerName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink-2 tabular">{booking.ref}</span>
            <StatusBadge status={booking.status} />
            {booking.dispute === 'open' && <Badge tone="amber">Duplicate lead</Badge>}
          </span>
        }
      >
        <div className="space-y-5 p-5">
          {/* Actions */}
          <section className="rounded-panel border border-line-soft bg-white p-4">
            <p className="text-sm font-semibold">Update this visit</p>
            {next.length === 0 ? (
              <p className="mt-1 text-[13px] text-ink-3">No further status changes are available.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {next.map((s) => {
                    const needsStart = (s === 'completed' || s === 'no_show') && !started
                    const reopen = s === 'confirmed' && ['completed', 'no_show', 'cancelled'].includes(booking.status)
                    return (
                      <Button
                        key={s}
                        size="sm"
                        variant={s === 'cancelled' ? 'danger' : s === 'confirmed' || s === 'completed' ? 'primary' : 'secondary'}
                        disabled={needsStart}
                        loading={busy === s}
                        onClick={() => changeStatus(s)}
                        title={needsStart ? 'Available once the visit time has started' : undefined}
                      >
                        {reopen ? REOPEN_LABEL : ACTION_LABEL[s]}
                      </Button>
                    )
                  })}
                  {canReschedule && (
                    <Button size="sm" variant="secondary" icon={<CalendarClock />} onClick={() => setRescheduleOpen(true)}>
                      Reschedule
                    </Button>
                  )}
                </div>
                {!started && next.some((s) => s === 'completed' || s === 'no_show') && (
                  <p className="mt-2 text-xs text-ink-3">Completed and no-show unlock once the visit time starts.</p>
                )}
                <Field label="Note for the history" optional className="mt-3">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: confirmed by phone with the customer" className="min-h-16 text-sm" />
                </Field>
              </>
            )}
          </section>

          {/* Customer */}
          <section>
            <h3 className="mb-1 text-sm font-semibold">Customer</h3>
            <DetailList
              items={[
                { label: 'Name', value: booking.customerName },
                {
                  label: 'Mobile',
                  value: (
                    <a href={`tel:+91${booking.phone}`} className="inline-flex items-center gap-1.5 text-paddy-600 hover:underline">
                      <Phone className="size-3.5" />
                      {phoneDisplay(booking.phone)}
                    </a>
                  ),
                },
                { label: 'Email', value: booking.email || <span className="text-ink-3">Not given</span> },
              ]}
            />
            <a
              href={whatsappLink(message, booking.phone)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-field border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-paper-2"
            >
              <MessageCircle className="size-4 text-paddy-600" />
              Send confirmation on WhatsApp
            </a>
          </section>

          {/* Visit */}
          <section>
            <h3 className="mb-1 text-sm font-semibold">Visit</h3>
            <DetailList
              items={[
                { label: 'Date', value: start ? longDate(start) : 'Slot removed' },
                { label: 'Time', value: slot ? slotRange(slot) : '—' },
                { label: 'Visitors', value: booking.visitors },
                { label: 'Pickup', value: booking.pickup ? booking.pickupPoint : <span className="text-ink-3">Coming on their own</span> },
                {
                  label: 'Plots of interest',
                  value: plots.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {plots.map((p) => (
                        <Badge key={p.id} tone={p.status === 'available' ? 'green' : p.status === 'reserved' ? 'amber' : 'neutral'}>
                          {p.id} · {p.areaSqft} sq ft
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-ink-3">None marked</span>
                  ),
                },
                { label: 'Booked on', value: dateTime(booking.createdAt) },
                { label: 'Checked in', value: booking.checkedInAt ? dateTime(booking.checkedInAt) : <span className="text-ink-3">Not yet</span> },
              ]}
            />
          </section>

          {/* Attribution */}
          <section>
            <h3 className="mb-1 text-sm font-semibold">Referral</h3>
            <DetailList
              items={[
                {
                  label: 'Credited broker',
                  value: broker ? (
                    <Link to={`/admin/bookings?broker=${broker.id}`} className="text-paddy-600 hover:underline" onClick={onClose}>
                      {broker.name}
                      <span className="block text-xs font-normal text-ink-3">{broker.agency}</span>
                    </Link>
                  ) : (
                    <span className="text-ink-3">Direct booking, no broker</span>
                  ),
                },
                { label: 'Referral code', value: booking.refCode ?? <span className="text-ink-3">None</span> },
                { label: 'Came from', value: sourceLabel(booking.source) },
              ]}
            />
            {claimant && (
              <div className={cn('mt-3 flex gap-3 rounded-field border p-3 text-[13px]', booking.dispute === 'open' ? 'border-turmeric-300 bg-turmeric-50' : 'border-line-soft bg-paper')}>
                <Split className="mt-0.5 size-4 shrink-0 text-turmeric-600" />
                <div>
                  <p className="font-semibold text-ink">
                    {booking.dispute === 'open' ? `${claimant.name} also claims this customer` : `Previously claimed by ${claimant.name}`}
                  </p>
                  <p className="mt-0.5 text-ink-3">
                    {booking.dispute === 'open'
                      ? 'The customer booked through a second broker’s link. First touch keeps the credit until you decide.'
                      : booking.dispute === 'moved_to_claimant'
                        ? 'Credit was moved to the broker who brought this booking.'
                        : 'Credit stayed with the broker who brought the customer first.'}
                  </p>
                  {booking.dispute === 'open' && (
                    <Link to="/admin/disputes" onClick={onClose} className="mt-1.5 inline-block font-semibold text-paddy-600 hover:underline">
                      Review duplicate leads
                    </Link>
                  )}
                </div>
              </div>
            )}
          </section>

          {booking.notes && (
            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Customer notes</h3>
              <p className="rounded-field bg-white p-3 text-sm leading-relaxed text-ink-2 ring-1 ring-line-soft">{booking.notes}</p>
            </section>
          )}

          {/* Sales stage */}
          {booking.status === 'completed' && (
            <section className="rounded-panel border border-dashed border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">After the visit</p>
                <Badge tone="amber">Phase 2 preview</Badge>
              </div>
              <p className="mt-1 text-[13px] text-ink-3">Track whether this visit turned into a sale.</p>
              <Select compact className="mt-3" value={booking.salesStage} onChange={(e) => changeStage(e.target.value as SalesStage)} aria-label="Sales stage">
                {(Object.keys(STAGE_LABEL) as SalesStage[]).map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </Select>
            </section>
          )}

          {/* History */}
          <section>
            <h3 className="mb-3 text-sm font-semibold">History</h3>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {[...booking.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className={cn('absolute top-1 -left-[25px] size-2.5 rounded-full ring-4 ring-paper', i === 0 ? 'bg-paddy-600' : 'bg-line')} />
                  <p className="text-sm">
                    <span className="font-semibold text-ink">{STATUS_LABEL[h.status]}</span>
                    <span className="text-ink-3"> by {ACTOR_LABEL[h.by]}</span>
                  </p>
                  {h.note && <p className="mt-0.5 text-[13px] text-ink-2">{h.note}</p>}
                  <p className="mt-0.5 text-xs text-ink-3">{dateTime(h.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </Drawer>

      <Modal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title={`Reschedule ${booking.ref}`}
        description={slot && start ? `Currently ${longDate(start)}, ${slotRange(slot)}` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRescheduleOpen(false)}>
              Keep current slot
            </Button>
            <Button onClick={reschedule} loading={rescheduling} disabled={!newSlot}>
              Move visit
            </Button>
          </>
        }
      >
        <SlotPicker slots={slotViews(db)} value={newSlot} onChange={setNewSlot} excludeSlotId={booking.slotId} />
        <Field label="Reason" optional className="mt-4">
          <Textarea value={rescheduleNote} onChange={(e) => setRescheduleNote(e.target.value)} placeholder="For example: customer asked for the weekend" className="min-h-16 text-sm" />
        </Field>
      </Modal>
    </>
  )
}
