import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns'
import type { BookingStatus, BrokerStatus, PlotStatus, SalesStage } from '@/data/types'

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
}

export const STATUS_TONE: Record<BookingStatus, Tone> = {
  pending: 'amber',
  confirmed: 'green',
  rescheduled: 'blue',
  cancelled: 'neutral',
  completed: 'ink',
  no_show: 'red',
}

export const BROKER_STATUS_LABEL: Record<BrokerStatus, string> = { pending: 'Awaiting approval', active: 'Active', disabled: 'Disabled' }
export const BROKER_STATUS_TONE: Record<BrokerStatus, Tone> = { pending: 'amber', active: 'green', disabled: 'neutral' }

export const PLOT_STATUS_LABEL: Record<PlotStatus, string> = { available: 'Available', reserved: 'Reserved', sold: 'Sold' }

export const STAGE_LABEL: Record<SalesStage, string> = {
  none: 'Not started',
  interested: 'Interested',
  negotiation: 'Negotiating',
  token: 'Token paid',
  sold: 'Sold',
  dropped: 'Dropped',
}

export const SOURCE_LABEL: Record<string, string> = { whatsapp: 'WhatsApp', facebook: 'Facebook', flyer: 'Flyer / QR', instagram: 'Instagram' }
export const sourceLabel = (s: string | null) => (s ? (SOURCE_LABEL[s] ?? s) : 'Direct link')

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'neutral' | 'ink'

export function time12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`
}

export const slotRange = (s: { start: string; end: string }) => `${time12(s.start)} – ${time12(s.end)}`

export function dayLabel(d: Date) {
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE d MMM')
}

export const longDate = (d: Date) => format(d, 'EEEE, d MMMM yyyy')
export const shortDate = (d: Date | string) => format(typeof d === 'string' ? new Date(d) : d, 'd MMM yyyy')
export const dateTime = (d: Date | string) => format(typeof d === 'string' ? new Date(d) : d, 'd MMM, h:mm a')
export const ago = (d: Date | string) => formatDistanceToNowStrict(typeof d === 'string' ? new Date(d) : d, { addSuffix: true })

export const phoneDisplay = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p)
/** Brokers see a masked number on cancelled/old leads; full details stay with the site office. */
export const maskPhone = (p: string) => (p.length === 10 ? `${p.slice(0, 2)}xxx xx${p.slice(7)}` : p)

export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
export const inrCompact = (n: number) => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, '')} L`
  return inr(n)
}
export const num = (n: number) => new Intl.NumberFormat('en-IN').format(n)
export const pct = (n: number) => `${Math.round(n * 100)}%`

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function bookingLink(code: string, source?: string | null) {
  const url = new URL('/book', window.location.origin)
  url.searchParams.set('ref', code)
  if (source) url.searchParams.set('src', source)
  return url.toString()
}

export function whatsappLink(text: string, phone?: string) {
  const to = phone ? (phone.length === 10 ? `91${phone}` : phone) : ''
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`
}

export function downloadFile(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function toCsv(rows: Record<string, string | number | null | undefined>[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}

export function icsFile(opts: { title: string; start: Date; end: Date; location: string; description: string }) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Karthipuram//Site visit//EN',
    'BEGIN:VEVENT',
    `UID:${f(opts.start)}-${Math.random().toString(36).slice(2)}@karthipuram`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(opts.start)}`,
    `DTEND:${f(opts.end)}`,
    `SUMMARY:${opts.title}`,
    `LOCATION:${opts.location}`,
    `DESCRIPTION:${opts.description.replace(/\n/g, '\\n')}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT3H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Site visit today',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
