import { addDays, format, getDay, setHours, setMinutes, subDays, subHours, addHours } from 'date-fns'
import { newBookingRef, newId, newReferralCode, seededRng, type Rng } from './ids'
import { buildPlots } from './plots'
import type { Booking, BookingStatus, Broker, Db, LinkClick, Notification, SalesStage, Settings, Slot, StatusEvent } from './types'

export const DB_VERSION = 3

export const DEMO_ADMIN = { email: 'admin@karthipuram.demo', password: 'admin123', name: 'Site Admin' }
export const DEMO_BROKER_PASSWORD = 'broker123'

export const defaultSettings: Settings = {
  requireBrokerApproval: true,
  autoConfirm: false,
  emailRequired: false,
  attributionDays: 30,
  maxVisitors: 6,
  defaultCapacity: 8,
  operatingDays: [0, 1, 3, 4, 5, 6], // closed Tuesdays
  slotTimes: [
    { start: '09:30', end: '10:30' },
    { start: '11:00', end: '12:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:30', end: '17:30' },
  ],
  pickupPoints: ['Chengalpattu bus stand', 'Kanchipuram railway station', 'Tambaram (West) bus stop', 'Sriperumbudur junction'],
  project: {
    name: 'Karthipuram Plots',
    tagline: 'DTCP-approved residential plots, open for site visits every day except Tuesday.',
    location: 'Karthipuram',
    address: 'Survey No. 214, Karthipuram Main Road (sample address — update in Settings)',
    phone: '+91 98400 12345',
    whatsapp: '919840012345',
    email: 'visits@karthipuram.example',
    pricePerSqft: 1850,
    approval: 'DTCP approval no. 000/2025 (sample)',
    mapsUrl: 'https://maps.google.com/?q=Karthipuram',
  },
}

const FIRST = ['Arun', 'Bharath', 'Chitra', 'Deepa', 'Ezhil', 'Gokul', 'Hari', 'Indhu', 'Jeeva', 'Kavitha', 'Lakshmi', 'Manoj', 'Nandhini', 'Prakash', 'Priya', 'Rajesh', 'Saranya', 'Senthil', 'Sowmya', 'Suresh', 'Tamil', 'Uma', 'Vignesh', 'Vijay', 'Yamini', 'Karthik', 'Meena', 'Dinesh', 'Anitha', 'Murugan', 'Revathi', 'Balaji', 'Gayathri', 'Ramesh', 'Divya', 'Sathish', 'Keerthana', 'Prabhu', 'Malathi', 'Ashok']
const LAST = ['Kumar', 'Raman', 'Selvam', 'Natarajan', 'Subramanian', 'Krishnan', 'Pandian', 'Murugesan', 'Rajendran', 'Ganesan', 'Velu', 'Sundaram', 'Anand', 'Mani', 'Shankar', 'Balan']
const AGENCIES = ['Sri Balaji Realtors', 'Vetri Properties', 'Annai Land Promoters', 'Kaveri Homes & Plots', 'Thirumalai Estates', 'Green Acre Associates', 'Murugan Land Links', 'Independent', 'Lakshmi Realty', 'Royal Plot Consultants']
const CITIES = ['Chennai', 'Kanchipuram', 'Chengalpattu', 'Tambaram', 'Sriperumbudur', 'Tiruvallur', 'Vellore', 'Arakkonam']
const NOTES = [
  'Looking for an east-facing plot.',
  'Coming with parents, need a slow walk-through.',
  'Want to see corner plots near the park.',
  'Please share approval documents during the visit.',
  'Interested in two adjacent plots.',
  'Need home-loan guidance.',
  '',
  '',
  '',
]

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]
}

function phone(rng: Rng) {
  const first = pick(rng, ['9', '8', '7', '6'])
  let rest = ''
  for (let i = 0; i < 9; i++) rest += Math.floor(rng() * 10)
  return first + rest
}

function weightedIndex(rng: Rng, weights: number[]) {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return weights.length - 1
}

function at(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return setMinutes(setHours(date, h), m)
}

