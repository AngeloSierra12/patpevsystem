-- =============================================================================
-- BPSU IGP PATVEP HOSTEL & UNIVERSITY CANTEEN SYSTEM
-- File: 04_views.sql
-- Purpose: Reporting and dashboard views
-- Run AFTER: 02_tables.sql, 03_indexes.sql
-- =============================================================================

USE bpsu_patvep;

-- ── DROP EXISTING VIEWS ───────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_reservation_summary;
DROP VIEW IF EXISTS vw_room_availability;
DROP VIEW IF EXISTS vw_payment_totals;
DROP VIEW IF EXISTS vw_guest_history;
DROP VIEW IF EXISTS vw_low_stock_items;
DROP VIEW IF EXISTS vw_inventory_value;
DROP VIEW IF EXISTS vw_stock_movement;
DROP VIEW IF EXISTS vw_delivery_summary;
DROP VIEW IF EXISTS vw_supplier_delivery_totals;
DROP VIEW IF EXISTS vw_consumption_summary;
DROP VIEW IF EXISTS vw_daily_revenue;
DROP VIEW IF EXISTS vw_occupancy_report;
DROP VIEW IF EXISTS vw_audit_log_full;


-- =============================================================================
-- HOTEL / RESERVATION VIEWS
-- =============================================================================

-- Reservation with full guest and room details
CREATE VIEW vw_reservation_summary AS
SELECT
    r.reservation_id,
    r.reference_number,
    r.status,
    r.check_in_date,
    r.check_out_date,
    r.total_nights,
    r.number_of_guests,
    r.rate_per_night_snapshot  AS rate_per_night,
    r.total_amount,
    r.paid_amount,
    r.balance,
    r.created_at,
    r.checked_in_at,
    r.checked_out_at,
    r.notes,
    -- Guest info
    g.guest_id,
    g.full_name                AS guest_name,
    g.email                    AS guest_email,
    g.phone                    AS guest_phone,
    g.id_type                  AS guest_id_type,
    g.id_number                AS guest_id_number,
    -- Room info
    rm.room_id,
    r.room_number_snapshot     AS room_number,
    r.room_type_snapshot       AS room_type,
    -- Handler
    u.full_name                AS handled_by_name
FROM reservations r
JOIN guests  g  ON r.guest_id   = g.guest_id
JOIN rooms   rm ON r.room_id    = rm.room_id
LEFT JOIN users u ON r.handled_by = u.user_id;


-- Current room availability: shows each room's physical status and any active
-- (CONFIRMED or CHECKED_IN) reservation details attached to it.
--
-- LIMITATION: A room with multiple CONFIRMED reservations on different future
-- dates will appear as multiple rows in this view. This view does NOT filter
-- by a specific requested check-in/check-out range — that requires passing
-- date parameters via an application query. Use this view to see which rooms
-- have active bookings and to display the rooms grid on the dashboard.
-- Filter by room_status = 'AVAILABLE' to find physically unoccupied rooms.
CREATE VIEW vw_room_availability AS
SELECT
    rm.room_id,
    rm.room_number,
    rt.type_name          AS room_type,
    rm.floor,
    rm.capacity,
    rm.rate_per_night,
    rm.status             AS room_status,
    -- Active reservation for this room (if any)
    res.reservation_id,
    res.reference_number,
    res.check_in_date,
    res.check_out_date,
    res.guest_id,
    g.full_name           AS current_guest_name
FROM rooms rm
JOIN room_types rt ON rm.room_type_id = rt.room_type_id
LEFT JOIN reservations res
    ON res.room_id = rm.room_id
    AND res.status IN ('CONFIRMED','CHECKED_IN')
LEFT JOIN guests g ON res.guest_id = g.guest_id;


-- Payment totals per reservation
CREATE VIEW vw_payment_totals AS
SELECT
    p.reservation_id,
    r.reference_number,
    g.full_name                         AS guest_name,
    r.total_amount,
    r.paid_amount,
    r.balance,
    COUNT(p.payment_id)                 AS payment_count,
    SUM(p.amount)                       AS total_paid_payments,
    MAX(p.payment_date)                 AS last_payment_date,
    GROUP_CONCAT(p.payment_method ORDER BY p.payment_date SEPARATOR ', ')
                                        AS payment_methods_used
