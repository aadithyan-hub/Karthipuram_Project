import { differenceInCalendarDays } from 'date-fns'
import { newBookingRef, newId, newReferralCode } from './ids'
import { DEMO_ADMIN } from './seed'
import { getDb, getSession, mutate, setSession } from './store'
import { activeBookingCount, slotStart } from './queries'
import type { Booking, BookingStatus, Broker, Db, Notification, PlotStatus, SalesStage, Session, Settings, Slot } from './types'

/**
 * Mock API. Every function here stands in for a REST endpoint and enforces the
 * rules the real server must enforce (capacity, attribution, role checks), so
 * the UI never trusts its own state. Swap these bodies for fetch() calls later.
 */

export class ApiError extends Error {
  field?: string
  constructor(message: string, field?: string) {
    super(message)
    this.field = field
  }
}

const wait = (ms = 220 + Math.random() * 280) => new Promise((r) => setTimeout(r, ms))
const nowIso = () => new Date().toISOString()

function requireAdmin(): Session {
  const s = getSession()
  if (s?.role !== 'admin') throw new ApiError('Sign in as an admin to do this.')
  return s
}

function requireBroker(): Extract<Session, { role: 'broker' }> {
  const s = getSession()
  if (s?.role !== 'broker') throw new ApiError('Sign in as a broker to do this.')
  return s
}

function notify(draft: Db, audience: string, title: string, body: string, link?: string) {
  const n: Notification = { id: newId('ntf'), audience, title, body, at: nowIso(), read: false, link }
  draft.notifications.unshift(n)
  draft.notifications = draft.notifications.slice(0, 200)
}

const normalisePhone = (p: string) => p.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')
const validPhone = (p: string) => /^[6-9]\d{9}$/.test(p)
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)

// ---------------------------------------------------------------- auth

export async function signInAdmin(email: string, password: string) {
  await wait()
  if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
    throw new ApiError('That email and password do not match an admin account.')
  }
  setSession({ role: 'admin', id: 'admin' })
}

export async function signInBroker(login: string, password: string) {
  await wait()
  const key = login.trim().toLowerCase()
  const phone = normalisePhone(login)
  const broker = getDb().brokers.find((b) => b.email.toLowerCase() === key || b.phone === phone)
  if (!broker || broker.password !== password) throw new ApiError('That phone/email and password do not match a broker account.')
  if (broker.status === 'disabled') throw new ApiError('This account has been disabled. Contact the site office to restore it.')
  setSession({ role: 'broker', id: broker.id })
  return broker
}

export interface SignUpInput {
  name: string
  phone: string
  email: string
  agency: string
  city: string
  password: string
}

