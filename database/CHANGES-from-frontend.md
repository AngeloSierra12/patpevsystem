# Seed data corrections

**Applied by:** Angelo Sierra (frontend) · for review by Darren Tamayo (database)
**File touched:** `06_seed_data.sql` only. Files 01–05 and 07 are unchanged.

These are the arithmetic and consistency errors found while wiring the UI to
the schema. Every one is a correctness fix, not a preference. The schema
itself, the triggers, the views and the ERD were left alone.

---

## 1. Delivery headers did not equal their line items

Three of the five `deliveries.total_amount` values disagreed with the sum of
their `delivery_items`. Any report joining the two would have shown different
totals depending on which side it read.

| Receipt | Header was | Lines total | Now |
|---|---|---|---|
| DR-2026-043 | 9,378.25 | 17,342.00 | **17,342.00** |
| DR-2026-044 | 2,553.00 | 5,816.00 | **5,816.00** |
| DR-2026-045 | 10,057.50 | 9,990.00 | **9,990.00** |

The line items were left untouched; only the headers moved to match them.
All five now reconcile:

```
DR-2026-041   14,100.00 = 14,100.00
DR-2026-042    2,300.00 =  2,300.00
DR-2026-043   17,342.00 = 17,342.00
DR-2026-044    5,816.00 =  5,816.00
DR-2026-045    9,990.00 =  9,990.00
```

## 2. `paid_amount` was double counted, then patched over

The seed set `reservations.paid_amount` directly, then inserted payments. The
payment trigger added those amounts again, so the table briefly held double
the correct figure. Three `UPDATE` statements at the end then wrote the right
value back.

The final numbers were correct, but the seed was demonstrating a repair rather
than the database's actual behaviour, and it hid whether the trigger worked.

**Changed to:** seed `paid_amount = 0.00` on all six reservations, insert the
payments, and let the trigger produce the totals. The three corrective
`UPDATE` statements were removed.

Expected result after the trigger runs:

| Reservation | Total | Payments | paid_amount | balance |
|---|---|---|---|---|
| res-1 | 3,600.00 | 3,600.00 | 3,600.00 | 0.00 |
| res-2 | 1,200.00 | 600.00 | 600.00 | 600.00 |
| res-3 | 6,600.00 | — | 0.00 | 6,600.00 |
| res-4 | 1,800.00 | — | 0.00 | 1,800.00 |
| res-5 | 1,200.00 | 1,200.00 | 1,200.00 | 0.00 |
| res-6 | 6,400.00 | — | 0.00 | 6,400.00 |

## 3. `SET FOREIGN_KEY_CHECKS = 0` was not needed

The inserts already run in dependency order:

```
users → guests → room_types → rooms → reservations → payments
→ suppliers → inventory_items → deliveries → delivery_items
→ inventory_consumption → audit_logs
```

Every foreign key resolves against a row inserted earlier, so the bypass was
masking nothing. Both the `= 0` and `= 1` statements were removed. If the seed
now fails on a foreign key, that is a real ordering problem worth seeing.

## 4. Audit action names were inconsistent

The reservation trigger emits `CONCAT('RESERVATION_', NEW.status)`, which
produces `RESERVATION_CONFIRMED`, `RESERVATION_CHECKED_IN`,
`RESERVATION_CHECKED_OUT`, `RESERVATION_CANCELLED`. The seed used a different
shape, so a search for one convention would have missed half the rows.

Seed names were brought onto the trigger's convention:

| Was | Now |
|---|---|
| `RESERVATION_CREATE` | `RESERVATION_CREATED` |
| `CHECK_IN` | `RESERVATION_CHECKED_IN` |
| `RESERVATION_CANCEL` | `RESERVATION_CANCELLED` |

`RESERVATION_CONFIRMED` already matched. `USER_CREATE`, `DELIVERY_RECORD`,
`SYSTEM_INIT`, `LOGIN` and `LOGOUT` are separate entities and were left as
they are.

---

## Not changed, deliberately

| Item | Why |
|---|---|
| Schema, indexes, views, triggers, archive | Not a frontend concern, and no correctness error was visible from the data |
| `vw_room_availability` date logic | Flagged in your brief; it is a design decision for the database owner |
| Occupancy view grouping by check-in month | Same |
| Low-stock index `(is_active, current_stock, reorder_level)` | Same |
| Payment overpayment rules, refund handling | Same |
| Audit actor semantics (`handled_by` vs real session user) | Same |
| `07_audit_archive.sql` opening with `DROP TABLE` | Same |
| ERD / DBML | Regenerating it is the database owner's task |

---

## How this was verified

By **parsing** the SQL and recomputing the arithmetic. There is no MariaDB
client on this machine, so the scripts were **not executed**. Run them against
MariaDB 10.4 to confirm the triggers behave as the table above predicts.
