import { ChevronDown, Compass, MapPin, MessageCircle, Phone } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlanLegend, SitePlan } from '@/components/SitePlan'
import { Badge, ButtonLink, cn } from '@/components/ui'
import { useDb } from '@/data/store'
import type { Plot } from '@/data/types'
import { inr, inrCompact, num, PLOT_STATUS_LABEL, whatsappLink } from '@/lib/format'

export default function Landing() {
  const db = useDb()
  const { project } = db.settings
  const [hovered, setHovered] = useState<Plot | null>(null)
  const [pinned, setPinned] = useState<Plot | null>(null)
  const shown = hovered ?? pinned

  const facts = useMemo(() => {
    const available = db.plots.filter((p) => p.status === 'available')
    const sizes = db.plots.map((p) => p.areaSqft)
    const counts = { available: 0, reserved: 0, sold: 0 }
    for (const p of db.plots) counts[p.status]++
    return { available: available.length, min: Math.min(...sizes), max: Math.max(...sizes), counts }
  }, [db.plots])

  return (
    <>
      <section id="plan" className="scroll-mt-16 border-b border-line-soft">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-12 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12 lg:pt-16 lg:pb-20">
          <div className="animate-rise">
            <h1 className="text-[40px] leading-[1.02] font-bold tracking-[-0.03em] sm:text-[56px]">
              Walk the plots before you decide.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-2">
              {project.tagline} Pick a time, bring your family, and our site team will walk you through every block.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink to="/book" size="lg">
                Book a site visit
              </ButtonLink>
              <ButtonLink to="/site-plan" size="lg" variant="secondary">
                Explore the site plan
              </ButtonLink>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 divide-x divide-line border-y border-line py-4">
              <Fact label="Plots open" value={num(facts.available)} />
              <Fact label="Sizes, sq ft" value={`${num(facts.min)}–${num(facts.max)}`} />
              <Fact label="Per sq ft" value={inr(project.pricePerSqft)} />
            </dl>
          </div>

          <div className="min-w-0">
            <div className="rounded-panel border border-line bg-white p-2 survey-grid sm:p-3">
              <SitePlan
                plots={db.plots}
                activeId={shown?.id}
                onPlotHover={setHovered}
                onPlotClick={(p) => setPinned((cur) => (cur?.id === p.id ? null : p))}
                selected={pinned ? [pinned.id] : []}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <PlanLegend counts={facts.counts} />
              <span className="text-xs text-ink-3">Tap a plot to see its size and price</span>
            </div>
            <PlotCard plot={shown} pricePerSqft={project.pricePerSqft} />
          </div>
        </div>
      </section>

      <section id="visit" className="scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">How a site visit works</h2>
              <p className="mt-3 max-w-sm text-ink-2">Visits are free and take about an hour. You do not need an account.</p>
            </div>
            <ol className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className="bg-white p-6">
                  <span className="font-display text-sm font-bold text-turmeric-600 tabular">Step {i + 1}</span>
                  <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-y border-line-soft bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-bold sm:text-4xl">What is on the site</h2>
            <Badge tone="amber">Sample details — final content pending approval</Badge>
          </div>
          <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {highlights(project.approval).map((h) => (
              <div key={h.title} className="border-t-2 border-ink pt-4">
                <dt className="font-display text-lg font-semibold">{h.title}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{h.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="faq" className="scroll-mt-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:py-20">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Questions</h2>
            <p className="mt-3 max-w-sm text-ink-2">
              Anything else? Call {project.phone} or message us on WhatsApp.
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-field py-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-5 text-[15px] leading-relaxed text-ink-2">
                  {f.a}
                  {f.link && (
                    <>
                      {' '}
                      <Link to={f.link.to} className="font-semibold text-paddy-600 underline-offset-2 hover:underline">
                        {f.link.label}
                      </Link>
                    </>
                  )}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paddy-800 text-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Visit the site office</h2>
            <p className="mt-3 flex max-w-md items-start gap-2 text-paper/80">
              <MapPin className="mt-1 size-4 shrink-0" />
              {project.address}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ContactLink href={`tel:${project.phone.replace(/\s/g, '')}`} icon={<Phone />} label="Call" detail={project.phone} />
            <ContactLink href={whatsappLink(`Hello, I'd like to know more about ${project.name}.`, project.whatsapp)} icon={<MessageCircle />} label="WhatsApp" detail="Message the office" external />
            <ContactLink href={project.mapsUrl} icon={<Compass />} label="Directions" detail="Open in Google Maps" external />
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-display text-lg font-semibold">Are you a broker or mediator?</p>
            <p className="mt-1 text-[15px] text-ink-2">Get your own booking link and see every visit your customers book.</p>
          </div>
          <ButtonLink to="/broker/sign-up" variant="secondary">
            Become a referral partner
          </ButtonLink>
        </div>
      </section>
    </>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0">
      <dt className="text-xs font-medium text-ink-3">{label}</dt>
      <dd className="mt-1 font-display text-lg font-semibold tabular sm:text-xl">{value}</dd>
    </div>
  )
}

function PlotCard({ plot, pricePerSqft }: { plot: Plot | null; pricePerSqft: number }) {
  if (!plot) {
    return (
      <div className="mt-4 rounded-panel border border-dashed border-line px-4 py-4 text-sm text-ink-3">
        Hover over or tap any plot on the plan to see its size, facing and approximate price.
      </div>
    )
  }
  const tone = plot.status === 'available' ? 'green' : plot.status === 'reserved' ? 'amber' : 'neutral'
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line bg-white px-4 py-4 animate-pop" aria-live="polite">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-xl font-semibold">
            Block {plot.block}, plot {plot.number}
          </p>
          <Badge tone={tone}>{PLOT_STATUS_LABEL[plot.status]}</Badge>
        </div>
        <p className="mt-1 text-sm text-ink-2 tabular">
          {num(plot.areaSqft)} sq ft, {plot.facing.toLowerCase()} facing{plot.corner ? ', corner plot' : ''}
          {plot.status !== 'sold' && <>. About {inrCompact(plot.areaSqft * pricePerSqft)}</>}
        </p>
      </div>
      {plot.status === 'available' && (
        <ButtonLink to={`/book?plot=${plot.id}`} size="sm" variant="accent">
          Book a visit to see this plot
        </ButtonLink>
      )}
    </div>
  )
}

function ContactLink({ href, icon, label, detail, external }: { href: string; icon: React.ReactNode; label: string; detail: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={cn('flex items-center gap-3 rounded-panel border border-white/15 px-4 py-3.5 transition-colors hover:border-turmeric-300 hover:bg-white/5 sm:flex-col sm:items-start')}
    >
      <span className="text-turmeric-300 [&_svg]:size-5">{icon}</span>
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-[13px] text-paper/65">{detail}</span>
      </span>
    </a>
  )
}

const STEPS = [
  { title: 'Pick a date and time', body: 'Choose any open slot. Each slot shows how many spots are left, so you know before you go.' },
  { title: 'Get your visit pass', body: 'You get a reference number and a QR pass on screen. Save it, add it to your calendar, or send it to yourself on WhatsApp.' },
  { title: 'Ask for free pickup', body: 'Need a ride? Choose a pickup point when you book and our vehicle will meet you there.' },
  { title: 'Walk the plots', body: 'The site team shows you available plots, approvals and prices. Show your pass or reference number when you arrive.' },
]

const highlights = (approval: string) => [
  { title: 'Approved layout', body: `${approval}. Clear title and individual patta for every plot.` },
  { title: 'Wide internal roads', body: 'A 40 ft main avenue and 30 ft cross roads, laid with tar and storm-water drains on both sides.' },
  { title: 'Park and play area', body: 'Open space reserved near the entrance, planted with native trees and a walking path.' },
  { title: 'Water and power', body: 'Overhead tank with a borewell supply and EB connection points ready at every plot.' },
  { title: 'Gated entrance', body: 'Arched entrance with a security cabin and street lights along every road.' },
  { title: 'Loan support', body: 'Plots are eligible for bank loans. The site office can connect you with partner banks.' },
]

const FAQ: { q: string; a: string; link?: { to: string; label: string } }[] = [
  { q: 'Does a site visit cost anything?', a: 'No. Site visits are free, and booking a visit does not commit you to buying a plot.' },
  { q: 'What should I bring?', a: 'Your reference number or QR pass, and a photo ID if you would like to see the approval documents. Wear comfortable shoes — the walk takes about an hour.' },
  { q: 'Can I change or cancel my visit?', a: 'Yes. Use your reference number and mobile number to pick a new slot or cancel.', link: { to: '/manage', label: 'Manage your booking' } },
  { q: 'How does the free pickup work?', a: 'When you book, turn on pickup and choose the nearest pickup point. The site office calls you the day before to confirm the time.' },
  { q: 'Can you help with a home loan?', a: 'Yes. Mention it in the notes when you book and the site team will bring loan details to your visit.' },
  { q: 'A broker sent me a link. Do I pay them anything?', a: 'No. Booking through a broker’s link is free for you. It only tells us who referred you, so they get credit for your visit.' },
]
