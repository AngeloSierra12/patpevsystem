# Hotel Reservation System and Inventory System
## IGP PATVEP Hostel and University Canteen — UI Shell

**Angelo Andrei P. Sierra** — Frontend and UI/UX Developer, BSIT-NW3A
Bataan Peninsula State University, Main Campus

---

## What this is

A **UI shell** for early research and development. It establishes the layout,
the navigation and the screen inventory for the whole system.

It is not a working system and does not pretend to be one. Screens that belong
to other developers show what goes there and **name the person building it**,
rather than showing a fake version. The records shown are real, read from
the project database seed; there is no sign-in yet.

**To run:** open `index.html` in any browser. No install, no build step, no
internet needed.

---

## Scope

Built against the updated Work Breakdown Structure.

### Built here — Angelo Sierra

| WBS | Task | Where |
|-----|------|-------|
| 3.4 | User Dashboard | `pages/users.html` |
| 5.4 | Guest Details Profile Menu | `pages/reservations.html` |
| 8.3 | Quick Actions Panel | `index.html` |
| 9.4 | Report Summary UI | `pages/reports.html` |
| 6.1 | UI Wireframing — Scheduling & Calendar | wireframe document |
| 7.1 | UI Wireframing — Audit Trail | wireframe document |
| 8.1 | UI Wireframing — Dashboard | wireframe document |
| 9.1 | UI Wireframing — Reports | wireframe document |

The layout, navigation, design system and shell chrome are also this
developer's work, since they follow from the wireframing tasks.

### Marked on screen — Andrew Santos

| WBS | Task | Appears on |
|-----|------|-----------|
| 3.1 | UI Wireframing — User Management | wireframe document, page 6 |
| 3.3 | Role Based Access | `pages/users.html`, `pages/account.html` |
| 4.1 | UI Wireframing — Canteen Inventory | wireframe document, page 7 |
| 5.1 | UI Wireframing — Hotel Reservation | wireframe document, page 8 |
| 8.2 | Hotel Metrics Integration | `index.html` |
| 9.2 | Report Control Panel and Date Filtering | `pages/reports.html` |

### Marked on screen — other developers

| WBS | Task | Owner |
|-----|------|-------|
| 2 | Database | Darren Jude S. Tamayo |
| 3.2 | Authentication Logic | John Carlos R. Capuli |
| 4.2–4.3 | Inventory logic and alerts | John Carlos R. Capuli |
| 4.4–4.5 | Suppliers, deliveries, consumption | Darren Jude S. Tamayo |
| 5.2–5.3, 5.5 | Reservation, check-in/out, billing | John Carlos R. Capuli |
| 6.2–6.3 | Interactive calendar, conflict detection | John Carlos R. Capuli |
| 7.2–7.3 | Event logger, log search | Darren Jude S. Tamayo |
| 9.3 | Data aggregation | Darren Jude S. Tamayo |

---

## Wireframe document

`wireframes/PATVEP-UI-Wireframes.pdf` — 8 pages, A4 landscape.

Delivered as a **separate PDF, deliberately not a page inside the site**. A
wireframe is a design document for the team, not a feature for the user.

Four wireframes are drawn in full with numbered annotations explaining each
layout decision. Three are placeholder pages for the screens Andrew Santos is
wireframing, listing what each should cover.

Regenerate it after a layout change:

```bash
python scripts/genwireframes.py
```

---

## Files

```
index.html               Dashboard
pages/
  reservations.html      Hotel Reservation
  inventory.html         Canteen Inventory
  calendar.html          Scheduling and Calendar
  users.html             User Management
  reports.html           Reports
  audit.html             Audit Trail
  account.html           My Account
assets/
  css/app.css            Design system
  css/fonts.css          Fira Sans and Fira Code, embedded
  img/bpsu-logo.png      University seal
  js/
    data.js              Records generated from the database seed
    queries.js           Reads, named after the SQL views
    shell.js             Layout, navigation, icons, table renderer, helpers
    pages/               One file per screen
database/                Project schema (MariaDB 10.4), 7 SQL files + DBML
scripts/
  genwireframes.py       Builds the wireframe PDF
  sql2js.py              Regenerates data.js from the seed
wireframes/
  PATVEP-UI-Wireframes.pdf
_archive-v1/             Previous build, kept for reference
```

---

## Design notes

