-- =============================================================================
-- BPSU IGP PATVEP HOSTEL & UNIVERSITY CANTEEN SYSTEM
-- File: 02_tables.sql
-- Purpose: Create all tables (DROP-safe, ordered by dependency)
-- Run AFTER: 01_database.sql
-- =============================================================================

USE bpsu_patvep;

SET FOREIGN_KEY_CHECKS = 0;

-- ── Drop in reverse dependency order ─────────────────────────────────────────
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS inventory_consumption;
DROP TABLE IF EXISTS delivery_items;
DROP TABLE IF EXISTS deliveries;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS room_types;
DROP TABLE IF EXISTS guests;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 1. USERS
-- Stores system accounts: Admin, Staff (Hostel), Staff (Canteen), Guest.
-- Guests who book rooms are linked here (guest_id on reservations).
-- =============================================================================
CREATE TABLE users (
    user_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username     VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,          -- bcrypt / Argon2 hash
    full_name    VARCHAR(120) NOT NULL,
    email        VARCHAR(120) NOT NULL UNIQUE,
    phone        VARCHAR(25),
    role         ENUM('ADMIN','STAFF_HOSTEL','STAFF_CANTEEN','GUEST') NOT NULL,
    department   VARCHAR(120),
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at DATETIME    NULL,

    INDEX idx_users_role      (role),
    INDEX idx_users_active    (is_active),
    INDEX idx_users_email     (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. GUESTS
-- Extended guest profile. A guest may or may not have a user account.
--   • guest_user_id IS NOT NULL  → guest has a login account
--   • guest_user_id IS NULL      → walk-in / manually registered guest
-- Guest contact info is stored here for history even if user account is deleted.
-- =============================================================================
CREATE TABLE guests (
    guest_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    guest_user_id INT UNSIGNED NULL,             -- FK → users (nullable)
    full_name     VARCHAR(120) NOT NULL,
    email         VARCHAR(120),
    phone         VARCHAR(25),
    id_type       VARCHAR(60),                   -- "BPSU Student ID", "Gov't ID", etc.
    id_number     VARCHAR(60),
    address       TEXT,
    notes         TEXT,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_guests_user
        FOREIGN KEY (guest_user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_guests_user   (guest_user_id),
    INDEX idx_guests_name   (full_name),
    INDEX idx_guests_email  (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. ROOM_TYPES
-- Defines categories of rooms: Standard Single, Dormitory, Suite, etc.
-- Separating type from room avoids repeating type info across every room row.
-- =============================================================================
CREATE TABLE room_types (
    room_type_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_name          VARCHAR(80)    NOT NULL UNIQUE,
    description        TEXT,
    base_rate_per_night DECIMAL(10,2) NOT NULL,   -- default nightly rate
    max_capacity       INT UNSIGNED   NOT NULL DEFAULT 1,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. ROOMS
-- Individual physical rooms. Rate is stored per-room so that specific rooms
-- can deviate from the type base rate (e.g., corner rooms, renovated rooms).
-- =============================================================================
CREATE TABLE rooms (
    room_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_type_id     INT UNSIGNED NOT NULL,
    room_number      VARCHAR(20)  NOT NULL UNIQUE,
    floor            TINYINT UNSIGNED NOT NULL DEFAULT 1,
    capacity         INT UNSIGNED NOT NULL DEFAULT 1,
    rate_per_night   DECIMAL(10,2) NOT NULL,      -- effective room rate
    description      TEXT,
    status           ENUM('AVAILABLE','OCCUPIED','MAINTENANCE','RESERVED')
                     NOT NULL DEFAULT 'AVAILABLE',
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_rooms_type
        FOREIGN KEY (room_type_id) REFERENCES room_types(room_type_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    INDEX idx_rooms_status   (status),
    INDEX idx_rooms_floor    (floor),
    INDEX idx_rooms_type     (room_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. RESERVATIONS
-- Core hotel booking record.
--
-- Design notes:
--   • rate_per_night and total_amount are STORED (denormalized) deliberately.
--     Room rates can change; the reservation must reflect the rate at booking time.
--   • guest_id references the guests table (not users directly).
--   • room_id is required; if a room is deleted the reservation is protected by
--     ON DELETE RESTRICT.
--   • handled_by references the staff user who created/processed the reservation.
-- =============================================================================
CREATE TABLE reservations (
    reservation_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference_number  VARCHAR(30)   NOT NULL UNIQUE,    -- e.g. BPSU-RES-202609-0001
    guest_id          INT UNSIGNED  NOT NULL,
    room_id           INT UNSIGNED  NOT NULL,
    -- Snapshot values preserved at time of booking
    room_number_snapshot  VARCHAR(20)  NOT NULL,
    room_type_snapshot    VARCHAR(80)  NOT NULL,
    rate_per_night_snapshot DECIMAL(10,2) NOT NULL,
    -- Booking details
    check_in_date     DATE NOT NULL,
    check_out_date    DATE NOT NULL,
    number_of_guests  INT UNSIGNED NOT NULL DEFAULT 1,
    total_nights      SMALLINT UNSIGNED NOT NULL,
    total_amount      DECIMAL(12,2) NOT NULL,
    paid_amount       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    balance           DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    status            ENUM('PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED')
                      NOT NULL DEFAULT 'PENDING',
    cancellation_reason TEXT NULL,
    notes             TEXT,
    handled_by        INT UNSIGNED NULL,              -- staff/admin who processed
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    checked_in_at     DATETIME NULL,
    checked_out_at    DATETIME NULL,

    CONSTRAINT fk_res_guest
        FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_res_room
        FOREIGN KEY (room_id) REFERENCES rooms(room_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_res_handler
        FOREIGN KEY (handled_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_res_dates
        CHECK (check_out_date > check_in_date),

    INDEX idx_res_guest       (guest_id),
    INDEX idx_res_room        (room_id),
    INDEX idx_res_status      (status),
    INDEX idx_res_dates       (check_in_date, check_out_date),
    INDEX idx_res_ref         (reference_number),
    INDEX idx_res_handler     (handled_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. PAYMENTS
-- Individual payment transactions against a reservation.
-- A reservation can have multiple partial payments (payment plan).
-- received_by references the staff user who recorded the payment.
-- =============================================================================
CREATE TABLE payments (
    payment_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reservation_id  INT UNSIGNED NOT NULL,
    receipt_number  VARCHAR(30)  NOT NULL UNIQUE,    -- e.g. OR-2026-00891
    amount          DECIMAL(12,2) NOT NULL,
    payment_method  ENUM('CASH','UNIVERSITY_CHARGE_SLIP','BANK_TRANSFER','GCASH_MANUAL_REF')
                    NOT NULL DEFAULT 'CASH',
    reference_code  VARCHAR(100) NULL,               -- charge slip #, bank ref, etc.
    notes           TEXT,
    received_by     INT UNSIGNED NULL,               -- FK → users
    payment_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pay_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pay_receiver
        FOREIGN KEY (received_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_pay_amount
        CHECK (amount > 0),

    INDEX idx_pay_reservation (reservation_id),
    INDEX idx_pay_receipt     (receipt_number),
    INDEX idx_pay_date        (payment_date),
    INDEX idx_pay_receiver    (received_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 7. SUPPLIERS
-- Canteen supplier master list.
-- supplied_categories is a human-readable note (not FK-enforced) to describe
-- what the supplier typically provides.
-- =============================================================================
CREATE TABLE suppliers (
    supplier_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_name    VARCHAR(120) NOT NULL,
    contact_person   VARCHAR(100),
    phone            VARCHAR(25),
    email            VARCHAR(120),
    address          TEXT,
    supplied_categories TEXT,    -- free-text description, e.g. "Meat, Poultry"
    notes            TEXT,
    is_active        TINYINT(1) NOT NULL DEFAULT 1,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_suppliers_name   (supplier_name),
    INDEX idx_suppliers_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 8. INVENTORY_ITEMS
-- Master list of canteen inventory items.
--
-- Design notes:
--   • current_stock is maintained by triggers (see 06_triggers.sql).
--   • reorder_level triggers low-stock alerts; critical_level is the absolute
--     floor (effectively "out of stock" threshold).
--   • preferred_supplier_id is informational; actual supplier per delivery is
--     recorded on delivery_items.
--   • unit_cost is the last recorded cost, used for valuation display.
-- =============================================================================
CREATE TABLE inventory_items (
    item_id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_code           VARCHAR(25)  NOT NULL UNIQUE,    -- e.g. STP-001
    item_name           VARCHAR(120) NOT NULL,
    category            ENUM(
                            'FOOD_STAPLES',
                            'MEAT_POULTRY',
                            'BEVERAGES',
                            'INGREDIENTS',
                            'SUPPLIES_PACKAGING',
                            'CLEANING'
                        ) NOT NULL,
    unit                VARCHAR(30)  NOT NULL,            -- sacks, kg, cans, pcs…
    current_stock       DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    reorder_level       DECIMAL(12,3) NOT NULL DEFAULT 10.000,  -- triggers low-stock alert
    critical_level      DECIMAL(12,3) NOT NULL DEFAULT 0.000,   -- absolute minimum
    unit_cost           DECIMAL(10,2) NOT NULL DEFAULT 0.00,    -- last known cost
    preferred_supplier_id INT UNSIGNED NULL,
    description         TEXT,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    last_restocked_at   DATETIME NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_item_supplier
        FOREIGN KEY (preferred_supplier_id) REFERENCES suppliers(supplier_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_items_category  (category),
    INDEX idx_items_stock     (current_stock),
    INDEX idx_items_supplier  (preferred_supplier_id),
    INDEX idx_items_active    (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 9. DELIVERIES  (Header table)
-- Records a delivery event from a supplier.
-- The individual items in the delivery are in delivery_items.
-- received_by references the staff user who recorded/signed the delivery.
-- =============================================================================
CREATE TABLE deliveries (
    delivery_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    delivery_receipt_no VARCHAR(60) NOT NULL UNIQUE,    -- supplier-issued DR number
    supplier_id        INT UNSIGNED NOT NULL,
    delivery_date      DATE NOT NULL,
    received_by        INT UNSIGNED NULL,               -- FK → users
    total_amount       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status             ENUM('PENDING','RECEIVED','REJECTED') NOT NULL DEFAULT 'RECEIVED',
    notes              TEXT,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_del_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_del_receiver
        FOREIGN KEY (received_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_del_supplier  (supplier_id),
    INDEX idx_del_date      (delivery_date),
    INDEX idx_del_status    (status),
    INDEX idx_del_receiver  (received_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 10. DELIVERY_ITEMS  (Detail table)
-- Line-items within a delivery: which item, how many, at what cost.
-- Inserting a delivery_item triggers a corresponding inventory_transaction.
-- =============================================================================
CREATE TABLE delivery_items (
    delivery_item_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    delivery_id       INT UNSIGNED NOT NULL,
    item_id           INT UNSIGNED NOT NULL,
    quantity          DECIMAL(12,3) NOT NULL,
    unit_cost         DECIMAL(10,2) NOT NULL,
    line_total        DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    notes             TEXT,

    CONSTRAINT fk_di_delivery
        FOREIGN KEY (delivery_id) REFERENCES deliveries(delivery_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_di_item
        FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_di_qty
        CHECK (quantity > 0),

    INDEX idx_di_delivery (delivery_id),
    INDEX idx_di_item     (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 11. INVENTORY_TRANSACTIONS
-- The complete movement ledger for every stock change.
-- Every STOCK_IN, STOCK_OUT, and ADJUSTMENT creates one row here.
-- Triggers on delivery_items and inventory_consumption auto-create rows here.
-- Manual adjustments can also insert directly (with ADJUSTMENT type).
--
-- transaction_type values:
--   STOCK_IN      – items received (usually from a delivery)
--   STOCK_OUT     – items consumed/issued (usage, canteen sales, etc.)
--   ADJUSTMENT    – manual stock correction (positive or negative)
--
-- ref_type / ref_id: polymorphic soft-reference for auditability
--   e.g. ref_type='DELIVERY', ref_id=delivery_id
--        ref_type='CONSUMPTION', ref_id=consumption_id
-- =============================================================================
CREATE TABLE inventory_transactions (
    txn_id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id           INT UNSIGNED NOT NULL,
    transaction_type  ENUM('STOCK_IN','STOCK_OUT','ADJUSTMENT') NOT NULL,
    quantity          DECIMAL(12,3) NOT NULL,          -- always positive; direction = type
    unit_cost         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_cost        DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    stock_before      DECIMAL(12,3) NOT NULL,          -- snapshot before change
    stock_after       DECIMAL(12,3) NOT NULL,          -- snapshot after change
    ref_type          VARCHAR(30) NULL,                -- 'DELIVERY','CONSUMPTION','MANUAL'
    ref_id            INT UNSIGNED NULL,               -- FK-by-convention (no DB FK to keep flexibility)
    reason            VARCHAR(120) NOT NULL DEFAULT 'MANUAL',
    performed_by      INT UNSIGNED NULL,               -- FK → users
    transaction_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes             TEXT,

    CONSTRAINT fk_txn_item
        FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_txn_user
        FOREIGN KEY (performed_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_txn_item      (item_id),
    INDEX idx_txn_type      (transaction_type),
    INDEX idx_txn_date      (transaction_date),
    INDEX idx_txn_user      (performed_by),
    INDEX idx_txn_ref       (ref_type, ref_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 12. INVENTORY_CONSUMPTION
-- Records deliberate usage/consumption of an inventory item.
-- Distinct from inventory_transactions so that usage details (purpose, notes)
-- are captured without polluting the transaction ledger.
-- A trigger creates a matching STOCK_OUT in inventory_transactions.
-- =============================================================================
CREATE TABLE inventory_consumption (
    consumption_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id          INT UNSIGNED NOT NULL,
    quantity         DECIMAL(12,3) NOT NULL,
    purpose          VARCHAR(120) NOT NULL,   -- e.g. "KITCHEN_USAGE", "CANTEEN_SALES"
    notes            TEXT,
    recorded_by      INT UNSIGNED NULL,       -- FK → users
    consumption_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_con_item
        FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_con_user
        FOREIGN KEY (recorded_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_con_qty
        CHECK (quantity > 0),

    INDEX idx_con_item   (item_id),
    INDEX idx_con_date   (consumption_date),
    INDEX idx_con_user   (recorded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 13. AUDIT_LOGS
-- System-wide activity and event log.
-- user_id references the actor (NULL = system/unauthenticated event).
-- Intentionally NOT foreign key constrained on other entity IDs to allow
-- logs to survive even after records are deleted.
-- =============================================================================
CREATE TABLE audit_logs (
    log_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id          INT UNSIGNED NULL,              -- FK → users (actor)
    username_snapshot VARCHAR(50) NOT NULL,          -- stored at time of event (survives user delete)
    role_snapshot    VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    action_type      VARCHAR(60) NOT NULL,           -- LOGIN, LOGOUT, RESERVATION_CREATE, etc.
    target_entity    VARCHAR(60) NOT NULL,           -- TABLE or MODULE name
    target_id        INT UNSIGNED NULL,              -- PK of affected record (if applicable)
    description      TEXT,                           -- human-readable event description
    old_value        TEXT NULL,                      -- serialized old data (optional)
    new_value        TEXT NULL,                      -- serialized new data (optional)
    ip_address       VARCHAR(45) DEFAULT '127.0.0.1',
    logged_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_log_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_log_user     (user_id),
    INDEX idx_log_action   (action_type),
    INDEX idx_log_entity   (target_entity),
    INDEX idx_log_date     (logged_at),
    INDEX idx_log_target   (target_entity, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
