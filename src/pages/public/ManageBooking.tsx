import { CalendarClock, Search, Ticket, XCircle } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { SlotPicker } from '@/components/SlotPicker'
import { Button, ButtonLink, cn, ConfirmModal, DetailList, Field, Input, Panel, StatusBadge, Textarea } from '@/components/ui'
import { ApiError, customerCancel, customerReschedule, findMyBooking, getBookingByRef } from '@/data/api'
import { slotStart, slotViews } from '@/data/queries'
import { useDb } from '@/data/store'
import type { BookingStatus, StatusEvent } from '@/data/types'
import { dateTime, longDate, slotRange, STATUS_LABEL } from '@/lib/format'

const EDITABLE: BookingStatus[] = ['pending', 'confirmed', 'rescheduled']
const ACTOR: Record<StatusEvent['by'], string> = { customer: 'by you', admin: 'by the site office', system: 'automatically', 'site-team': 'by the site team' }

export default function ManageBooking() {
  const [params] = useSearchParams()
  const [verified, setVerified] = useState<{ ref: string; phone: string } | null>(null)

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16 sm:px-6 lg:pt-12">
      <h1 className="text-[32px] leading-tight font-bold sm:text-[40px]">Manage your booking</h1>
      <p className="mt-2 text-[16px] text-ink-2">Change the time of your visit or cancel it. You need the reference number from your visit pass and the mobile number you booked with.</p>
      <div className="mt-8">{verified ? <BookingManager bookingRef={verified.ref} phone={verified.phone} onSignOut={() => setVerified(null)} /> : <Lookup initialRef={params.get('ref') ?? ''} onFound={setVerified} />}</div>
    </div>
  )
}

function Lookup({ initialRef, onFound }: { initialRef: string; onFound: (v: { ref: string; phone: string }) => void }) {
  const [ref, setRef] = useState(initialRef.toUpperCase())
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ref.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Enter both your reference number and your 10-digit mobile number.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const b = await findMyBooking(ref, phone)
      onFound({ ref: b.ref, phone })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That booking could not be found.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-panel border border-line bg-white p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reference number" htmlFor="m-ref" hint="Starts with KP-, for example KP-7H3K9Q">
          <Input id="m-ref" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} autoCapitalize="characters" placeholder="KP-" invalid={!!error} />
        </Field>
        <Field label="Mobile number" htmlFor="m-phone">
          <Input id="m-phone" prefix="+91" type="tel" inputMode="numeric" value={phone} maxLength={11} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ''))} placeholder="98400 12345" invalid={!!error} />
        </Field>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-field bg-brick-50 px-3 py-2.5 text-sm font-medium text-brick-600">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" loading={loading} icon={<Search />}>
          Find my booking
        </Button>
        <p className="text-sm text-ink-3">
          Lost your reference? <Link to="/#faq" className="font-semibold text-paddy-600 hover:underline">Call the site office</Link>
        </p>
      </div>
    </form>
  )
}

