import { addDays, differenceInCalendarDays, eachDayOfInterval, format, getDay } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, ConfirmModal, Field, IconButton, Input, Modal, Toggle, cn } from '@/components/ui'
import { ApiError, createSlotsInRange, deleteSlot, upsertSlot } from '@/data/api'
import type { SlotView } from '@/data/queries'
import { useDb } from '@/data/store'
import { longDate, slotRange } from '@/lib/format'

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function WeekdayChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  // Monday-first order reads naturally for an operating week.
  const order = [1, 2, 3, 4, 5, 6, 0]
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
      {order.map((d) => {
        const on = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            className={cn('h-9 w-12 rounded-field border text-sm font-semibold transition-colors', on ? 'border-paddy-600 bg-paddy-50 text-paddy-700' : 'border-line bg-white text-ink-3 hover:border-ink-3/50')}
          >
            {WEEKDAYS[d]}
          </button>
        )
      })}
    </div>
  )
}

export function TimeRows({ value, onChange }: { value: { start: string; end: string }[]; onChange: (v: { start: string; end: string }[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input type="time" value={t.start} aria-label={`Slot ${i + 1} start`} className="h-10" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
          <span className="text-sm text-ink-3">to</span>
          <Input type="time" value={t.end} aria-label={`Slot ${i + 1} end`} className="h-10" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
          <IconButton label="Remove this time" onClick={() => onChange(value.filter((_, j) => j !== i))} disabled={value.length === 1} className="shrink-0 disabled:opacity-30">
            <Trash2 />
          </IconButton>
        </div>
      ))}
      <Button variant="ghost" size="sm" icon={<Plus />} onClick={() => onChange([...value, { start: '17:30', end: '18:30' }])}>
        Add a time
      </Button>
    </div>
  )
}

type SlotDraft = { id?: string; date: string; start: string; end: string; capacity: number; active: boolean }

