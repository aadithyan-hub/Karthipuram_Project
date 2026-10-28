import { useSyncExternalStore } from 'react'
import { createSeed, DB_VERSION } from './seed'
import type { Db, Session } from './types'

/**
 * The prototype's "database": one JSON document in localStorage.
 * Every change is broadcast to other open tabs, so a booking made through a
 * referral link in one tab shows up live on the admin dashboard in another.
 */
const DB_KEY = 'kp.db'
const SESSION_KEY = 'kp.session'
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kp-db') : null

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or full storage: the demo keeps working in memory.
  }
}

function load(): Db {
  const stored = readStorage<Db>(DB_KEY)
  if (stored && stored.version === DB_VERSION) return stored
  const fresh = createSeed()
  writeStorage(DB_KEY, fresh)
  return fresh
}

let db: Db = load()
let session: Session | null = readStorage<Session>(SESSION_KEY)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

channel?.addEventListener('message', (e) => {
  if (e.data === 'db') db = load()
  if (e.data === 'session') session = readStorage<Session>(SESSION_KEY)
  emit()
})

export function getDb() {
  return db
}

/** Apply a change to a draft copy, persist it, and notify every subscriber and tab. */
export function mutate(recipe: (draft: Db) => void) {
  const draft = structuredClone(db)
  recipe(draft)
  db = draft
  writeStorage(DB_KEY, db)
  channel?.postMessage('db')
  emit()
}

export function resetDb() {
  db = createSeed()
  writeStorage(DB_KEY, db)
  channel?.postMessage('db')
  emit()
}

export function getSession() {
  return session
}

export function setSession(next: Session | null) {
  session = next
  writeStorage(SESSION_KEY, next)
  channel?.postMessage('session')
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDb(): Db {
  return useSyncExternalStore(subscribe, getDb)
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession)
}
