import { Ban, CalendarPlus, CheckCircle2, Clock, Compass, MessageCircle, Pencil, Printer, SearchX } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { ReactNode } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Button, ButtonLink, cn, EmptyState } from '@/components/ui'
import { getBookingByRef } from '@/data/api'
import { slotStart } from '@/data/queries'
import { useDb } from '@/data/store'
import type { Booking } from '@/data/types'
import { downloadFile, icsFile, longDate, phoneDisplay, slotRange, whatsappLink } from '@/lib/format'

export default function Confirmation() {
  const { ref = '' } = useParams()
  const location = useLocation()
  const justBooked = (location.state as { justBooked?: boolean } | null)?.justBooked === true
  const db = useDb()
  const booking = getBookingByRef(ref)
  const { project } = db.settings

  if (!booking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<SearchX />}
          title="We could not find that booking"
          body={`No visit matches the reference ${ref.toUpperCase() || 'in this link'}. Check the reference, or look it up with your mobile number.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/manage" variant="secondary">
                Find my booking
              </ButtonLink>
              <ButtonLink to="/book">Book a site visit</ButtonLink>
            </div>
          }
        />
      </div>
    )
  }

  const slot = db.slots.find((s) => s.id === booking.slotId)
  const start = slot ? slotStart(slot) : null
  const end = slot ? new Date(`${slot.date}T${slot.end}:00`) : null
  const broker = booking.brokerId ? db.brokers.find((b) => b.id === booking.brokerId) : undefined
  const manageUrl = `${window.location.origin}/manage?ref=${booking.ref}`
  const closed = booking.status === 'cancelled' || booking.status === 'no_show'

  const shareText = [
    `${project.name} site visit`,
    `Reference: ${booking.ref}`,
    start && slot ? `${longDate(start)}, ${slotRange(slot)}` : '',
    `Visitors: ${booking.visitors}`,
    booking.pickup ? `Pickup: ${booking.pickupPoint}` : '',
    project.address,
    `Change or cancel: ${manageUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  const addToCalendar = () => {
    if (!start || !end) return
    downloadFile(
      `site-visit-${booking.ref}.ics`,
      icsFile({ title: `${project.name} site visit`, start, end, location: project.address, description: `Reference ${booking.ref}. Show this at the site office.\n${manageUrl}` }),
      'text/calendar',
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-16 sm:px-6 lg:pt-12 print:p-0">
      <style>{'@media print { header, footer, [data-sonner-toaster] { display: none !important } body { background: #fff } }'}</style>

      <StatusHeader booking={booking} justBooked={justBooked} phone={booking.phone} />

      <article className="mt-8 grid overflow-hidden rounded-panel border border-line bg-white sm:grid-cols-[minmax(0,1fr)_auto] print:border-ink">
        <div className="p-5 sm:p-7">
          <p className="text-sm font-medium text-ink-3">Visit pass</p>
          <p className={cn('mt-1 font-display text-[34px] leading-none font-bold tracking-tight tabular sm:text-[40px]', closed && 'text-ink-3 line-through decoration-2')}>{booking.ref}</p>
          <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <PassRow label="Date">{start ? longDate(start) : 'Slot removed — call the site office'}</PassRow>
            <PassRow label="Time">{slot ? slotRange(slot) : '—'}</PassRow>
            <PassRow label="Name">{booking.customerName}</PassRow>
            <PassRow label="Visitors">{booking.visitors}</PassRow>
            <PassRow label="Pickup">{booking.pickup ? booking.pickupPoint : 'Not needed'}</PassRow>
            {booking.plotsOfInterest.length > 0 && <PassRow label="Plots to see">{booking.plotsOfInterest.join(', ')}</PassRow>}
            {broker && <PassRow label="Referred by">{broker.name}</PassRow>}
            <PassRow label="Where" wide>
              {project.address}
            </PassRow>
          </dl>
        </div>

        <div className="relative flex flex-col items-center justify-center gap-3 border-t-2 border-dashed border-line px-7 py-6 sm:border-t-0 sm:border-l-2">
          <span aria-hidden className="absolute -top-3 -left-3 hidden size-6 rounded-full border border-line bg-paper sm:block print:hidden" />
          <span aria-hidden className="absolute -bottom-3 -left-3 hidden size-6 rounded-full border border-line bg-paper sm:block print:hidden" />
          <div className={cn('rounded-field border border-line-soft bg-white p-3', closed && 'opacity-30')}>
            <QRCodeSVG value={booking.ref} size={148} fgColor="#13261C" level="M" title={`QR code for ${booking.ref}`} />
          </div>
          <p className="max-w-[11rem] text-center text-xs text-ink-3">Show this at the site office to check in</p>
        </div>
      </article>

      {!closed && booking.status !== 'completed' && (
        <div className="mt-5 flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" icon={<CalendarPlus />} onClick={addToCalendar} disabled={!start}>
            Add to calendar
          </Button>
          <a className="inline-flex h-10 items-center gap-2 rounded-field border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-paper-2 [&_svg]:size-4" href={project.mapsUrl} target="_blank" rel="noreferrer">
            <Compass />
            Get directions
          </a>
          <a className="inline-flex h-10 items-center gap-2 rounded-field border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-paper-2 [&_svg]:size-4" href={whatsappLink(shareText)} target="_blank" rel="noreferrer">
            <MessageCircle />
            Send to WhatsApp
          </a>
          <Button variant="secondary" icon={<Printer />} onClick={() => window.print()}>
            Print pass
          </Button>
          <ButtonLink to={`/manage?ref=${booking.ref}`} variant="ghost" className="sm:ml-auto">
            <Pencil />
            Change or cancel
          </ButtonLink>
        </div>
      )}

      {closed && (
        <div className="mt-5 flex flex-wrap gap-2 print:hidden">
          <ButtonLink to="/book">Book another visit</ButtonLink>
          <a className="inline-flex h-10 items-center rounded-field px-4 text-sm font-semibold text-ink-2 hover:bg-ink/5" href={`tel:${project.phone.replace(/\s/g, '')}`}>
            Call the site office
          </a>
        </div>
      )}

      <p className="mt-8 text-sm text-ink-3 print:mt-4">
        Questions about your visit? Call {project.phone}. Keep your reference number handy.
      </p>
    </div>
  )
}

function StatusHeader({ booking, justBooked, phone }: { booking: Booking; justBooked: boolean; phone: string }) {
  const map: Record<Booking['status'], { icon: ReactNode; title: string; body: string; tone: string }> = {
    pending: {
      icon: <Clock />,
      title: justBooked ? 'Your visit is booked' : 'Waiting for confirmation',
      body: `The site office will call you on ${phoneDisplay(phone)} to confirm, usually within a few hours.`,
      tone: 'bg-turmeric-100 text-turmeric-800',
    },
    confirmed: { icon: <CheckCircle2 />, title: justBooked ? 'Your visit is booked and confirmed' : 'Your visit is confirmed', body: 'See you at the site. Arrive 10 minutes early and show your pass at the office.', tone: 'bg-paddy-100 text-paddy-700' },
    rescheduled: { icon: <CheckCircle2 />, title: 'Your visit has a new time', body: 'The details below show your updated slot. Show your pass at the site office.', tone: 'bg-sky-100 text-sky-600' },
    completed: { icon: <CheckCircle2 />, title: 'Thanks for visiting', body: 'Your visit is complete. The site team will follow up on the plots you liked.', tone: 'bg-ink text-paper' },
    cancelled: { icon: <Ban />, title: 'This visit was cancelled', body: 'This pass is no longer valid. Book a new visit any time.', tone: 'bg-brick-100 text-brick-600' },
    no_show: { icon: <Ban />, title: 'This visit was missed', body: 'We did not see you on the day. Book a new visit whenever it suits you.', tone: 'bg-brick-100 text-brick-600' },
  }
  const s = map[booking.status]
  return (
    <div className="flex items-start gap-4">
      <span className={cn('grid size-12 shrink-0 place-items-center rounded-full [&_svg]:size-6', s.tone, justBooked && 'animate-pop')}>{s.icon}</span>
      <div className={cn(justBooked && 'animate-rise')}>
        <h1 className="text-[28px] leading-tight font-bold sm:text-[34px]">{s.title}</h1>
        <p className="mt-1.5 max-w-xl text-[15px] text-ink-2">{s.body}</p>
      </div>
    </div>
  )
}

function PassRow({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn(wide && 'sm:col-span-2')}>
      <dt className="text-xs font-medium text-ink-3">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{children}</dd>
    </div>
  )
}