function BookingManager({ bookingRef: ref, phone, onSignOut }: { bookingRef: string; phone: string; onSignOut: () => void }) {
  const db = useDb()
  const booking = getBookingByRef(ref)
  const [mode, setMode] = useState<'view' | 'reschedule'>('view')
  const [newSlot, setNewSlot] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [slotError, setSlotError] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const slots = useMemo(() => {
    const now = new Date()
    return slotViews(db).filter((s) => s.active && s.startsAt > now)
  }, [db])

  if (!booking) return null
  const slot = db.slots.find((s) => s.id === booking.slotId)
  const start = slot ? slotStart(slot) : null
  const editable = EDITABLE.includes(booking.status) && !!start && start > new Date()

  async function reschedule() {
    if (!newSlot) {
      setSlotError('Pick a new date and time.')
      return
    }
    setSaving(true)
    setSlotError('')
    try {
      await customerReschedule(ref, phone, newSlot)
      toast.success('Visit moved')
      setMode('view')
      setNewSlot(null)
    } catch (err) {
      setSlotError(err instanceof ApiError ? err.message : 'The visit could not be moved. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function cancel() {
    setCancelling(true)
    try {
      await customerCancel(ref, phone, reason.trim())
      toast.success('Visit cancelled')
      setCancelOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The visit could not be cancelled. Try again.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-5">
      <Panel
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-xl tabular">{booking.ref}</span>
            <StatusBadge status={booking.status} />
          </span>
        }
        actions={
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            Look up another booking
          </Button>
        }
      >
        <DetailList
          items={[
            { label: 'Date', value: start ? longDate(start) : 'Slot removed — call the site office' },
            { label: 'Time', value: slot ? slotRange(slot) : '—' },
            { label: 'Name', value: booking.customerName },
            { label: 'Visitors', value: booking.visitors },
            { label: 'Pickup', value: booking.pickup ? booking.pickupPoint : 'Not needed' },
          ]}
        />
        <div className="mt-5 flex flex-wrap gap-2">
          {editable && mode === 'view' && (
            <>
              <Button icon={<CalendarClock />} onClick={() => setMode('reschedule')}>
                Change date or time
              </Button>
              <Button variant="danger" icon={<XCircle />} onClick={() => setCancelOpen(true)}>
                Cancel visit
              </Button>
            </>
          )}
          <ButtonLink to={`/booking/${booking.ref}`} variant="secondary">
            <Ticket />
            View visit pass
          </ButtonLink>
        </div>
        {!editable && (
          <p className="mt-4 rounded-field bg-paper-2 px-3 py-2.5 text-sm text-ink-2">
            {booking.status === 'cancelled' || booking.status === 'no_show' ? (
              <>
                This visit can no longer be changed. <Link to="/book" className="font-semibold text-paddy-600 hover:underline">Book a new visit</Link> whenever it suits you.
              </>
            ) : booking.status === 'completed' ? (
              'This visit is complete, so there is nothing to change.'
            ) : (
              'This visit has already started, so it can no longer be changed online. Call the site office for help.'
            )}
          </p>
        )}
      </Panel>

      {mode === 'reschedule' && (
        <Panel title="Pick a new time" description="Your current slot is kept until you save the new one.">
          <SlotPicker slots={slots} value={newSlot} onChange={(id) => { setNewSlot(id); setSlotError('') }} excludeSlotId={booking.slotId} invalid={!!slotError} />
          {slotError && (
            <p role="alert" className="mt-2 text-[13px] font-medium text-brick-600">
              {slotError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={reschedule} loading={saving}>
              Move my visit
            </Button>
            <Button variant="ghost" onClick={() => { setMode('view'); setNewSlot(null); setSlotError('') }}>
              Keep current time
            </Button>
          </div>
        </Panel>
      )}

      <Panel title="History">
        <ol className="relative space-y-5 pl-6 before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-px before:bg-line">
          {[...booking.history].reverse().map((h, i) => (
            <li key={i} className="relative">
              <span className={cn('absolute top-1 -left-6 size-[11px] rounded-full border-2 border-white ring-1', i === 0 ? 'bg-paddy-600 ring-paddy-600' : 'bg-line ring-line')} />
              <p className="text-sm font-semibold text-ink">
                {h.status === 'pending' && h.by === 'customer' ? 'Booked' : STATUS_LABEL[h.status]}
                <span className="font-normal text-ink-3"> {ACTOR[h.by]}</span>
              </p>
              <p className="text-[13px] text-ink-3">{dateTime(h.at)}</p>
              {h.note && <p className="mt-0.5 text-[13px] text-ink-2">{h.note}</p>}
            </li>
          ))}
        </ol>
      </Panel>

      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancel}
        loading={cancelling}
        danger
        title="Cancel this visit?"
        confirmLabel="Cancel visit"
        body={
          <div className="space-y-3">
            <p>Your slot on {start ? longDate(start) : 'the booked day'} is released for other visitors. You can book again any time.</p>
            <Field label="Reason" optional htmlFor="c-reason">
              <Textarea id="c-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: travel plans changed" className="min-h-20" />
            </Field>
          </div>
        }
      />
    </div>
  )
}