export function SlotModal({ slot, defaults, onClose }: { slot: SlotView | null; defaults?: Partial<SlotDraft>; onClose: () => void }) {
  const db = useDb()
  const { settings } = db
  const [draft, setDraft] = useState<SlotDraft>(() =>
    slot
      ? { id: slot.id, date: slot.date, start: slot.start, end: slot.end, capacity: slot.capacity, active: slot.active }
      : { date: format(addDays(new Date(), 1), 'yyyy-MM-dd'), start: settings.slotTimes[0]?.start ?? '10:00', end: settings.slotTimes[0]?.end ?? '11:00', capacity: settings.defaultCapacity, active: true, ...defaults },
  )
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const past = slot ? slot.startsAt <= new Date() : false
  const hasBookings = slot ? db.bookings.some((b) => b.slotId === slot.id) : false
  const set = <K extends keyof SlotDraft>(k: K, v: SlotDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await upsertSlot(draft)
      toast.success(slot ? 'Slot updated' : 'Slot added')
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? { field: e.field, message: e.message } : { message: 'Something went wrong. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!slot) return
    try {
      await deleteSlot(slot.id)
      toast.success('Slot deleted')
      onClose()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
      setConfirmDelete(false)
    }
  }

  const fieldError = (f: string) => (error?.field === f ? error.message : undefined)

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={slot ? (past ? 'Past slot' : 'Edit slot') : 'Add a slot'}
        description={slot ? `${longDate(slot.startsAt)}, ${slotRange(slot)}` : 'Open one extra visit time. Use bulk opening for whole weeks.'}
        footer={
          past ? (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          ) : (
            <>
              {slot && !hasBookings && (
                <Button variant="danger" className="mr-auto" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving}>
                {slot ? 'Save slot' : 'Add slot'}
              </Button>
            </>
          )
        }
      >
        {slot && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-field bg-paper px-3 py-2.5 text-sm">
            <span>
              <span className="font-semibold tabular">{slot.booked}</span> of <span className="tabular">{slot.capacity}</span> places booked
            </span>
            {slot.booked > 0 && (
              <Link to={`/admin/bookings?slot=${slot.id}`} className="font-semibold text-paddy-600 hover:underline">
                View bookings
              </Link>
            )}
          </div>
        )}
        {past ? (
          <p className="text-sm text-ink-3">This slot has already started, so it can no longer be changed. Its bookings stay on record.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" error={fieldError('date')} className="sm:col-span-2">
              <Input type="date" value={draft.date} min={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="Starts" error={fieldError('start')}>
              <Input type="time" value={draft.start} invalid={!!fieldError('start')} onChange={(e) => set('start', e.target.value)} />
            </Field>
            <Field label="Ends" error={fieldError('end')}>
              <Input type="time" value={draft.end} invalid={!!fieldError('end')} onChange={(e) => set('end', e.target.value)} />
            </Field>
            <Field label="Capacity" hint="Maximum bookings for this slot." error={fieldError('capacity')} className="sm:col-span-2">
              <Input type="number" min={1} max={100} value={draft.capacity} invalid={!!fieldError('capacity')} onChange={(e) => set('capacity', Number(e.target.value))} />
            </Field>
            <div className="sm:col-span-2">
              <Toggle checked={draft.active} onChange={(v) => set('active', v)} label="Open for booking" description="Turned-off slots are hidden from customers. Existing bookings are kept." />
            </div>
            {error && !error.field && <p className="text-sm font-medium text-brick-600 sm:col-span-2">{error.message}</p>}
          </div>
        )}
      </Modal>
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this slot?"
        body="Nobody has booked it, so it is removed completely. Customers will not see it."
        confirmLabel="Delete slot"
        danger
        onConfirm={remove}
      />
    </>
  )
}

export function BulkSlotsModal({ onClose, defaultFrom }: { onClose: () => void; defaultFrom?: Date }) {
  const { settings } = useDb()
  const start = defaultFrom && defaultFrom > new Date() ? defaultFrom : addDays(new Date(), 1)
  const [from, setFrom] = useState(format(start, 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(addDays(start, 13), 'yyyy-MM-dd'))
  const [days, setDays] = useState<number[]>(settings.operatingDays)
  const [times, setTimes] = useState(settings.slotTimes)
  const [capacity, setCapacity] = useState(settings.defaultCapacity)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fromDate = new Date(`${from}T00:00:00`)
  const toDate = new Date(`${to}T00:00:00`)
  const span = from && to ? differenceInCalendarDays(toDate, fromDate) : -1
  const dates = span >= 0 && span <= 120 ? eachDayOfInterval({ start: fromDate, end: toDate }).filter((d) => days.includes(getDay(d))).map((d) => format(d, 'yyyy-MM-dd')) : []
  const validTimes = times.every((t) => t.start && t.end && t.end > t.start)

  async function save() {
    setError('')
    if (span < 0) return setError('The end date must be on or after the start date.')
    if (span > 120) return setError('Open at most 120 days at a time.')
    if (!dates.length) return setError('Pick at least one weekday that falls inside these dates.')
    if (!validTimes) return setError('Each time needs an end after its start.')
    if (capacity < 1) return setError('Capacity must be at least 1.')
    setSaving(true)
    try {
      const { created, skipped } = await createSlotsInRange(dates, times, capacity)
      toast.success(`${created} slots added${skipped ? `, ${skipped} skipped (already existed)` : ''}`)
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Open dates in bulk"
      description="Create the same visit times across a range of dates. Times that already exist on a day are skipped."
      size="lg"
      footer={
        <>
          <span className="mr-auto self-center text-[13px] text-ink-3 tabular">
            {dates.length * times.length} slots on {dates.length} days
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Open dates
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input type="date" value={from} min={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Field label="On these days">
            <WeekdayChips value={days} onChange={setDays} />
          </Field>
          <Field label="Capacity per slot" hint="Maximum bookings in each slot.">
            <Input type="number" min={1} max={100} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Visit times">
          <TimeRows value={times} onChange={setTimes} />
        </Field>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-brick-600">
          {error}
        </p>
      )}
    </Modal>
  )
}
