# Hotel Reservation System and Inventory System
## IGP PATVEP Hostel and University Canteen — Frontend Build

**Developer:** Angelo Andrei P. Sierra — Frontend & UI/UX Developer, BSIT-NW3A
**Institution:** Bataan Peninsula State University, Main Campus

---

## What this build is

This repository contains **only the modules assigned to the Frontend & UI/UX
Developer** in the project Work Breakdown Structure. It is deliberately not a
complete system. Modules owned by other members of the team are present in the
navigation as clearly labelled placeholders so that the whole system's shape is
visible, but they are not implemented here.

### Running it

Open `index.html` in any modern browser. There is nothing to install, no build
step, and no internet connection required — fonts, icons and charts are all
bundled locally so it runs from a flash drive during the defense.

---

## Scope

### Implemented (assigned to A. Sierra)

| WBS | Deliverable | Where |
|-----|-------------|-------|
| **7.0** | Dashboard | `index.html` |
| 7.1 | UI Wireframing | `pages/wireframes.html` |
| 7.2 | Hostel metrics + canteen stock integration | `assets/js/pages/dashboard.js` |
| 7.3 | Quick actions panel | `assets/js/pages/dashboard.js` |
| **5.0** | Scheduling and Calendar Module | `pages/calendar.html` |
| 5.1 | UI Wireframing | `pages/wireframes.html` |
| 5.2 | Interactive calendar + room occupancy timeline | `assets/js/pages/calendar.js` |
| 5.3 | Schedule conflict detection | `assets/js/core/scheduling.js` |
| **2.0** | User Management Module | `pages/users.html` |
| 2.1 | UI Wireframing | `pages/wireframes.html` |
| 2.3 | Role-Based Access Control | `assets/js/core/rbac.js` |
| 2.4 | User dashboard | `pages/users.html`, `pages/account.html` |

### Not implemented (owned by other developers)

| WBS | Module | Owner |
|-----|--------|-------|
| 1.0 | Database (ERD, tables, migration) | Darren Jude S. Tamayo |
| 2.2 | Authentication Logic | *not assigned to this developer* |
| 3.0 | Inventory Management Module | Andrew Jacob E. Santos |
| 4.0 | Hotel Reservation Module | Andrew Jacob E. Santos |
| 6.0 | Audit Trail and Activity Logs | John Carlos R. Capuli |
| 8.0 | Report Generation Module | Darren Jude S. Tamayo |
| 9.0 | System Documentation | Fritz Edrick B. Sarmiento |

---

## About WBS 2.2 (Authentication)

There is **no login screen and no password handling anywhere in this build**,
because authentication is not part of this developer's assignment.

Role-Based Access Control (2.3) still needs to know who is signed in, so
`assets/js/core/session.js` provides a stub that holds a chosen user id and
nothing else. The **"Viewing as"** selector in the header swaps the active
account so the access rules can be demonstrated from an Administrator, Staff and
Guest point of view.

When 2.2 is delivered, remove the selector and keep the interface — `current()`
should return the user decoded from the real session. No other file needs to
change.

---

## Demonstrating the access rules

Use the **"Viewing as"** dropdown in the header:

| Role | What changes |
|------|--------------|
| **Administrator** | Every module visible. Can create, edit and delete accounts, assign roles, manage individual permissions, and override a booking conflict. |
| **Staff** | User Management is read-only. Audit Trail disappears from the navigation entirely. Cannot override a conflict — the save button stays disabled. |
| **Guest** | Sees only their own bookings on the calendar. User Management, Inventory, Reports and Audit all disappear. Opening `pages/users.html` directly shows an access-denied page. |

The suspended account (Grace P. Mendoza, `U-1009`) demonstrates that a
non-active account holds **zero** permissions regardless of its role.

---

## Architecture

```
index.html                       Dashboard (WBS 7.0)
pages/
  calendar.html                  Scheduling & Calendar (WBS 5.0)
  users.html                     User Management (WBS 2.0)
  account.html                   My Account (WBS 2.4)
  wireframes.html                Wireframe deliverables (2.1 / 5.1 / 7.1)
  module-*.html                  Placeholders for other developers' modules
assets/
  css/
    app.css                      Design system
    fonts.css                    Fira Sans / Fira Code embedded as data URIs
  js/
    core/
      util.js                    Paths, date maths, formatting, DOM helpers
      store.js                   Data access layer  <-- swap for the real API
      session.js                 STUB for WBS 2.2
      rbac.js                    Role-Based Access Control (WBS 2.3)
      scheduling.js              Occupancy + conflict detection (WBS 5.2/5.3)
    data/
      mock-data.js               Seed data  <-- delete once the database exists
    ui/
      shell.js                   Sidebar, topbar, modal, toast
      icons.js                   Inline SVG icon set
      charts.js                  Hand-built SVG charts
    pages/                       One module per file
```

