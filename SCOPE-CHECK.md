# Scope check — prototype against the project charter

**Checked:** 15 September 2026
**Charter:** *Hotel Reservation System and Inventory System for IGP PATVEP Hostel
and University Canteen*, 11 pages
**Against:** this repository at its current state — the UI shell, the database
scripts, and the wireframe document

Nothing was changed to produce this. It is a reading of what exists.

---

## How to read the marks

| | Meaning |
|---|---|
| **LIVE** | Works in the prototype now, against real records from the seed |
| **SHELL** | The screen and its layout exist; the feature behind it does not |
| **DATA** | Modelled in the database, not reachable from any screen |
| **NONE** | Not started anywhere |

A word on what "live" can mean here. The prototype is a **UI shell with a
read-only data layer**. It reads; it never writes. So no charter item that
requires *recording* something can be marked LIVE, however complete its screen
looks. Ten of the fifteen in-scope items are write operations.

---

## Part 1 — The charter's In-Scope list

| # | In-scope item | State | What exists |
|---|---|---|---|
| 1 | Secure role-based login (Admin, Staff, Guest) | **NONE** | No sign-in. The shell runs as one fixed account. Roles exist as a 4-value column and render as labels, but nothing authenticates and no screen is restricted. |
| 2 | Guest registration, profiles, booking history | **LIVE** (read) | Guest profile menu with 6 guests: contact, ID presented, address, linked account, and full stay history with balances. Registration and editing: **NONE**. |
| 3 | Room information — add, update, delete, types, availability | **LIVE** (read) | 8 rooms listed with number, type, rate, capacity, status. 7 room types. Add/update/delete: **NONE**. `vw_room_availability` exists but no screen reads it. |
| 4 | Guests reserve rooms by date and type | **NONE** | No booking form anywhere, staff-facing or guest-facing. |
| 5 | Reservation confirm / modify / cancel / status monitoring | **LIVE** (read) | 6 reservations with status shown per guest. All four actions: **NONE**. |
| 6 | Guest check-in and check-out transactions | **DATA** | Status values and the audit trigger exist. No screen records either. |
| 7 | Payments, payment modes, billing statements, receipts | **DATA** | `payments` table, 4-mode `payment_method`, `receipt_number`, and a trigger maintaining `paid_amount`. Reports shows collected and outstanding totals. Payment entry, billing and receipts: **NONE**. |
| 8 | Inventory module — food, beverages, supplies | **LIVE** (read) | 12 items with stock, reorder level, critical level and a state tag. Add/edit/delete: **NONE**. |
| 9 | Purchases, replenishment, issuance, consumption | **DATA** | Two triggers, a 20-row movement ledger, 8 consumption records. Reports counts them. No recording screen. |
| 10 | Supplier information and delivery records | **DATA** | 4 suppliers, 5 deliveries, 12 delivery lines. Reports shows counts and total value. No supplier or delivery screen. |
| 11 | Dashboard — occupancy, reservation stats, inventory status, low-stock alerts | **SHELL** | All four regions are placeholders. Only the header count line is live. |
| 12 | Reports — reservations, occupancy, inventory, stock movement, transactions | **LIVE** (partial) | A counted summary across 7 tables in 6 blocks. Date filtering, report types, aggregation and export: **NONE** (export button is disabled). |
| 13 | Audit logs | **LIVE** (read) | 15 entries, read-only, in plain English. Logger, search, filter: **NONE**. |
| 14 | Scheduling / calendar | **SHELL** | Page exists, month label is live, everything else is a placeholder. Previous/next are disabled. |
| 15 | Centralized database | **AUTHORED, UNVERIFIED** | 13 tables, 13 views, 6 triggers, 1 procedure. **Never executed against MariaDB** — there is no client on this machine. The browser reads a generated JavaScript mirror, not the database. |

**Count:** 6 items have something live and read-only · 4 exist only as data ·
2 are empty shells · 2 are untouched · 1 is authored but unverified.

---

## Part 2 — The charter's Deliverables, item by item

### Hotel Reservation System Module — *charter assignee: Backend & API Developer*

| Sub-item | State |
|---|---|
| Role-based secure login | NONE |
| Guest registration and profile management | Profile display LIVE · registration NONE |
| Room management (types, cost, availability) | Display LIVE · management NONE |
| Online room reservation | NONE |
| Reservation management (confirm/modify/cancel) | NONE |
| Room availability check | DATA (view exists, unused) |
| Check-in and check-out management | NONE |
| Reservation history | LIVE |
| Payment entry | NONE |
| Billing and receipt generation | NONE |

**2 of 10.**

