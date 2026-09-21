# Seed verification

**Checked by:** Angelo Sierra (frontend) · for Darren Tamayo (database)
**Version checked:** the updated `database.zip`, installed 15 September 2026.
**Files changed by the frontend:** none. This round is a check, not an edit.

---

## The four corrections from last round were all taken

Every one of them is in the new version. Nothing had to be re-applied.

| | Status |
|---|---|
| Delivery headers matching their line items | fixed |
| `paid_amount` seeded at `0.00`, trigger produces the total | fixed |
| `SET FOREIGN_KEY_CHECKS` removed | fixed |
| Audit action names on the trigger's convention | fixed |

---

## What was re-checked, and the result

Parsed the new seed and recomputed every figure the UI depends on.

**1. Delivery headers reconcile with their line items — all five.**

```
DR-2026-041   14,100.00 = 14,100.00
DR-2026-042    2,300.00 =  2,300.00
DR-2026-043   17,342.00 = 17,342.00
DR-2026-044    5,816.00 =  5,816.00
DR-2026-045    9,990.00 =  9,990.00
```

**2. `paid_amount` is seeded at zero on all six reservations.** The payment
trigger produces these:

| Reservation | Total | Payments | paid_amount | balance |
|---|---|---|---|---|
| 1 | 3,600.00 | 3,600.00 | 3,600.00 | 0.00 |
| 2 | 1,200.00 | 600.00 | 600.00 | 600.00 |
| 3 | 6,600.00 | — | 0.00 | 6,600.00 |
| 4 | 1,800.00 | — | 0.00 | 1,800.00 |
| 5 | 1,200.00 | 1,200.00 | 1,200.00 | 0.00 |
| 6 | 6,400.00 | — | 0.00 | 6,400.00 |

**3. Stock never goes negative.** One item sits at its reorder level:
`ING-005` Refined White Sugar, 2 bags against a reorder level of 2. That reads
as *Reorder* on the inventory screen, which is the intended behaviour.

**4. Every foreign key resolves against a row inserted earlier**, so the seed
does not need the bypass that was removed.

**5. `inventory_transactions` is seeded empty, which is correct.** The delivery
and consumption triggers each insert one row. Seeding rows by hand as well
would double them. Twenty rows result from the seed: twelve `STOCK_IN`, eight
`STOCK_OUT`.

---

## One thing worth knowing about, not a bug

`trg_delivery_item_after_insert` sets `inventory_items.unit_cost = NEW.unit_cost`,
so an item is valued at whatever the **most recent delivery** charged, not at
the cost seeded on the row. That is a real decision — it is moving-latest-cost
rather than weighted average — and it changes the stock value the reports show.

It is worth being deliberate about it before the report figures are presented.
Weighted average is the more usual choice for canteen stock, and it would need
the cost recomputed across remaining quantity on each delivery rather than
overwritten. Your call; the frontend follows whichever you pick.

---

## How the UI consumes this

`scripts/sql2js.py` parses the seed and replays the triggers in insert order to
produce `assets/js/data.js`: `paid_amount`, `current_stock`, `unit_cost`, and
the full `inventory_transactions` ledger with its before and after snapshots.
The ledger's final snapshot per item was checked against `current_stock` and
matches on all twelve items.

`users.password_hash` is dropped during generation. `data.js` is plain text
served to the browser, so anything secret in it would be public.

---

## Still verified by parsing, not by running

There is no MariaDB client on this machine, so the scripts have **not been
executed**. Everything above is arithmetic recomputed from the SQL text. Run
the seed against MariaDB 10.4 and confirm the trigger output matches the tables
above — particularly the `paid_amount` column and the twenty ledger rows.
