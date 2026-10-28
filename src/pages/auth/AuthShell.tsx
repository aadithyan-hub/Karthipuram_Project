import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/misc'
import { SitePlan } from '@/components/SitePlan'
import { useDb } from '@/data/store'

export const BROKER_POINTS = ['Your own booking link to share on WhatsApp', 'See every visit your customers book, as it happens', 'Know who visited, who cancelled and who is still to come']

/** Split screen used by the sign-in and sign-up pages: brand panel left, form right. */
export function AuthShell({ statement, points, title, description, children, footer }: { statement: string; points: string[]; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const db = useDb()
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink px-12 py-10 text-paper lg:flex lg:flex-col">
        <Link to="/" aria-label="Karthipuram home">
          <Logo inverse />
        </Link>
        <div className="mt-auto max-w-md">
          <p className="font-display text-[40px] leading-[1.05] font-bold tracking-[-0.025em]">{statement}</p>
          <ul className="mt-6 space-y-2.5 text-[15px] text-paper/70">
            {points.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-turmeric-400" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden className="mt-10 -mr-24 -mb-16 rotate-[-4deg] rounded-panel bg-paper p-3 opacity-95 shadow-2xl">
          <SitePlan plots={db.plots} showLabels={false} />
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-8 lg:px-16 lg:py-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="lg:hidden" aria-label="Karthipuram home">
            <Logo />
          </Link>
          <Link to="/" className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 hover:text-ink">
            <ChevronLeft className="size-4" />
            Back to the site
          </Link>
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="text-[30px] leading-tight font-bold">{title}</h1>
          {description && <p className="mt-2 text-[15px] text-ink-2">{description}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-8 text-sm text-ink-2">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

export function DemoHint({ children }: { children: ReactNode }) {
  return <div className="mt-6 rounded-field border border-dashed border-line bg-paper-2/60 px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">{children}</div>
}

/** Only allow in-app paths as redirect targets. */
export function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}
