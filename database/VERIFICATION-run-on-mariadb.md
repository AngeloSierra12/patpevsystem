# Verification run — executed against real MariaDB

**Run by:** Angelo Sierra (frontend) · for Darren Tamayo (database)
**Date:** 21 September 2026
**Engine:** MariaDB **10.4.32** — the same version XAMPP 8.2 ships
**Method:** portable server, throwaway data directory, port 3309.
Nothing was installed system-wide and no XAMPP installation was touched.
**Procedure:** exactly the seven commands in `database/README.md`, in order.

This closes the caveat that has been on every previous check: until now the
schema had only ever been **parsed**, never **run**.

---

## Status: FIXED and re-verified

The bug below was found on the first run, fixed in `06_seed_data.sql`, and the
whole set re-run from a dropped database. **All seven scripts now execute with
no errors** and `audit_logs` holds 18 rows. The section is kept because Darren
should know what changed in his file and why.

---

## The bug that was found

```
BEFORE THE FIX                        AFTER THE FIX
OK    01_database.sql                 OK    01_database.sql
OK    02_tables.sql                   OK    02_tables.sql
OK    03_indexes.sql                  OK    03_indexes.sql
OK    04_views.sql                    OK    04_views.sql
OK    05_triggers.sql                 OK    05_triggers.sql
FAIL  06_seed_data.sql   ERROR 1062   OK    06_seed_data.sql
OK    07_audit_archive.sql            OK    07_audit_archive.sql

                                      audit_logs: 18 rows
```

Before the fix, following the README as written left a **broken database**. The seed aborts
at the `audit_logs` insert, so the audit trail ends up holding 3 rows instead
of 18, and `07_audit_archive.sql` then runs against incomplete data.

### Why it happens

`trg_payment_after_insert` writes its own `PAYMENT_RECORDED` row into
`audit_logs`. The seed inserts **payments before audit_logs**, so by the time
the `audit_logs` statement runs, the trigger has already taken `log_id` 1, 2
and 3:

```
log_id  action_type        description
1       PAYMENT_RECORDED   Payment OR-2026-00891 … BPSU-RES-202609-0001 via CASH
2       PAYMENT_RECORDED   Payment OR-2026-00892 … BPSU-RES-202609-0002 via UNIVERSITY_CHARGE_SLIP
3       PAYMENT_RECORDED   Payment OR-2026-00885 … BPSU-RES-202609-0005 via CASH
```

The seed then tries to insert its own row with a hardcoded `log_id` of `1`,
and collides.

The seed's own comment block already documents that the trigger generates
these rows. The oversight is only that `log_id` is still written by hand into
a table a trigger also writes to.

### The fix, applied

Let `log_id` auto-increment. Drop it from the column list and drop the leading
number from each of the fifteen tuples:

```sql
-- was
INSERT INTO audit_logs
    (log_id, user_id, username_snapshot, role_snapshot,
     action_type, target_entity, target_id, description, logged_at)
VALUES
(1,  1, 'admin', 'ADMIN', 'SYSTEM_INIT', 'SYSTEM', NULL, '…', '2026-09-01 08:00:00'),

-- now
INSERT INTO audit_logs
    (user_id, username_snapshot, role_snapshot,
     action_type, target_entity, target_id, description, logged_at)
VALUES
(1, 'admin', 'ADMIN', 'SYSTEM_INIT', 'SYSTEM', NULL, '…', '2026-09-01 08:00:00'),
```

Renumbering the literals to start at 4 would also work today, but it breaks
again the moment a payment is added or removed. Auto-increment does not.

This is now in `06_seed_data.sql`, with a comment above the statement
explaining why `log_id` is absent so nobody puts it back. A clean rebuild runs
all seven scripts with **no errors**, and `audit_logs` holds 18 rows: the 3 the
trigger wrote plus the 15 seeded.

`assets/js/data.js` was regenerated to match. `scripts/sql2js.py` now replays
the payment trigger's audit rows as well, and assigns `log_id` the way
AUTO_INCREMENT does. The mirror was then compared against the live database:

| Check | Result |
|---|---|
| Row counts, all 13 tables | identical |
| `audit_logs`, row by row | 18 of 18 identical |
| `paid_amount` and `balance`, all 6 reservations | identical |
| `current_stock` and `unit_cost`, all 12 items | identical |

---

## Everything else was verified correct

Every figure previously predicted by parsing was produced by the real engine.

### `paid_amount` and `balance` — written by `trg_payment_after_insert`

| Reservation | total_amount | paid_amount | balance | Predicted |
|---|---|---|---|---|
| 1 | 3,600.00 | 3,600.00 | 0.00 | matches |
| 2 | 1,200.00 | 600.00 | 600.00 | matches |
| 3 | 6,600.00 | 0.00 | 6,600.00 | matches |
| 4 | 1,800.00 | 0.00 | 1,800.00 | matches |
| 5 | 1,200.00 | 1,200.00 | 0.00 | matches |
| 6 | 6,400.00 | 0.00 | 6,400.00 | matches |

Seeding `paid_amount` at `0.00` and letting the trigger produce the total
behaves exactly as intended. No double counting.

### Stock levels — written by the two stock triggers

No negative stock. One item at its reorder level: `ING-005` Refined White
Sugar, 2.000 against a reorder level of 2.000. `vw_low_stock_items` returns
that one row.

### `inventory_transactions` — 20 rows, all written by triggers

12 `STOCK_IN`, 8 `STOCK_OUT`. Lowest `stock_after` snapshot is 2.000, so the
ledger never goes negative. The last snapshot per item was compared against
`inventory_items.current_stock`: **0 items disagree**.

### Delivery headers reconcile with their line items — all five

```
DR-2026-041   14,100.00 = 14,100.00
DR-2026-042    2,300.00 =  2,300.00
DR-2026-043   17,342.00 = 17,342.00
DR-2026-044    5,816.00 =  5,816.00
DR-2026-045    9,990.00 =  9,990.00
```

### All 13 views execute

| View | Rows | | View | Rows |
|---|---|---|---|---|
| vw_reservation_summary | 6 | | vw_inventory_value | 6 |
| vw_room_availability | 8 | | vw_stock_movement | 20 |
| vw_payment_totals | 3 | | vw_delivery_summary | 5 |
| vw_guest_history | 6 | | vw_supplier_delivery_totals | 4 |
| vw_occupancy_report | 2 | | vw_consumption_summary | 8 |
| vw_daily_revenue | 3 | | vw_audit_log_full | 18 |
| vw_low_stock_items | 1 | | | |

No syntax errors, no missing columns, no invalid references.

### `07_audit_archive.sql`

Creates `sp_archive_audit_logs` without error.

---

## Confirmed as real behaviour, still worth a decision

`trg_delivery_item_after_insert` sets `inventory_items.unit_cost =
NEW.unit_cost`. The live run confirms it: `STP-001` ends at **2,350.00**, the
price on its most recent delivery line, not the cost the row was seeded with.

So stock is valued at latest cost rather than weighted average. That is a real
accounting choice and it changes the stock value the reports show. Flagged
previously; now confirmed to behave that way in practice. Still your call.

---

## One cosmetic note

`deliveries` uses `delivery_receipt_no`, while `payments` uses
`receipt_number`. Both are fine on their own; the inconsistency just means
anyone writing a join has to check which is which. Not worth changing if the
ERD is already submitted.
