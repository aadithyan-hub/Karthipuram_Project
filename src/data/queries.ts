import type { Booking, BookingStatus, Broker, Db, Slot } from './types'

export const slotStart = (s: Pick<Slot, 'date' | 'start'>) => new Date(`${s.date}T${s.start}:00`)

const HOLDS_SEAT: BookingStatus[] = ['pending', 'confirmed', 'rescheduled', 'completed', 'no_show']

export function activeBookingCount(db: Db, slotId: string, ignoreBookingId?: string) {
  return db.bookings.filter((b) => b.slotId === slotId && b.id !== ignoreBookingId && HOLDS_SEAT.includes(b.status)).length
}

export interface SlotView extends Slot {
  booked: number
  remaining: number
  startsAt: Date
}

export function slotViews(db: Db): SlotView[] {
  const counts = new Map<string, number>()
  for (const b of db.bookings) if (HOLDS_SEAT.includes(b.status)) counts.set(b.slotId, (counts.get(b.slotId) ?? 0) + 1)
  return db.slots.map((s) => {
    const booked = counts.get(s.id) ?? 0
    return { ...s, booked, remaining: Math.max(0, s.capacity - booked), startsAt: slotStart(s) }
  })
}

/** Slots a customer can pick right now: active, in the future, with seats left. */
export function bookableSlots(db: Db, now = new Date()) {
  return slotViews(db).filter((s) => s.active && s.startsAt > now && s.remaining > 0)
}

export interface BookingView extends Booking {
  slot: Slot | undefined
  startsAt: Date | null
  broker: Broker | undefined
}

export function bookingViews(db: Db, filter?: (b: Booking) => boolean): BookingView[] {
  const slots = new Map(db.slots.map((s) => [s.id, s]))
  const brokers = new Map(db.brokers.map((b) => [b.id, b]))
  const list = filter ? db.bookings.filter(filter) : db.bookings
  return list.map((b) => {
    const slot = slots.get(b.slotId)
    return { ...b, slot, startsAt: slot ? slotStart(slot) : null, broker: b.brokerId ? brokers.get(b.brokerId) : undefined }
  })
}

/** Broker scope: a broker only ever sees bookings credited to them. */
export const brokerBookings = (db: Db, brokerId: string) => bookingViews(db, (b) => b.brokerId === brokerId)

export interface Metrics {
  total: number
  pending: number
  confirmed: number
  rescheduled: number
  completed: number
  cancelled: number
  noShow: number
  visitors: number
  /** completed / visits that were due (completed + no-show) */
  showRate: number
}

export function metrics(list: Booking[]): Metrics {
  const m = { total: list.length, pending: 0, confirmed: 0, rescheduled: 0, completed: 0, cancelled: 0, noShow: 0, visitors: 0, showRate: 0 }
  for (const b of list) {
    if (b.status === 'pending') m.pending++
    else if (b.status === 'confirmed') m.confirmed++
    else if (b.status === 'rescheduled') m.rescheduled++
    else if (b.status === 'completed') m.completed++
    else if (b.status === 'cancelled') m.cancelled++
    else if (b.status === 'no_show') m.noShow++
    if (b.status === 'completed') m.visitors += b.visitors
  }
  const due = m.completed + m.noShow
  m.showRate = due ? m.completed / due : 0
  return m
}

export interface BrokerStat {
  broker: Broker
  metrics: Metrics
  clicks: number
  sold: number
}

export function brokerStats(db: Db, from?: Date, to?: Date): BrokerStat[] {
  const inRange = (iso: string) => (!from || new Date(iso) >= from) && (!to || new Date(iso) <= to)
  return db.brokers.map((broker) => {
    const own = db.bookings.filter((b) => b.brokerId === broker.id && inRange(b.createdAt))
    return {
      broker,
      metrics: metrics(own),
      clicks: db.clicks.filter((c) => c.refCode === broker.referralCode && inRange(c.at)).length,
      sold: own.filter((b) => b.salesStage === 'sold').length,
    }
  })
}

export function inDateRange(iso: string | Date, from?: Date | null, to?: Date | null) {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return (!from || d >= from) && (!to || d <= to)
}
