-- =============================================================================
-- BPSU IGP PATVEP HOSTEL & UNIVERSITY CANTEEN SYSTEM
-- File: 05_triggers.sql
-- Purpose: Database triggers for stock management and audit automation
-- Run AFTER: 02_tables.sql
--
-- TRIGGER INVENTORY
-- ─────────────────────────────────────────────────────────────────────────────
-- trg_delivery_item_after_insert
--     Table:   delivery_items
--     Event:   AFTER INSERT
--     Purpose: When a delivery line item is saved, automatically:
--              1. Increase current_stock on inventory_items
--              2. Update last_restocked_at and unit_cost on inventory_items
--              3. Insert a STOCK_IN record into inventory_transactions
--
-- trg_consumption_after_insert
--     Table:   inventory_consumption
--     Event:   AFTER INSERT
--     Purpose: When a consumption record is saved, automatically:
--              1. Decrease current_stock on inventory_items
--              2. Insert a STOCK_OUT record into inventory_transactions
--
-- TRIGGER AUDIT
-- ─────────────────────────────────────────────────────────────────────────────
-- trg_reservation_after_update
--     Table:   reservations
--     Event:   AFTER UPDATE
--     Purpose: Log status changes (CONFIRM, CHECK_IN, CHECK_OUT, CANCEL)
--              into audit_logs automatically.
--
-- trg_payment_after_insert
--     Table:   payments
--     Event:   AFTER INSERT
--     Purpose: Update paid_amount on the parent reservation, and log the
--              payment event to audit_logs.
--
-- trg_payment_before_update
--     Table:   payments
--     Event:   BEFORE UPDATE
--     Purpose: Prevent modification of posted payment records.
--              Payments are append-only; use a reversal record if needed.
--
-- trg_payment_before_delete
--     Table:   payments
--     Event:   BEFORE DELETE
--     Purpose: Prevent deletion of payment records.
--              Deleting a payment would cause paid_amount on the reservation
--              to become inconsistent with the payment ledger.
--
-- NOTE: No trigger causes another trigger on the same table (no recursion risk).
-- NOTE: Triggers use SIGNAL SQLSTATE for input validation where relevant.
-- =============================================================================

USE bpsu_patvep;

DELIMITER $$

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DELIVERY ITEM INSERT → stock increase + transaction record
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_delivery_item_after_insert $$

CREATE TRIGGER trg_delivery_item_after_insert
AFTER INSERT ON delivery_items
FOR EACH ROW
BEGIN
    DECLARE v_stock_before DECIMAL(12,3);
    DECLARE v_stock_after  DECIMAL(12,3);
    DECLARE v_receiver     INT UNSIGNED;

    -- Guard: quantity must be positive (belt-and-suspenders for CHECK constraint)
    IF NEW.quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'delivery_items.quantity must be greater than zero';
    END IF;

    -- Read current stock before update
    SELECT current_stock INTO v_stock_before
    FROM inventory_items
    WHERE item_id = NEW.item_id;

    SET v_stock_after = v_stock_before + NEW.quantity;

    -- Update inventory_items
    UPDATE inventory_items
    SET current_stock     = v_stock_after,
        unit_cost         = NEW.unit_cost,
        last_restocked_at = NOW(),
        updated_at        = NOW()
    WHERE item_id = NEW.item_id;

    -- Get the staff member who received the delivery
    SELECT received_by INTO v_receiver
    FROM deliveries
    WHERE delivery_id = NEW.delivery_id;

    -- Insert STOCK_IN transaction record
    INSERT INTO inventory_transactions
        (item_id, transaction_type, quantity, unit_cost,
         stock_before, stock_after, ref_type, ref_id,
         reason, performed_by, transaction_date)
    VALUES
        (NEW.item_id, 'STOCK_IN', NEW.quantity, NEW.unit_cost,
         v_stock_before, v_stock_after, 'DELIVERY', NEW.delivery_id,
         'SUPPLIER_DELIVERY', v_receiver, NOW());
END $$


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CONSUMPTION INSERT → stock decrease + transaction record
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_consumption_after_insert $$

CREATE TRIGGER trg_consumption_after_insert
AFTER INSERT ON inventory_consumption
FOR EACH ROW
BEGIN
    DECLARE v_stock_before DECIMAL(12,3);
    DECLARE v_stock_after  DECIMAL(12,3);
    DECLARE v_unit_cost    DECIMAL(10,2);

    -- Read current stock and cost before update
    SELECT current_stock, unit_cost
    INTO v_stock_before, v_unit_cost
    FROM inventory_items
    WHERE item_id = NEW.item_id;

    -- Guard: cannot consume more than available
    
    IF NEW.quantity <= 0 THEN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Consumption quantity must be greater than zero';
	END IF;
    
    IF NEW.quantity > v_stock_before THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Consumption quantity exceeds available stock';
    END IF;

    SET v_stock_after = v_stock_before - NEW.quantity;

    -- Update inventory_items
    UPDATE inventory_items
    SET current_stock = v_stock_after,
        updated_at    = NOW()
    WHERE item_id = NEW.item_id;

    -- Insert STOCK_OUT transaction record
    INSERT INTO inventory_transactions
        (item_id, transaction_type, quantity, unit_cost,
         stock_before, stock_after, ref_type, ref_id,
         reason, performed_by, transaction_date, notes)
    VALUES
        (NEW.item_id, 'STOCK_OUT', NEW.quantity, v_unit_cost,
         v_stock_before, v_stock_after, 'CONSUMPTION', NEW.consumption_id,
         NEW.purpose, NEW.recorded_by, NEW.consumption_date, NEW.notes);
