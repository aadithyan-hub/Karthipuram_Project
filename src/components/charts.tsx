import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek } from 'date-fns'
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Booking } from '@/data/types'
import { num } from '@/lib/format'
import { cn } from './ui'

/** Validated categorical order (dataviz validator, light surface). Never cycled. */
export const SERIES = { green: '#1d7a4c', gold: '#d0921c', blue: '#2a72b0', red: '#c0473a' }

const GROUPS = [
  { key: 'visited', label: 'Visited', color: SERIES.green },
  { key: 'upcoming', label: 'Booked, not yet visited', color: SERIES.blue },
  { key: 'lost', label: 'Cancelled or no-show', color: SERIES.gold },
] as const

type Bucket = { label: string; visited: number; upcoming: number; lost: number; total: number }

/** Bookings per day (short ranges) or per week (long ranges), split by what happened to them. */
export function trendBuckets(list: Booking[], from: Date | null, to: Date | null): Bucket[] {
  const end = startOfDay(to ?? new Date())
  const first = list.reduce<Date | null>((min, b) => {
    const d = new Date(b.createdAt)
    return !min || d < min ? d : min
  }, null)
  const start = startOfDay(from ?? first ?? addDays(end, -29))
  const span = differenceInCalendarDays(end, start) + 1
  const weekly = span > 45
  const keyOf = (d: Date) => (weekly ? startOfWeek(d, { weekStartsOn: 1 }) : startOfDay(d)).getTime()

  const buckets = new Map<number, Bucket>()
  for (let d = weekly ? startOfWeek(start, { weekStartsOn: 1 }) : start; d <= end; d = addDays(d, weekly ? 7 : 1)) {
    buckets.set(d.getTime(), { label: weekly ? `w/c ${format(d, 'd MMM')}` : format(d, 'd MMM'), visited: 0, upcoming: 0, lost: 0, total: 0 })
  }
  for (const b of list) {
    const bucket = buckets.get(keyOf(new Date(b.createdAt)))
    if (!bucket) continue
    const g = b.status === 'completed' ? 'visited' : b.status === 'cancelled' || b.status === 'no_show' ? 'lost' : 'upcoming'
    bucket[g]++
    bucket.total++
  }
  return [...buckets.values()]
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div className="min-w-48 rounded-field border border-line bg-white px-3 py-2.5 text-[13px] shadow-lg">
      <p className="mb-1.5 font-semibold text-ink">
        {label} <span className="font-normal text-ink-3">· {total} bookings</span>
      </p>
      {GROUPS.map((g) => {
        const v = payload.find((p) => p.dataKey === g.key)?.value ?? 0
        return (
          <p key={g.key} className="flex items-center justify-between gap-4 py-0.5 text-ink-2">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ background: g.color }} />
              {g.label}
            </span>
            <span className="font-semibold text-ink tabular">{v}</span>
          </p>
        )
      })}
    </div>
  )
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export function TrendChart({ data, height = 240 }: { data: Bucket[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.total, 0)
  return (
    <div>
      <ChartLegend items={GROUPS.map((g) => ({ label: g.label, color: g.color }))} />
      <div className="mt-3" style={{ height }} role="img" aria-label={`Bookings over time, ${total} in total`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="var(--color-line-soft)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} width={44} />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: 'var(--color-paper-2)', opacity: 0.7 }} />
            {GROUPS.map((g, i) => (
              <Bar key={g.key} dataKey={g.key} stackId="a" fill={g.color} stroke="#fff" strokeWidth={1} radius={i === GROUPS.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Ranked horizontal bars built from plain HTML: crisp labels, no axis needed. */
export function BarList({ items, valueFormat = num, color = SERIES.green, empty }: { items: { key: string; label: ReactNode; value: number; hint?: ReactNode }[]; valueFormat?: (n: number) => string; color?: string; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <p className="py-6 text-center text-sm text-ink-3">{empty ?? 'No data for this period.'}</p>
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} className="group" title={`${typeof i.label === 'string' ? i.label : ''} ${valueFormat(i.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium text-ink">{i.label}</span>
            <span className="shrink-0 font-semibold text-ink tabular">
              {valueFormat(i.value)}
              {i.hint && <span className="ml-1.5 font-normal text-ink-3">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-paper-2">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Stepwise funnel: each step's bar is its share of the first step, with the step-to-step rate. */
export function Funnel({ steps, className }: { steps: { label: string; value: number; note?: string }[]; className?: string }) {
  const top = Math.max(1, steps[0]?.value ?? 1)
  return (
    <ol className={cn('space-y-3', className)}>
      {steps.map((s, i) => {
        const prev = steps[i - 1]?.value
        const rate = prev ? Math.round((s.value / prev) * 100) : null
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-ink">{s.label}</span>
              <span className="tabular">
                <span className="font-semibold text-ink">{num(s.value)}</span>
                {rate !== null && <span className="ml-2 text-ink-3">{rate}% of previous</span>}
              </span>
            </div>
            <div className="h-7 overflow-hidden rounded-md bg-paper-2">
              <div className="h-full rounded-md" style={{ width: `${Math.max(2, (s.value / top) * 100)}%`, background: SERIES.green, opacity: 1 - i * 0.16 }} />
            </div>
            {s.note && <p className="mt-1 text-xs text-ink-3">{s.note}</p>}
          </li>
        )
      })}
    </ol>
  )
}
