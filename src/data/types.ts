export type BrokerStatus = 'pending' | 'active' | 'disabled'

export interface Broker {
  id: string
  name: string
  phone: string
  email: string
  agency: string
  city: string
  referralCode: string
  status: BrokerStatus
  /** Prototype only. A real backend stores a salted hash, never the password. */
  password: string
  createdAt: string
  updatedAt: string
}

export interface Slot {
  id: string
  /** yyyy-MM-dd */
  date: string
  /** HH:mm, 24h */
  start: string
  end: string
  capacity: number
  active: boolean
}

export type BookingStatus = 'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed' | 'no_show'

/** Phase 2 preview: what happens after a completed visit. */
export type SalesStage = 'none' | 'interested' | 'negotiation' | 'token' | 'sold' | 'dropped'

export type Actor = 'customer' | 'admin' | 'system' | 'site-team'

export interface StatusEvent {
  status: BookingStatus
  at: string
  by: Actor
  note?: string
}

export type DisputeState = 'none' | 'open' | 'kept_first' | 'moved_to_claimant'

export interface Booking {
  id: string
  ref: string
  customerName: string
  phone: string
  email: string
  slotId: string
  visitors: number
  notes: string
  pickup: boolean
  pickupPoint: string
  plotsOfInterest: string[]
  /** Broker credited with the booking (first touch). Null for walk-in/direct bookings. */
  brokerId: string | null
  /** Referral code the customer arrived with on this booking. */
  refCode: string | null
  /** Campaign tag from the referral link, e.g. whatsapp, flyer. */
  source: string | null
  /** Set when another broker's link brought in a customer who already belongs to a broker. */
  claimantBrokerId: string | null
  dispute: DisputeState
  status: BookingStatus
  history: StatusEvent[]
  checkedInAt: string | null
  salesStage: SalesStage
  createdAt: string
}

export type PlotStatus = 'available' | 'reserved' | 'sold'
export type Facing = 'North' | 'South' | 'East' | 'West'

export interface Plot {
  id: string
  block: string
  number: number
  areaSqft: number
  facing: Facing
  corner: boolean
  status: PlotStatus
  x: number
  y: number
  w: number
  h: number
}

export interface LinkClick {
  id: string
  refCode: string
  source: string | null
  at: string
}

export interface ProjectInfo {
  name: string
  tagline: string
  location: string
  address: string
  phone: string
  whatsapp: string
  email: string
  pricePerSqft: number
  approval: string
  mapsUrl: string
}

export interface Settings {
  requireBrokerApproval: boolean
  autoConfirm: boolean
  emailRequired: boolean
  /** How long a referral link keeps credit on this device, in days. 0 = this booking only. */
  attributionDays: number
  maxVisitors: number
  defaultCapacity: number
  /** 0 = Sunday ... 6 = Saturday */
  operatingDays: number[]
  slotTimes: { start: string; end: string }[]
  pickupPoints: string[]
  project: ProjectInfo
}

export interface Notification {
  id: string
  /** 'admin' or a broker id */
  audience: string
  title: string
  body: string
  at: string
  read: boolean
  link?: string
}

export interface Db {
  version: number
  brokers: Broker[]
  slots: Slot[]
  bookings: Booking[]
  plots: Plot[]
  clicks: LinkClick[]
  notifications: Notification[]
  settings: Settings
}

export type Session = { role: 'admin'; id: 'admin' } | { role: 'broker'; id: string }
