# For Carlos — Backend & API Developer

**From:** Angelo (Frontend & UI/UX)
**Date:** 21 September 2026

Short version: **the whole interface is built, and the database is verified
working.** What is missing between them is your part, and I have tried to make
it as small and as specific a job as I can.

Nothing in here is a criticism of pace. Two of your modules were due before
today and I know the load everyone is carrying. I built the screens so you are
not blocked waiting on me, and so that when you write the API you are writing
against something you can actually see.

---

## 1. The database runs. Start there.

I executed all seven scripts against a real MariaDB 10.4.32 — the same version
XAMPP 8.2 ships — and fixed the one bug that stopped them.

```bash
mysql -u root -p < database/01_database.sql
mysql -u root -p bpsu_patvep < database/02_tables.sql
mysql -u root -p bpsu_patvep < database/03_indexes.sql
mysql -u root -p bpsu_patvep < database/04_views.sql
mysql -u root -p bpsu_patvep < database/05_triggers.sql
mysql -u root -p bpsu_patvep < database/06_seed_data.sql
mysql -u root -p bpsu_patvep < database/07_audit_archive.sql
```

That now runs clean end to end. 13 tables, 13 views, 6 triggers, 112 rows.
Details in `database/VERIFICATION-run-on-mariadb.md`.

**The triggers already do more than you might expect.** Do not re-implement
any of this in PHP:

| You insert | The database does the rest |
|---|---|
| a row in `payments` | raises `reservations.paid_amount`, recalculates `balance`, writes the audit entry |
| a row in `delivery_items` | raises `inventory_items.current_stock`, updates `unit_cost`, writes the ledger row with before/after |
| a row in `inventory_consumption` | lowers stock, **refuses the insert** if it exceeds what is on hand, writes the ledger row |
| an update to `reservations.status` | writes the matching audit entry |

All four verified running. Your endpoints mostly just need to insert one row
and return.

---

## 2. What the frontend needs from you — the read side

Every screen reads through **one file**: `assets/js/queries.js`. No page talks
to data directly. Each function in it is named after the SQL view it mirrors,
so the mapping is already done:

| `App.Q` function | Becomes | Used by |
|---|---|---|
| `reservationSummary()` | `GET /api/reservations` → `vw_reservation_summary` | Reservations, Reports |
| `guestHistory(id)` | `GET /api/guests/{id}/stays` → `vw_guest_history` | Reservations, Reports |
| `paymentsFor(id)` | `GET /api/reservations/{id}/payments` → `vw_payment_totals` | Billing statement |
| `roomsWithType()` | `GET /api/rooms` → `vw_room_availability` | Reservations, Reports |
| `lowStockItems()` | `GET /api/inventory/low-stock` → `vw_low_stock_items` | Dashboard, Inventory |
| `inventoryValue()` | `GET /api/inventory/value` → `vw_inventory_value` | Dashboard, Reports |
| `deliveryTotal()` | `GET /api/deliveries` → `vw_delivery_summary` | Inventory, Reports |
| `auditLog()` | `GET /api/audit` → `vw_audit_log_full` | Audit Trail |
| `occupancyWeek()` | `GET /api/occupancy?from=&to=` → computed from reservations | Dashboard |
| `me()` | `GET /api/session` → the signed-in user | every screen |

**When these return live data instead of reading `App.DB`, every screen works
with no page changes.** That was the point of keeping them separate.

Return the schema's own column names. The screens already speak them:
`reference_number`, `check_in_date`, `current_stock`, `critical_level`,
`username_snapshot`. Please do not rename anything to camelCase on the way out
— that would break every screen for no gain.

---

## 3. What the frontend needs from you — the write side

Every form on the system validates, then **prints the exact row it would
write**. Open any of them, fill it in, press the button, and you get the
payload your endpoint has to accept. That is your specification, generated
from the real schema, and you can read it without asking me anything.

Try these:

| Screen | Button | Produces |
|---|---|---|
| Hotel Reservation | New reservation | `INSERT INTO reservations` — 16 fields |
| Hotel Reservation | Payment | `INSERT INTO payments` |
| Hotel Reservation | Confirm / Check in / Check out / Cancel | `UPDATE reservations` |
| Hotel Reservation | Register guest | `INSERT INTO guests` |
| Canteen Inventory | Add item | `INSERT INTO inventory_items` |
| Canteen Inventory | Record delivery | `INSERT INTO deliveries` then `delivery_items` |
| Canteen Inventory | Record usage | `INSERT INTO inventory_consumption` |
| User Management | Add user | `INSERT INTO users` |

**The validation is already written and it matches the schema's constraints.**
Check-out must be after check-in; a payment cannot exceed the balance; a
non-cash payment needs a reference; consumption cannot exceed stock; the
critical level cannot be above the reorder level; usernames and item codes and
receipt numbers are checked for duplicates.

Please validate again server side anyway — the browser is not a trustworthy
place to enforce a rule — but the rules themselves are decided and visible.

---

## 4. Three things only you can do

**Authentication (WBS 3.2).** Nothing signs in. `App.Q.me()` returns a fixed
row from the `users` table. `users.password_hash` exists in the schema and is
deliberately **stripped out** of the generated `assets/js/data.js`, because
that file is plain text served to the browser. Keep it that way: hashes are
compared server side and never leave it.

**Room availability at the moment of saving.** The booking form only offers
rooms that are free for the chosen nights, so a double booking cannot be made
from the UI. That is not a guarantee — two staff could submit at the same
instant. The overlap test is `check_in < new_to AND new_from < check_out`
against statuses `PENDING`, `CONFIRMED`, `CHECKED_IN`. Re-check it inside the
transaction that saves. Your charter's first success metric is "no double
bookings", and this is where that is actually won or lost.

**Billing and receipt output.** The statement is built and printable. Turning
it into a numbered official receipt document is yours.

---

## 5. How to plug in without touching any screen

In `queries.js`, one function at a time:

```js
// now
function lowStockItems() {
  return DB.inventory_items.filter(function (i) {
    return i.is_active !== 0 &&
           Number(i.current_stock) <= Number(i.reorder_level);
  });
}

// later
function lowStockItems() {
  return fetch('api/inventory/low-stock').then(function (r) { return r.json(); });
}
```

The screens will need to await these once they return promises — tell me when
you are close and I will do that pass in one go. It is about an hour's work on
my side and I would rather do it once, against real endpoints, than guess now.

---

## 6. Running it

```bash
python .claude/devserver.py      # serves on http://localhost:5174
```

Or just double-click `index.html` — it works with no server at all. Please
keep that property if you can: it is what lets any of us demo on any machine
in the room without setting up XAMPP first.

`assets/js/data.js` is **generated**, never hand-edited. If the seed changes:

```bash
python scripts/sql2js.py
```

It reparses the seed, replays the triggers, and rewrites the file. I diffed
its output against the live database row by row — 18 of 18 audit rows, all 6
reservations' money, all 12 items' stock — identical.

---

Anything unclear, ask me rather than guessing. I would much rather answer a
question than have you build against a wrong assumption.

— Angelo
