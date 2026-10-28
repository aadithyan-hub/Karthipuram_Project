import { CheckCircle2, Link2, RefreshCw, ShieldOff, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BarList, TrendChart, trendBuckets } from '@/components/charts'
import { Avatar, BrokerStatusBadge, Button, ConfirmModal, CopyButton, DetailList, Drawer, StatusBadge } from '@/components/ui'
import { ApiError, regenerateReferralCode, setBrokerStatus } from '@/data/api'
import { bookingViews, metrics } from '@/data/queries'
import { useDb } from '@/data/store'
import type { Broker } from '@/data/types'
import { bookingLink, dayLabel, pct, phoneDisplay, shortDate, slotRange, sourceLabel } from '@/lib/format'

export function BrokerDrawer({ broker, onClose }: { broker: Broker | null; onClose: () => void }) {
  const db = useDb()
  const [confirm, setConfirm] = useState<'disable' | 'relink' | null>(null)
  const [busy, setBusy] = useState(false)

  const data = useMemo(() => {
    if (!broker) return null
    const own = bookingViews(db, (b) => b.brokerId === broker.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const clicks = db.clicks.filter((c) => c.refCode === broker.referralCode)
    const bySource = new Map<string, number>()
    for (const c of clicks) bySource.set(sourceLabel(c.source), (bySource.get(sourceLabel(c.source)) ?? 0) + 1)
    return {
      own,
      m: metrics(own),
      clicks: clicks.length,
      sources: [...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ key: label, label, value })),
      trend: trendBuckets(own, null, null),
    }
  }, [db, broker])

  if (!broker || !data) return null

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await fn()
      toast.success(success)
      setConfirm(null)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const link = bookingLink(broker.referralCode)
  const { m } = data

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <Avatar name={broker.name} />
          <span className="min-w-0">
            <span className="block truncate">{broker.name}</span>
            <span className="block truncate text-[13px] font-normal text-ink-3">{broker.agency}</span>
          </span>
        </span>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BrokerStatusBadge status={broker.status} />
          <div className="flex flex-wrap gap-2">
            {broker.status === 'pending' && (
              <>
                <Button variant="danger" onClick={() => setConfirm('disable')} icon={<ShieldOff />}>
                  Reject
                </Button>
                <Button loading={busy} onClick={() => run(() => setBrokerStatus(broker.id, 'active'), `${broker.name} approved`)} icon={<CheckCircle2 />}>
                  Approve
                </Button>
              </>
            )}
            {broker.status === 'active' && (
              <Button variant="danger" onClick={() => setConfirm('disable')} icon={<ShieldOff />}>
                Disable account
              </Button>
            )}
            {broker.status === 'disabled' && (
              <Button loading={busy} onClick={() => run(() => setBrokerStatus(broker.id, 'active'), `${broker.name} re-enabled`)} icon={<ShieldCheck />}>
                Re-enable account
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6 p-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold">Referral link</h3>
          <div className="rounded-panel border border-line-soft bg-white p-3">
            <p className="flex items-center gap-2 text-[13px] break-all text-ink-2">
              <Link2 className="size-4 shrink-0 text-ink-3" />
              {link}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton value={link} label="Copy link" size="sm" />
              <Button variant="ghost" size="sm" icon={<RefreshCw />} onClick={() => setConfirm('relink')}>
                Issue new link
              </Button>
            </div>
            {broker.status !== 'active' && <p className="mt-2 text-xs text-turmeric-800">This link gives no credit until the account is active.</p>}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Bookings', m.total],
            ['Completed', m.completed],
            ['Show rate', pct(m.showRate)],
            ['Link clicks', data.clicks],
          ].map(([label, value]) => (
            <div key={label} className="rounded-panel border border-line-soft bg-white px-3 py-2.5">
              <p className="text-xs text-ink-3">{label}</p>
              <p className="mt-1 font-display text-xl font-semibold tabular">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-panel border border-line-soft bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Bookings over time</h3>
          {m.total ? <TrendChart data={data.trend} height={170} /> : <p className="py-4 text-sm text-ink-3">No bookings yet. Bookings made through this broker's link appear here.</p>}
        </section>

        <section className="rounded-panel border border-line-soft bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Link clicks by channel</h3>
          <BarList items={data.sources} empty="No one has opened this link yet." />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent bookings</h3>
            {m.total > 0 && (
              <Link to={`/admin/bookings?broker=${broker.id}`} className="text-[13px] font-semibold text-paddy-600 hover:underline">
                View all {m.total}
              </Link>
            )}
          </div>
          {data.own.length === 0 ? (
            <p className="rounded-panel border border-dashed border-line p-4 text-sm text-ink-3">Nothing booked yet.</p>
          ) : (
            <ul className="divide-y divide-line-soft rounded-panel border border-line-soft bg-white">
              {data.own.slice(0, 8).map((b) => (
                <li key={b.id}>
                  <Link to={`/admin/bookings?open=${b.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-paper">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{b.customerName}</span>
                      <span className="block text-xs text-ink-3 tabular">
                        {b.ref} · {b.startsAt ? `${dayLabel(b.startsAt)}, ${b.slot ? slotRange(b.slot) : ''}` : '—'}
                      </span>
                    </span>
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">Profile</h3>
          <DetailList
            items={[
              { label: 'Mobile', value: <a className="hover:underline" href={`tel:+91${broker.phone}`}>{phoneDisplay(broker.phone)}</a> },
              { label: 'Email', value: broker.email },
              { label: 'Agency', value: broker.agency },
              { label: 'City', value: broker.city || '—' },
              { label: 'Referral code', value: <span className="tabular">{broker.referralCode}</span> },
              { label: 'Joined', value: shortDate(broker.createdAt) },
              { label: 'Last updated', value: shortDate(broker.updatedAt) },
            ]}
          />
        </section>
      </div>

      <ConfirmModal
        open={confirm === 'disable'}
        onClose={() => setConfirm(null)}
        title={broker.status === 'pending' ? `Reject ${broker.name}?` : `Disable ${broker.name}?`}
        body="They will not be able to sign in, and their referral link stops giving credit. Bookings already made stay credited to them. You can re-enable the account later."
        confirmLabel={broker.status === 'pending' ? 'Reject broker' : 'Disable account'}
        danger
        loading={busy}
        onConfirm={() => run(() => setBrokerStatus(broker.id, 'disabled'), `${broker.name} disabled`)}
      />
      <ConfirmModal
        open={confirm === 'relink'}
        onClose={() => setConfirm(null)}
        title="Issue a new referral link?"
        body="The current link stops giving this broker credit straight away. Use this if the link was shared somewhere it should not be. The broker is notified and sees the new link on their dashboard."
        confirmLabel="Issue new link"
        loading={busy}
        onConfirm={() => run(() => regenerateReferralCode(broker.id), 'New link issued')}
      />
    </Drawer>
  )
}