### Inventory Management System Module — *charter assignee: Backend & API Developer*

| Sub-item | State |
|---|---|
| Product, food, beverage and supply management | Display LIVE · management NONE |
| Stock-in and stock-out management | DATA |
| Inventory purchase recording | NONE |
| Stock replenishment management | NONE |
| Low stock management and alerts | Threshold tags LIVE · alerting NONE |
| Supplier data management | DATA |
| Delivery record management | DATA |
| Consumption of inventories | DATA |

**1 of 8 fully, 1 partial.**

### Dashboard — *charter assignee: Frontend & UI/UX Developer*

| Sub-item | State |
|---|---|
| Room occupancy status | SHELL |
| Current reservations | SHELL |
| Inventory status | SHELL |
| Low-stock alerts | SHELL |
| System summary and statistics | Header count line only |

**0 of 5.** Note this module is assigned to the Frontend developer in the
charter but every region on screen currently names a different owner — see
Part 5.

### Report Generation Module — *charter assignee: Project Lead & System Analyst*

| Sub-item | State |
|---|---|
| Reservation reports | Counts LIVE · report NONE |
| Room occupancy reports | Counts LIVE · report NONE |
| Guest records | LIVE (on the reservation screen) |
| Inventory level reports | Counts LIVE · report NONE |
| Stock movement reports | Counts LIVE · report NONE |
| Transaction reports | Counts LIVE · report NONE |

**1 of 6.** The summary counts real records but nothing filters, aggregates or
exports.

### User Management Module — *charter assignee: Project Lead & System Analyst*

| Sub-item | State |
|---|---|
| User account management | List, search, role filter and read-only detail LIVE · create/edit/delete NONE |
| Assign user roles | NONE |
| User permission control | NONE |
| User information update | NONE |

**0 of 4 fully.** This is the most complete screen in the prototype and still
delivers none of its four sub-items, because all four are writes.

### Audit Trail and Activity Logs — *charter assignee: QA / Tester & Documentation Lead*

| Sub-item | State |
|---|---|
| User login history | LIVE (display) |
| User activities | LIVE (display) |
| System transactions | LIVE (display) |
| Changes to reservations and inventory | Trigger DATA · display LIVE |

**4 of 4 displaying**, 0 of 4 recording. The trigger that writes reservation
changes exists in SQL; nothing else logs anything.

### Scheduling and Calendar Module — *charter assignee: Backend & API Developer*

| Sub-item | State |
|---|---|
| Viewing reservations | SHELL |
| Monitoring room bookings | SHELL |
| Managing reservation schedule | SHELL |

**0 of 3.**

### Database — *charter assignee: Database Specialist*

| Sub-item | State |
|---|---|
| Guest information | Table exists |
| Reservation records | Table exists |
| Room information | Tables exist (rooms + room_types) |
| Inventory records | Tables exist |
| Supplier records | Table exists |
| User accounts | Table exists |
| Transaction history | Tables exist (payments + inventory_transactions + audit_logs) |

**7 of 7 modelled.** None verified by execution.

### System Documentation — *charter assignee: QA / Tester & Documentation Lead*

| Sub-item | State |
|---|---|
| Software Requirements Specification | NONE |
| System Design Document | NONE |
| Database Design (ERD and Data Dictionary) | ERD/DBML exists · data dictionary NONE |
| User Manual | NONE |
| Technical Documentation | Partial — repository README and database notes |
| Installation Guide | NONE |

**0 of 6 complete.**

---

## Part 3 — Out-of-scope compliance

Each of the charter's ten exclusions, checked against the build.

| # | Excluded | Status |
|---|---|---|
| 1 | Online payment gateway (GCash, Maya, PayPal, card) | **Clear** — but see creep item C6 |
| 2 | Third-party hotel booking platforms | Clear |
| 3 | Mobile app for Android or iOS | Clear — the site is responsive, which is not an app |
| 4 | SIS / HRMS / Accounting integration | Clear |
| 5 | POS operations beyond inventory monitoring | Clear |
| 6 | Payroll, attendance, HR functions | Clear |
| 7 | Procurement approval workflows, automated ordering | Clear |
| 8 | SMS or email notifications | Clear — no sending code anywhere |
| 9 | Multi-campus or multi-branch | Clear |
| 10 | Predictive analytics, forecasting, AI recommendations | Clear |

**No breach of any exclusion.**

---

## Part 4 — Present in the build, not named in the charter

Listed for your decision. **Nothing here has been removed or changed.**