export function createSeed(now = new Date()): Db {
  const rng = seededRng(20261028)
  const settings: Settings = structuredClone(defaultSettings)

  // Brokers: a handful of strong performers and a long tail, like real channel partners.
  const brokers: Broker[] = []
  const brokerCount = 22
  for (let i = 0; i < brokerCount; i++) {
    const name = `${pick(rng, FIRST)} ${pick(rng, LAST)}`
    const created = subDays(now, 20 + Math.floor(rng() * 160))
    const status = i === 19 || i === 20 ? 'pending' : i === 21 ? 'disabled' : 'active'
    brokers.push({
      id: newId('brk', rng),
      name,
      phone: phone(rng),
      email: `${name.toLowerCase().replace(/\s+/g, '.')}${i}@example.com`,
      agency: pick(rng, AGENCIES),
      city: pick(rng, CITIES),
      referralCode: newReferralCode(rng),
      status,
      password: DEMO_BROKER_PASSWORD,
      createdAt: (status === 'pending' ? subDays(now, 1 + i - 19) : created).toISOString(),
      updatedAt: created.toISOString(),
    })
  }
  // A known login for demos.
  brokers[0] = { ...brokers[0], name: 'Senthil Kumar', email: 'senthil@broker.demo', phone: '9840011111', agency: 'Sri Balaji Realtors', city: 'Kanchipuram' }
  const earningBrokers = brokers.filter((b) => b.status !== 'pending')
  const brokerWeights = earningBrokers.map((_, i) => (i === 0 ? 9 : Math.max(0.6, 7 / (i + 1))))

  // Slots: 60 days back, 35 days ahead.
  const slots: Slot[] = []
  for (let d = -60; d <= 35; d++) {
    const day = addDays(now, d)
    if (!settings.operatingDays.includes(getDay(day))) continue
    const weekend = [0, 6].includes(getDay(day))
    for (const t of settings.slotTimes) {
      slots.push({
        id: newId('slt', rng),
        date: format(day, 'yyyy-MM-dd'),
        start: t.start,
        end: t.end,
        capacity: weekend ? 12 : settings.defaultCapacity,
        active: !(d > 20 && rng() < 0.05),
      })
    }
  }

  const bookings: Booking[] = []
  const usedPhones: { phone: string; name: string; brokerId: string | null }[] = []

  for (const slot of slots) {
    const start = at(new Date(`${slot.date}T00:00:00`), slot.start)
    const daysAway = (start.getTime() - now.getTime()) / 86400000
    const weekend = [0, 6].includes(getDay(start))
    let expected = weekend ? 3.2 : 1.4
    if (daysAway > 0) expected *= Math.max(0.15, 1 - daysAway / 30)
    const count = Math.min(slot.capacity, Math.floor(expected + rng() * expected))
    for (let k = 0; k < count; k++) {
      const viaBroker = rng() > 0.14
      const broker = viaBroker ? earningBrokers[weightedIndex(rng, brokerWeights)] : null
      const created = subHours(start, 6 + Math.floor(rng() * 24 * 9))
      const createdAt = created > now ? subHours(now, 1 + Math.floor(rng() * 40)) : created
      const name = `${pick(rng, FIRST)} ${pick(rng, LAST)}`
      const ph = phone(rng)
      usedPhones.push({ phone: ph, name, brokerId: broker?.id ?? null })

      const history: StatusEvent[] = [{ status: 'pending', at: createdAt.toISOString(), by: 'customer' }]
      let status = 'pending' as BookingStatus
      const push = (s: BookingStatus, when: Date, by: StatusEvent['by'], note?: string) => {
        status = s
        history.push({ status: s, at: (when > now ? now : when).toISOString(), by, note })
      }

      if (daysAway < -0.1) {
        push('confirmed', addHours(createdAt, 2 + rng() * 10), 'admin')
        const r = rng()
        if (daysAway > -2.5 && r < 0.3) {
          // Recent visits the team has not closed out yet.
        } else if (r < 0.64) {
          if (rng() < 0.12) push('rescheduled', addHours(createdAt, 20), 'admin', 'Customer asked for a later slot')
          push('completed', addHours(start, 1), 'site-team')
        } else if (r < 0.8) push('no_show', addHours(start, 2), 'admin', 'Did not arrive; phone unanswered')
        else push('cancelled', subHours(start, 10), pick(rng, ['customer', 'admin'] as const), pick(rng, ['Change of plans', 'Travel issue', 'Booked a different slot']))
      } else {
        const r = rng()
        if (r < 0.5) push('confirmed', addHours(createdAt, 3), 'admin')
        else if (r < 0.58) {
          push('confirmed', addHours(createdAt, 3), 'admin')
          push('rescheduled', addHours(createdAt, 30), 'admin', 'Moved at customer request')
        } else if (r < 0.65) push('cancelled', addHours(createdAt, 26), 'customer', 'Change of plans')
      }

      let salesStage: SalesStage = 'none'
      if (status === 'completed') {
        const s = rng()
        salesStage = s < 0.12 ? 'sold' : s < 0.2 ? 'token' : s < 0.32 ? 'negotiation' : s < 0.62 ? 'interested' : s < 0.85 ? 'dropped' : 'none'
      }

      bookings.push({
        id: newId('bkg', rng),
        ref: newBookingRef(rng),
        customerName: name,
        phone: ph,
        email: rng() < 0.55 ? `${name.split(' ')[0].toLowerCase()}${Math.floor(rng() * 90 + 10)}@example.com` : '',
        slotId: slot.id,
        visitors: 1 + Math.floor(rng() * 4),
        notes: pick(rng, NOTES),
        pickup: rng() < 0.22,
        pickupPoint: '',
        plotsOfInterest: [],
        brokerId: broker?.id ?? null,
        refCode: broker?.referralCode ?? null,
        source: broker ? pick(rng, ['whatsapp', 'whatsapp', 'whatsapp', 'facebook', 'flyer', null]) : null,
        claimantBrokerId: null,
        dispute: 'none',
        status,
        history,
        checkedInAt: status === 'completed' ? addHours(start, 0.2).toISOString() : null,
        salesStage,
        createdAt: createdAt.toISOString(),
      })
    }
  }

  const plots = buildPlots(rng)
  const open = plots.filter((p) => p.status !== 'sold')
  for (const b of bookings) {
    if (b.pickup) b.pickupPoint = pick(rng, settings.pickupPoints)
    if (rng() < 0.35) b.plotsOfInterest = [pick(rng, open).id]
  }

  // Duplicate-lead disputes: an existing customer arrives again through a different broker.
  const upcoming = bookings.filter((b) => ['pending', 'confirmed'].includes(b.status) && b.createdAt > subDays(now, 6).toISOString())
  for (let i = 0; i < 4 && i < upcoming.length; i++) {
    const b = upcoming[(i * 7) % upcoming.length]
    const original = usedPhones.find((p) => p.brokerId && p.brokerId !== b.brokerId && p.phone !== b.phone)
    if (!original) continue
    const firstBooking = bookings.find((x) => x.phone === original.phone)
    if (!firstBooking) continue
    b.phone = original.phone
    b.customerName = original.name
    b.claimantBrokerId = b.brokerId
    b.brokerId = firstBooking.brokerId
    b.dispute = 'open'
    usedPhones.splice(usedPhones.indexOf(original), 1)
  }

  const clicks: LinkClick[] = []
  for (const b of bookings) {
    if (!b.refCode) continue
    const extra = 2 + Math.floor(rng() * 4)
    for (let i = 0; i < extra; i++) {
      clicks.push({ id: newId('clk', rng), refCode: b.refCode, source: b.source, at: subHours(new Date(b.createdAt), rng() * 72).toISOString() })
    }
  }

  const notifications: Notification[] = [
    { id: newId('ntf', rng), audience: 'admin', title: '2 brokers waiting for approval', body: `${brokers[19].name} and ${brokers[20].name} signed up and need approval before their links work.`, at: subHours(now, 3).toISOString(), read: false, link: '/admin/brokers?status=pending' },
    { id: newId('ntf', rng), audience: 'admin', title: 'Possible duplicate leads', body: 'Some customers booked again through a different broker. Review who gets credit.', at: subHours(now, 5).toISOString(), read: false, link: '/admin/disputes' },
    { id: newId('ntf', rng), audience: brokers[0].id, title: 'Welcome back', body: 'Share your link on WhatsApp — most of your bookings come from there.', at: subHours(now, 20).toISOString(), read: false, link: '/broker/share' },
  ]

  bookings.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { version: DB_VERSION, brokers, slots, bookings, plots, clicks, notifications, settings }
}
