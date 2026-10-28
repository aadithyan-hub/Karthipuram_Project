import { CalendarDays, Info, LandPlot, Minus, Plus, UserCheck, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PlanLegend, SitePlan } from '@/components/SitePlan'
import { SlotPicker } from '@/components/SlotPicker'
import { Button, cn, Field, Input, Modal, Select, Textarea, Toggle } from '@/components/ui'
import { ApiError, createBooking, recordReferralVisit, resolveReferral, storedReferral } from '@/data/api'
import { slotViews } from '@/data/queries'
import { useDb } from '@/data/store'
import { longDate, slotRange } from '@/lib/format'

type FormState = {
  customerName: string
  phone: string
  email: string
  slotId: string | null
  visitors: number
  pickup: boolean
  pickupPoint: string
  plots: string[]
  notes: string
}

type Errors = Partial<Record<keyof FormState, string>>

const MAX_PLOTS = 4

export default function Book() {
  const db = useDb()
  const settings = db.settings
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const urlRef = params.get('ref')
  const urlSrc = params.get('src')
  const plotParam = params.get('plot')

  // The referral this booking will carry: the link in the URL first, else one remembered on this device.
  const [attribution] = useState(() => (urlRef ? { code: urlRef.toUpperCase(), source: urlSrc } : storedReferral()))
  const recorded = useRef(false)
  useEffect(() => {
    if (urlRef && !recorded.current) {
      recorded.current = true
      recordReferralVisit(urlRef, urlSrc)
    }
  }, [urlRef, urlSrc])
  const referrer = resolveReferral(attribution?.code)
  const inactiveLink = !!urlRef && !referrer

  const [form, setForm] = useState<FormState>(() => {
    const plot = db.plots.find((p) => p.id === plotParam && p.status !== 'sold')
    return { customerName: '', phone: '', email: '', slotId: null, visitors: 2, pickup: false, pickupPoint: '', plots: plot ? [plot.id] : [], notes: '' }
  })
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const slots = useMemo(() => {
    const now = new Date()
    return slotViews(db).filter((s) => s.active && s.startsAt > now)
  }, [db])
  const selectedSlot = slots.find((s) => s.id === form.slotId)

  // If the chosen slot fills up in another tab, tell the customer before they submit.
  useEffect(() => {
    if (form.slotId && selectedSlot && selectedSlot.remaining <= 0) {
      setErrors((e) => ({ ...e, slotId: 'That slot just filled up. Pick another time.' }))
    }
  }, [form.slotId, selectedSlot])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): Errors {
    const e: Errors = {}
    const phone = form.phone.replace(/\D/g, '')
    if (form.customerName.trim().length < 3) e.customerName = 'Enter your full name.'
    if (!/^[6-9]\d{9}$/.test(phone)) e.phone = 'Enter a 10-digit mobile number, like 98400 12345.'
    if (settings.emailRequired && !form.email.trim()) e.email = 'Enter your email address.'
    else if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'Enter a valid email address, or leave it blank.'
    if (!form.slotId) e.slotId = 'Pick a date and time for your visit.'
    else if (selectedSlot && selectedSlot.remaining <= 0) e.slotId = 'That slot just filled up. Pick another time.'
    if (form.pickup && !form.pickupPoint) e.pickupPoint = 'Choose a pickup point.'
    return e
  }

  function focusFirstError(e: Errors) {
    const first = (['slotId', 'customerName', 'phone', 'email', 'pickupPoint'] as const).find((k) => e[k])
    if (!first) return
    if (first === 'slotId') pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    else document.getElementById(`f-${first}`)?.focus()
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.values(e).some(Boolean)) {
      focusFirstError(e)
      return
    }
    setSubmitting(true)
    try {
      const booking = await createBooking({
        customerName: form.customerName,
        phone: form.phone,
        email: form.email,
        slotId: form.slotId!,
        visitors: form.visitors,
        notes: form.notes,
        pickup: form.pickup,
        pickupPoint: form.pickupPoint,
        plotsOfInterest: form.plots,
        refCode: referrer?.code ?? null,
        source: attribution?.source ?? null,
      })
      toast.success(`Visit booked. Your reference is ${booking.ref}`)
      navigate(`/booking/${booking.ref}`, { replace: true, state: { justBooked: true } })
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        const next = { [err.field]: err.message } as Errors
        setErrors(next)
        focusFirstError(next)
        toast.error(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : 'The booking could not be saved. Try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const togglePlot = (id: string) => {
    setForm((f) => {
      if (f.plots.includes(id)) return { ...f, plots: f.plots.filter((p) => p !== id) }
      if (f.plots.length >= MAX_PLOTS) {
        toast.message(`You can mark up to ${MAX_PLOTS} plots.`)
        return f
      }
      return { ...f, plots: [...f.plots, id] }
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 lg:pt-12">
      <header className="max-w-2xl">
        <h1 className="text-[32px] leading-tight font-bold sm:text-[40px]">Book a site visit</h1>
        <p className="mt-2 text-[16px] text-ink-2">Free, about an hour on site, and no account needed. You get a reference number as soon as you book.</p>
      </header>

      {referrer && (
        <div className="mt-6 flex items-center gap-3 rounded-panel border border-paddy-200 bg-paddy-50 px-4 py-3 text-sm text-paddy-800">
          <UserCheck className="size-5 shrink-0" />
          <p>
            Referred by <strong className="font-semibold">{referrer.name}</strong>, {referrer.agency}. They will be told about your visit.
          </p>
        </div>
      )}
      {inactiveLink && (
        <div className="mt-6 flex items-center gap-3 rounded-panel border border-line bg-white px-4 py-3 text-sm text-ink-2">
          <Info className="size-5 shrink-0 text-ink-3" />
          <p>The referral link you used is not active any more. You can still book your visit below.</p>
        </div>
      )}

      <form noValidate onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="min-w-0 space-y-10">
          <FormSection title="When would you like to visit?" description="Dots show availability: green has room, yellow is filling up, red is full.">
            <div ref={pickerRef} className="scroll-mt-24">
              <SlotPicker slots={slots} value={form.slotId} onChange={(id) => set('slotId', id)} invalid={!!errors.slotId} />
              {errors.slotId && (
                <p role="alert" className="mt-2 text-[13px] font-medium text-brick-600">
                  {errors.slotId}
                </p>
              )}
            </div>
          </FormSection>

          <FormSection title="Your details" description="The site office uses these only to confirm and manage your visit.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="f-customerName" error={errors.customerName} className="sm:col-span-2">
                <Input id="f-customerName" autoComplete="name" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} invalid={!!errors.customerName} placeholder="As you'd like us to call you" />
              </Field>
              <Field label="Mobile number" htmlFor="f-phone" error={errors.phone} hint="We call or WhatsApp this number to confirm.">
                <Input
                  id="f-phone"
                  prefix="+91"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={11}
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value.replace(/[^\d ]/g, ''))}
                  invalid={!!errors.phone}
                  placeholder="98400 12345"
                />
              </Field>
              <Field label="Email" htmlFor="f-email" error={errors.email} optional={!settings.emailRequired}>
                <Input id="f-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} invalid={!!errors.email} placeholder="you@example.com" />
              </Field>
            </div>
          </FormSection>

          <FormSection title="About your visit">
            <div className="space-y-6">
              <Field label="How many people are coming?">
                <Stepper value={form.visitors} min={1} max={settings.maxVisitors} onChange={(v) => set('visitors', v)} />
              </Field>

              <div className="rounded-panel border border-line bg-white p-4">
                <Toggle checked={form.pickup} onChange={(v) => set('pickup', v)} label="I need free pickup" description="Our vehicle meets you at a pickup point and drops you back after the visit." />
                {form.pickup && (
                  <Field label="Pickup point" htmlFor="f-pickupPoint" error={errors.pickupPoint} className="mt-4">
                    <Select id="f-pickupPoint" value={form.pickupPoint} onChange={(e) => set('pickupPoint', e.target.value)} invalid={!!errors.pickupPoint}>
                      <option value="">Choose the nearest point</option>
                      {settings.pickupPoints.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>

              <Field label="Plots you'd like to see" optional hint={`Mark up to ${MAX_PLOTS} plots and the site team will start there.`}>
                <div className="flex flex-wrap items-center gap-2">
                  {form.plots.map((id) => (
                    <span key={id} className="inline-flex h-8 items-center gap-1 rounded-full bg-paddy-50 pr-1 pl-3 text-[13px] font-semibold text-paddy-800 ring-1 ring-paddy-200 ring-inset">
                      Plot {id}
                      <button type="button" aria-label={`Remove plot ${id}`} onClick={() => togglePlot(id)} className="grid size-6 place-items-center rounded-full hover:bg-paddy-100">
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                  <Button variant="secondary" size="sm" icon={<LandPlot />} onClick={() => setPlanOpen(true)}>
                    {form.plots.length ? 'Change plots' : 'Choose on the site plan'}
                  </Button>
                </div>
              </Field>

              <Field label="Anything we should know?" htmlFor="f-notes" optional>
                <Textarea id="f-notes" value={form.notes} maxLength={500} onChange={(e) => set('notes', e.target.value)} placeholder="For example: coming with parents, interested in loan options, prefer east-facing plots" />
              </Field>
            </div>
          </FormSection>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-panel border border-line bg-white">
            <div className="border-b border-line-soft px-5 py-4">
              <h2 className="text-[17px] font-semibold">Your visit</h2>
            </div>
            <dl className="space-y-3 px-5 py-4 text-sm">
              <SummaryRow label="When">
                {selectedSlot ? (
                  <>
                    {longDate(selectedSlot.startsAt)}
                    <span className="block text-ink-3">{slotRange(selectedSlot)}</span>
                  </>
                ) : (
                  <span className="text-ink-3">Pick a slot</span>
                )}
              </SummaryRow>
              <SummaryRow label="Visitors">{form.visitors}</SummaryRow>
              <SummaryRow label="Pickup">{form.pickup ? form.pickupPoint || 'Choose a point' : 'Not needed'}</SummaryRow>
              {form.plots.length > 0 && <SummaryRow label="Plots">{form.plots.join(', ')}</SummaryRow>}
              {referrer && <SummaryRow label="Referred by">{referrer.name}</SummaryRow>}
            </dl>
            <div className="border-t border-line-soft px-5 py-4">
              <Button type="submit" size="lg" className="w-full" loading={submitting} icon={<CalendarDays />}>
                Confirm booking
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-ink-3">
                {settings.autoConfirm ? 'Your visit is confirmed as soon as you book.' : 'The site office confirms your visit by phone, usually within a few hours.'} You can change or cancel it any time.
              </p>
            </div>
          </div>
        </aside>
      </form>

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        size="lg"
        title="Choose plots to see"
        description="Tap available plots to mark them. Tap again to remove."
        footer={
          <Button onClick={() => setPlanOpen(false)}>
            {form.plots.length ? `Done, ${form.plots.length} marked` : 'Done'}
          </Button>
        }
      >
        <div className="overflow-x-auto rounded-panel border border-line bg-white p-2 scrollbar-thin">
          <div className="min-w-[620px]">
            <SitePlan plots={db.plots} selected={form.plots} onPlotClick={(p) => togglePlot(p.id)} interactiveStatuses={['available', 'reserved']} />
          </div>
        </div>
        <PlanLegend className="mt-3" />
      </Modal>
    </div>
  )
}

function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 font-medium text-ink">{children}</dd>
    </div>
  )
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const btn = 'grid size-11 place-items-center text-ink-2 transition-colors hover:bg-paper-2 disabled:text-ink-3/40 disabled:hover:bg-transparent'
  return (
    <div className="inline-flex items-center overflow-hidden rounded-field border border-line bg-white">
      <button type="button" className={btn} aria-label="Fewer people" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-4" />
      </button>
      <output aria-live="polite" className={cn('w-14 text-center font-display text-lg font-semibold tabular')}>
        {value}
      </output>
      <button type="button" className={btn} aria-label="More people" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}