export async function signUpBroker(input: SignUpInput) {
  await wait()
  const phone = normalisePhone(input.phone)
  const email = input.email.trim().toLowerCase()
  if (input.name.trim().length < 3) throw new ApiError('Enter your full name.', 'name')
  if (!validPhone(phone)) throw new ApiError('Enter a 10-digit Indian mobile number.', 'phone')
  if (!validEmail(email)) throw new ApiError('Enter a valid email address.', 'email')
  if (input.password.length < 6) throw new ApiError('Use at least 6 characters for the password.', 'password')
  const db = getDb()
  if (db.brokers.some((b) => b.phone === phone)) throw new ApiError('A broker account already uses this mobile number. Sign in instead.', 'phone')
  if (db.brokers.some((b) => b.email.toLowerCase() === email)) throw new ApiError('A broker account already uses this email. Sign in instead.', 'email')

  let referralCode = newReferralCode()
  while (db.brokers.some((b) => b.referralCode === referralCode)) referralCode = newReferralCode()

  const broker: Broker = {
    id: newId('brk'),
    name: input.name.trim(),
    phone,
    email,
    agency: input.agency.trim() || 'Independent',
    city: input.city.trim(),
    referralCode,
    status: db.settings.requireBrokerApproval ? 'pending' : 'active',
    password: input.password,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  mutate((d) => {
    d.brokers.push(broker)
    if (broker.status === 'pending') notify(d, 'admin', 'New broker waiting for approval', `${broker.name} (${broker.agency}) signed up.`, `/admin/brokers?focus=${broker.id}`)
  })
  setSession({ role: 'broker', id: broker.id })
  return broker
}

export function signOut() {
  setSession(null)
}

export async function updateMyProfile(patch: Pick<Broker, 'name' | 'email' | 'agency' | 'city'>) {
  const s = requireBroker()
  await wait()
  const email = patch.email.trim().toLowerCase()
  if (patch.name.trim().length < 3) throw new ApiError('Enter your full name.', 'name')
  if (!validEmail(email)) throw new ApiError('Enter a valid email address.', 'email')
  if (getDb().brokers.some((b) => b.id !== s.id && b.email.toLowerCase() === email)) throw new ApiError('Another account already uses this email.', 'email')
  mutate((d) => {
    const b = d.brokers.find((x) => x.id === s.id)!
    Object.assign(b, { ...patch, name: patch.name.trim(), email, updatedAt: nowIso() })
  })
}

export async function changeMyPassword(current: string, next: string) {
  const s = requireBroker()
  await wait()
  const b = getDb().brokers.find((x) => x.id === s.id)!
  if (b.password !== current) throw new ApiError('Your current password is not correct.', 'current')
  if (next.length < 6) throw new ApiError('Use at least 6 characters for the new password.', 'next')
  mutate((d) => {
    d.brokers.find((x) => x.id === s.id)!.password = next
  })
}

// ---------------------------------------------------------------- referral

const ATTRIBUTION_KEY = 'kp.attribution'
interface Attribution {
  code: string
  source: string | null
  at: string
}

/** Public lookup used by the booking page. Only active brokers' links give credit. */
export function resolveReferral(code: string | null | undefined) {
  if (!code) return null
  const b = getDb().brokers.find((x) => x.referralCode === code.trim().toUpperCase())
  if (!b || b.status !== 'active') return null
  return { name: b.name, agency: b.agency, code: b.referralCode }
}

export function recordReferralVisit(code: string, source: string | null) {
  if (!resolveReferral(code)) return
  const entry: Attribution = { code: code.toUpperCase(), source, at: nowIso() }
  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(entry))
    if (getDb().settings.attributionDays > 0) localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(entry))
  } catch {
    // Storage blocked: the code still travels in the URL for this visit.
  }
  mutate((d) => {
    d.clicks.push({ id: newId('clk'), refCode: entry.code, source, at: entry.at })
  })
}

/** The referral this device should credit, respecting the attribution window in Settings. */
export function storedReferral(): Attribution | null {
  try {
    const session = sessionStorage.getItem(ATTRIBUTION_KEY)
    if (session) return JSON.parse(session)
    const days = getDb().settings.attributionDays
    const raw = localStorage.getItem(ATTRIBUTION_KEY)
    if (!raw || days === 0) return null
    const entry = JSON.parse(raw) as Attribution
    return differenceInCalendarDays(new Date(), new Date(entry.at)) <= days ? entry : null
  } catch {
    return null
  }
}

