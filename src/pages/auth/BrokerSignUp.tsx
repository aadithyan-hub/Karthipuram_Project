import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Field, Input } from '@/components/ui'
import { ApiError, signUpBroker, type SignUpInput } from '@/data/api'
import { useDb, useSession } from '@/data/store'
import { AuthShell, BROKER_POINTS } from './AuthShell'

type Errors = Partial<Record<keyof SignUpInput, string>>

export default function BrokerSignUp() {
  const session = useSession()
  const db = useDb()
  const navigate = useNavigate()
  const [form, setForm] = useState<SignUpInput>({ name: '', phone: '', email: '', agency: '', city: '', password: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)

  if (session?.role === 'broker' && db.brokers.some((b) => b.id === session.id && b.status !== 'disabled')) return <Navigate to="/broker" replace />

  const set = (key: keyof SignUpInput, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): Errors {
    const e: Errors = {}
    if (form.name.trim().length < 3) e.name = 'Enter your full name.'
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))) e.phone = 'Enter a 10-digit Indian mobile number.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'Enter a valid email address.'
    if (!form.city.trim()) e.city = 'Enter the town or city you work in.'
    if (form.password.length < 6) e.password = 'Use at least 6 characters for the password.'
    return e
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    const first = (Object.keys(e) as (keyof SignUpInput)[])[0]
    if (first) {
      document.getElementById(`su-${first}`)?.focus()
      return
    }
    setLoading(true)
    try {
      const b = await signUpBroker(form)
      toast.success(b.status === 'pending' ? 'Account created. The site office will approve it soon.' : 'Account created. Your link is ready to share.')
      navigate('/broker', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        setErrors({ [err.field]: err.message })
        document.getElementById(`su-${err.field}`)?.focus()
      } else toast.error(err instanceof Error ? err.message : 'The account could not be created. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      statement="Bring buyers to the site. Get credit for every visit."
      points={BROKER_POINTS}
      title="Become a referral partner"
      description={
        db.settings.requireBrokerApproval
          ? 'Create your account and get your booking link. The site office approves new partners before the link starts giving you credit.'
          : 'Create your account and get your booking link straight away.'
      }
      footer={
        <>
          Already have an account?{' '}
          <Link to="/broker/sign-in" className="font-semibold text-paddy-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Full name" htmlFor="su-name" error={errors.name}>
          <Input id="su-name" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label="Mobile number" htmlFor="su-phone" error={errors.phone} hint="You can sign in with this number.">
          <Input id="su-phone" prefix="+91" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11} value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/[^\d ]/g, ''))} invalid={!!errors.phone} placeholder="98400 12345" />
        </Field>
        <Field label="Email" htmlFor="su-email" error={errors.email}>
          <Input id="su-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} invalid={!!errors.email} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Agency" htmlFor="su-agency" optional error={errors.agency}>
            <Input id="su-agency" autoComplete="organization" value={form.agency} onChange={(e) => set('agency', e.target.value)} placeholder="Independent" />
          </Field>
          <Field label="Town or city" htmlFor="su-city" error={errors.city}>
            <Input id="su-city" autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} invalid={!!errors.city} />
          </Field>
        </div>
        <Field label="Password" htmlFor="su-password" error={errors.password} hint="At least 6 characters.">
          <Input id="su-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} invalid={!!errors.password} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>
        <p className="text-xs leading-relaxed text-ink-3">Commission terms are agreed with the site office separately. This account tracks the visits your link brings in.</p>
      </form>
    </AuthShell>
  )
}
