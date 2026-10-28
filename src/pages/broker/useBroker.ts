import { useDb, useSession } from '@/data/store'
import type { Broker } from '@/data/types'

/** The signed-in broker. BrokerLayout guarantees one exists before these pages render. */
export function useBroker(): Broker {
  const session = useSession()
  const db = useDb()
  return db.brokers.find((b) => session?.role === 'broker' && b.id === session.id)!
}

export function shareMessage(projectName: string, link: string) {
  return `Hi! I'd like to invite you for a free site visit to ${projectName}. Pick a date and time that suits you here: ${link}\n\nThe site team will show you the available plots and answer your questions.`
}
