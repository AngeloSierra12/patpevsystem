-- =============================================================================
-- HOTEL INVENTORY SYSTEM FOR IGP PATVEP HOSTEL AND UNIVERSITY CANTEEN
-- File: 05_views.sql
-- Purpose: Dashboard and report views (WBS 8.x dashboard, 9.3 aggregation)
-- Run AFTER: 02_tables.sql
--
-- Every inventory view has a `location` column. The backend filters with
-- WHERE location = 'HOSTEL' / 'CANTEEN' for staff, and shows both for ADMIN.
--
--   vw_low_stock_items           low-stock / critical alerts
--   vw_inventory_value           stock value per location + category
--   vw_stock_movement            full ledger with item + user names
--   vw_delivery_summary          delivery headers with supplier + line count
--   vw_supplier_delivery_totals  supplier performance per location
--   vw_consumption_summary       usage records with item + user names
--   vw_monthly_inventory_finance purchases / usage cost / adjustments per month
--   vw_audit_log_full            audit log with actor full name
--   vw_all_audit_logs            active + archived audit logs together
-- =============================================================================

USE bpsu_patvep_inventory;

-- ── Low stock alerts ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_low_stock_items AS
SELECT
    i.item_id,
    i.item_code,
    i.item_name,
    i.location,
    i.category,
    i.unit,
    i.current_stock,
    i.reorder_level,
    i.critical_level,
    i.unit_cost,
    ROUND(i.current_stock * i.unit_cost, 2) AS stock_value,
    IF(i.current_stock <= i.critical_level, 'CRITICAL', 'LOW') AS stock_status,
    s.supplier_name AS preferred_supplier,
    s.phone         AS supplier_phone
FROM inventory_items i
LEFT JOIN suppliers s ON i.preferred_supplier_id = s.supplier_id
WHERE i.is_active = 1
  AND i.current_stock <= i.reorder_level;


-- ── Inventory value per location and category ────────────────────────────────
CREATE OR REPLACE VIEW vw_inventory_value AS
SELECT
    i.location,
    i.category,
    COUNT(*)                                       AS item_count,
    SUM(ROUND(i.current_stock * i.unit_cost, 2))   AS total_value,
    SUM(i.current_stock <= i.critical_level)       AS critical_items,
    SUM(i.current_stock <= i.reorder_level)        AS low_stock_items
FROM inventory_items i
WHERE i.is_active = 1
GROUP BY i.location, i.category;


-- ── Stock movement ledger ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_stock_movement AS
SELECT
    t.txn_id,
    t.transaction_date,
    t.transaction_type,
    i.location,
    i.item_code,
    i.item_name,
    i.category,
    i.unit,
    t.quantity,
    t.stock_after - t.stock_before AS net_change,
    t.unit_cost,
    t.total_cost,
    t.stock_before,
    t.stock_after,
    t.ref_type,
    t.ref_id,
    t.reason,
    u.full_name AS performed_by_name,
    t.notes
FROM inventory_transactions t
JOIN inventory_items i ON t.item_id = i.item_id
LEFT JOIN users u ON t.performed_by = u.user_id;


-- ── Deliveries ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_delivery_summary AS
SELECT
    d.delivery_id,
    d.delivery_receipt_no,
    d.location,
    d.status,
    d.received_at,
    d.total_amount,
    d.notes,
    s.supplier_id,
    s.supplier_name,
    s.contact_person,
    s.phone                    AS supplier_phone,
    COUNT(di.delivery_item_id) AS line_item_count,
    u.full_name                AS received_by_name
FROM deliveries d
JOIN suppliers s ON d.supplier_id = s.supplier_id
LEFT JOIN delivery_items di ON d.delivery_id = di.delivery_id
LEFT JOIN users u ON d.received_by = u.user_id
GROUP BY d.delivery_id, d.delivery_receipt_no, d.location, d.status, d.received_at,
         d.total_amount, d.notes, s.supplier_id, s.supplier_name, s.contact_person,
         s.phone, u.full_name;


CREATE OR REPLACE VIEW vw_supplier_delivery_totals AS
SELECT
    s.supplier_id,
    s.supplier_name,
    d.location,
    SUM(d.status = 'RECEIVED')                          AS received_deliveries,
    SUM(d.status = 'REJECTED')                          AS rejected_deliveries,
    SUM(IF(d.status = 'RECEIVED', d.total_amount, 0))   AS total_delivery_value,
    MAX(d.received_at)                                  AS last_delivery_at
FROM suppliers s
JOIN deliveries d ON s.supplier_id = d.supplier_id
GROUP BY s.supplier_id, s.supplier_name, d.location;


-- ── Consumption ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_consumption_summary AS
SELECT
    c.consumption_id,
    c.consumption_date,
    i.location,
    i.item_code,
    i.item_name,
    i.category,
    c.quantity,
    i.unit,
    c.purpose,
    c.notes,
    u.full_name AS recorded_by_name
FROM inventory_consumption c
JOIN inventory_items i ON c.item_id = i.item_id
LEFT JOIN users u ON c.recorded_by = u.user_id;


-- ── Monthly finance (WBS 9.3) ────────────────────────────────────────────────
-- purchases_value   = cost of goods received (STOCK_IN)
-- usage_cost        = cost of goods used, at last known unit cost (STOCK_OUT)
-- adjustment_value  = net value gained (+) or lost (−) through count corrections
CREATE OR REPLACE VIEW vw_monthly_inventory_finance AS
SELECT
    DATE_FORMAT(t.transaction_date, '%Y-%m') AS month_year,
    i.location,
    SUM(IF(t.transaction_type = 'STOCK_IN',  t.total_cost, 0)) AS purchases_value,
    SUM(IF(t.transaction_type = 'STOCK_OUT', t.total_cost, 0)) AS usage_cost,
    SUM(IF(t.transaction_type = 'ADJUSTMENT',
           ROUND((t.stock_after - t.stock_before) * t.unit_cost, 2), 0)) AS adjustment_value,
    COUNT(*) AS transaction_count
FROM inventory_transactions t
JOIN inventory_items i ON t.item_id = i.item_id
GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m'), i.location;


-- ── Audit ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_audit_log_full AS
SELECT
    l.*,
    u.full_name AS actor_full_name,
    u.is_active AS actor_still_active
FROM audit_logs l
LEFT JOIN users u ON l.user_id = u.user_id;


-- Search across active + archived logs. Always filter by logged_at or
-- action_type for speed.
CREATE OR REPLACE VIEW vw_all_audit_logs AS
SELECT log_id, user_id, username_snapshot, role_snapshot, action_type, target_entity,
       target_id, description, old_value, new_value, ip_address, logged_at,
       'ACTIVE' AS log_source
FROM audit_logs
UNION ALL
SELECT log_id, user_id, username_snapshot, role_snapshot, action_type, target_entity,
       target_id, description, old_value, new_value, ip_address, logged_at,
       'ARCHIVED' AS log_source
FROM audit_logs_archive;
