import { useId } from 'react'
import { PLAN } from '@/data/plots'
import type { Plot } from '@/data/types'
import { cn } from './ui'

/**
 * The venture's layout drawn like a surveyor's plan: numbered plots, roads,
 * park and entrance. Plots are buttons, so keyboard users can explore too.
 */
export function SitePlan({
  plots,
  selected = [],
  activeId,
  onPlotClick,
  onPlotHover,
  className,
  interactiveStatuses = ['available', 'reserved', 'sold'],
  showLabels = true,
}: {
  plots: Plot[]
  selected?: string[]
  activeId?: string | null
  onPlotClick?: (p: Plot) => void
  onPlotHover?: (p: Plot | null) => void
  className?: string
  interactiveStatuses?: Plot['status'][]
  showLabels?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const hatch = `hatch-${uid}`
  const sold = `sold-${uid}`
  const { boundary: B, avenue: A, crossRoads, park } = PLAN

  return (
    <svg viewBox={`0 0 ${PLAN.width} ${PLAN.height + 40}`} className={cn('h-auto w-full select-none', className)} role="group" aria-label="Site plan of Karthipuram plots">
      <defs>
        <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="var(--color-turmeric-50)" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-turmeric-300)" strokeWidth="2.2" />
        </pattern>
        <pattern id={sold} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width="6" height="6" fill="var(--color-paper-2)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-line)" strokeWidth="1.4" />
        </pattern>
      </defs>

      {/* Boundary */}
      <rect x={B.x - 8} y={B.y - 8} width={B.w + 16} height={B.h + 16} fill="none" stroke="var(--color-ink)" strokeWidth="1.5" strokeDasharray="10 4 2 4" opacity="0.55" />
      <rect x={B.x} y={B.y} width={B.w} height={B.h} fill="#fff" stroke="var(--color-line)" />

      {/* Roads */}
      <rect x={A.x} y={B.y} width={A.w} height={B.h + 28} fill="var(--color-paper-2)" />
      <line x1={A.x + A.w / 2} y1={B.y + 8} x2={A.x + A.w / 2} y2={B.y + B.h + 20} stroke="#fff" strokeWidth="2" strokeDasharray="10 9" />
      {crossRoads.map((r, i) => (
        <g key={i}>
          <rect x={B.x} y={r.y} width={B.w} height={r.h} fill="var(--color-paper-2)" />
          <line x1={B.x + 8} y1={r.y + r.h / 2} x2={B.x + B.w - 8} y2={r.y + r.h / 2} stroke="#fff" strokeWidth="2" strokeDasharray="10 9" />
          {showLabels && (
            <g transform={`translate(${B.x + 160} ${r.y + r.h / 2})`}>
              <rect x="-42" y="-9" width="84" height="18" fill="var(--color-paper-2)" />
              <text y="4.5" textAnchor="middle" fontSize="12" fill="var(--color-ink-3)" fontWeight="600" letterSpacing="0.04em">
                {r.label}
              </text>
            </g>
          )}
        </g>
      ))}
      {showLabels && (
        <g transform={`translate(${A.x + A.w / 2} 482) rotate(-90)`}>
          <rect x="-46" y="-9" width="92" height="18" fill="var(--color-paper-2)" />
          <text y="4.5" textAnchor="middle" fontSize="12" fill="var(--color-ink-3)" fontWeight="600" letterSpacing="0.04em">
            40 ft avenue
          </text>
        </g>
      )}

      {/* Park with trees */}
      <rect x={park.x} y={park.y} width={park.w} height={park.h} rx="10" fill="var(--color-paddy-50)" stroke="var(--color-paddy-200)" />
      {Array.from({ length: 14 }, (_, i) => {
        const cx = park.x + 26 + (i % 7) * 62 + (Math.floor(i / 7) % 2) * 30
        const cy = park.y + 34 + Math.floor(i / 7) * 82
        return <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 15 : 11} fill="var(--color-paddy-200)" opacity={0.75} />
      })}
      <rect x={park.x + 150} y={park.y + 58} width="130" height="44" rx="6" fill="#fff" stroke="var(--color-paddy-200)" />
      <text x={park.x + 215} y={park.y + 78} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-paddy-700)">
        Park &amp; play area
      </text>
      <text x={park.x + 215} y={park.y + 94} textAnchor="middle" fontSize="11" fill="var(--color-paddy-700)" opacity="0.8">
        OSR reserved space
      </text>

      {/* Plots */}
      {plots.map((p) => {
        const isSelected = selected.includes(p.id)
        const isActive = activeId === p.id
        const interactive = !!onPlotClick && interactiveStatuses.includes(p.status)
        const fill = isSelected ? 'var(--color-paddy-600)' : p.status === 'sold' ? `url(#${sold})` : p.status === 'reserved' ? `url(#${hatch})` : isActive ? 'var(--color-paddy-100)' : '#fff'
        const stroke = isSelected || isActive ? 'var(--color-paddy-700)' : p.status === 'available' ? 'var(--color-paddy-500)' : p.status === 'reserved' ? 'var(--color-turmeric-400)' : 'var(--color-line)'
        return (
          <g
            key={p.id}
            role={interactive ? 'button' : 'img'}
            tabIndex={interactive ? 0 : -1}
            aria-label={`Plot ${p.id}, ${p.areaSqft} square feet, ${p.facing} facing, ${p.status}`}
            aria-pressed={interactive ? isSelected : undefined}
            className={cn('outline-none', interactive ? 'cursor-pointer [&:focus-visible>rect]:stroke-[3]' : 'cursor-default')}
            onClick={() => interactive && onPlotClick?.(p)}
            onKeyDown={(e) => {
              if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onPlotClick?.(p)
              }
            }}
            onMouseEnter={() => onPlotHover?.(p)}
            onMouseLeave={() => onPlotHover?.(null)}
            onFocus={() => onPlotHover?.(p)}
          >
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="2.5" fill={fill} stroke={stroke} strokeWidth={isActive || isSelected ? 2.2 : 1.1} className="transition-[fill] duration-150" />
            {showLabels && (
              <text
                x={p.x + p.w / 2}
                y={p.y + p.h / 2 + 4.5}
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill={isSelected ? '#fff' : p.status === 'sold' ? 'var(--color-ink-3)' : 'var(--color-ink)'}
                style={{ fontVariantNumeric: 'tabular-nums' }}
                pointerEvents="none"
              >
                {p.number}
              </text>
            )}
          </g>
        )
      })}

      {/* Block badges sit on the avenue, next to the block they name */}
      {showLabels &&
        (
          [
            ['A', A.x + 13, 110],
            ['B', A.x + A.w - 13, 110],
            ['C', A.x + 13, 318],
            ['D', A.x + A.w - 13, 318],
            ['E', A.x + A.w - 13, 528],
          ] as const
        ).map(([l, x, y]) => (
          <g key={l} transform={`translate(${x} ${y})`}>
            <circle r="10" fill="var(--color-ink)" />
            <text y="4.2" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-paper)">
              {l}
            </text>
          </g>
        ))}

      {/* Entrance */}
      <g transform={`translate(${A.x + A.w / 2} ${B.y + B.h + 30})`}>
        <path d="M-46 0 v-14 q46 -22 92 0 v14" fill="none" stroke="var(--color-turmeric-400)" strokeWidth="4" strokeLinecap="round" />
        <text y="2" dy="14" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ink)">
          Main entrance
        </text>
      </g>

      {/* North arrow */}
      <g transform={`translate(${B.x + B.w - 8} ${B.y + B.h + 22})`}>
        <path d="M0 -14 L6 4 L0 0 L-6 4 Z" fill="var(--color-ink)" />
        <text y="18" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-ink)">
          N
        </text>
      </g>
    </svg>
  )
}

export function PlanLegend({ counts, className }: { counts?: Partial<Record<Plot['status'], number>>; className?: string }) {
  const items: [Plot['status'], string, string][] = [
    ['available', 'Available', 'bg-white ring-paddy-500'],
    ['reserved', 'Reserved', 'bg-[repeating-linear-gradient(45deg,var(--color-turmeric-300)_0_2px,var(--color-turmeric-50)_2px_6px)] ring-turmeric-400'],
    ['sold', 'Sold', 'bg-[repeating-linear-gradient(-45deg,var(--color-line)_0_1.5px,var(--color-paper-2)_1.5px_5px)] ring-line'],
  ]
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-2', className)}>
      {items.map(([k, label, sw]) => (
        <li key={k} className="flex items-center gap-2">
          <span className={cn('size-3.5 rounded-[3px] ring-1 ring-inset', sw)} />
          {label}
          {counts?.[k] !== undefined && <span className="tabular font-semibold text-ink">{counts[k]}</span>}
        </li>
      ))}
    </ul>
  )
}
