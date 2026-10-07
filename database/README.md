# Hotel Inventory System for IGP PATVEP Hostel and University Canteen — Database

**Database:** `bpsu_patvep_inventory` (MariaDB 10.4 / XAMPP)
**Owner:** Darren Jude S. Tamayo, Database Specialist, BSIT-NW3A

Database for the PATVEP Hostel & Canteen Inventory frontend. Hotel reservation, payments, guests and scheduling are out of scope; the old reservation-era database (`bpsu_patvep`) is retired.

## Run order

| File | What it does |
|---|---|
| `01_database.sql` | Creates `bpsu_patvep_inventory` |
| `02_tables.sql` | 9 tables with constraints and indexes (**drops and recreates them**) |
| `03_procedures.sql` | `sp_log`, `sp_adjust_stock`, `sp_archive_audit_logs` |
| `04_triggers.sql` | Stock automation, integrity guards, audit logging |
| `05_views.sql` | 9 dashboard and report views |
| `06_seed_data.sql` | Demo data for both hostel and canteen |
| `07_selftest.sql` | 41 PASS/FAIL checks. Changes no data. Should print `ALL PASS` |
| `08_app_user.sql` | Creates `patvep_app`, the limited account the PHP backend uses |
| `backup/` | Nightly backup script and its Task Scheduler registration |
| `bpsu_patvep_inventory_erd.dbml` | ERD for dbdiagram.io |

From the folder, with XAMPP MySQL running:

```bash
for f in 0*.sql; do /c/xampp/mysql/bin/mysql.exe -uroot < "$f" || break; done
```

You can also paste each file into phpMyAdmin's SQL tab, in order.

Demo logins: `admin`, `hostel_staff`, `canteen_staff`, `qa_staff`. The password for all of them is `password`.

## Tables

| Table | Purpose |
|---|---|
| `users` | Accounts. Roles: `ADMIN`, `STAFF_HOSTEL`, `STAFF_CANTEEN` |
| `suppliers` | Supplier master list, shared by both locations |
| `inventory_items` | Items, each tagged `location = HOSTEL` or `CANTEEN` |
| `deliveries` | Delivery header for one location. Status is `RECEIVED` or `REJECTED` |
| `delivery_items` | Delivery lines. Inserting one raises stock |
| `inventory_consumption` | Usage records. Inserting one lowers stock |
| `inventory_transactions` | Stock ledger: every stock change, before and after |
| `audit_logs` | Activity log |
| `audit_logs_archive` | Old audit rows moved out by `sp_archive_audit_logs` |

## Rules the database enforces

Stock only moves three ways:

1. **Delivery:** `INSERT INTO delivery_items`, which is stock in.
2. **Consumption:** `INSERT INTO inventory_consumption`, which is stock out.
3. **Count correction:** `CALL sp_adjust_stock(item_id, counted_qty, 'reason', user_id)`. The reason is required.

Everything else is rejected with a readable error:

- Editing `current_stock` directly.
- Editing or deleting delivery lines, consumption records or ledger rows. History is append-only.
- Putting a hostel item on a canteen delivery, or the other way round.
- Adding items to a `REJECTED` delivery.
- Typing in a delivery `total_amount`. It is computed from the lines.
- Consuming more than is in stock.
- Moving an item to the other location after it has stock history.

An item both sides use, such as bleach, is **two rows**, one per location. That way each side has its own stock count and its own reorder levels.

## For the backend (John)

Connect as `patvep_app`, never as `root`. The connection details are in `app_db_credentials.local.php`, a local-only file that git ignores. To create the account on another machine:

```bash
mysql -uroot -e "SET @app_pw='a-strong-password'; SOURCE 08_app_user.sql;"
```

`patvep_app` can SELECT, INSERT, UPDATE and call procedures. It cannot DELETE, DROP, ALTER, touch triggers, or see other databases. Deactivate records with `is_active = 0` instead of deleting them. Triggers still update stock because they run with root's rights.

Right after login, set these on the connection so triggers know who is acting:

```sql
SET @app_user_id = 3;          -- logged-in user_id
SET @app_ip = '192.168.1.20';  -- client IP
```

Write audit entries for app-level events (login, logout, user management) with:

```sql
CALL sp_log(@app_user_id, 'LOGIN', 'AUTH', NULL, 'User canteen_staff logged in', NULL, NULL, NOW());
```

Deliveries, consumption, stock adjustments and item edits log themselves through triggers. Don't log those again from PHP.

Staff only see their own location: `STAFF_HOSTEL` maps to `WHERE location = 'HOSTEL'` and `STAFF_CANTEEN` to `WHERE location = 'CANTEEN'`. Every view has a `location` column for this.

## Views

| View | Used for |
|---|---|
| `vw_low_stock_items` | Low-stock and critical alerts (dashboard) |
| `vw_inventory_value` | Stock value per location and category |
| `vw_stock_movement` | Stock movement report |
| `vw_delivery_summary` | Delivery records |
| `vw_supplier_delivery_totals` | Supplier report per location |
| `vw_consumption_summary` | Consumption report |
| `vw_monthly_inventory_finance` | Monthly purchases, usage cost and adjustment losses (WBS 9.3) |
| `vw_audit_log_full` | Audit trail with actor names |
| `vw_all_audit_logs` | Search across active and archived logs |

## Backups

`backup/backup_inventory.bat` dumps the whole database to `C:\xampp\mysql\patvep_backups\`. The dump includes data, triggers, procedures and views. Backups older than 14 days are deleted, and every run is written to `backup_log.txt`. `backup/schedule_backup.bat` registers it with Windows Task Scheduler to run daily at 9:00 PM. MySQL must be running at that time.

To restore, which replaces the database with the backup:

```bash
C:\xampp\mysql\bin\mysql.exe -uroot < "C:\xampp\mysql\patvep_backups\bpsu_patvep_inventory_<date>.sql"
```

A restored backup has been verified to pass `07_selftest.sql` 41/41.

## Not included (out of scope or deferred)

- Suppliers and users have no audit triggers. The backend logs those changes with `sp_log`.
- Edits to delivery headers (supplier, notes) are not audited.
