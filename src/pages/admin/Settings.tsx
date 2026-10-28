import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button, Field, IconButton, Input, PageHeader, Panel, Select, Textarea, Toggle } from '@/components/ui'
import { ApiError, updateSettings } from '@/data/api'
import { useDb } from '@/data/store'
import type { ProjectInfo, Settings as SettingsType } from '@/data/types'
import { inr, slotRange } from '@/lib/format'
import { TimeRows, WEEKDAYS, WeekdayChips } from './mgmtSlotModals'

const ATTRIBUTION_OPTIONS = [
  { value: 0, label: 'This booking only' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

function daysSummary(days: number[]) {
  if (days.length === 7) return 'Every day'
  if (days.length === 0) return 'No days'
  const closed = [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.includes(d)).map((d) => WEEKDAYS[d])
  return closed.length <= 2 ? `Every day except ${closed.join(' and ')}` : [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => WEEKDAYS[d]).join(', ')
}

export default function Settings() {
  const { settings } = useDb()
  const [draft, setDraft] = useState<SettingsType>(() => structuredClone(settings))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  // Pick up changes saved from another tab while nothing is being edited here.
  useEffect(() => {
    if (!dirty) setDraft(structuredClone(settings))
  }, [settings])

  const set = <K extends keyof SettingsType>(k: K, v: SettingsType[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setProject = <K extends keyof ProjectInfo>(k: K, v: ProjectInfo[K]) => setDraft((d) => ({ ...d, project: { ...d.project, [k]: v } }))

  function validate() {
    const e: Record<string, string> = {}
    if (draft.maxVisitors < 1 || draft.maxVisitors > 20) e.maxVisitors = 'Choose between 1 and 20.'
    if (draft.defaultCapacity < 1 || draft.defaultCapacity > 100) e.defaultCapacity = 'Choose between 1 and 100.'
    if (!draft.operatingDays.length) e.operatingDays = 'Pick at least one day.'
    if (!draft.slotTimes.length || draft.slotTimes.some((t) => !t.start || !t.end || t.end <= t.start)) e.slotTimes = 'Each time needs an end after its start.'
    if (draft.pickupPoints.some((p) => !p.trim())) e.pickupPoints = 'Fill in or remove empty pickup points.'
    if (!draft.project.name.trim()) e.name = 'Enter the project name.'
    if (!(draft.project.pricePerSqft > 0)) e.pricePerSqft = 'Enter a price above zero.'
    if (draft.project.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.project.email)) e.email = 'Enter a valid email address.'
    if (draft.project.whatsapp && !/^\d{10,13}$/.test(draft.project.whatsapp)) e.whatsapp = 'Digits only, with country code, like 919840012345.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function save() {
    if (!validate()) {
      toast.error('Fix the highlighted fields before saving.')
      return
    }
    setSaving(true)
    try {
      await updateSettings({
        ...draft,
        slotTimes: [...draft.slotTimes].sort((a, b) => a.start.localeCompare(b.start)),
        pickupPoints: draft.pickupPoints.map((p) => p.trim()),
      })
      toast.success('Settings saved')
      setErrors({})
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const attribution = ATTRIBUTION_OPTIONS.find((o) => o.value === draft.attributionDays)?.label ?? `${draft.attributionDays} days`
  const decisions: { q: string; a: ReactNode; href?: string }[] = [
    { q: 'Final domain and hosting', a: `Not decided. Prototype runs at ${window.location.host}` },
    { q: 'Do brokers need approval before their link works?', a: draft.requireBrokerApproval ? 'Yes, the site office approves each broker' : 'No, links work straight after sign-up', href: '#brokers' },
    { q: 'Broker profile fields and verification', a: 'Name, mobile and email required; agency and city optional. No OTP check yet' },
    { q: 'Visit days, times and capacity', a: `${daysSummary(draft.operatingDays)}, ${draft.slotTimes.length} times a day, ${draft.defaultCapacity} bookings per slot`, href: '#schedule' },
    { q: 'Are bookings confirmed automatically?', a: draft.autoConfirm ? 'Yes, instantly' : 'No, the site office confirms each one', href: '#booking' },
    { q: 'How long does a referral link keep credit?', a: draft.attributionDays === 0 ? 'Only for the booking made on that visit' : `${attribution} on the same phone or browser; first broker keeps the customer`, href: '#brokers' },
    { q: 'Is customer email required? Which notifications?', a: `${draft.emailRequired ? 'Email required' : 'Email optional'}. On-screen confirmation and one-tap WhatsApp messages; no paid SMS`, href: '#booking' },
    { q: 'Who marks a visit completed?', a: 'Site team at check-in using the reference or mobile number, or an admin' },
  ]

  return (
    <div className={dirty ? 'pb-20' : undefined}>
      <PageHeader title="Settings" description="Booking rules, the visit schedule and the project details shown on the public site." />

      <Panel title="Decisions to confirm" description="The open questions from the requirements, with how this prototype currently answers them. Change a setting below to try a different answer." className="mb-5" bodyClassName="p-0">
        <dl className="divide-y divide-line-soft">
          {decisions.map((d) => (
            <div key={d.q} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-center sm:gap-4 sm:px-5">
              <dt className="text-sm text-ink-3">{d.q}</dt>
              <dd className="text-sm font-semibold text-ink">{d.a}</dd>
              <dd className="sm:text-right">
                {d.href && (
                  <a href={d.href} className="text-[13px] font-semibold text-paddy-600 hover:underline">
                    Change
                  </a>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel id="booking" className="scroll-mt-20" title="Booking rules" description="What customers must give, and what happens after they book.">
          <div className="space-y-5">
            <Toggle
              checked={draft.autoConfirm}
              onChange={(v) => set('autoConfirm', v)}
              label="Confirm bookings automatically"
              description="On: customers get a confirmed visit straight away. Off: bookings wait as pending until the site office confirms them, which helps when visits need a call first."
            />
            <Toggle
              checked={draft.emailRequired}
              onChange={(v) => set('emailRequired', v)}
              label="Ask customers for an email address"
              description="Many visitors only share a mobile number. Making email required may lower bookings slightly."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Most visitors per booking" error={errors.maxVisitors} hint="Family members coming together.">
                <Input type="number" min={1} max={20} value={draft.maxVisitors} invalid={!!errors.maxVisitors} onChange={(e) => set('maxVisitors', Number(e.target.value))} />
              </Field>
              <Field label="Default bookings per slot" error={errors.defaultCapacity} hint="Used when you open new dates.">
                <Input type="number" min={1} max={100} value={draft.defaultCapacity} invalid={!!errors.defaultCapacity} onChange={(e) => set('defaultCapacity', Number(e.target.value))} />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel id="brokers" className="scroll-mt-20" title="Brokers and credit" description="Who can refer customers, and how long a link counts.">
          <div className="space-y-5">
            <Toggle
              checked={draft.requireBrokerApproval}
              onChange={(v) => set('requireBrokerApproval', v)}
              label="Approve new brokers before their link works"
              description="On: new sign-ups wait for the site office, so unknown agents cannot claim customers. Off: links work as soon as a broker signs up."
            />
            <Field
              label="Referral link keeps credit for"
              hint="If a customer opens a broker's link and books later on the same phone, the broker still gets credit within this window. Either way, a customer who already came through one broker stays with that broker."
            >
              <Select value={draft.attributionDays} onChange={(e) => set('attributionDays', Number(e.target.value))}>
                {ATTRIBUTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>

        <Panel id="schedule" className="scroll-mt-20" title="Visit schedule" description="Defaults used when you open new dates. Slots already created are not changed.">
          <div className="space-y-5">
            <Field label="Open on" error={errors.operatingDays} hint={daysSummary(draft.operatingDays)}>
              <WeekdayChips value={draft.operatingDays} onChange={(v) => set('operatingDays', v)} />
            </Field>
            <Field label="Visit times" error={errors.slotTimes} hint={draft.slotTimes.filter((t) => t.end > t.start).map(slotRange).join(', ')}>
              <TimeRows value={draft.slotTimes} onChange={(v) => set('slotTimes', v)} />
            </Field>
          </div>
        </Panel>

        <Panel title="Pickup points" description="Places customers can ask to be picked up from for their visit.">
          <div className="space-y-2">
            {draft.pickupPoints.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={p} aria-label={`Pickup point ${i + 1}`} className="h-10" invalid={!!errors.pickupPoints && !p.trim()} onChange={(e) => set('pickupPoints', draft.pickupPoints.map((x, j) => (j === i ? e.target.value : x)))} />
                <IconButton label="Remove pickup point" onClick={() => set('pickupPoints', draft.pickupPoints.filter((_, j) => j !== i))}>
                  <Trash2 />
                </IconButton>
              </div>
            ))}
            {draft.pickupPoints.length === 0 && <p className="text-sm text-ink-3">No pickup points. Customers will not be offered pickup.</p>}
            {errors.pickupPoints && <p className="text-[13px] font-medium text-brick-600">{errors.pickupPoints}</p>}
            <Button variant="ghost" size="sm" icon={<Plus />} onClick={() => set('pickupPoints', [...draft.pickupPoints, ''])}>
              Add pickup point
            </Button>
          </div>
        </Panel>
      </div>

      <Panel title="Project information" description="Shown on the public site, booking confirmations and WhatsApp messages. Replace the sample text with approved details." className="mt-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Project name" error={errors.name}>
            <Input value={draft.project.name} invalid={!!errors.name} onChange={(e) => setProject('name', e.target.value)} />
          </Field>
          <Field label="Location">
            <Input value={draft.project.location} onChange={(e) => setProject('location', e.target.value)} />
          </Field>
          <Field label="Tagline" className="md:col-span-2">
            <Input value={draft.project.tagline} onChange={(e) => setProject('tagline', e.target.value)} />
          </Field>
          <Field label="Site address" className="md:col-span-2">
            <Textarea value={draft.project.address} onChange={(e) => setProject('address', e.target.value)} className="min-h-20" />
          </Field>
          <Field label="Office phone">
            <Input type="tel" value={draft.project.phone} onChange={(e) => setProject('phone', e.target.value)} />
          </Field>
          <Field label="WhatsApp number" error={errors.whatsapp} hint="With country code, digits only.">
            <Input inputMode="numeric" value={draft.project.whatsapp} invalid={!!errors.whatsapp} onChange={(e) => setProject('whatsapp', e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={draft.project.email} invalid={!!errors.email} onChange={(e) => setProject('email', e.target.value)} />
          </Field>
          <Field label="Price per sq ft" error={errors.pricePerSqft} hint={draft.project.pricePerSqft > 0 ? `A 1,500 sq ft plot shows as ${inr(draft.project.pricePerSqft * 1500)}` : undefined}>
            <Input type="number" min={0} value={draft.project.pricePerSqft} invalid={!!errors.pricePerSqft} prefix="₹" onChange={(e) => setProject('pricePerSqft', Number(e.target.value))} />
          </Field>
          <Field label="Approval details">
            <Input value={draft.project.approval} onChange={(e) => setProject('approval', e.target.value)} />
          </Field>
          <Field label="Google Maps link" hint="Used for the Get directions button.">
            <Input type="url" value={draft.project.mapsUrl} onChange={(e) => setProject('mapsUrl', e.target.value)} />
          </Field>
        </div>
      </Panel>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur-md animate-pop lg:left-64">
          <div className="mx-auto flex max-w-[1280px] items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="mr-auto hidden pl-24 text-sm font-medium text-ink-2 sm:block">You have unsaved changes.</p>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(structuredClone(settings))
                setErrors({})
              }}
            >
              Discard
            </Button>
            <Button onClick={save} loading={saving}>
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
