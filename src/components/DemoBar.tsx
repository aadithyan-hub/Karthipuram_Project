import { ExternalLink, FlaskConical, KeyRound, RotateCcw, ShieldCheck, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { clearStoredReferral } from '@/data/api'
import { DEMO_ADMIN, DEMO_BROKER_PASSWORD } from '@/data/seed'
import { resetDb, setSession, useDb } from '@/data/store'
import { bookingLink } from '@/lib/format'
import { Button, cn, ConfirmModal } from './ui'

/**
 * Presenter controls for client demos: jump between roles, open a broker's
 * referral link in a new tab, and restore the sample data.
 */
export function DemoBar() {
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const db = useDb()
  const demoBroker = db.brokers.find((b) => b.email === 'senthil@broker.demo') ?? db.brokers[0]
  const inApp = location.pathname.startsWith('/broker') && !location.pathname.includes('sign-')

  const go = (path: string, session?: Parameters<typeof setSession>[0]) => {
    if (session !== undefined) setSession(session)
    setOpen(false)
    navigate(path)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'fixed left-4 z-40 inline-flex h-10 items-center gap-2 rounded-full border border-ink/10 bg-ink px-4 text-[13px] font-semibold text-paper shadow-lg shadow-ink/20 transition-transform hover:-translate-y-0.5 print:hidden',
          inApp ? 'bottom-20 lg:bottom-4' : 'bottom-4',
        )}
      >
        {open ? <X className="size-4" /> : <FlaskConical className="size-4 text-turmeric-300" />}
        Demo
      </button>

      {open && (
        <div className={cn('fixed left-4 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-panel border border-line bg-white shadow-2xl animate-pop print:hidden', inApp ? 'bottom-34 lg:bottom-18' : 'bottom-18')}>
          <div className="bg-ink px-4 py-3 text-paper">
            <p className="font-display text-[15px] font-semibold">Demo controls</p>
            <p className="mt-0.5 text-xs text-paper/60">Sample data lives in this browser. Open two tabs to watch bookings appear live.</p>
          </div>
          <div className="space-y-1 p-2">
            <DemoAction icon={<ExternalLink />} title="Open a broker's referral link" body={`Books as a customer referred by ${demoBroker.name}`} onClick={() => {
              clearStoredReferral()
              window.open(bookingLink(demoBroker.referralCode, 'whatsapp'), '_blank')
            }} />
            <DemoAction icon={<UserRound />} title="View as broker" body={`${demoBroker.name}, ${demoBroker.agency}`} onClick={() => go('/broker', { role: 'broker', id: demoBroker.id })} />
            <DemoAction icon={<ShieldCheck />} title="View as site admin" body="Bookings, brokers, slots and settings" onClick={() => go('/admin', { role: 'admin', id: 'admin' })} />
            <DemoAction icon={<FlaskConical />} title="View as customer" body="Public site without a referral" onClick={() => {
              clearStoredReferral()
              go('/', null)
            }} />
          </div>
          <div className="border-t border-line-soft px-4 py-3 text-xs text-ink-3">
            <p className="flex items-center gap-1.5 font-semibold text-ink-2">
              <KeyRound className="size-3.5" /> Sign-in details
            </p>
            <p className="mt-1">
              Admin: {DEMO_ADMIN.email} / {DEMO_ADMIN.password}
            </p>
            <p>
              Broker: {demoBroker.email} / {DEMO_BROKER_PASSWORD}
            </p>
          </div>
          <div className="border-t border-line-soft p-2">
            <Button variant="ghost" size="sm" className="w-full justify-start text-brick-600 hover:bg-brick-50 hover:text-brick-600" icon={<RotateCcw />} onClick={() => setConfirmReset(true)}>
              Reset sample data
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset sample data?"
        body="Bookings, brokers, slots and settings go back to the original sample. Anything added during this demo is removed from this browser."
        confirmLabel="Reset data"
        danger
        onConfirm={() => {
          resetDb()
          setSession(null)
          clearStoredReferral()
          setConfirmReset(false)
          setOpen(false)
          toast.success('Sample data restored')
          navigate('/')
        }}
      />
    </>
  )
}

function DemoAction({ icon, title, body, onClick }: { icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 rounded-field px-2.5 py-2 text-left hover:bg-paper">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-field bg-paper-2 text-ink-2 [&_svg]:size-4">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-ink-3">{body}</span>
      </span>
    </button>
  )
}