Plain ES5-style JavaScript in classic `<script>` tags, not ES modules, so the
site works when opened directly from the file system (`file://` blocks module
imports).

---

## Handover notes for the backend developer

Every screen reads and writes through **`App.Store`**. Replace the bodies of
those methods with `fetch()` calls and no page code has to change:

```
Store.users.list()            ->  GET    /api/users
Store.users.get(id)           ->  GET    /api/users/:id
Store.users.create(data)      ->  POST   /api/users
Store.users.update(id, data)  ->  PATCH  /api/users/:id
Store.users.remove(id)        ->  DELETE /api/users/:id
Store.events.list()           ->  GET    /api/schedule
Store.events.create(data)     ->  POST   /api/schedule
Store.reservations.list()     ->  GET    /api/reservations
Store.inventory.list()        ->  GET    /api/inventory
```

Data currently persists to `localStorage` so the prototype survives page
navigation. It re-seeds automatically each day so the demo's relative dates
("today", "tomorrow") never drift.

**The conflict rules in `scheduling.js` are reusable.** The Hotel Reservation
module (WBS 4.0) should call `App.Scheduling.detect()` rather than writing its
own overlap check, so both modules agree on what counts as a double booking.

---

## Date semantics (important)

Getting this wrong is the classic cause of off-by-one double bookings, which the
project charter lists as risk #1. The rule is stated once in
`assets/js/core/scheduling.js` and every function obeys it:

- A **reservation** occupies the half-open interval `[checkIn, checkOut)`. The
  guest vacates on the check-out date, so a new guest may check in that same
  morning. Two reservations overlap when
  `A.checkIn < B.checkOut AND B.checkIn < A.checkOut`.
- A **maintenance event** uses an **inclusive** end date, because "cleaning on
  the 5th to the 7th" means the room is unusable on the 7th too. Event ranges
  are converted to `[start, end + 1 day)` before being compared.

---

## Conflict checks implemented (WBS 5.3)

`App.Scheduling.detect(candidate)` returns findings ordered worst-first.
`error` blocks the save; `warn` is shown but allowed.

| Level | Code | Catches |
|-------|------|---------|
| error | `DATE_MISSING` | Start or end date not supplied |
| error | `DATE_ORDER` | End before start; a reservation of zero nights |
| error | `ROOM_DOUBLE_BOOKED` | Overlaps a reservation that still holds the room |
| error | `ROOM_BLOCKED` | Overlaps a maintenance block on the same room |
| warn | `OVER_CAPACITY` | Guest count exceeds the room's rated capacity |
| warn | `NO_ROOM_SELECTED` | Maintenance entry that blocks nothing |
| warn | `PAST_DATE` | Entry starts in the past |
| warn | `LONG_SPAN` | Stay longer than 30 days |
| warn | `LOW_AVAILABILITY` | One room or fewer free on any covered night |

Cancelled reservations are ignored — they no longer hold a room.

---

## Design system

Built as a **dense operational tool**, not a dashboard template. The system is
software the front desk sits in front of for eight hours, and the visual
decisions follow from that:

- **Structure comes from rules, not elevation.** Almost nothing casts a shadow;
  panels are separated by 1px borders. Shadows are reserved for things that
  genuinely float (modal, toast).
- **Corners are nearly square** (3-4px). Heavy rounding reads as a consumer app.
- **Density over air.** Ten user accounts fit on screen at once; rows are a
  uniform 43px and names never wrap.
- **One dominant element per screen.** An evenly weighted grid tells the reader
  nothing about what matters, so the layout is deliberately lopsided.
- **Figures are tabular and monospaced** so columns align down the page.
- **The screen never explains itself in prose.** There is no descriptive
  paragraph under any heading. A meta line of real figures carries it instead:
  `September 12, 2026 | Rooms 22 | Occupied 9 | Free 13 | Low stock 6`.
- **A status bar runs along the bottom** with dataset scope, record counts, read
  time, session id and keyboard hints — the texture real tools have.

**Palette: the university's own red.** `#AE0404` was sampled from the BPSU seal
itself, not picked by eye, by counting pixels in the official logo: it is the
dominant red across 17,482 of them. The sidebar uses a near-black maroon drawn
from the same family, and the interface ink is warmed slightly so it sits with
the red rather than fighting it.