FROM payments p
JOIN reservations r ON p.reservation_id = r.reservation_id
JOIN guests g ON r.guest_id = g.guest_id
GROUP BY
    p.reservation_id, r.reference_number, g.full_name,
    r.total_amount, r.paid_amount, r.balance;


-- Full guest booking history (all reservations per guest)
CREATE VIEW vw_guest_history AS
SELECT
    g.guest_id,
    g.full_name,
    g.email,
    g.phone,
    COUNT(r.reservation_id)             AS total_reservations,
    SUM(CASE WHEN r.status = 'CHECKED_OUT' THEN 1 ELSE 0 END) AS completed_stays,
    SUM(CASE WHEN r.status = 'CANCELLED'   THEN 1 ELSE 0 END) AS cancellations,
    SUM(r.paid_amount)                  AS total_spent,
    MAX(r.check_in_date)                AS last_check_in
FROM guests g
LEFT JOIN reservations r ON g.guest_id = r.guest_id
GROUP BY g.guest_id, g.full_name, g.email, g.phone;


-- Occupancy report: occupied nights per room type per month.
--
-- LIMITATION: Stays are grouped by check_in_date month. A reservation spanning
-- two calendar months (e.g., Sep 28 – Oct 3) is credited entirely to September.
-- For the academic prototype this is an acceptable approximation. A production
-- system would prorate nights across months using a date dimension or calendar
-- table. total_revenue similarly reflects the full reservation amount in the
-- check-in month regardless of actual night distribution.
CREATE VIEW vw_occupancy_report AS
SELECT
    rt.type_name                        AS room_type,
    DATE_FORMAT(r.check_in_date, '%Y-%m') AS month_year,
    COUNT(DISTINCT rm.room_id)          AS total_rooms_of_type,
    COUNT(r.reservation_id)             AS reservations_count,
    SUM(r.total_nights)                 AS total_occupied_nights,
    SUM(r.total_amount)                 AS total_revenue
FROM reservations r
JOIN rooms rm    ON r.room_id      = rm.room_id
JOIN room_types rt ON rm.room_type_id = rt.room_type_id
WHERE r.status IN ('CHECKED_IN','CHECKED_OUT')
GROUP BY rt.type_name, DATE_FORMAT(r.check_in_date, '%Y-%m');


-- Daily revenue from payments
CREATE VIEW vw_daily_revenue AS
SELECT
    DATE(p.payment_date)        AS payment_day,
    COUNT(p.payment_id)         AS payment_count,
    SUM(p.amount)               AS total_collected,
    SUM(CASE WHEN p.payment_method = 'CASH'                  THEN p.amount ELSE 0 END) AS cash_total,
    SUM(CASE WHEN p.payment_method = 'UNIVERSITY_CHARGE_SLIP' THEN p.amount ELSE 0 END) AS charge_slip_total,
    SUM(CASE WHEN p.payment_method = 'BANK_TRANSFER'          THEN p.amount ELSE 0 END) AS bank_transfer_total,
    SUM(CASE WHEN p.payment_method = 'GCASH_MANUAL_REF'       THEN p.amount ELSE 0 END) AS gcash_total
FROM payments p
GROUP BY DATE(p.payment_date);


-- =============================================================================
-- INVENTORY VIEWS
-- =============================================================================

-- Items at or below reorder level (low-stock alert)
CREATE VIEW vw_low_stock_items AS
SELECT
    i.item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.unit,
    i.current_stock,
    i.reorder_level,
    i.critical_level,
    i.unit_cost,
    ROUND(i.current_stock * i.unit_cost, 2) AS stock_value,
    CASE
        WHEN i.current_stock <= i.critical_level THEN 'CRITICAL'
        WHEN i.current_stock <= i.reorder_level  THEN 'LOW'
        ELSE 'OK'
    END AS stock_status,
    s.supplier_name                         AS preferred_supplier,
    s.phone                                 AS supplier_phone
