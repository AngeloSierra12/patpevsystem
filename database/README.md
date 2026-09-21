# BPSU IGP PATVEP Hostel & University Canteen System
## Database Package — README

**Role:** Database Specialist — Darren Jude S. Tamayo  
**Course:** BSIT-NW3A, Bataan Peninsula State University (BPSU) Main Campus  
**System:** Hotel Reservation System and Inventory System for IGP PATVEP Hostel and University Canteen

---

## Directory Contents

| File | Purpose | Run Order |
|------|---------|-----------|
| `01_database.sql` | Creates the `bpsu_patvep` database, sets charset and timezone | 1 |
| `02_tables.sql` | Creates all 13 tables in dependency order, with constraints | 2 |
| `03_indexes.sql` | Adds composite/covering indexes for performance | 3 |
| `04_views.sql` | Creates 13 SQL views for dashboard and reporting | 4 |
| `05_triggers.sql` | 6 triggers for stock management, audit automation, and payment integrity | 5 |
| `06_seed_data.sql` | Realistic demo data for all tables | 6 |
| `07_audit_archive.sql` | Archive table + stored procedure for log archiving (safe to re-run) | 7 |
| `bpsu_patvep_erd.dbml` | DBML for importing into dbdiagram.io | — |

---

## How to Execute

Using **DBeaver Community**:
1. Open a new SQL Editor connected to your MySQL/MariaDB server
2. Run each `.sql` file **in numerical order**
3. Verify each file completes without errors before running the next

Using **MySQL CLI**:
```bash
mysql -u root -p < 01_database.sql
mysql -u root -p bpsu_patvep < 02_tables.sql
mysql -u root -p bpsu_patvep < 03_indexes.sql
mysql -u root -p bpsu_patvep < 04_views.sql
mysql -u root -p bpsu_patvep < 05_triggers.sql
mysql -u root -p bpsu_patvep < 06_seed_data.sql
mysql -u root -p bpsu_patvep < 07_audit_archive.sql
```

> **Note:** The seed data (06) intentionally starts inventory item stock at 0 and relies on the delivery_items inserts to drive stock up via triggers. This demonstrates the trigger system working correctly.

---

## Table Summary

### Authentication & Users

| Table | Purpose |
|-------|---------|
| `users` | System accounts (Admin, Staff Hostel, Staff Canteen, Guest roles) |
| `guests` | Extended guest profiles. May or may not have a user account. Walk-in guests have `guest_user_id = NULL`. |

### Hotel Reservation Module

| Table | Purpose |
|-------|---------|
| `room_types` | Room category definitions with base rates and capacity |
| `rooms` | Individual physical rooms. Rate per room can differ from type base rate. |
| `reservations` | Core booking record. Stores rate/type snapshots to preserve historical accuracy. |
| `payments` | Individual payment transactions. Multiple payments per reservation supported. |

### Inventory Module

| Table | Purpose |
|-------|---------|
| `suppliers` | Canteen supplier master list |
| `inventory_items` | Item master list with stock levels, reorder and critical thresholds |
| `deliveries` | Delivery header record (one per delivery event) |
| `delivery_items` | Line items per delivery. Triggers auto-update stock. |
| `inventory_transactions` | Complete stock movement ledger. Every change creates one row. |
| `inventory_consumption` | Deliberate usage/consumption records (kitchen, canteen sales, etc.) |

### Audit

| Table | Purpose |
|-------|---------|
| `audit_logs` | Active system-wide event log |
| `audit_logs_archive` | Long-term archive of old log records (moved by procedure) |

---

## Primary Key Convention

All tables use **unsigned AUTO_INCREMENT INT** primary keys named `<table_name>_id`.
Example: `user_id`, `guest_id`, `reservation_id`, `delivery_id`, etc.

This is consistent throughout the schema.

---

## Key Design Decisions

### Why is `guests` separate from `users`?

A guest who books online may have a user account (`guest_user_id → users`).  
A walk-in guest entered by staff has `guest_user_id = NULL`.  
Keeping guests separate ensures guest reservation history survives even if their user account is deleted, and allows staff to book on behalf of guests without requiring a login account.

### Why are `room_number_snapshot`, `room_type_snapshot`, and `rate_per_night_snapshot` stored on reservations?

Room rates change over time. A guest who booked at ₱1,200/night must always see ₱1,200 on their receipt, even if the room type rate later changes to ₱1,500. This is standard hospitality system practice and required for correct billing statements.

### Why is `balance` a GENERATED column?

`balance = total_amount - paid_amount` is always derivable. Using a generated column eliminates the possibility of the three values being inconsistent due to a bug or failed update. The column is `STORED` so it can be indexed.

### Why does `inventory_transactions` use a soft `ref_type/ref_id` instead of two separate FK columns?

A transaction can originate from a delivery, a consumption, or a manual adjustment. Using a polymorphic reference (`ref_type='DELIVERY', ref_id=5`) avoids having three nullable FK columns where two are always NULL. The trade-off is that the DB cannot enforce referential integrity across the three source tables, but this is acceptable because the `ref_id` is always populated by a trigger (not free-form user input).

