import { addDays, format, startOfDay } from 'date-fns'
import { CalendarX2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SlotView } from '@/data/queries'
import { slotRange } from '@/lib/format'
import { cn, EmptyState } from './ui'

/**
 * Date strip + time slots. Shows every active future slot so customers can see
 * which ones are full, but only lets them pick one with seats left.
 */
export function SlotPicker({
  slots,
  value,
  onChange,
  days = 28,
  invalid,
  excludeSlotId,
}: {
  slots: SlotView[]
  value: string | null
  onChange: (slotId: string) => void
  days?: number
  invalid?: boolean
  excludeSlotId?: string
}) {
  const now = new Date()
  const byDate = useMemo(() => {
    const map = new Map<string, SlotView[]>()
    for (const s of slots) {
      if (!s.active || s.startsAt <= now) continue
      const list = map.get(s.date) ?? []
      list.push(s)
      map.set(s.date, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start))
    return map
  }, [slots])

  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(startOfDay(new Date()), i)), [days])
  const selectedSlot = slots.find((s) => s.id === value)
  const firstOpen = dates.find((d) => (byDate.get(format(d, 'yyyy-MM-dd')) ?? []).some((s) => s.remaining > 0 && s.id !== excludeSlotId))
  const [date, setDate] = useState(() => selectedSlot?.date ?? (firstOpen ? format(firstOpen, 'yyyy-MM-dd') : format(dates[0], 'yyyy-MM-dd')))
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    stripRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [date])

  const daySlots = byDate.get(date) ?? []

  return (
    <div className={cn('rounded-panel border bg-white', invalid ? 'border-brick-500' : 'border-line')}>
      <div ref={stripRef} className="flex gap-1.5 overflow-x-auto border-b border-line-soft p-2 scrollbar-thin" role="listbox" aria-label="Visit date">
        {dates.map((d) => {
          const key = format(d, 'yyyy-MM-dd')
          const list = byDate.get(key) ?? []
          const open = list.reduce((s, x) => s + (x.id === excludeSlotId ? 0 : x.remaining), 0)
          const closed = list.length === 0
          const active = key === date
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              disabled={closed}
              onClick={() => setDate(key)}
              className={cn(
                'flex w-[60px] shrink-0 flex-col items-center rounded-field py-2 transition-colors',
                active ? 'bg-ink text-paper' : closed ? 'text-ink-3/50' : 'text-ink hover:bg-paper-2',
              )}
            >
              <span className={cn('text-[11px] font-semibold', active ? 'text-paper/70' : 'text-ink-3')}>{format(d, 'EEE')}</span>
              <span className="font-display text-lg leading-tight font-semibold tabular">{format(d, 'd')}</span>
              <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', closed ? 'bg-transparent' : open === 0 ? 'bg-brick-500' : open <= 4 ? 'bg-turmeric-400' : 'bg-paddy-500')} />
            </button>
          )
        })}
      </div>
      <div className="p-3 sm:p-4">
        <p className="mb-3 text-sm font-semibold text-ink">{format(new Date(`${date}T00:00:00`), 'EEEE, d MMMM')}</p>
        {daySlots.length === 0 ? (
          <EmptyState icon={<CalendarX2 />} title="No visits on this day" body="The site office is closed or no slots are open yet. Pick another date." className="py-6" />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Time slot">
            {daySlots.map((s) => {
              const isCurrent = s.id === excludeSlotId
              const full = s.remaining <= 0 || isCurrent
              const selected = s.id === value
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={full}
                  onClick={() => onChange(s.id)}
                  className={cn(
                    'flex flex-col items-start rounded-field border px-3 py-2.5 text-left transition-colors',
                    selected ? 'border-paddy-600 bg-paddy-50 ring-1 ring-paddy-600' : full ? 'border-line-soft bg-paper text-ink-3' : 'border-line hover:border-paddy-500',
                  )}
                >
                  <span className={cn('text-sm font-semibold', full && 'line-through decoration-ink-3/40')}>{slotRange(s)}</span>
                  <span className={cn('mt-0.5 text-xs', selected ? 'text-paddy-700' : full ? 'text-ink-3' : s.remaining <= 2 ? 'font-semibold text-turmeric-800' : 'text-ink-3')}>
                    {isCurrent ? 'Your current slot' : full ? 'Full' : s.remaining <= 2 ? `Only ${s.remaining} left` : `${s.remaining} spots left`}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
