-- =============================================================================
-- HOTEL INVENTORY SYSTEM FOR IGP PATVEP HOSTEL AND UNIVERSITY CANTEEN
-- File: 02_tables.sql
-- Purpose: All tables, constraints and indexes (9 tables)
-- Run AFTER: 01_database.sql
--
-- Hostel vs Canteen:
--   Every inventory item belongs to exactly one LOCATION ('HOSTEL' or
--   'CANTEEN'). Deliveries also carry a location, and a trigger makes sure a
--   delivery only contains items from its own location. Consumption and
--   transactions inherit the location through item_id.
--   An item stocked by both sides (e.g. bleach) is two rows, one per location,
--   so each side keeps its own stock count and reorder levels.
-- =============================================================================

USE bpsu_patvep_inventory;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs_archive;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS inventory_consumption;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS delivery_items;
DROP TABLE IF EXISTS deliveries;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 1. USERS
-- ADMIN sees both locations. STAFF_HOSTEL / STAFF_CANTEEN are limited to their
-- own location by the backend (role → location: STAFF_HOSTEL → 'HOSTEL').
-- =============================================================================
CREATE TABLE users (
    user_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,               -- bcrypt (PHP password_hash)
    full_name     VARCHAR(120) NOT NULL,
    email         VARCHAR(120) NOT NULL UNIQUE,
    phone         VARCHAR(25),
    role          ENUM('ADMIN','STAFF_HOSTEL','STAFF_CANTEEN') NOT NULL,
    department    VARCHAR(120),
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at DATETIME     NULL,

    INDEX idx_users_role   (role),
    INDEX idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. SUPPLIERS
-- Shared by both locations (one supplier can deliver to hostel and canteen).
-- =============================================================================
CREATE TABLE suppliers (
    supplier_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_name       VARCHAR(120) NOT NULL UNIQUE,
    contact_person      VARCHAR(100),
    phone               VARCHAR(25),
    email               VARCHAR(120),
    address             TEXT,
    supplied_categories TEXT,                          -- free text, e.g. "Linens, Toiletries"
    notes               TEXT,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_suppliers_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. INVENTORY_ITEMS
-- current_stock is NEVER edited directly. It only moves through:
--   • delivery_items           (stock in)
--   • inventory_consumption    (stock out)
--   • CALL sp_adjust_stock()   (physical count correction, reason required)
-- Triggers in 04_triggers.sql enforce this.
-- =============================================================================
CREATE TABLE inventory_items (
    item_id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_code             VARCHAR(25)  NOT NULL UNIQUE,    -- e.g. C-STP-001, H-LIN-001
    item_name             VARCHAR(120) NOT NULL,
    location              ENUM('HOSTEL','CANTEEN') NOT NULL,
    category              ENUM(
                              -- canteen
                              'FOOD_STAPLES',
                              'MEAT_POULTRY',
                              'BEVERAGES',
                              'INGREDIENTS',
                              'SUPPLIES_PACKAGING',
                              -- hostel
                              'LINENS_BEDDING',
                              'TOILETRIES',
                              'ROOM_SUPPLIES',
                              -- both
                              'CLEANING'
                          ) NOT NULL,
    unit                  VARCHAR(30)   NOT NULL,          -- sacks, kg, pcs, rolls…
    current_stock         DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    reorder_level         DECIMAL(12,3) NOT NULL DEFAULT 10.000,  -- LOW alert
    critical_level        DECIMAL(12,3) NOT NULL DEFAULT 0.000,   -- CRITICAL alert
    unit_cost             DECIMAL(10,2) NOT NULL DEFAULT 0.00,    -- last delivery cost
    preferred_supplier_id INT UNSIGNED NULL,
    description           TEXT,
    is_active             TINYINT(1) NOT NULL DEFAULT 1,
    last_restocked_at     DATETIME NULL,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_item_supplier
        FOREIGN KEY (preferred_supplier_id) REFERENCES suppliers(supplier_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_item_stock  CHECK (current_stock >= 0),
    CONSTRAINT chk_item_levels CHECK (critical_level >= 0 AND critical_level <= reorder_level),
    CONSTRAINT uq_item_name_per_location UNIQUE (location, item_name),

    INDEX idx_items_location_cat (location, category),
    INDEX idx_items_low_stock    (is_active, location, current_stock),
    INDEX idx_items_supplier     (preferred_supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. DELIVERIES (header)
-- total_amount is computed by trigger from delivery_items — never typed in.
-- REJECTED deliveries are recorded for supplier history but cannot hold items
-- (rejected goods never enter stock).
-- =============================================================================
CREATE TABLE deliveries (
    delivery_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    delivery_receipt_no VARCHAR(60)  NOT NULL UNIQUE,      -- supplier DR number
    supplier_id         INT UNSIGNED NOT NULL,
    location            ENUM('HOSTEL','CANTEEN') NOT NULL,
    status              ENUM('RECEIVED','REJECTED') NOT NULL DEFAULT 'RECEIVED',
    received_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_by         INT UNSIGNED NULL,
    total_amount        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    notes               TEXT,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_del_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_del_receiver
        FOREIGN KEY (received_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_del_location_date (location, received_at),
    INDEX idx_del_supplier_date (supplier_id, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. DELIVERY_ITEMS (lines)
-- Append-only. Inserting a line raises stock, adds to the header total and
-- writes a STOCK_IN ledger row. FK is RESTRICT (not CASCADE) because cascaded
-- deletes do not fire triggers and would leave stock wrong.
-- =============================================================================
CREATE TABLE delivery_items (
    delivery_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    delivery_id      INT UNSIGNED  NOT NULL,
    item_id          INT UNSIGNED  NOT NULL,
    quantity         DECIMAL(12,3) NOT NULL,
    unit_cost        DECIMAL(10,2) NOT NULL,
    line_total       DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(quantity * unit_cost, 2)) STORED,
    notes            TEXT,

    CONSTRAINT fk_di_delivery
        FOREIGN KEY (delivery_id) REFERENCES deliveries(delivery_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_di_item
        FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_di_qty  CHECK (quantity > 0),
    CONSTRAINT chk_di_cost CHECK (unit_cost >= 0),

    INDEX idx_di_delivery (delivery_id),
    INDEX idx_di_item     (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. INVENTORY_TRANSACTIONS (stock ledger)
-- One row per stock change, written only by triggers / sp_adjust_stock.
--   STOCK_IN   ← delivery_items       (ref_type 'DELIVERY',    ref_id delivery_id)
--   STOCK_OUT  ← inventory_consumption (ref_type 'CONSUMPTION', ref_id consumption_id)
--   ADJUSTMENT ← sp_adjust_stock       (ref_type 'COUNT')
-- quantity is always positive; direction is stock_before → stock_after.
-- =============================================================================
CREATE TABLE inventory_transactions (
    txn_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id          INT UNSIGNED  NOT NULL,
    transaction_type ENUM('STOCK_IN','STOCK_OUT','ADJUSTMENT') NOT NULL,
    quantity         DECIMAL(12,3) NOT NULL,
    unit_cost        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_cost       DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(quantity * unit_cost, 2)) STORED,
    stock_before     DECIMAL(12,3) NOT NULL,
    stock_after      DECIMAL(12,3) NOT NULL,
    ref_type         VARCHAR(30)   NULL,
    ref_id           INT UNSIGNED  NULL,
    reason           VARCHAR(255)  NOT NULL,
    performed_by     INT UNSIGNED  NULL,
    transaction_date DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes            TEXT,

    CONSTRAINT fk_txn_item
        FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_txn_user
        FOREIGN KEY (performed_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_txn_item_date (item_id, transaction_date),
    INDEX idx_txn_type_date (transaction_type, transaction_date),
    INDEX idx_txn_ref       (ref_type, ref_id),
    INDEX idx_txn_user      (performed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 7. INVENTORY_CONSUMPTION
-- Append-only usage records. purpose examples:
--   canteen: KITCHEN_USAGE, CANTEEN_SALES, SPOILAGE
--   hostel : ROOM_RESTOCK, HOUSEKEEPING, LAUNDRY, DAMAGED
-- =============================================================================
CREATE TABLE inventory_consumption (
    consumption_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id          INT UNSIGNED  NOT NULL,
    quantity         DECIMAL(12,3) NOT NULL,
    purpose          VARCHAR(120)  NOT NULL,
    notes            TEXT,
    recorded_by      INT UNSIGNED  NULL,
    consumption_date DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_con_item
        FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_con_user
        FOREIGN KEY (recorded_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_con_qty CHECK (quantity > 0),

    INDEX idx_con_item_date (item_id, consumption_date),
    INDEX idx_con_user      (recorded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 8. AUDIT_LOGS
-- username/role snapshots keep the log readable after a user is deleted.
-- Write to it with CALL sp_log(...) (see 03_procedures.sql).
-- =============================================================================
CREATE TABLE audit_logs (
    log_id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id           INT UNSIGNED NULL,
    username_snapshot VARCHAR(50)  NOT NULL,
    role_snapshot     VARCHAR(30)  NOT NULL DEFAULT 'SYSTEM',
    action_type       VARCHAR(60)  NOT NULL,      -- LOGIN, DELIVERY_RECORDED, STOCK_ADJUSTED…
    target_entity     VARCHAR(60)  NOT NULL,      -- table / module name
    target_id         INT UNSIGNED NULL,
    description       TEXT,
    old_value         TEXT NULL,
    new_value         TEXT NULL,
    ip_address        VARCHAR(45)  NULL,
    logged_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_log_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_log_date        (logged_at, log_id),
    INDEX idx_log_user_date   (user_id, logged_at),
    INDEX idx_log_action_date (action_type, logged_at),
    INDEX idx_log_target      (target_entity, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 9. AUDIT_LOGS_ARCHIVE
-- Same shape as audit_logs; old rows are MOVED here by sp_archive_audit_logs.
-- No FK to users on purpose: archived rows must outlive user accounts.
-- =============================================================================
CREATE TABLE audit_logs_archive (
    log_id            INT UNSIGNED PRIMARY KEY,    -- original id preserved
    user_id           INT UNSIGNED NULL,
    username_snapshot VARCHAR(50)  NOT NULL,
    role_snapshot     VARCHAR(30)  NOT NULL DEFAULT 'SYSTEM',
    action_type       VARCHAR(60)  NOT NULL,
    target_entity     VARCHAR(60)  NOT NULL,
    target_id         INT UNSIGNED NULL,
    description       TEXT,
    old_value         TEXT NULL,
    new_value         TEXT NULL,
    ip_address        VARCHAR(45)  NULL,
    logged_at         DATETIME     NOT NULL,
    archived_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_arch_date        (logged_at),
    INDEX idx_arch_user_date   (user_id, logged_at),
    INDEX idx_arch_action_date (action_type, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
