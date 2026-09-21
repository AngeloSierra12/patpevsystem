-- =============================================================================
-- BPSU IGP PATVEP HOSTEL & UNIVERSITY CANTEEN SYSTEM
-- File: 03_indexes.sql
-- Purpose: Additional composite and covering indexes for query performance
-- Run AFTER: 02_tables.sql
-- =============================================================================

USE bpsu_patvep;

-- ── RESERVATIONS ─────────────────────────────────────────────────────────────
-- Calendar/availability queries: find reservations overlapping a date range
CREATE INDEX idx_res_availability
    ON reservations (room_id, status, check_in_date, check_out_date);

-- Dashboard: reservations by status + created date
CREATE INDEX idx_res_status_created
    ON reservations (status, created_at);

-- ── PAYMENTS ─────────────────────────────────────────────────────────────────
-- Revenue report: sum payments by date range
CREATE INDEX idx_pay_method_date
    ON payments (payment_method, payment_date);

-- ── INVENTORY_ITEMS ──────────────────────────────────────────────────────────
-- Low-stock dashboard index.
-- Leading column is_active = 1 allows MariaDB to efficiently filter active items.
-- NOTE: The column-vs-column comparison (current_stock <= reorder_level) cannot
-- be resolved by an index alone — MariaDB evaluates it as a row filter after
-- the is_active range scan. This index is still beneficial because the is_active
-- prefix significantly narrows the scan before the comparison is applied.
CREATE INDEX idx_items_low_stock
    ON inventory_items (is_active, current_stock, reorder_level);

-- ── INVENTORY_TRANSACTIONS ───────────────────────────────────────────────────
-- Stock movement report per item + date
CREATE INDEX idx_txn_item_date
    ON inventory_transactions (item_id, transaction_date);

-- Delivery-linked transactions
CREATE INDEX idx_txn_delivery
    ON inventory_transactions (ref_type, ref_id, transaction_date);

-- ── DELIVERIES ───────────────────────────────────────────────────────────────
-- Supplier delivery history
CREATE INDEX idx_del_supplier_date
    ON deliveries (supplier_id, delivery_date);

-- ── AUDIT_LOGS ───────────────────────────────────────────────────────────────
-- Log search: by user + date range
CREATE INDEX idx_log_user_date
    ON audit_logs (user_id, logged_at);

-- Log search: by action + date range
CREATE INDEX idx_log_action_date
    ON audit_logs (action_type, logged_at);

-- Archive query: all logs before a certain date (for archiving old records)
CREATE INDEX idx_log_archive
    ON audit_logs (logged_at, log_id);
