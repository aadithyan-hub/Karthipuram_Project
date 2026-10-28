# Karthipuram Plots — broker referral & site-visit booking (prototype)

A clickable, fully working front-end prototype of the Karthipuram site-visit platform. Brokers share a personal referral link, customers book a site-visit slot through it, and the site office manages visits, brokers and slots.

There is no backend. All data is sample data kept in the browser, so the prototype can be shown to clients and stakeholders before any server work is funded.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Deploy `dist/` to any static host. `vercel.json` and `public/_redirects` (Netlify) already send every route to `index.html`, so referral links like `/book?ref=CODE` work on a fresh page load.

## Demo sign-in

The **Demo** button (bottom-right on every page) switches roles, opens a broker's referral link in a new tab, and restores the sample data.

| Role | Sign-in | Password |
|---|---|---|
| Site admin | `admin@karthipuram.demo` | `admin123` |
| Broker | `senthil@broker.demo` (or any seeded broker's phone/email) | `broker123` |

**Live demo trick:** keep the admin dashboard open in one tab, then use *Demo → Open a broker's referral link* to book a visit in another tab. The booking, notification and broker metrics update in the first tab right away.

## What's included

**From the requirements document**
- Public landing page, booking form, confirmation page with reference number
- Broker sign-up / sign-in, profile, dashboard with date-range filters and all metrics from section 4.6
- Unique, non-guessable referral codes; copy and WhatsApp share; attribution kept through the booking journey
- Slot availability with per-slot capacity; capacity is re-checked at submission
- All six statuses (Pending, Confirmed, Rescheduled, Cancelled, Completed, No-show) with full status history
- Admin dashboard, broker directory, booking table with search and filters (broker, status, date, slot), slot management
- Brokers only ever see their own bookings

**Added for the prototype**
- Interactive site plan with plot availability, and plot interest captured on bookings
- Settings page that turns every open decision in section 11 into a switch (broker approval, auto-confirm, email required, attribution window, operating days, slot times)
- Duplicate-lead protection: first broker to bring a customer keeps the credit; conflicts go to an admin review queue
- QR visit pass and on-site check-in by reference number or mobile number
- Customer self-service: reschedule or cancel with reference + mobile number, add to calendar, directions
- Free pickup requests with a per-day pickup list
- Free WhatsApp messaging through `wa.me` links (no SMS/WhatsApp API cost)
- Campaign-tagged referral links (`&src=flyer`) and link-click tracking
- Broker leaderboard, CSV exports, activity log, in-app notifications
- Installable as an app on phones (PWA)
- Phase 2 preview: sales pipeline after the visit, conversion per broker, commission estimate

## How it is built

| Layer | Where | Notes |
|---|---|---|
| UI | `src/pages`, `src/components`, `src/layouts` | React 19, Tailwind CSS 4, React Router 7 |
| Mock API | `src/data/api.ts` | One function per future REST endpoint. Enforces capacity, attribution, role checks and duplicate rules |
| Read helpers | `src/data/queries.ts` | Joins and metrics used by the dashboards |
| Store | `src/data/store.ts` | One JSON document in `localStorage`, synced across tabs with `BroadcastChannel` |
| Sample data | `src/data/seed.ts` | Deterministic generator: ~22 brokers, ~95 days of slots, several hundred bookings |

### Moving to a real backend

Keep the pages as they are and replace the bodies in `src/data/api.ts` with `fetch` calls to the server. The rules the mock API enforces are the rules the server must enforce, as required by section 7 of the requirements:

- Re-check slot capacity inside a transaction when saving a booking
- Resolve the referral code on the server; never trust a broker ID sent by the browser
- Filter broker queries by the signed-in broker's ID on the server
- Hash passwords (the prototype stores demo passwords in plain text on purpose — it holds no real data)

## Limits of the prototype

- Data lives in each browser. A booking made on one device does not appear on another.
- Content (address, prices, approval number, photos) is placeholder text until the project owner approves final details. Admins can edit it under **Settings → Project information**.
- Do not enter real customer details.
