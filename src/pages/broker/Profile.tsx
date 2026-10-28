import { LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, Button, BrokerStatusBadge, DetailList, Field, Input, PageHeader, Panel } from '@/components/ui'
import { ApiError, changeMyPassword, signOut, updateMyProfile } from '@/data/api'
import { phoneDisplay, shortDate } from '@/lib/format'
import { useBroker } from './useBroker'

export default function BrokerProfile() {
  const broker = useBroker()
  const navigate = useNavigate()

  return (
    <>
      <PageHeader title="Profile" description="Keep your details current so the site office can reach you about your customers." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <ProfileForm key={broker.updatedAt} />
          <PasswordForm />
        </div>
        <div className="space-y-5">
          <Panel>
            <div className="flex items-center gap-3">
              <Avatar name={broker.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold">{broker.name}</p>
                <p className="truncate text-sm text-ink-3">{broker.agency}</p>
              </div>
            </div>
            <div className="mt-4">
              <DetailList
                items={[
                  { label: 'Status', value: <BrokerStatusBadge status={broker.status} /> },
                  { label: 'Referral code', value: <span className="tabular">{broker.referralCode}</span> },
                  { label: 'Member since', value: shortDate(broker.createdAt) },
                ]}
              />
            </div>
          </Panel>
          <Button
            variant="secondary"
            className="w-full"
            icon={<LogOut />}
            onClick={() => {
              signOut()
              navigate('/')
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </>
  )
}

function ProfileForm() {
  const broker = useBroker()
  const [form, setForm] = useState({ name: broker.name, email: broker.email, agency: broker.agency, city: broker.city })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const dirty = form.name !== broker.name || form.email !== broker.email || form.agency !== broker.agency || form.city !== broker.city
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setSaving(true)
    try {
      await updateMyProfile(form)
      toast.success('Profile saved')
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message })
      else toast.error(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Your details">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Full name" htmlFor="p-name" error={errors.name}>
          <Input id="p-name" value={form.name} onChange={set('name')} invalid={!!errors.name} autoComplete="name" />
        </Field>
        <Field label="Mobile number" htmlFor="p-phone" hint="Contact the site office to change your mobile number.">
          <Input id="p-phone" value={phoneDisplay(broker.phone)} disabled prefix="+91" />
        </Field>
        <Field label="Email" htmlFor="p-email" error={errors.email}>
          <Input id="p-email" type="email" value={form.email} onChange={set('email')} invalid={!!errors.email} autoComplete="email" />
        </Field>
        <Field label="Agency" htmlFor="p-agency" optional>
          <Input id="p-agency" value={form.agency} onChange={set('agency')} placeholder="Independent" />
        </Field>
        <Field label="City or area" htmlFor="p-city" optional>
          <Input id="p-city" value={form.city} onChange={set('city')} autoComplete="address-level2" />
        </Field>
        <div className="flex items-end justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => setForm({ name: broker.name, email: broker.email, agency: broker.agency, city: broker.city })}>
            Discard changes
          </Button>
          <Button type="submit" loading={saving} disabled={!dirty}>
            Save profile
          </Button>
        </div>
      </form>
    </Panel>
  )
}

function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setSaving(true)
    try {
      await changeMyPassword(current, next)
      setCurrent('')
      setNext('')
      toast.success('Password changed')
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message })
      else toast.error(err instanceof Error ? err.message : 'Could not change your password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Password">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Current password" htmlFor="pw-current" error={errors.current}>
          <Input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} invalid={!!errors.current} autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor="pw-next" error={errors.next} hint="At least 6 characters.">
          <Input id="pw-next" type="password" value={next} onChange={(e) => setNext(e.target.value)} invalid={!!errors.next} autoComplete="new-password" />
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" variant="secondary" loading={saving} disabled={!current || !next}>
            Change password
          </Button>
        </div>
      </form>
    </Panel>
  )
}
