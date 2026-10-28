import { ButtonLink } from '@/components/ui'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <p className="font-display text-6xl font-bold text-line">404</p>
      <h1 className="mt-4 text-3xl font-bold">This page is not on the plan</h1>
      <p className="mt-3 text-[16px] text-ink-2">The link may be old or mistyped. If someone sent you a booking link, ask them to share it again, or book directly below.</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <ButtonLink to="/book">Book a site visit</ButtonLink>
        <ButtonLink to="/" variant="secondary">
          Go to the home page
        </ButtonLink>
      </div>
    </div>
  )
}
