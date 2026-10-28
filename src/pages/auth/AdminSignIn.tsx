import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Field, Input } from '@/components/ui'
import { signInAdmin } from '@/data/api'
import { DEMO_ADMIN } from '@/data/seed'
import { useSession } from '@/data/store'
import { AuthShell, DemoHint, safeNext } from './AuthShell'

export default function AdminSignIn() {
  const session = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'), '/admin')
  const target = next.startsWith('/admin') ? next : '/admin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (session?.role === 'admin') return <Navigate to={target} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signInAdmin(email, password)
      toast.success('Signed in to the site office')
      navigate(target, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      statement="Every booking, broker and slot in one place."
      points={['Confirm, reschedule and close out visits', 'Check customers in at the site with their pass', 'See which brokers bring visitors who show up']}
      title="Site office sign-in"
      description="For the project team that manages visits and brokers."
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Email" htmlFor="as-email">
          <Input id="as-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!error} />
        </Field>
        <Field label="Password" htmlFor="as-password">
          <Input id="as-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!error} />
        </Field>
        {error && (
          <p role="alert" className="rounded-field bg-brick-50 px-3 py-2.5 text-sm font-medium text-brick-600">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
      <DemoHint>
        Demo account: <strong className="font-semibold">{DEMO_ADMIN.email}</strong> with password <strong className="font-semibold">{DEMO_ADMIN.password}</strong>.{' '}
        <button
          type="button"
          className="font-semibold text-paddy-600 hover:underline"
          onClick={() => {
            setEmail(DEMO_ADMIN.email)
            setPassword(DEMO_ADMIN.password)
            setError('')
          }}
        >
          Fill in
        </button>
      </DemoHint>
    </AuthShell>
  )
}