export function clearStoredReferral() {
  try {
    sessionStorage.removeItem(ATTRIBUTION_KEY)
    localStorage.removeItem(ATTRIBUTION_KEY)
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- bookings

export interface BookingInput {
  customerName: string
  phone: string
  email: string
  slotId: string
  visitors: number
  notes: string
  pickup: boolean
  pickupPoint: string
  plotsOfInterest: string[]
  refCode: string | null
  source: string | null
}

function assertSlotBookable(db: Db, slotId: string, ignoreBookingId?: string): Slot {
  const slot = db.slots.find((s) => s.id === slotId)
  if (!slot || !slot.active) throw new ApiError('That slot is no longer offered. Pick another time.', 'slotId')
  if (slotStart(slot) <= new Date()) throw new ApiError('That slot has already started. Pick a later time.', 'slotId')
  const taken = activeBookingCount(db, slot.id, ignoreBookingId)
  if (taken >= slot.capacity) throw new ApiError('That slot just filled up. Pick another time.', 'slotId')
  return slot
}

export async function createBooking(input: BookingInput): Promise<Booking> {
  await wait(450)
  const db = getDb()
  const s = db.settings
  const phone = normalisePhone(input.phone)
  const email = input.email.trim()
  if (input.customerName.trim().length < 3) throw new ApiError('Enter your full name.', 'customerName')
  if (!validPhone(phone)) throw new ApiError('Enter a 10-digit mobile number, like 98400 12345.', 'phone')
  if (s.emailRequired && !email) throw new ApiError('Enter your email address.', 'email')
  if (email && !validEmail(email)) throw new ApiError('Enter a valid email address, or leave it blank.', 'email')
  if (input.visitors < 1 || input.visitors > s.maxVisitors) throw new ApiError(`Choose between 1 and ${s.maxVisitors} visitors.`, 'visitors')
  if (input.pickup && !input.pickupPoint) throw new ApiError('Choose a pickup point.', 'pickupPoint')
  assertSlotBookable(db, input.slotId)

  // Duplicate visit: one upcoming visit per mobile number.
  const upcoming = db.bookings.find((b) => {
    if (b.phone !== phone || !['pending', 'confirmed', 'rescheduled'].includes(b.status)) return false
    const slot = db.slots.find((x) => x.id === b.slotId)
    return slot ? slotStart(slot) > new Date() : false
  })
  if (upcoming) throw new ApiError(`This number already has a visit booked (${upcoming.ref}). Use "Manage booking" to change it.`, 'phone')

  // Attribution is decided here, never trusted from the browser: the code must belong to an active broker.
  const referrer = input.refCode ? db.brokers.find((b) => b.referralCode === input.refCode!.toUpperCase() && b.status === 'active') : undefined
  // First touch wins: a customer who already came through another broker stays with that broker.
  const earlier = db.bookings
    .filter((b) => b.phone === phone && b.brokerId && b.status !== 'cancelled')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
  let brokerId = referrer?.id ?? null
  let claimantBrokerId: string | null = null
  if (earlier && referrer && earlier.brokerId !== referrer.id) {
    brokerId = earlier.brokerId
    claimantBrokerId = referrer.id
  } else if (earlier && !referrer) {
    brokerId = earlier.brokerId
  }

  let ref = newBookingRef()
  while (db.bookings.some((b) => b.ref === ref)) ref = newBookingRef()
  const at = nowIso()
  const status: BookingStatus = s.autoConfirm ? 'confirmed' : 'pending'
  const booking: Booking = {
    id: newId('bkg'),
    ref,
    customerName: input.customerName.trim(),
    phone,
    email,
    slotId: input.slotId,
    visitors: input.visitors,
    notes: input.notes.trim(),
    pickup: input.pickup,
    pickupPoint: input.pickup ? input.pickupPoint : '',
    plotsOfInterest: input.plotsOfInterest,
    brokerId,
    refCode: referrer?.referralCode ?? null,
    source: referrer ? input.source : null,
    claimantBrokerId,
    dispute: claimantBrokerId ? 'open' : 'none',
    status,
    history: s.autoConfirm
      ? [{ status: 'pending', at, by: 'customer' }, { status: 'confirmed', at, by: 'system', note: 'Auto-confirmed' }]
      : [{ status: 'pending', at, by: 'customer' }],
    checkedInAt: null,
    salesStage: 'none',
    createdAt: at,
  }

  mutate((d) => {
    d.bookings.unshift(booking)
    notify(d, 'admin', `New booking ${ref}`, `${booking.customerName} booked a visit${referrer ? ` via ${referrer.name}` : ''}.`, `/admin/bookings?open=${booking.id}`)
    if (brokerId) notify(d, brokerId, 'New booking from your link', `${booking.customerName} booked a site visit (${ref}).`, '/broker/bookings')
    if (claimantBrokerId) notify(d, 'admin', 'Possible duplicate lead', `${booking.customerName} already came through another broker. Review who gets credit.`, '/admin/disputes')
  })
  return booking
}

/** Public: confirmation page after booking. Exposes only what the customer just entered. */
export function getBookingByRef(ref: string) {
  return getDb().bookings.find((b) => b.ref === ref.trim().toUpperCase()) ?? null
}

/** Public: reference number + mobile number is the customer's proof of ownership. */
export async function findMyBooking(ref: string, phone: string) {
  await wait()
  const b = getBookingByRef(ref)
  if (!b || b.phone !== normalisePhone(phone)) throw new ApiError('No booking matches that reference and mobile number. Check both and try again.')
  return b
}

const CUSTOMER_EDITABLE: BookingStatus[] = ['pending', 'confirmed', 'rescheduled']

export async function customerReschedule(ref: string, phone: string, slotId: string) {
  const b = await findMyBooking(ref, phone)
  if (!CUSTOMER_EDITABLE.includes(b.status)) throw new ApiError('This booking can no longer be changed.')
  assertSlotBookable(getDb(), slotId, b.id)
  mutate((d) => {
    const x = d.bookings.find((y) => y.id === b.id)!
    x.slotId = slotId
    x.status = 'rescheduled'
    x.history.push({ status: 'rescheduled', at: nowIso(), by: 'customer', note: 'Customer picked a new slot' })
    notify(d, 'admin', `${x.ref} rescheduled by customer`, `${x.customerName} moved their visit.`, `/admin/bookings?open=${x.id}`)
    if (x.brokerId) notify(d, x.brokerId, 'A customer changed their visit time', `${x.customerName} (${x.ref}) picked a new slot.`, '/broker/bookings')
  })
}

export async function customerCancel(ref: string, phone: string, reason: string) {
  const b = await findMyBooking(ref, phone)
  if (!CUSTOMER_EDITABLE.includes(b.status)) throw new ApiError('This booking can no longer be changed.')
  mutate((d) => {
    const x = d.bookings.find((y) => y.id === b.id)!
    x.status = 'cancelled'
    x.history.push({ status: 'cancelled', at: nowIso(), by: 'customer', note: reason || 'Cancelled by customer' })
    notify(d, 'admin', `${x.ref} cancelled by customer`, reason || `${x.customerName} cancelled their visit.`, `/admin/bookings?open=${x.id}`)
    if (x.brokerId) notify(d, x.brokerId, 'A customer cancelled', `${x.customerName} (${x.ref}) cancelled their visit.`, '/broker/bookings')
  })
}

/** Which status changes an admin may make from each status. */
export const NEXT_STATUSES: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  rescheduled: ['confirmed', 'completed', 'no_show', 'cancelled'],
  completed: ['confirmed'],
  no_show: ['confirmed', 'completed'],
  cancelled: ['confirmed'],
}

export async function setBookingStatus(bookingIds: string[], status: BookingStatus, note?: string) {
  requireAdmin()
  await wait()
  const db = getDb()
  const skipped: string[] = []
  const now = new Date()
  mutate((d) => {
    for (const id of bookingIds) {
      const b = d.bookings.find((x) => x.id === id)
      if (!b) continue
      const slot = db.slots.find((s) => s.id === b.slotId)
      const visitStarted = slot ? slotStart(slot) <= now : false
      const allowed = NEXT_STATUSES[b.status].includes(status) && (!['completed', 'no_show'].includes(status) || visitStarted)
      if (!allowed) {
        skipped.push(b.ref)
        continue
      }
      b.status = status
      b.history.push({ status, at: nowIso(), by: 'admin', note })
      if (status === 'completed' && !b.checkedInAt) b.checkedInAt = nowIso()
      if (b.brokerId && ['confirmed', 'completed', 'cancelled'].includes(status)) {
        const label = status === 'completed' ? 'Visit completed' : status === 'confirmed' ? 'Visit confirmed' : 'Visit cancelled'
        notify(d, b.brokerId, label, `${b.customerName} (${b.ref})`, '/broker/bookings')
      }
    }
  })
  return { updated: bookingIds.length - skipped.length, skipped }
}

export async function adminReschedule(bookingId: string, slotId: string, note: string) {
  requireAdmin()
  await wait()
  const db = getDb()
  assertSlotBookable(db, slotId, bookingId)
  mutate((d) => {
    const b = d.bookings.find((x) => x.id === bookingId)!
    b.slotId = slotId
    b.status = 'rescheduled'
    b.history.push({ status: 'rescheduled', at: nowIso(), by: 'admin', note: note || 'Moved by site office' })
    if (b.brokerId) notify(d, b.brokerId, 'Visit rescheduled', `${b.customerName} (${b.ref}) has a new visit time.`, '/broker/bookings')
  })
}

export async function setSalesStage(bookingId: string, stage: SalesStage) {
  requireAdmin()
  await wait(150)
  mutate((d) => {
    d.bookings.find((x) => x.id === bookingId)!.salesStage = stage
  })
}

/** Site team check-in: reference number from the QR pass, or the customer's mobile number. */
export async function checkIn(query: string) {
  requireAdmin()
  await wait()
  const db = getDb()
  const q = query.trim().toUpperCase()
  const phone = normalisePhone(query)
  const today = new Date().toDateString()
  const candidates = db.bookings.filter((b) => b.ref === q || (validPhone(phone) && b.phone === phone))
  if (!candidates.length) throw new ApiError('No booking found for that reference or mobile number.')
  const b =
    candidates.find((x) => {
      const slot = db.slots.find((s) => s.id === x.slotId)
      return slot && slotStart(slot).toDateString() === today && CUSTOMER_EDITABLE.includes(x.status)
    }) ?? candidates[0]
  const slot = db.slots.find((s) => s.id === b.slotId)!
  if (b.status === 'completed') throw new ApiError(`${b.customerName} is already checked in (${b.ref}).`)
  if (!CUSTOMER_EDITABLE.includes(b.status)) throw new ApiError(`${b.ref} is ${b.status.replace('_', '-')} and cannot be checked in.`)
  if (slotStart(slot).toDateString() !== today) throw new ApiError(`${b.ref} is booked for another day (${slot.date}). Reschedule it first.`)
  mutate((d) => {
    const x = d.bookings.find((y) => y.id === b.id)!
    x.status = 'completed'
    x.checkedInAt = nowIso()
    x.history.push({ status: 'completed', at: nowIso(), by: 'site-team', note: 'Checked in at site' })
    if (x.brokerId) notify(d, x.brokerId, 'Your customer arrived at site', `${x.customerName} (${x.ref}) checked in.`, '/broker/bookings')
  })
  return getDb().bookings.find((x) => x.id === b.id)!
}

export async function resolveDispute(bookingId: string, decision: 'kept_first' | 'moved_to_claimant') {
  requireAdmin()
  await wait()
  mutate((d) => {
    const b = d.bookings.find((x) => x.id === bookingId)!
    if (decision === 'moved_to_claimant' && b.claimantBrokerId) {
      const previous = b.brokerId
      b.brokerId = b.claimantBrokerId
      b.claimantBrokerId = previous
    }
    b.dispute = decision
    if (b.brokerId) notify(d, b.brokerId, 'Lead credit confirmed', `${b.customerName} (${b.ref}) is credited to you.`, '/broker/bookings')
  })
}

// ---------------------------------------------------------------- brokers (admin)

export async function setBrokerStatus(brokerId: string, status: Broker['status']) {
  requireAdmin()
  await wait()
  mutate((d) => {
    const b = d.brokers.find((x) => x.id === brokerId)!
    b.status = status
    b.updatedAt = nowIso()
    if (status === 'active') notify(d, b.id, 'Your account is approved', 'Your referral link is live. Share it to start getting bookings.', '/broker/share')
  })
}

export async function regenerateReferralCode(brokerId: string) {
  requireAdmin()
  await wait()
  let code = newReferralCode()
  while (getDb().brokers.some((b) => b.referralCode === code)) code = newReferralCode()
  mutate((d) => {
    const b = d.brokers.find((x) => x.id === brokerId)!
    b.referralCode = code
    b.updatedAt = nowIso()
    notify(d, b.id, 'Your referral link changed', 'The site office issued you a new link. Old links no longer give you credit.', '/broker/share')
  })
  return code
}

// ---------------------------------------------------------------- slots (admin)

export async function upsertSlot(slot: Omit<Slot, 'id'> & { id?: string }) {
  requireAdmin()
  await wait()
  if (slot.end <= slot.start) throw new ApiError('The end time must be after the start time.', 'end')
  if (slot.capacity < 1) throw new ApiError('Capacity must be at least 1.', 'capacity')
  const db = getDb()
  const clash = db.slots.find((s) => s.id !== slot.id && s.date === slot.date && s.start < slot.end && slot.start < s.end)
  if (clash) throw new ApiError(`This overlaps the ${clash.start}–${clash.end} slot on the same day.`, 'start')
  if (slot.id) {
    const taken = activeBookingCount(db, slot.id)
    if (slot.capacity < taken) throw new ApiError(`${taken} visits are already booked. Capacity cannot go below that.`, 'capacity')
  }
  mutate((d) => {
    if (slot.id) Object.assign(d.slots.find((s) => s.id === slot.id)!, slot)
    else d.slots.push({ ...slot, id: newId('slt') })
    d.slots.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  })
}

export async function createSlotsInRange(dates: string[], times: { start: string; end: string }[], capacity: number) {
  requireAdmin()
  await wait()
  const db = getDb()
  let created = 0
  let skipped = 0
  mutate((d) => {
    for (const date of dates) {
      for (const t of times) {
        if (db.slots.some((s) => s.date === date && s.start < t.end && t.start < s.end)) {
          skipped++
          continue
        }
        d.slots.push({ id: newId('slt'), date, start: t.start, end: t.end, capacity, active: true })
        created++
      }
    }
    d.slots.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  })
  return { created, skipped }
}

export async function setSlotsActive(slotIds: string[], active: boolean) {
  requireAdmin()
  await wait()
  mutate((d) => {
    for (const s of d.slots) if (slotIds.includes(s.id)) s.active = active
  })
}

export async function deleteSlot(slotId: string) {
  requireAdmin()
  await wait()
  if (getDb().bookings.some((b) => b.slotId === slotId)) throw new ApiError('This slot has bookings. Turn it off instead so existing visits are kept.')
  mutate((d) => {
    d.slots = d.slots.filter((s) => s.id !== slotId)
  })
}

// ---------------------------------------------------------------- plots, settings, notifications

export async function setPlotStatus(plotId: string, status: PlotStatus) {
  requireAdmin()
  await wait(150)
  mutate((d) => {
    d.plots.find((p) => p.id === plotId)!.status = status
  })
}

export async function updateSettings(patch: Partial<Settings>) {
  requireAdmin()
  await wait()
  mutate((d) => {
    d.settings = { ...d.settings, ...patch }
  })
}

export function markNotificationsRead(audience: string) {
  mutate((d) => {
    for (const n of d.notifications) if (n.audience === audience) n.read = true
  })
}
