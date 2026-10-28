import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Field, Input } from '@/components/ui'
import { signInBroker } from '@/data/api'
import { DEMO_BROKER_PASSWORD } from '@/data/seed'
import { useDb, useSession } from '@/data/store'
import { AuthShell, BROKER_POINTS, DemoHint, safeNext } from './AuthShell'

export default function BrokerSignIn() {
  const session = useSession()
  const db = useDb()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'), '/broker')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const signedIn = session?.role === 'broker' && db.brokers.some((b) => b.id === session.id && b.status !== 'disabled')
  if (signedIn) return <Navigate to={next.startsWith('/broker') ? next : '/broker'} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!login.trim() || !password) {
      setError('Enter your mobile number or email, and your password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const b = await signInBroker(login, password)
      toast.success(`Signed in as ${b.name}`)
      navigate(next.startsWith('/broker') ? next : '/broker', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      statement="Share one link. See every visit your customers book."
      points={BROKER_POINTS}
      title="Broker sign-in"
      description="Sign in to see your bookings and share your link."
      footer={
        <>
          New here?{' '}
          <Link to="/broker/sign-up" className="font-semibold text-paddy-600 hover:underline">
            Create a broker account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Mobile number or email" htmlFor="bs-login">
          <Input id="bs-login" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} invalid={!!error} placeholder="98400 12345 or you@example.com" />
        </Field>
        <Field label="Password" htmlFor="bs-password">
          <Input id="bs-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!error} />
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
        Demo account: <strong className="font-semibold">senthil@broker.demo</strong> with password <strong className="font-semibold">{DEMO_BROKER_PASSWORD}</strong>.{' '}
        <button
          type="button"
          className="font-semibold text-paddy-600 hover:underline"
          onClick={() => {
            setLogin('senthil@broker.demo')
            setPassword(DEMO_BROKER_PASSWORD)
            setError('')
          }}
        >
          Fill in
        </button>
      </DemoHint>
    </AuthShell>
  )
}
