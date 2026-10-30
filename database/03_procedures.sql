USE bpsu_patvep_inventory;

DROP PROCEDURE IF EXISTS sp_log;
DROP PROCEDURE IF EXISTS sp_adjust_stock;
DROP PROCEDURE IF EXISTS sp_archive_audit_logs;

DELIMITER $$

CREATE PROCEDURE sp_log(
    IN p_user_id     INT UNSIGNED,
    IN p_action      VARCHAR(60),
    IN p_entity      VARCHAR(60),
    IN p_target_id   INT UNSIGNED,
    IN p_description TEXT,
    IN p_old_value   TEXT,
    IN p_new_value   TEXT,
    IN p_logged_at   DATETIME
)
BEGIN
    DECLARE v_username VARCHAR(50) DEFAULT NULL;
    DECLARE v_role     VARCHAR(30) DEFAULT NULL;

    IF p_user_id IS NOT NULL THEN
        SELECT username, role INTO v_username, v_role
        FROM users WHERE user_id = p_user_id;
    END IF;

    INSERT INTO audit_logs
        (user_id, username_snapshot, role_snapshot, action_type, target_entity,
         target_id, description, old_value, new_value, ip_address, logged_at)
    VALUES
        (IF(v_username IS NULL, NULL, p_user_id),
         IFNULL(v_username, 'SYSTEM'), IFNULL(v_role, 'SYSTEM'),
         p_action, p_entity, p_target_id, p_description, p_old_value, p_new_value,
         @app_ip, IFNULL(p_logged_at, NOW()));
END $$

CREATE PROCEDURE sp_adjust_stock(
    IN p_item_id     INT UNSIGNED,
    IN p_counted_qty DECIMAL(12,3),
    IN p_reason      VARCHAR(255),
    IN p_user_id     INT UNSIGNED
)
BEGIN
    DECLARE v_stock     DECIMAL(12,3);
    DECLARE v_cost      DECIMAL(10,2);
    DECLARE v_code      VARCHAR(25);

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A reason is required for every stock adjustment';
    END IF;
    IF p_counted_qty IS NULL OR p_counted_qty < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Counted quantity must be zero or more';
    END IF;

    SELECT current_stock, unit_cost, item_code
    INTO v_stock, v_cost, v_code
    FROM inventory_items WHERE item_id = p_item_id
    FOR UPDATE;

    IF v_code IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inventory item not found';
    END IF;

    IF v_stock = p_counted_qty THEN
        CALL sp_log(p_user_id, 'STOCK_COUNT_MATCHED', 'INVENTORY_ITEM', p_item_id,
                    CONCAT('Physical count of ', v_code, ' matches system stock (', v_stock, '). ', p_reason),
                    NULL, NULL, NOW());
    ELSE

        SET @ledger_write = 1;
        UPDATE inventory_items SET current_stock = p_counted_qty WHERE item_id = p_item_id;
        SET @ledger_write = NULL;

        INSERT INTO inventory_transactions
            (item_id, transaction_type, quantity, unit_cost, stock_before, stock_after,
             ref_type, ref_id, reason, performed_by, transaction_date)
        VALUES
            (p_item_id, 'ADJUSTMENT', ABS(p_counted_qty - v_stock), v_cost, v_stock, p_counted_qty,
             'COUNT', NULL, p_reason, p_user_id, NOW());

        CALL sp_log(p_user_id, 'STOCK_ADJUSTED', 'INVENTORY_ITEM', p_item_id,
                    CONCAT('Stock of ', v_code, ' adjusted from ', v_stock, ' to ', p_counted_qty, '. Reason: ', p_reason),
                    v_stock, p_counted_qty, NOW());
    END IF;
END $$

CREATE PROCEDURE sp_archive_audit_logs(IN p_days_to_keep INT)
BEGIN
    DECLARE v_cutoff   DATETIME;
    DECLARE v_inserted INT DEFAULT 0;
    DECLARE v_deleted  INT DEFAULT 0;

    SET p_days_to_keep = IF(p_days_to_keep IS NULL OR p_days_to_keep < 1, 90, p_days_to_keep);
    SET v_cutoff = DATE_SUB(NOW(), INTERVAL p_days_to_keep DAY);

    START TRANSACTION;
        INSERT IGNORE INTO audit_logs_archive
            (log_id, user_id, username_snapshot, role_snapshot, action_type, target_entity,
             target_id, description, old_value, new_value, ip_address, logged_at)
        SELECT
             log_id, user_id, username_snapshot, role_snapshot, action_type, target_entity,
             target_id, description, old_value, new_value, ip_address, logged_at
        FROM audit_logs
        WHERE logged_at < v_cutoff;
        SET v_inserted = ROW_COUNT();

        DELETE FROM audit_logs
        WHERE logged_at < v_cutoff
          AND log_id IN (SELECT log_id FROM audit_logs_archive);
        SET v_deleted = ROW_COUNT();
    COMMIT;

    SELECT v_inserted AS records_inserted, v_deleted AS records_deleted, v_cutoff AS archived_before;
END $$

DELIMITER ;
