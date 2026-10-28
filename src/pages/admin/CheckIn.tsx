import { format } from 'date-fns'
import { Bus, Camera, CheckCircle2, ClipboardCopy, ScanLine, UserCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge, Button, cn, EmptyState, Input, Modal, PageHeader, Panel, StatusBadge } from '@/components/ui'
import { ApiError, checkIn, setBookingStatus } from '@/data/api'
import { bookingViews, slotViews } from '@/data/queries'
import { useDb } from '@/data/store'
import type { Booking } from '@/data/types'
import { longDate, phoneDisplay, slotRange } from '@/lib/format'
import { BookingDrawer } from './BookingDrawer'

// Minimal typing for the Barcode Detection API (Chrome/Android); absent in TS's DOM lib.
interface DetectedCode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedCode[]>
}
type BarcodeDetectorCtor = new (opts?: { formats: string[] }) => BarcodeDetectorLike
const Detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector

const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
const OPEN = ['pending', 'confirmed', 'rescheduled']

export default function AdminCheckIn() {
  const db = useDb()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [last, setLast] = useState<Booking | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const today = format(new Date(), 'yyyy-MM-dd')
  const slots = useMemo(() => slotViews(db).filter((s) => s.date === today).sort((a, b) => a.start.localeCompare(b.start)), [db, today])
  const visits = useMemo(() => bookingViews(db, (b) => slots.some((s) => s.id === b.slotId) && b.status !== 'cancelled'), [db, slots])
  const arrived = visits.filter((v) => v.status === 'completed')
  const expected = visits.filter((v) => v.status !== 'no_show')
  const people = expected.reduce((s, v) => s + v.visitors, 0)

  const pickups = useMemo(() => {
    const map = new Map<string, typeof visits>()
    for (const v of visits) {
      if (!v.pickup || !OPEN.includes(v.status)) continue
      map.set(v.pickupPoint, [...(map.get(v.pickupPoint) ?? []), v])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [visits])

  async function submit(value: string) {
    if (!value.trim()) {
      setError('Enter a reference number or mobile number.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const b = await checkIn(value)
      setLast(b)
      setQuery('')
      toast.success(`${b.customerName} checked in`)
    } catch (e) {
      setError(errorMessage(e))
      setLast(null)
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  async function quick(id: string, status: 'completed' | 'no_show') {
    setRowBusy(id + status)
    try {
      const res = await setBookingStatus([id], status, status === 'completed' ? 'Checked in at site' : 'Did not arrive')
      if (res.skipped.length) toast.error('This visit cannot be updated yet. Its slot may not have started.')
      else toast.success(status === 'completed' ? 'Checked in' : 'Marked no-show')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setRowBusy(null)
    }
  }

  function copyPickups() {
    const text = [
      `Pickups for ${longDate(new Date())}`,
      ...pickups.flatMap(([point, list]) => [
        '',
        point,
        ...list
          .sort((a, b) => (a.slot?.start ?? '').localeCompare(b.slot?.start ?? ''))
          .map((v) => `- ${v.slot ? slotRange(v.slot) : ''}: ${v.customerName}, ${v.visitors} ${v.visitors === 1 ? 'person' : 'people'}, ${phoneDisplay(v.phone)} (${v.ref})`),
      ]),
    ].join('\n')
    navigator.clipboard?.writeText(text).then(
      () => toast.success('Pickup list copied. Paste it into WhatsApp for the driver.'),
      () => toast.error('Copy was blocked by the browser.'),
    )
  }

  const lastBroker = last?.brokerId ? db.brokers.find((b) => b.id === last.brokerId) : undefined
  const lastSlot = last ? db.slots.find((s) => s.id === last.slotId) : undefined

  return (
    <>
      <PageHeader title="Today & check-in" description={`${longDate(new Date())}. Check visitors in as they arrive at the site.`} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-panel bg-ink p-5 text-paper sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ScanLine className="size-5 text-turmeric-300" />
            Check in a visitor
          </h2>
          <p className="mt-1 text-sm text-paper/60">Scan the QR on their visit pass, or type the reference number or mobile number.</p>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              submit(query)
            }}
          >
            <Input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setError('')
              }}
              placeholder="KP-7QH3MZ or 98400 12345"
              aria-label="Reference or mobile number"
              invalid={!!error}
              className="h-12 flex-1 text-base uppercase placeholder:normal-case"
              autoComplete="off"
            />
            <Button type="submit" variant="accent" size="lg" loading={busy} icon={<UserCheck />}>
              Check in
            </Button>
            {Detector && (
              <Button variant="inverse" size="lg" icon={<Camera />} onClick={() => setScanOpen(true)}>
                Scan
              </Button>
            )}
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm font-medium text-brick-100">
              {error}
            </p>
          )}
          {last && (
            <div className="mt-4 flex items-start gap-3 rounded-field bg-paper p-4 text-ink animate-pop">
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-paddy-600" />
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold">{last.customerName} is checked in</p>
                <p className="mt-0.5 text-sm text-ink-2">
                  {last.ref} · {last.visitors} {last.visitors === 1 ? 'visitor' : 'visitors'}
                  {lastSlot && ` · ${slotRange(lastSlot)}`}
                </p>
                <p className="mt-0.5 text-sm text-ink-3">{lastBroker ? `Referred by ${lastBroker.name}, ${lastBroker.agency}` : 'Direct booking'}</p>
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <MiniStat label="Visits today" value={expected.length} />
          <MiniStat label="Arrived" value={arrived.length} accent />
          <MiniStat label="People expected" value={people} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Today’s visits" description="Grouped by slot. Select a name for full details." bodyClassName="p-0">
          {slots.length === 0 ? (
            <EmptyState icon={<ScanLine />} title="No visit slots today" body="Open slots for today from Visit slots if the site is receiving visitors." />
          ) : (
            <div className="divide-y divide-line-soft">
              {slots.map((s) => {
                const list = visits.filter((v) => v.slotId === s.id)
                const started = s.startsAt <= new Date()
                return (
                  <div key={s.id}>
                    <div className="flex items-center justify-between gap-3 bg-paper/60 px-4 py-2.5 sm:px-5">
                      <p className="text-sm font-semibold">{slotRange(s)}</p>
                      <span className="text-[13px] text-ink-3 tabular">
                        {s.booked} of {s.capacity} booked
                      </span>
                    </div>
                    {list.length === 0 ? (
                      <p className="px-4 py-3 text-[13px] text-ink-3 sm:px-5">No visitors booked in this slot.</p>
                    ) : (
                      <ul className="divide-y divide-line-soft">
                        {list.map((v) => (
                          <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(v.id)}>
                              <p className="truncate font-semibold hover:underline">{v.customerName}</p>
                              <p className="text-[13px] text-ink-3">
                                {v.ref} · {v.visitors} {v.visitors === 1 ? 'visitor' : 'visitors'}
                                {v.pickup && ` · pickup at ${v.pickupPoint}`}
                                {' · '}
                                {v.broker ? v.broker.name : 'Direct'}
                              </p>
                            </button>
                            <div className="flex items-center gap-2">
                              {OPEN.includes(v.status) ? (
                                <>
                                  <Button size="sm" loading={rowBusy === v.id + 'completed'} disabled={!started} title={started ? undefined : 'Available once the slot starts'} onClick={() => quick(v.id, 'completed')}>
                                    Check in
                                  </Button>
                                  <Button size="sm" variant="secondary" loading={rowBusy === v.id + 'no_show'} disabled={!started} title={started ? undefined : 'Available once the slot starts'} onClick={() => quick(v.id, 'no_show')}>
                                    No-show
                                  </Button>
                                </>
                              ) : (
                                <StatusBadge status={v.status} />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Pickup list"
          description="Visitors who asked to be picked up today."
          actions={
            pickups.length > 0 && (
              <Button size="sm" variant="secondary" icon={<ClipboardCopy />} onClick={copyPickups}>
                Copy pickup list
              </Button>
            )
          }
          bodyClassName="p-0"
        >
          {pickups.length === 0 ? (
            <EmptyState icon={<Bus />} title="No pickups today" body="Visitors who ask for a pickup when booking appear here, grouped by pickup point." className="py-8" />
          ) : (
            <ul className="divide-y divide-line-soft">
              {pickups.map(([point, list]) => (
                <li key={point} className="px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{point}</p>
                    <Badge tone="blue">{list.reduce((s, v) => s + v.visitors, 0)} people</Badge>
                  </div>
                  <ul className="mt-1.5 space-y-1 text-[13px] text-ink-2">
                    {list.map((v) => (
                      <li key={v.id} className="flex justify-between gap-2">
                        <span className="truncate">{v.customerName}</span>
                        <span className="shrink-0 text-ink-3">{v.slot ? slotRange(v.slot) : ''}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {scanOpen && Detector && (
        <ScanModal
          onClose={() => setScanOpen(false)}
          onCode={(code) => {
            setScanOpen(false)
            setQuery(code)
            submit(code)
          }}
        />
      )}

      <BookingDrawer key={openId ?? 'none'} bookingId={openId} onClose={() => setOpenId(null)} />
    </>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn('rounded-panel border p-4', accent ? 'border-paddy-200 bg-paddy-50' : 'border-line-soft bg-white')}>
      <p className="text-[13px] font-medium text-ink-3">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-semibold tabular', accent ? 'text-paddy-700' : 'text-ink')}>{value}</p>
    </div>
  )
}

function ScanModal({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false
    const detector = new Detector!({ formats: ['qr_code'] })

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const video = videoRef.current!
        video.srcObject = s
        await video.play()
        const tick = async () => {
          if (stopped) return
          try {
            const codes = await detector.detect(video)
            const raw = codes[0]?.rawValue
            if (raw) {
              // The visit pass QR may hold a URL ending in the reference, or the bare reference.
              const ref = raw.match(/KP-[A-Z0-9]{6}/i)?.[0] ?? raw
              onCodeRef.current(ref.toUpperCase())
              return
            }
          } catch {
            /* keep scanning */
          }
          timer = window.setTimeout(tick, 250)
        }
        tick()
      })
      .catch(() => setError('Camera access was blocked. Allow the camera in the browser, or type the reference number instead.'))

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <Modal open onClose={onClose} title="Scan visit pass" description="Point the camera at the QR code on the visitor’s pass.">
      {error ? (
        <p className="rounded-field bg-brick-50 p-3 text-sm text-brick-600">{error}</p>
      ) : (
        <div className="relative overflow-hidden rounded-panel bg-ink">
          <video ref={videoRef} muted playsInline className="aspect-square w-full object-cover" />
          <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-turmeric-300" />
        </div>
      )}
    </Modal>
  )
}