END $$


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RESERVATION STATUS CHANGE → audit log
--
-- ACTOR NOTE: This trigger logs reservation.handled_by as the audit actor.
-- handled_by is the staff member assigned to the reservation, not necessarily
-- the currently authenticated application user making the status change.
-- For the prototype, this is an acceptable approximation. A production system
-- would pass the authenticated session user via application-level logic.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_reservation_after_update $$

CREATE TRIGGER trg_reservation_after_update
AFTER UPDATE ON reservations
FOR EACH ROW
BEGIN
    DECLARE v_action   VARCHAR(60);
    DECLARE v_username VARCHAR(50);
    DECLARE v_role     VARCHAR(30);

    -- Only log if status actually changed
    IF OLD.status <> NEW.status THEN

        -- Action name: RESERVATION_ + new status value
        -- Results in: RESERVATION_CONFIRMED, RESERVATION_CHECKED_IN,
        --             RESERVATION_CHECKED_OUT, RESERVATION_CANCELLED, etc.
        SET v_action = CONCAT('RESERVATION_', NEW.status);

        -- Resolve handler username for the snapshot
        IF NEW.handled_by IS NOT NULL THEN
            SELECT username, role INTO v_username, v_role
            FROM users WHERE user_id = NEW.handled_by;
        ELSE
            SET v_username = 'SYSTEM';
            SET v_role     = 'SYSTEM';
        END IF;

        INSERT INTO audit_logs
            (user_id, username_snapshot, role_snapshot,
             action_type, target_entity, target_id,
             description, old_value, new_value, logged_at)
        VALUES
            (NEW.handled_by, IFNULL(v_username,'SYSTEM'), IFNULL(v_role,'SYSTEM'),
             v_action, 'RESERVATION', NEW.reservation_id,
             CONCAT('Reservation ', NEW.reference_number,
                    ' status changed from ', OLD.status, ' to ', NEW.status),
             OLD.status, NEW.status, NOW());
    END IF;
END $$


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PAYMENT INSERT → update reservation paid_amount + audit log
--
-- OVERPAYMENT GUARD: A payment that would cause paid_amount to exceed
-- total_amount is rejected. Staff must resolve overpayment disputes manually.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_payment_after_insert $$

CREATE TRIGGER trg_payment_after_insert
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    DECLARE v_ref         VARCHAR(30);
    DECLARE v_total       DECIMAL(12,2);
    DECLARE v_paid        DECIMAL(12,2);
    DECLARE v_username    VARCHAR(50);
    DECLARE v_role        VARCHAR(30);

    -- Read current reservation state
    SELECT reference_number, total_amount, paid_amount
    INTO v_ref, v_total, v_paid
    FROM reservations WHERE reservation_id = NEW.reservation_id;

    -- Guard: prevent overpayment
    IF v_paid + NEW.amount > v_total THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payment amount would exceed the reservation total. Correct the amount or adjust the reservation total first.';
    END IF;

    -- Accumulate paid_amount on the reservation
    UPDATE reservations
    SET paid_amount = paid_amount + NEW.amount,
        updated_at  = NOW()
    WHERE reservation_id = NEW.reservation_id;

    -- Resolve receiver info for audit
    IF NEW.received_by IS NOT NULL THEN
        SELECT username, role INTO v_username, v_role
        FROM users WHERE user_id = NEW.received_by;
    ELSE
        SET v_username = 'SYSTEM';
        SET v_role     = 'SYSTEM';
    END IF;

    -- Audit log entry
    INSERT INTO audit_logs
        (user_id, username_snapshot, role_snapshot,
         action_type, target_entity, target_id,
         description, logged_at)
    VALUES
        (NEW.received_by, IFNULL(v_username,'SYSTEM'), IFNULL(v_role,'SYSTEM'),
         'PAYMENT_RECORDED', 'PAYMENT', NEW.payment_id,
         CONCAT('Payment ', NEW.receipt_number, ' of PHP ', NEW.amount,
                ' recorded for reservation ', IFNULL(v_ref,'?'),
                ' via ', NEW.payment_method),
         NOW());
END $$


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PAYMENT BEFORE UPDATE → prevent modification of posted payments
--
-- Payments are an append-only financial ledger. Modifying a posted payment
-- record would make paid_amount on the reservation inconsistent.
-- If a payment was entered in error, it must be voided via a new adjustment
-- record (application-level), not by editing the payment row directly.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_payment_before_update $$

CREATE TRIGGER trg_payment_before_update
BEFORE UPDATE ON payments
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Payment records are append-only and cannot be modified. To void a payment, use the reversal process.';
END $$


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PAYMENT BEFORE DELETE → prevent deletion of posted payments
--
-- Deleting a payment row would cause paid_amount on the parent reservation
-- to be overstated (since the trigger only increments, never decrements).
-- Deletion is blocked at the database level to enforce ledger integrity.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_payment_before_delete $$

CREATE TRIGGER trg_payment_before_delete
BEFORE DELETE ON payments
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Payment records cannot be deleted. The payment ledger must remain intact for audit and billing accuracy.';
END $$


DELIMITER ;