### Why are audit log actor fields denormalized (username_snapshot, role_snapshot)?

If a user account is renamed or deleted, the audit log must still show who performed the action at the time it happened. Storing the username as a snapshot alongside the (nullable) FK to users achieves both: traceability through the FK while a user exists, and permanent record after deletion.

### Why is `delivery_items.line_total` a GENERATED column?

`line_total = quantity × unit_cost` is always derivable. Storing it prevents rounding inconsistencies and simplifies reporting queries without risking data drift.

---

## Triggers

| Trigger | Table | Event | Effect |
|---------|-------|-------|--------|
| `trg_delivery_item_after_insert` | `delivery_items` | AFTER INSERT | Increases `current_stock`, updates `unit_cost` and `last_restocked_at`, creates STOCK_IN transaction |
| `trg_consumption_after_insert` | `inventory_consumption` | AFTER INSERT | Decreases `current_stock`, creates STOCK_OUT transaction, validates stock not exceeded |
| `trg_reservation_after_update` | `reservations` | AFTER UPDATE | Logs status changes to `audit_logs`. Actor is `handled_by` (the assigned staff user — see trigger note for limitation) |
| `trg_payment_after_insert` | `payments` | AFTER INSERT | Validates payment does not exceed reservation balance, accumulates `paid_amount` on reservation, logs payment to `audit_logs` |
| `trg_payment_before_update` | `payments` | BEFORE UPDATE | **Blocks all updates** — payments are append-only. Raises SIGNAL error. |
| `trg_payment_before_delete` | `payments` | BEFORE DELETE | **Blocks all deletes** — prevents paid_amount from becoming inconsistent. Raises SIGNAL error. |

**No trigger fires another trigger on the same table. There is no recursion risk.**

---

## Views

| View | Use Case |
|------|---------|
| `vw_reservation_summary` | Full reservation list with guest, room, and handler names |
| `vw_room_availability` | Current room status with active reservation dates |
| `vw_payment_totals` | Payment summary per reservation |
| `vw_guest_history` | Booking history per guest |
| `vw_occupancy_report` | Occupied nights and revenue by room type by month |
| `vw_daily_revenue` | Payments collected per day broken down by method |
| `vw_low_stock_items` | Items at or below reorder level, with status CRITICAL or LOW |
| `vw_inventory_value` | Total stock value per category |
| `vw_stock_movement` | Full transaction ledger with item and user names |
| `vw_delivery_summary` | Delivery headers with supplier info and line-item counts |
| `vw_supplier_delivery_totals` | Supplier delivery performance |
| `vw_consumption_summary` | Consumption records with item and user names |
| `vw_audit_log_full` | Audit logs joined with user full name |
| `vw_all_audit_logs` | UNION of active + archived audit logs for cross-table search |

---

## Audit Archiving

The stored procedure `sp_archive_audit_logs(days_to_keep)` moves old audit records to `audit_logs_archive`.

```sql
-- Archive logs older than 90 days
CALL sp_archive_audit_logs(90);

-- Archive logs older than 6 months
CALL sp_archive_audit_logs(180);
```

Records are **moved**, not deleted. The archive table is permanent.  
The view `vw_all_audit_logs` provides a unified search across both tables.

---

## ERD (dbdiagram.io)

1. Open https://dbdiagram.io/d
2. Click **Import → DBML**
3. Paste the contents of `bpsu_patvep_erd.dbml`
4. The ERD will render with all tables and relationships

---

## Useful Demo Queries

```sql
-- All current reservations with guest and room info
SELECT * FROM vw_reservation_summary WHERE status IN ('CONFIRMED','CHECKED_IN');

-- Low-stock and critical items
SELECT * FROM vw_low_stock_items;

-- Stock movement history for rice
SELECT * FROM vw_stock_movement WHERE item_code = 'STP-001' ORDER BY transaction_date;

-- Revenue collected this week
SELECT * FROM vw_daily_revenue WHERE payment_day >= CURDATE() - INTERVAL 7 DAY;

-- All deliveries from a specific supplier
SELECT * FROM vw_delivery_summary WHERE supplier_name LIKE '%Bataan Fresh%';

-- Audit trail for a specific user
SELECT * FROM vw_audit_log_full WHERE username_snapshot = 'hostel_staff' ORDER BY logged_at DESC;

-- Room availability (rooms not OCCUPIED/RESERVED today)
SELECT room_number, room_type, floor, capacity, rate_per_night, room_status
FROM vw_room_availability
WHERE room_status = 'AVAILABLE';
```

---

## Compatibility

- MySQL 5.7+  
- MariaDB 10.3+  
- Compatible with DBeaver, HeidiSQL, MySQL Workbench, phpMyAdmin  
- Character set: `utf8mb4` / Collation: `utf8mb4_unicode_ci`  
- Timezone: `+08:00` (Philippine Standard Time)

---

*Database package prepared by: Darren Jude S. Tamayo — Database Specialist, BSIT-NW3A*  
*BPSU Main Campus — September 2026*