Because the brand colour is now red, and red also means danger, the two are kept
apart deliberately: destructive controls use a darker `#7F1010`, always carry a
trash icon, and always route through a confirmation dialog. Informational states
stay blue so they can never be mistaken for either.

Every foreground and background pair in the interface was measured against
WCAG AA. The lowest is 4.51:1 and the brand red on white is 7.45:1.

**Logo:** the real university seal (`assets/img/bpsu-logo.png`), used in the
sidebar and as the favicon.

Type: Fira Sans for the interface, Fira Code for identifiers and figures.

**Icons are inline SVG in the Lucide style. No emoji is used as an interface
icon** — they render differently on every machine and cannot be recoloured by
the theme. Charts are hand-built SVG: no charting library, no CDN.

The fonts are embedded in `fonts.css` as base64 data URIs rather than sitting
beside it as `.woff2` files. Browsers treat every `file://` page as an opaque
origin, so a font loaded from a neighbouring `file://` path is treated as
cross-origin and blocked — which would silently drop the typography the moment
someone double-clicks `index.html` instead of serving the folder. A `data:` URI
carries no origin and always loads.

Accessibility: skip link, visible focus rings, `aria-current` on the active nav
item, labels on every field, errors announced next to their field with the first
invalid field focused on submit, 16px inputs on mobile to stop iOS zoom, status
never conveyed by colour alone, and `prefers-reduced-motion` respected.

---

## Why the interface carries no WBS labels

Earlier builds printed the WBS code on every screen: a tag beside each heading,
a code on every navigation item, a badge on each panel, and a cell in the status
bar. Those have all been removed.

Real software does not label its own screens with the project-management codes
used to build it. Leaving them in made the system read as a class exercise
rather than a working tool, and it was the single most obvious sign that the
interface had been generated rather than designed.

The full scope mapping still exists in this README, in the header comment of
every source file, and on the placeholder pages for modules that are not built.
Nothing was lost; it simply lives in the documentation, where it belongs.

---

## Signs of AI-generated design, and what was done about each

The interface was audited against the commonly cited tells. Findings and fixes:

| Tell | Status |
|------|--------|
| Emoji used as interface icons | Replaced with an inline SVG set |
| Stock Tailwind indigo/violet/slate palette | Shifted off the default hex values to a cooler institutional blue and a warmer ink |
| Coloured left-border accent stripes on cards | Removed from panels and notices. Kept only on conflict messages, where the rule encodes severity and therefore carries meaning |
| Em dashes as prose connectors | Removed from all interface copy. Retained only as the empty-value placeholder in data cells, which is ordinary typographic convention |
| Rigid symmetry, identical card heights and padding | Layout made deliberately lopsided; metrics and role summaries became single ruled strips rather than rows of matching cards |
| Excessive whitespace | Density raised throughout: 13px base, 43px table rows, ten accounts visible at once |
| Generic placeholder names | Seed data uses regionally plausible Filipino names and real BPSU departments |
| A descriptive paragraph under every heading | Replaced with a meta line of live figures |
| Hover states that do nothing, instant state changes | Every interactive element has a hover and active state on a shared 110/170ms easing token |
| Generic gradient or letter-mark logo | Replaced with the actual BPSU seal |
| Information crowding | Status bar cut from five readings to three, page meta lines from five items to three, quick actions lost their second line, the stock panel shows six items instead of eight |

---

## Fixed: sticky table header overlapped the first row

The header row of the user table sat 46px too low and covered the top half of
the first account.

The cause was not the header. `.table-wrap` sets `overflow-x: auto` so wide
tables can scroll sideways on a small screen. When one axis is set to `auto`, a
browser resolves the other axis to `auto` as well, which quietly turns that
wrapper into a scroll container. A sticky element positions itself against its
nearest scrolling ancestor, so `top: var(--topbar-h)` stopped meaning "46px
below the fixed top bar" and started meaning "46px down from the top of the
table". The header was pushed onto a row only 43px tall.

Inside that scrollport the correct offset is `0`. The header now sits flush at
the top of the table, verified by measuring its offset within the wrapper.

---

## Known limitations

1. **No authentication.** By design — see WBS 2.2 above.
2. **Data is not shared between machines.** `localStorage` is per-browser. Two
   people opening the site do not see each other's changes. The real database
   (WBS 1.0) resolves this.
3. **Reservations are read-only here.** The calendar displays and validates them,
   but creating one belongs to WBS 4.0.
4. **Reports, audit logs, inventory editing and check-in/check-out are absent.**
   They belong to other developers' modules.