FROM inventory_items i
LEFT JOIN suppliers s ON i.preferred_supplier_id = s.supplier_id
WHERE i.is_active = 1
  AND i.current_stock <= i.reorder_level
ORDER BY i.current_stock ASC;


-- Inventory value snapshot
CREATE VIEW vw_inventory_value AS
SELECT
    i.category,
    COUNT(i.item_id)                            AS item_count,
    SUM(i.current_stock)                        AS total_units,
    SUM(ROUND(i.current_stock * i.unit_cost, 2)) AS total_value,
    SUM(CASE WHEN i.current_stock <= i.critical_level THEN 1 ELSE 0 END) AS critical_items,
    SUM(CASE WHEN i.current_stock <= i.reorder_level  THEN 1 ELSE 0 END) AS low_stock_items
FROM inventory_items i
WHERE i.is_active = 1
GROUP BY i.category;


-- Stock movement report per item (all transactions)
CREATE VIEW vw_stock_movement AS
SELECT
    t.txn_id,
    t.transaction_date,
    t.transaction_type,
    i.item_code,
    i.item_name,
    i.category,
    i.unit,
    t.quantity,
    t.unit_cost,
    t.total_cost,
    t.stock_before,
    t.stock_after,
    t.ref_type,
    t.ref_id,
    t.reason,
    u.full_name  AS performed_by_name,
    t.notes
FROM inventory_transactions t
JOIN inventory_items i ON t.item_id = i.item_id
LEFT JOIN users u ON t.performed_by = u.user_id;


-- Delivery summary with supplier info and line-item count
CREATE VIEW vw_delivery_summary AS
SELECT
    d.delivery_id,
    d.delivery_receipt_no,
    d.delivery_date,
    d.status,
    d.total_amount,
    d.notes,
    s.supplier_id,
    s.supplier_name,
    s.contact_person,
    s.phone         AS supplier_phone,
    COUNT(di.delivery_item_id)  AS line_item_count,
    SUM(di.quantity)            AS total_units_received,
    u.full_name     AS received_by_name
FROM deliveries d
JOIN suppliers s ON d.supplier_id = s.supplier_id
LEFT JOIN delivery_items di ON d.delivery_id = di.delivery_id
LEFT JOIN users u ON d.received_by = u.user_id
GROUP BY
    d.delivery_id, d.delivery_receipt_no, d.delivery_date, d.status,
    d.total_amount, d.notes,
    s.supplier_id, s.supplier_name, s.contact_person, s.phone,
    u.full_name;


-- Supplier delivery totals (for supplier performance reports)
CREATE VIEW vw_supplier_delivery_totals AS
SELECT
    s.supplier_id,
    s.supplier_name,
    COUNT(d.delivery_id)            AS total_deliveries,
    SUM(d.total_amount)             AS total_delivery_value,
    MAX(d.delivery_date)            AS last_delivery_date,
    COUNT(CASE WHEN d.status = 'REJECTED' THEN 1 END) AS rejected_deliveries
FROM suppliers s
LEFT JOIN deliveries d ON s.supplier_id = d.supplier_id
GROUP BY s.supplier_id, s.supplier_name;


-- Consumption summary per item
CREATE VIEW vw_consumption_summary AS
SELECT
    c.consumption_id,
    c.consumption_date,
    c.quantity,
    c.purpose,
    c.notes,
    i.item_code,
    i.item_name,
    i.category,
    i.unit,
    u.full_name   AS recorded_by_name
FROM inventory_consumption c
JOIN inventory_items i ON c.item_id = i.item_id
LEFT JOIN users u ON c.recorded_by = u.user_id;


-- =============================================================================
-- AUDIT VIEW
-- =============================================================================

CREATE VIEW vw_audit_log_full AS
SELECT
    l.log_id,
    l.logged_at,
    l.user_id,
    l.username_snapshot,
    l.role_snapshot,
    l.action_type,
    l.target_entity,
    l.target_id,
    l.description,
    l.old_value,
    l.new_value,
    l.ip_address,
    u.full_name     AS actor_full_name,
    u.is_active     AS actor_still_active
FROM audit_logs l
LEFT JOIN users u ON l.user_id = u.user_id;
