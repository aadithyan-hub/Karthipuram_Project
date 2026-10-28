import { addDays, addWeeks, format, isToday, startOfDay, startOfWeek } from 'date-fns'
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Power, PowerOff, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button, Checkbox, cn, IconButton, PageHeader, Segmented, Stat } from '@/components/ui'
import { ApiError, setSlotsActive } from '@/data/api'
import { slotViews, type SlotView } from '@/data/queries'
import { useDb } from '@/data/store'
import { pct, slotRange, time12 } from '@/lib/format'
import { BulkSlotsModal, SlotModal } from './mgmtSlotModals'

type View = '1w' | '2w'

export default function Slots() {
  const db = useDb()
  const [view, setView] = useState<View>('1w')
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<SlotView | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [bulk, setBulk] = useState(false)
  const [busy, setBusy] = useState(false)

  const dayCount = view === '1w' ? 7 : 14
  const days = useMemo(() => Array.from({ length: dayCount }, (_, i) => addDays(anchor, i)), [anchor, dayCount])
  const all = useMemo(() => slotViews(db), [db])
  const byDate = useMemo(() => {
    const map = new Map<string, SlotView[]>()
    for (const s of all) {
      const list = map.get(s.date) ?? []
      list.push(s)
      map.set(s.date, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start))
    return map
  }, [all])

  const visible = days.flatMap((d) => byDate.get(format(d, 'yyyy-MM-dd')) ?? [])
  const now = new Date()
  const activeVisible = visible.filter((s) => s.active)
  const capacity = activeVisible.reduce((s, x) => s + x.capacity, 0)
  const booked = activeVisible.reduce((s, x) => s + x.booked, 0)
  const openSeats = activeVisible.filter((s) => s.startsAt > now).reduce((s, x) => s + x.remaining, 0)
  const offCount = visible.filter((s) => !s.active).length

  const toggle = (id: string) => setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]))
  const selectableIn = (list: SlotView[]) => list.filter((s) => s.startsAt > now).map((s) => s.id)

  async function setActive(active: boolean) {
    setBusy(true)
    try {
      await setSlotsActive(selected, active)
      toast.success(`${selected.length} ${selected.length === 1 ? 'slot' : 'slots'} turned ${active ? 'on' : 'off'}`)
      setSelected([])
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const rangeLabel = `${format(days[0], 'd MMM')} – ${format(days[days.length - 1], 'd MMM yyyy')}`

  return (
    <>
      <PageHeader
        title="Visit slots"
        description="The dates and times customers can book. Turn slots off for holidays, or open new weeks in bulk."
        actions={
          <>
            <Button variant="secondary" icon={<Plus />} onClick={() => setAdding(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}>
              Add slot
            </Button>
            <Button icon={<CalendarPlus />} onClick={() => setBulk(true)}>
              Open dates in bulk
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open places left" value={openSeats} sub="In upcoming slots shown" tone="green" />
        <Stat label="Booked" value={booked} sub={`Of ${capacity} places`} tone="blue" />
        <Stat label="Fill rate" value={capacity ? pct(booked / capacity) : '—'} sub="Booked ÷ capacity" tone="amber" />
        <Stat label="Slots turned off" value={offCount} sub="Hidden from customers" tone="ink" />
      </div>

      <section className="rounded-panel border border-line-soft bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
          <div className="flex items-center gap-1">
            <IconButton label="Previous" onClick={() => setAnchor((a) => addWeeks(a, view === '1w' ? -1 : -2))}>
              <ChevronLeft />
            </IconButton>
            <IconButton label="Next" onClick={() => setAnchor((a) => addWeeks(a, view === '1w' ? 1 : 2))}>
              <ChevronRight />
            </IconButton>
            <h2 className="ml-1 text-[15px] font-semibold tabular">{rangeLabel}</h2>
            <Button variant="ghost" size="sm" className="ml-1" onClick={() => setAnchor(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Today
            </Button>
          </div>
          <Segmented size="sm" value={view} onChange={setView} options={[{ value: '1w', label: '1 week' }, { value: '2w', label: '2 weeks' }]} />
        </header>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-paddy-50 px-4 py-2.5 sm:px-5">
            <span className="mr-auto text-sm font-semibold text-paddy-800">
              {selected.length} {selected.length === 1 ? 'slot' : 'slots'} selected
            </span>
            <Button size="sm" variant="secondary" icon={<PowerOff />} loading={busy} onClick={() => setActive(false)}>
              Turn off
            </Button>
            <Button size="sm" variant="secondary" icon={<Power />} loading={busy} onClick={() => setActive(true)}>
              Turn on
            </Button>
            <IconButton label="Clear selection" onClick={() => setSelected([])}>
              <X />
            </IconButton>
          </div>
        )}

        <div className={cn('grid divide-line-soft lg:grid-cols-7 lg:divide-x', view === '2w' && 'lg:[&>*:nth-child(n+8)]:border-t lg:[&>*:nth-child(n+8)]:border-line-soft')}>
          {days.map((d) => {
            const key = format(d, 'yyyy-MM-dd')
            const list = byDate.get(key) ?? []
            const past = startOfDay(d) < startOfDay(now)
            const selectable = selectableIn(list)
            const allSelected = selectable.length > 0 && selectable.every((id) => selected.includes(id))
            return (
              <div key={key} className={cn('min-w-0 border-b border-line-soft p-3 lg:border-b-0', past && 'bg-paper/60')}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className={cn('text-sm font-semibold', isToday(d) ? 'text-paddy-700' : past ? 'text-ink-3' : 'text-ink')}>
                    {format(d, 'EEE d')}
                    <span className="font-normal text-ink-3 lg:hidden"> {format(d, 'MMMM')}</span>
                    {isToday(d) && <span className="ml-1.5 rounded bg-paddy-100 px-1.5 py-0.5 text-[10px] font-bold text-paddy-700">Today</span>}
                  </p>
                  {selectable.length > 0 && (
                    <Checkbox
                      label={`Select all slots on ${format(d, 'd MMMM')}`}
                      checked={allSelected}
                      indeterminate={!allSelected && selectable.some((id) => selected.includes(id))}
                      onChange={(v) => setSelected((sel) => (v ? [...new Set([...sel, ...selectable])] : sel.filter((id) => !selectable.includes(id))))}
                    />
                  )}
                </div>
                {list.length === 0 ? (
                  past ? (
                    <p className="py-2 text-xs text-ink-3">No slots</p>
                  ) : (
                    <button type="button" onClick={() => setAdding(key)} className="flex w-full items-center justify-center gap-1.5 rounded-field border border-dashed border-line py-3 text-xs font-semibold text-ink-3 hover:border-paddy-500 hover:text-paddy-700">
                      <Plus className="size-3.5" /> Add slot
                    </button>
                  )
                ) : (
                  <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-1">
                    {list.map((s) => (
                      <li key={s.id}>
                        <SlotCell slot={s} selected={selected.includes(s.id)} onToggle={() => toggle(s.id)} onOpen={() => setEditing(s)} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
        <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line-soft px-4 py-3 text-xs text-ink-3 sm:px-5">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-full bg-paddy-500" /> Places booked</span>
          <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded border border-dashed border-ink-3/60" /> Turned off</span>
          <span>Select upcoming slots to turn them on or off together.</span>
        </footer>
      </section>

      {editing && <SlotModal slot={all.find((s) => s.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
      {adding && <SlotModal slot={null} defaults={{ date: adding }} onClose={() => setAdding(null)} />}
      {bulk && <BulkSlotsModal defaultFrom={days.find((d) => d > now) ?? undefined} onClose={() => setBulk(false)} />}
    </>
  )
}

function SlotCell({ slot, selected, onToggle, onOpen }: { slot: SlotView; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const past = slot.startsAt <= new Date()
  const fill = slot.capacity ? Math.min(1, slot.booked / slot.capacity) : 0
  const full = slot.remaining === 0
  return (
    <div
      className={cn(
        'group relative rounded-field border px-2.5 py-2 transition-colors',
        selected ? 'border-paddy-600 bg-paddy-50 ring-1 ring-paddy-600' : !slot.active ? 'border-dashed border-ink-3/50 bg-paper' : 'border-line bg-white hover:border-ink-3/50',
        past && 'opacity-60',
      )}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`${slotRange(slot)}, ${slot.booked} of ${slot.capacity} booked${slot.active ? '' : ', turned off'}`}>
        <span className={cn('block pr-5 text-[13px] font-semibold', !slot.active && 'text-ink-3')}>
          <span className="lg:hidden xl:inline">{slotRange(slot)}</span>
          <span className="hidden lg:inline xl:hidden">{time12(slot.start)}</span>
        </span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper-2">
          <span className={cn('block h-full rounded-full', full ? 'bg-turmeric-400' : 'bg-paddy-500', !slot.active && 'bg-ink-3/40')} style={{ width: `${fill * 100}%` }} />
        </span>
        <span className="mt-1 flex items-center justify-between text-[11px] text-ink-3">
          <span className="tabular">
            {slot.booked}/{slot.capacity}
          </span>
          {!slot.active ? <span className="font-semibold">Off</span> : full ? <span className="font-semibold text-turmeric-800">Full</span> : null}
        </span>
      </button>
      {!past && (
        <span className="absolute top-2 right-2">
          <Checkbox label={`Select ${slotRange(slot)}`} checked={selected} onChange={onToggle} />
        </span>
      )}
    </div>
  )
}