| | Item | Where | Why it is flagged | Severity |
|---|---|---|---|---|
| **C1** | Audit log archiving | `database/07_audit_archive.sql`, `sp_archive_audit_logs` | The Audit Trail deliverable lists four things to *record*. Archiving and retention is a fifth capability nobody asked for. | Low |
| **C2** | Quick Actions panel | Dashboard, `dashboard.js` | The Dashboard deliverable names five regions. This is a sixth. It is in the team's WBS (8.3) but not in the charter. | Low |
| **C3** | "My Account" screen | `pages/account.html` | The User Management deliverable is written from the administrator's side. A self-service account screen is a different audience. Arguably covered by "user information update". | Low |
| **C4** | UI Wireframe Document | `wireframes/` | System Documentation names six documents. A wireframe document is not one of them, though it supports the System Design Document. | Very low |
| **C5** | Search and role filter on User Management | `users.js` | Not named in the four User Management sub-items. Reads as a usability affordance rather than a feature claim. | Negligible |
| **C6** | `GCASH_MANUAL_REF` payment method | `02_tables.sql`, `payments.payment_method` | This is a **manual reference field a staff member types in**, not an integration, so it does not breach exclusion #1. But the word GCash sits in the schema next to an exclusion that names GCash, and any reviewer skimming will stop on it. Worth one clarifying comment in the SQL. | Watch |

### Checked and found **not** to be creep

- **`inventory_transactions`** (the new ledger table) — In-Scope #9 names "stock
  issuance", and the Reports deliverable names "stock movement reports". A
  movement ledger is the thing that makes both possible. In scope.
- **Responsive / mobile layout** — exclusion #3 rules out a native Android or
  iOS application. A website that reflows is not that.
- **`vw_daily_revenue`** — covered by "Transaction reports".

### Not features, but counted in the repository

These exist because a browser cannot open a MariaDB connection. They are
scaffolding for the prototype and are **not** part of the system:
`scripts/sql2js.py`, the generated `assets/js/data.js`, `.claude/devserver.py`,
`.claude/launch.json`. Worth stating plainly in the turnover document so nobody
mistakes the generated mirror for the database.

Separately, `_archive-v1/` holds the previous build — 592 KB, 63% of the
repository, referenced by nothing.

---

## Part 5 — Ownership does not match the charter

The charter's Milestones table assigns each deliverable to a role. The
prototype's on-screen labels name different people for four of them. This
matters because the charter is the signed document and the labels are what a
sponsor sees.

| Deliverable | Charter assignee | Named on screen | |
|---|---|---|---|
| Hotel Reservation Module | Backend & API — Capuli | J. C. Capuli | match |
| Inventory Management Module | Backend & API — Capuli | Capuli *and* D. Tamayo | **mismatch** |
| Dashboard | Frontend & UI/UX — **Sierra** | A. Santos (all four regions) | **mismatch** |
| Report generation module | Project Lead — Santos | Santos (controls) · Tamayo (aggregation) | **partial mismatch** |
| User Management Module | Project Lead — Santos | A. Santos | match |
| Audit Trail and Activity Logs | QA / Tester — **Sarmiento** | D. Tamayo | **mismatch** |
| Scheduling and Calendar | Backend & API — Capuli | J. C. Capuli | match |
| Database | Database Specialist — Tamayo | D. Tamayo | match |

**Fritz Edrick B. Sarmiento is named nowhere in the prototype**, despite the
charter assigning him two deliverables: Audit Trail and Activity Logs, and the
entire System Documentation set.

The likely cause is that the updated WBS reassigned work and the charter was
not updated to follow. Either document can be the one that moves, but they
should not disagree at turnover.

---

## Part 6 — One contradiction inside the charter itself

The **budget** funds a line the **scope** excludes:

> OPEX — *Payment Gateway Integration and Transaction Fees* — **Php 40,000**

> Out of Scope — *Online payment gateway integration (e.g., GCash, Maya,
> PayPal, or credit/debit card processing).*

Php 40,000 of a Php 590,000 budget is allocated to something the charter says
will not be built. This is worth resolving before the sponsor reads both pages,
because it is the kind of thing that invites a question nobody on the team can
answer.

---

## Summary

- **In-scope items with anything working:** 6 of 15, all read-only
- **Deliverable sub-items complete:** roughly 15 of 53, nearly all display-only
- **Out-of-scope breaches:** none
- **Items present but not in the charter:** 6, all low severity, none removed
- **Ownership mismatches against the charter:** 4
- **Contradictions inside the charter:** 1

The honest summary is that the prototype is a **complete shell with a real
read-only data layer, and almost no write path**. That is a reasonable place to
be in early research and development, but it means the current build satisfies
very little of the charter as written, and the gap is concentrated in exactly
one place: nothing records anything yet.
