-- =============================================================================
-- HOTEL INVENTORY SYSTEM FOR IGP PATVEP HOSTEL AND UNIVERSITY CANTEEN
-- File: 04_triggers.sql
-- Purpose: Stock automation, data-integrity guards, audit automation (WBS 7.2)
-- Run AFTER: 03_procedures.sql
--
-- STOCK FLOW
--   trg_delivery_item_after_insert   stock +qty, header total +line, STOCK_IN row
--   trg_consumption_after_insert     stock −qty, STOCK_OUT row, audit row
--   (sp_adjust_stock)                count correction, ADJUSTMENT row, audit row
--
-- GUARDS (raise an error instead of silently corrupting stock)
--   trg_item_before_insert           new items must start at 0 stock
--   trg_item_before_update           stock can't be edited directly; location
--                                    can't change once the item has history
--   trg_delivery_before_update       total is computed; status/location locked
--                                    once lines exist
--   trg_delivery_item_before_update  lines are append-only
--   trg_delivery_item_before_delete  lines are append-only
--   trg_consumption_before_update    consumption is append-only
--   trg_consumption_before_delete    consumption is append-only
--   trg_txn_before_update            ledger is append-only
--   trg_txn_before_delete            ledger is append-only
--
-- AUDIT
--   trg_item_after_update            item detail edits (name, levels, etc.)
--   trg_delivery_after_insert        delivery received / rejected
--   trg_consumption_after_insert     consumption recorded
--
-- Mistakes are corrected with sp_adjust_stock (with a reason), never by
-- editing or deleting history.
-- =============================================================================

USE bpsu_patvep_inventory;

DROP TRIGGER IF EXISTS trg_item_before_insert;
DROP TRIGGER IF EXISTS trg_item_before_update;
DROP TRIGGER IF EXISTS trg_item_after_update;
DROP TRIGGER IF EXISTS trg_delivery_after_insert;
DROP TRIGGER IF EXISTS trg_delivery_before_update;
DROP TRIGGER IF EXISTS trg_delivery_item_after_insert;
DROP TRIGGER IF EXISTS trg_delivery_item_before_update;
DROP TRIGGER IF EXISTS trg_delivery_item_before_delete;
DROP TRIGGER IF EXISTS trg_consumption_after_insert;
DROP TRIGGER IF EXISTS trg_consumption_before_update;
DROP TRIGGER IF EXISTS trg_consumption_before_delete;
DROP TRIGGER IF EXISTS trg_txn_before_update;
DROP TRIGGER IF EXISTS trg_txn_before_delete;

DELIMITER $$

-- ═════════════════════════════════════════════════════════════════════════════
-- INVENTORY ITEMS
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_item_before_insert
BEFORE INSERT ON inventory_items
FOR EACH ROW
BEGIN
    IF NEW.current_stock <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'New items start at 0 stock. Record a delivery or CALL sp_adjust_stock() for the opening balance.';
    END IF;
END $$


