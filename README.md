# Hotel Reservation System and Inventory System

**IGP PATVEP Hostel and University Canteen**
Bataan Peninsula State University, Main Campus &middot; BSIT-NW3A

---

## Running it

Open `index.html` in any browser. No install, no build step, no internet.

---

## Screens

| Page | What it does |
|---|---|
| `index.html` | Occupancy, rooms free, arrivals, low stock; seven-night occupancy chart; stock levels; alerts |
| `pages/reservations.html` | Reservations, booking, availability check, payments, billing, guest profiles |
| `pages/inventory.html` | Items, deliveries, usage, suppliers, stock movement ledger |
| `pages/calendar.html` | Month grid of bookings, day detail, double-booking detection |
| `pages/users.html` | Accounts, roles, permission matrix |
| `pages/reports.html` | Six report types, date filtering, CSV export |
| `pages/audit.html` | Activity log with search and filters |
| `pages/account.html` | Signed-in account, role permissions, recent activity |

---

## Files

```
index.html               Dashboard
pages/                   One file per screen
assets/
  css/app.css            Design system
  css/fonts.css          Fira Sans and Fira Code, embedded as data URIs
  img/bpsu-logo.png      University seal
  js/
    data.js              Records generated from the database seed
    queries.js           Reads, named after the SQL views
    shell.js             Layout, navigation, icons, table renderer
    pages/               One file per screen
database/                MariaDB 10.4 schema, 7 SQL files + DBML
scripts/sql2js.py        Regenerates data.js from the seed
wireframes/              Low-fidelity wireframes
```

---

## The database

`database/` holds the schema: 13 tables, 13 views, 6 triggers, and an audit
archive procedure, for MariaDB 10.4. Setup steps are in `database/README.md`.

A browser cannot open a MariaDB connection, so the screens read
`assets/js/data.js`, generated from the seed with the schema's exact table and
column names:

```
users  guests  room_types  rooms  reservations  payments  suppliers
inventory_items  deliveries  delivery_items  inventory_transactions
inventory_consumption  audit_logs
```

Values the triggers derive are applied during generation, so the file mirrors
the state MariaDB holds after seeding: `paid_amount` from the payments,
`current_stock` from deliveries in minus consumption out, `unit_cost` from the
most recent delivery line, and the `inventory_transactions` ledger.

Regenerate after a seed change:

```bash
python scripts/sql2js.py
```

`users.password_hash` is withheld: `data.js` is plain text served to the
browser, and no screen reads it.

`assets/js/queries.js` holds the reads, named after the SQL views they mirror
(`vw_low_stock_items`, `vw_reservation_summary`, `vw_daily_revenue`). When the
API layer exists, each becomes a request for the matching view and no screen
changes.

---

## Notes

**Colour** is `#AE0404`, sampled from the BPSU seal rather than picked by eye.

**Fonts are embedded as data URIs.** Browsers treat every `file://` page as an
opaque origin, so a font loaded from a neighbouring `file://` path is blocked
as cross-origin. A `data:` URI carries no origin and always loads, which is
what keeps the typography working when the system is opened by double-clicking.

**Icons are inline SVG**, never emoji: emoji render differently on every
machine and cannot be recoloured.

**Database codes never reach the screen.** Roles, statuses, actions and
categories are stored as `SCREAMING_SNAKE` codes and pass through a label map
before display, so `RESERVATION_CHECKED_IN` reads as "Guest checked in".

**On a phone, tables become cards.** Below 800px the header row is hidden and
each cell prints its own label, so a row reads top to bottom instead of
scrolling sideways.

Accessibility: skip link, visible focus rings, `aria-current` on the active nav
item, labels on every field, 16px inputs on mobile so iOS does not zoom, status
never conveyed by colour alone, and `prefers-reduced-motion` respected.

---

## Current limitations

1. **No sign-in.** The system runs as one fixed account.
2. **Nothing is saved.** There is no API layer yet, so each form validates and
   then shows the record it would write instead of reporting a save that did
   not happen.
3. **Records are a snapshot.** `data.js` is generated from the seed, not a live
   connection to MariaDB.
