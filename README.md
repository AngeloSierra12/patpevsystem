# Hotel Reservation System and Inventory System
## IGP PATVEP Hostel and University Canteen — UI Shell

**Angelo Andrei P. Sierra** — Frontend and UI/UX Developer, BSIT-NW3A
Bataan Peninsula State University, Main Campus

---

## What this is

The **complete interface layer** for the system: all seven screens, every
region, reading real records from the project database seed.

It does not write. Ten of the charter's fifteen in-scope items are write
operations, and the API layer that would perform them is a separate task. So
every form here validates fully and then **prints the exact row it would
write**, rather than reporting a save that did not happen. That is honest, and
those printed payloads are the specification the endpoints have to satisfy.

There is no sign-in yet either; the shell runs as one fixed account.

**To run:** open `index.html` in any browser. No install, no build step, no
internet needed.

---

## What is built

Every charter deliverable that has a user interface.

| Screen | What works |
|---|---|
| Dashboard | Occupancy rate, rooms free, arrivals, low stock; seven-night occupancy chart; stock levels against reorder points; low stock alerts; quick actions |
| Hotel Reservation | Reservation list with status-aware actions; booking form offering only genuinely free rooms; availability check; payment entry; billing statement; guest registration; guest profiles with stay history |
| Canteen Inventory | Item management with search and filters; delivery recording; usage recording; suppliers; delivery records; full stock movement ledger; per-item history |
| Scheduling & Calendar | Month grid of bookings by night; day detail splitting arrivals, departures and in-house; double-booking detection |
| User Management | Account list with search and role filter; create and edit forms with validation; role assignment; role permission matrix |
| Reports | All six report types the charter names, plus the summary; date filtering; column totals; CSV export |
| Audit Trail | The full log, searchable and filterable by action and area |
| My Account | Own details, what the role reaches, recent activity |

## What is not built, and whose it is

| Work | Owner |
|---|---|
| Authentication and sign-in | John Carlos R. Capuli |
| The API layer that performs the writes | John Carlos R. Capuli |
| Official receipt document output | John Carlos R. Capuli |
| Enforcing the role permission rules | John Carlos R. Capuli |
| SRS, System Design, User Manual, Installation Guide | Fritz Edrick B. Sarmiento |

See `HANDOVER-carlos.md` for the API specification and `HANDOVER-andrew.md`
for project status. `SCOPE-CHECK.md` measures the build against the charter.

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
