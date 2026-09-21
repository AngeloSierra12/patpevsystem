# For Andrew — Project Lead & System Analyst

**From:** Angelo (Frontend & UI/UX)
**Date:** 21 September 2026

The interface layer is finished. All seven screens, every region, no
placeholders left anywhere. This is what you need to know as project lead, and
the three decisions I think are yours to make.

---

## 1. Where the project actually stands

I measured the build against the charter rather than against our own WBS, and
wrote it up in `SCOPE-CHECK.md`. The honest summary:

| | Before today | Now |
|---|---|---|
| Screens with placeholder regions | 7 of 8 | **0** |
| Charter in-scope items with a working interface | 6 of 15 | **15 of 15** |
| Charter in-scope items that can *record* anything | 0 | 0 |

That last row is the one that matters and I want to be plain about it: **the
interface for every module is complete, and nothing writes to the database
yet.** Ten of the fifteen in-scope items are write operations. Every form on
the system validates properly and then prints the exact row it would send,
instead of reporting a save that did not happen.

That is a deliberate choice, not a shortcut. A form that says "Saved!" and
discards the data would demo beautifully and be a lie. This way the screens
are honest, and the printed payloads double as Carlos's specification.

**What this means for a demo:** you can walk a panel through every screen,
every form, every validation rule and every report, and it is all real data
from the real seed. You cannot show a record surviving a refresh.

---

## 2. The database is verified. That caveat is closed.

Every previous status I gave you said the schema had been checked by *reading*
it. I ran it for real on MariaDB 10.4.32 today.

It failed. `06_seed_data.sql` aborted on a duplicate primary key — the payment
trigger writes its own audit rows, so the IDs the seed hardcoded were already
taken. Anyone following our own README got a broken database.

Fixed, re-run, all seven scripts clean. Full write-up in
`database/VERIFICATION-run-on-mariadb.md`. **Darren should read that one** —
he would have lost an evening to it.

---

## 3. Three decisions that are yours

### a. The charter and the WBS disagree about who owns what

Four mismatches. The one that matters most:

> **The charter assigns the Dashboard to the Frontend & UI/UX Developer, due
> 25 September.** Our WBS gave it to you as 8.2 Hotel Metrics Integration.

I built it, because the charter is the signed document and the due date is
Friday. But the two documents still contradict each other, and the others do
too:

| Deliverable | Charter says | We have been saying |
|---|---|---|
| Dashboard | Frontend — me | You |
| Inventory Management | Carlos | Carlos and Darren |
| Audit Trail | **Fritz** | Darren |
| Report aggregation | You | Darren |

**Fritz is named nowhere in our build**, despite the charter assigning him the
Audit Trail *and* the entire System Documentation set. Either the charter gets
updated or the WBS does, but they should not disagree at turnover.

### b. The charter contradicts itself on payments

> Budget, OPEX: *Payment Gateway Integration and Transaction Fees* — **Php 40,000**
> Out of Scope: *Online payment gateway integration (e.g. GCash, Maya, PayPal…)*

Php 40,000 of a Php 590,000 budget funds something the same document says will
not be built. If a panelist reads both pages, none of us can answer it. Worth
fixing before Chapter 1 goes out.

### c. The seed's dates have gone stale

Every reservation is dated 5–22 September. The dashboard's occupancy chart is
therefore nearly empty today, and will look worse every week. The chart is
correct — the data has just aged past it.

Ask Darren to re-date the sample reservations so a few span the current week.
It is a five-minute change to `06_seed_data.sql` and it is the difference
between a dashboard that looks alive at the defense and one that looks broken.

---

## 4. Things I found while building that you may want in the paper

These came out of building against the real schema, and they are the kind of
specifics that make a Chapter 2 gap analysis defensible:

- **`UNIVERSITY_CHARGE_SLIP` is a first-class payment method** in our schema,
  with a reference code and an OR number. No commercial hotel system models
  how an SUC income-generating unit actually collects money. That is our
  strongest claim to novelty.
- **The audit trail stores `username_snapshot` and `role_snapshot` at the time
  of the event**, so a transaction stays attributable after staff turnover. A
  plain foreign key would leave a null actor — exactly the record COA would
  ask for.
- **Two stock thresholds, not one.** Reorder means buy more; critical means
  service is at risk. Most inventory tools carry a single reorder point.
- **Guests are not one population.** Students, faculty, CHED and DPWH
  visitors, walk-ins. `guest_user_id` is nullable and the ID type is free
  text, because we cannot assume every guest holds an account.

I wrote a full gap analysis around these — it is in our chat, ready for
Chapter 2, and it needs citations attached before it can go in.

---

## 5. What is left, and who it belongs to

| Work | Owner | Note |
|---|---|---|
| Authentication and sign-in | Carlos | Nothing signs in; the shell runs as one fixed account |
| The API layer | Carlos | Detailed spec in `HANDOVER-carlos.md` |
| Official receipt document | Carlos | The statement is built and printable |
| Re-date the seed | Darren | See 3c |
| Weighted-average vs latest cost | Darren | Stock is valued at the last delivery price; that is a real accounting choice |
| SRS, System Design, User Manual, Installation Guide | Fritz | None started |
| Data dictionary | Fritz / Darren | The ERD exists; the dictionary does not |

Once Carlos's endpoints exist, switching the frontend over is roughly an
hour's work in one file. No screen changes.

---

## 6. Where everything is

```
SCOPE-CHECK.md                            build vs charter, item by item
HANDOVER-carlos.md                        the API spec
database/VERIFICATION-run-on-mariadb.md   the execution report and the bug
README.md                                 how to run it and why it is built this way
```

Everything is committed to git with full history.

To run it: double-click `index.html`. No install, no server, no internet.

— Angelo