**Colour is the university's own.** `#AE0404` was taken from the BPSU seal by
counting pixels in the official logo, not chosen by eye. It is the dominant red
across 17,482 of them.

**Fonts are embedded as data URIs** in `fonts.css`. Browsers treat every
`file://` page as an opaque origin, so a font loaded from a neighbouring
`file://` path is blocked as cross-origin. That would silently drop the
typography the moment someone opens `index.html` by double-clicking instead of
serving the folder. A `data:` URI carries no origin and always loads.

Five faces are embedded: Fira Sans 400/500/600/700 and Fira Code 400. Each
page links `fonts.css` itself rather than having `app.css` `@import` it, so the
browser can start both downloads at once instead of waiting for `app.css` to
arrive and parse before it learns the second file exists.

**Icons are inline SVG.** No emoji is used as an interface icon: they render
differently on every machine and cannot be recoloured by the theme.

**Database codes never reach the screen.** The schema stores roles, statuses,
actions and categories as `SCREAMING_SNAKE` codes. That is the right thing for
a column to hold and the wrong thing to show a canteen supervisor, so every one
of them passes through a label map in `queries.js` first: `STAFF_CANTEEN`
reads as Canteen Staff, `RESERVATION_CHECKED_IN` as Guest checked in. A code
the maps have not seen is turned into a sentence rather than printed raw.
Primary keys are labelled in English too. The codes that *are* shown — item
codes, room numbers, booking references — are real ones the staff already use.

**On a phone a table becomes a list of cards.** Six columns cannot fit in
375px: they either scroll out of sight or squeeze each word onto its own line.
Below 800px the header row is hidden and every cell prints its own label from
the `data-label` the table renderer puts there, so a row reads top to bottom.

**The top bar names the section, not the page.** It used to repeat the page
title, which the `<h1>` directly beneath it already carries — the same words
twice, stacked a few pixels apart on a phone. It now shows the section
(Operations, Administration, Account), which is the one piece of context the
heading does not give you, and the only thing still saying which part of the
system you are in once the sidebar slides away on a narrow screen.

Accessibility: skip link, visible focus rings, `aria-current` on the active nav
item, labels on every field, 16px inputs on mobile so iOS does not zoom, status
never conveyed by colour alone, and `prefers-reduced-motion` respected.

---

## The database

`database/` holds the project schema from the database specialist: 13 tables,
13 views, triggers, and an audit archive procedure, for MariaDB 10.4.

**A browser cannot open a MariaDB connection.** So the shell reads
`assets/js/data.js`, which is generated from the seed file and uses the
schema's exact table and column names:

```
users  guests  room_types  rooms  reservations  payments  suppliers
inventory_items  deliveries  delivery_items  inventory_transactions
inventory_consumption  audit_logs
```

Values the triggers derive are applied during generation, so the JS mirrors the
state MariaDB would actually be in after seeding:

| Derived | From |
|---|---|
| `reservations.paid_amount` | the sum of that reservation's payments |
| `inventory_items.current_stock` | deliveries in, minus consumption out |
| `inventory_items.unit_cost` | the price on the most recent delivery line |
| `inventory_transactions` | one ledger row per movement, with the before and after snapshot |

The seed inserts no `inventory_transactions` rows; the stock triggers write
them. The generator replays those triggers in insert order, so the mirror holds
the 20 rows MariaDB would hold.

Regenerate after a seed change:

```bash
python scripts/sql2js.py
```

`users.password_hash` is withheld during generation. `data.js` is plain text
served to the client, so anything secret in it is public, and no screen reads
it. `scripts/sql2js.py` holds the list.

`assets/js/queries.js` holds the reads, named after the SQL views they mirror
(`vw_low_stock_items`, `vw_reservation_summary`, `vw_daily_revenue`). When the
API layer exists, each becomes a request for the matching view and no screen
changes.

Corrections made to `06_seed_data.sql` are listed in
`database/CHANGES-from-frontend.md` for the database owner to review.

---

## Known limitations

1. **No sign-in.** Authentication is WBS 3.2 and is not built. The shell shows
   one fixed account.
2. **No access rules.** Role Based Access is WBS 3.3 and belongs to Andrew
   Santos, so every screen is reachable.
3. **Read-only.** The records are real, but nothing is written back. There is
   no connection to MariaDB; `data.js` is a snapshot.
4. **Most modules are placeholders by design.** That is what a shell at this
   stage of research and development should be.
