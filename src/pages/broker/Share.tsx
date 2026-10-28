import { Download, Link2, MessageCircle, Plus, Share2, ShieldAlert } from 'lucide-react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button, CopyButton, EmptyState, Field, Input, PageHeader, Panel, Textarea } from '@/components/ui'
import { brokerBookings } from '@/data/queries'
import { useDb } from '@/data/store'
import { bookingLink, num, pct, sourceLabel, whatsappLink } from '@/lib/format'
import { shareMessage, useBroker } from './useBroker'

const PRESET_TAGS = ['whatsapp', 'facebook', 'instagram', 'flyer']

export default function BrokerShare() {
  const db = useDb()
  const broker = useBroker()
  const link = bookingLink(broker.referralCode)
  const [message, setMessage] = useState(() => shareMessage(db.settings.project.name, link))
  const [tags, setTags] = useState<string[]>(PRESET_TAGS)
  const [custom, setCustom] = useState('')
  const qrRef = useRef<HTMLDivElement>(null)
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  const performance = useMemo(() => {
    const bookings = brokerBookings(db, broker.id)
    const keys = new Set<string>()
    const rows = new Map<string, { clicks: number; bookings: number; completed: number }>()
    const row = (k: string) => {
      keys.add(k)
      if (!rows.has(k)) rows.set(k, { clicks: 0, bookings: 0, completed: 0 })
      return rows.get(k)!
    }
    for (const c of db.clicks) if (c.refCode === broker.referralCode) row(c.source ?? '').clicks++
    for (const b of bookings) {
      const r = row(b.source ?? '')
      r.bookings++
      if (b.status === 'completed') r.completed++
    }
    return [...keys].map((k) => ({ key: k, ...rows.get(k)! })).sort((a, b) => b.bookings - a.bookings || b.clicks - a.clicks)
  }, [db, broker.id, broker.referralCode])

  if (broker.status !== 'active') {
    return (
      <>
        <PageHeader title="Share your link" />
        <Panel>
          <EmptyState
            icon={<ShieldAlert />}
            title={broker.status === 'pending' ? 'Your link is waiting for approval' : 'Your link is turned off'}
            body={
              broker.status === 'pending'
                ? 'The site office reviews every new broker before their link gives credit. You will get a notification as soon as you are approved.'
                : 'The site office has disabled this account, so bookings through your link are not credited. Contact the site office to restore it.'
            }
          />
        </Panel>
      </>
    )
  }

  function nativeShare() {
    navigator.share({ title: db.settings.project.name, text: message, url: link }).catch(() => {})
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `karthipuram-qr-${broker.referralCode}.png`
    a.click()
    toast.success('QR code downloaded')
  }

  function addTag() {
    const tag = custom.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24)
    if (!tag) {
      toast.error('Use letters, numbers or dashes for the tag, like "temple-fair".')
      return
    }
    if (!tags.includes(tag)) setTags((t) => [...t, tag])
    setCustom('')
  }

  return (
    <>
      <PageHeader title="Share your link" description="Every booking made through these links is credited to you. Your code stays the same unless the site office changes it." />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section className="rounded-panel bg-ink p-5 text-paper sm:p-6">
            <p className="text-sm text-paper/60">Your booking link</p>
            <p className="mt-2 font-display text-lg leading-snug font-semibold break-all sm:text-xl">{link}</p>
            <p className="mt-2 text-[13px] text-paper/60">
              Referral code <span className="font-semibold text-turmeric-300 tabular">{broker.referralCode}</span>
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <CopyButton value={link} label="Copy link" variant="accent" />
              {canNativeShare && (
                <Button variant="inverse" icon={<Share2 />} onClick={nativeShare}>
                  Share
                </Button>
              )}
            </div>
          </section>

          <Panel title="WhatsApp message" description="Edit the message, then send it to a customer or a group.">
            <Field label="Message" htmlFor="share-message" hint="Your link is already in the message.">
              <Textarea id="share-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={whatsappLink(message)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-field bg-paddy-600 px-4 text-sm font-semibold text-white hover:bg-paddy-700">
                <MessageCircle className="size-4" />
                Send on WhatsApp
              </a>
              <CopyButton value={message} label="Copy message" />
              <Button variant="ghost" onClick={() => setMessage(shareMessage(db.settings.project.name, link))}>
                Reset text
              </Button>
            </div>
          </Panel>

          <Panel title="Campaign links" description="Use a different link for each place you share, so you can see which one brings bookings.">
            <ul className="divide-y divide-line-soft">
              {tags.map((tag) => {
                const tagged = bookingLink(broker.referralCode, tag)
                return (
                  <li key={tag} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{sourceLabel(tag)}</p>
                      <p className="truncate text-xs text-ink-3">{tagged}</p>
                    </div>
                    <CopyButton value={tagged} size="sm" />
                  </li>
                )
              })}
            </ul>
            <form
              className="mt-4 flex gap-2 border-t border-line-soft pt-4"
              onSubmit={(e) => {
                e.preventDefault()
                addTag()
              }}
            >
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="New tag, e.g. temple-fair" className="h-10" aria-label="New campaign tag" maxLength={30} />
              <Button type="submit" variant="secondary" icon={<Plus />}>
                Add
              </Button>
            </form>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="QR code" description="Print it on flyers or show it on your phone.">
            <div className="flex justify-center rounded-field border border-line-soft bg-white p-4">
              <QRCodeSVG value={bookingLink(broker.referralCode, 'flyer')} size={196} fgColor="#13261C" level="M" marginSize={1} />
            </div>
            <div ref={qrRef} className="hidden" aria-hidden>
              <QRCodeCanvas value={bookingLink(broker.referralCode, 'flyer')} size={1024} fgColor="#13261C" level="M" marginSize={4} />
            </div>
            <p className="mt-3 text-xs text-ink-3">Scans are tagged as "Flyer / QR" in your results.</p>
            <Button variant="secondary" className="mt-3 w-full" icon={<Download />} onClick={downloadQr}>
              Download QR code
            </Button>
          </Panel>

          <Panel title="Results by source" bodyClassName="p-0 sm:p-0">
            {performance.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-left text-xs text-ink-3">
                    <th className="px-4 py-2.5 font-semibold">Source</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Clicks</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Bookings</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Visited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {performance.map((r) => (
                    <tr key={r.key}>
                      <td className="px-4 py-2.5 font-medium">{sourceLabel(r.key || null)}</td>
                      <td className="px-2 py-2.5 text-right tabular">{num(r.clicks)}</td>
                      <td className="px-2 py-2.5 text-right tabular">
                        {num(r.bookings)}
                        {r.clicks > 0 && <span className="block text-[11px] text-ink-3">{pct(r.bookings / r.clicks)}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular">{num(r.completed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState icon={<Link2 />} title="No clicks yet" body="Send your link to a customer. Clicks and bookings show up here." className="py-8" />
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
