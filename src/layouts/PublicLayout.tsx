import { Menu, Phone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '@/components/misc'
import { ButtonLink, cn } from '@/components/ui'
import { useDb } from '@/data/store'

const NAV = [
  { to: '/#plan', label: 'Site plan' },
  { to: '/#visit', label: 'How visits work' },
  { to: '/#faq', label: 'Questions' },
  { to: '/manage', label: 'Manage booking' },
]

export function PublicLayout() {
  const { settings } = useDb()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const onBooking = location.pathname.startsWith('/book')

  useEffect(() => setOpen(false), [location.pathname, location.hash])
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo({ top: 0 })
  }, [location.pathname, location.hash])

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line-soft bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="Karthipuram home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="rounded-field px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-ink/5 hover:text-ink">
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ButtonLink to="/broker/sign-in" variant="ghost" className="hidden sm:inline-flex">
              Broker sign-in
            </ButtonLink>
            {!onBooking && (
              <ButtonLink to="/book" variant="primary" className="hidden sm:inline-flex">
                Book a site visit
              </ButtonLink>
            )}
            <button type="button" className="grid size-10 place-items-center rounded-field text-ink md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-line-soft bg-paper px-4 pt-2 pb-4 md:hidden animate-pop" aria-label="Mobile">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="block rounded-field px-3 py-3 text-[15px] font-semibold text-ink hover:bg-ink/5">
                {n.label}
              </Link>
            ))}
            <Link to="/broker/sign-in" className="block rounded-field px-3 py-3 text-[15px] font-semibold text-ink hover:bg-ink/5">
              Broker sign-in
            </Link>
            <ButtonLink to="/book" className="mt-2 w-full" size="lg">
              Book a site visit
            </ButtonLink>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-ink text-paper/75">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo inverse />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">{settings.project.address}</p>
            <a href={`tel:${settings.project.phone.replace(/\s/g, '')}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-paper hover:text-turmeric-300">
              <Phone className="size-4" />
              {settings.project.phone}
            </a>
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-paper">Visitors</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="hover:text-paper" to="/book">Book a site visit</Link></li>
              <li><Link className="hover:text-paper" to="/manage">Change or cancel a visit</Link></li>
              <li><Link className="hover:text-paper" to="/site-plan">Explore the site plan</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-paper">Partners</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="hover:text-paper" to="/broker/sign-up">Become a referral partner</Link></li>
              <li><Link className="hover:text-paper" to="/broker/sign-in">Broker sign-in</Link></li>
              <li><Link className="hover:text-paper" to="/admin/sign-in">Site office sign-in</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className={cn('mx-auto max-w-6xl px-4 py-5 text-xs text-paper/50 sm:px-6')}>
            Prototype with sample data. Project details, prices and approvals shown here are placeholders until the project owner approves final content.
          </p>
        </div>
      </footer>
    </div>
  )
}