CREATE TRIGGER trg_item_before_update
BEFORE UPDATE ON inventory_items
FOR EACH ROW
BEGIN
    IF NEW.current_stock <> OLD.current_stock AND IFNULL(@ledger_write, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'current_stock cannot be edited directly. Use deliveries, consumption, or CALL sp_adjust_stock().';
    END IF;

    IF NEW.location <> OLD.location
       AND EXISTS (SELECT 1 FROM inventory_transactions WHERE item_id = OLD.item_id) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Item already has stock history; create a new item for the other location instead.';
    END IF;
END $$


-- Logs edits to item details. Stock/cost changes are NOT logged here because
-- they already appear in inventory_transactions and their own audit rows.
CREATE TRIGGER trg_item_after_update
AFTER UPDATE ON inventory_items
FOR EACH ROW
BEGIN
    DECLARE v_changes TEXT;

    SET v_changes = CONCAT_WS('; ',
        IF(NOT (OLD.item_name             <=> NEW.item_name),             CONCAT('name: ', OLD.item_name, ' -> ', NEW.item_name), NULL),
        IF(NOT (OLD.location              <=> NEW.location),              CONCAT('location: ', OLD.location, ' -> ', NEW.location), NULL),
        IF(NOT (OLD.category              <=> NEW.category),              CONCAT('category: ', OLD.category, ' -> ', NEW.category), NULL),
        IF(NOT (OLD.unit                  <=> NEW.unit),                  CONCAT('unit: ', OLD.unit, ' -> ', NEW.unit), NULL),
        IF(NOT (OLD.reorder_level         <=> NEW.reorder_level),         CONCAT('reorder_level: ', OLD.reorder_level, ' -> ', NEW.reorder_level), NULL),
        IF(NOT (OLD.critical_level        <=> NEW.critical_level),        CONCAT('critical_level: ', OLD.critical_level, ' -> ', NEW.critical_level), NULL),
        IF(NOT (OLD.preferred_supplier_id <=> NEW.preferred_supplier_id), CONCAT('preferred_supplier_id: ', IFNULL(OLD.preferred_supplier_id, 'none'), ' -> ', IFNULL(NEW.preferred_supplier_id, 'none')), NULL),
        IF(NOT (OLD.is_active             <=> NEW.is_active),             IF(NEW.is_active = 1, 'reactivated', 'deactivated'), NULL)
    );

    IF v_changes <> '' THEN
        CALL sp_log(@app_user_id,
                    IF(NOT (OLD.is_active <=> NEW.is_active) AND NEW.is_active = 0, 'ITEM_DEACTIVATED', 'ITEM_UPDATED'),
                    'INVENTORY_ITEM', NEW.item_id,
                    CONCAT('Item ', NEW.item_code, ' updated: ', v_changes),
                    NULL, NULL, NOW());
    END IF;
END $$


-- ═════════════════════════════════════════════════════════════════════════════
-- DELIVERIES
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_delivery_after_insert
AFTER INSERT ON deliveries
FOR EACH ROW
BEGIN
    DECLARE v_supplier VARCHAR(120);
    SELECT supplier_name INTO v_supplier FROM suppliers WHERE supplier_id = NEW.supplier_id;

    CALL sp_log(NEW.received_by,
                IF(NEW.status = 'REJECTED', 'DELIVERY_REJECTED', 'DELIVERY_RECORDED'),
                'DELIVERY', NEW.delivery_id,
                CONCAT(IF(NEW.status = 'REJECTED', 'Rejected', 'Received'),
                       ' delivery ', NEW.delivery_receipt_no, ' from ', IFNULL(v_supplier, '?'),
                       ' for ', NEW.location),
                NULL, NULL, NEW.received_at);
END $$


CREATE TRIGGER trg_delivery_before_update
BEFORE UPDATE ON deliveries
FOR EACH ROW
BEGIN
    IF NEW.total_amount <> OLD.total_amount AND IFNULL(@ledger_write, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'deliveries.total_amount is computed from its line items and cannot be edited.';
    END IF;

    IF (NEW.status <> OLD.status OR NEW.location <> OLD.location)
       AND EXISTS (SELECT 1 FROM delivery_items WHERE delivery_id = OLD.delivery_id) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Delivery already has items in stock; its status and location are locked. Use sp_adjust_stock to correct stock.';
    END IF;
END $$


-- ═════════════════════════════════════════════════════════════════════════════
-- DELIVERY ITEMS  (stock in)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_delivery_item_after_insert
AFTER INSERT ON delivery_items
FOR EACH ROW
BEGIN
    DECLARE v_del_location  VARCHAR(10);
    DECLARE v_del_status    VARCHAR(10);
    DECLARE v_received_at   DATETIME;
    DECLARE v_received_by   INT UNSIGNED;
    DECLARE v_item_location VARCHAR(10);
    DECLARE v_stock_before  DECIMAL(12,3);

    SELECT location, status, received_at, received_by
    INTO v_del_location, v_del_status, v_received_at, v_received_by
    FROM deliveries WHERE delivery_id = NEW.delivery_id;

    -- FOR UPDATE locks the item row so two simultaneous deliveries/consumptions
    -- can't both read the same stock_before.
    SELECT location, current_stock
    INTO v_item_location, v_stock_before
    FROM inventory_items WHERE item_id = NEW.item_id
    FOR UPDATE;

    IF v_del_status <> 'RECEIVED' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Items can only be added to a RECEIVED delivery.';
    END IF;

    IF v_item_location <> v_del_location THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Item location does not match the delivery location (HOSTEL vs CANTEEN).';
    END IF;

    SET @ledger_write = 1;

    UPDATE inventory_items
    SET current_stock     = v_stock_before + NEW.quantity,
        unit_cost         = NEW.unit_cost,
        last_restocked_at = v_received_at
    WHERE item_id = NEW.item_id;

    UPDATE deliveries
    SET total_amount = total_amount + NEW.line_total
    WHERE delivery_id = NEW.delivery_id;

    SET @ledger_write = NULL;

    INSERT INTO inventory_transactions
        (item_id, transaction_type, quantity, unit_cost, stock_before, stock_after,
         ref_type, ref_id, reason, performed_by, transaction_date)
    VALUES
        (NEW.item_id, 'STOCK_IN', NEW.quantity, NEW.unit_cost,
         v_stock_before, v_stock_before + NEW.quantity,
         'DELIVERY', NEW.delivery_id, 'SUPPLIER_DELIVERY', v_received_by, v_received_at);
END $$


CREATE TRIGGER trg_delivery_item_before_update
BEFORE UPDATE ON delivery_items
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Delivery lines cannot be edited. Correct stock with sp_adjust_stock (reason required).';
END $$


CREATE TRIGGER trg_delivery_item_before_delete
BEFORE DELETE ON delivery_items
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Delivery lines cannot be deleted. Correct stock with sp_adjust_stock (reason required).';
END $$


-- ═════════════════════════════════════════════════════════════════════════════
-- CONSUMPTION  (stock out)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_consumption_after_insert
AFTER INSERT ON inventory_consumption
FOR EACH ROW
BEGIN
    DECLARE v_stock_before DECIMAL(12,3);
    DECLARE v_unit_cost    DECIMAL(10,2);
    DECLARE v_code         VARCHAR(25);
    DECLARE v_unit         VARCHAR(30);

    SELECT current_stock, unit_cost, item_code, unit
    INTO v_stock_before, v_unit_cost, v_code, v_unit
    FROM inventory_items WHERE item_id = NEW.item_id
    FOR UPDATE;

    IF NEW.quantity > v_stock_before THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Consumption quantity exceeds available stock.';
    END IF;

    SET @ledger_write = 1;
    UPDATE inventory_items
    SET current_stock = v_stock_before - NEW.quantity
    WHERE item_id = NEW.item_id;
    SET @ledger_write = NULL;

    INSERT INTO inventory_transactions
        (item_id, transaction_type, quantity, unit_cost, stock_before, stock_after,
         ref_type, ref_id, reason, performed_by, transaction_date, notes)
    VALUES
        (NEW.item_id, 'STOCK_OUT', NEW.quantity, v_unit_cost,
         v_stock_before, v_stock_before - NEW.quantity,
         'CONSUMPTION', NEW.consumption_id, NEW.purpose, NEW.recorded_by,
         NEW.consumption_date, NEW.notes);

    CALL sp_log(NEW.recorded_by, 'CONSUMPTION_RECORDED', 'INVENTORY_CONSUMPTION', NEW.consumption_id,
                CONCAT(NEW.quantity, ' ', v_unit, ' of ', v_code, ' used (', NEW.purpose, ')'),
                NULL, NULL, NEW.consumption_date);
END $$


CREATE TRIGGER trg_consumption_before_update
BEFORE UPDATE ON inventory_consumption
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Consumption records cannot be edited. Correct stock with sp_adjust_stock (reason required).';
END $$


CREATE TRIGGER trg_consumption_before_delete
BEFORE DELETE ON inventory_consumption
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Consumption records cannot be deleted. Correct stock with sp_adjust_stock (reason required).';
END $$


-- ═════════════════════════════════════════════════════════════════════════════
-- STOCK LEDGER
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_txn_before_update
BEFORE UPDATE ON inventory_transactions
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'The stock ledger is append-only.';
END $$


CREATE TRIGGER trg_txn_before_delete
BEFORE DELETE ON inventory_transactions
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'The stock ledger is append-only.';
END $$

DELIMITER ;
