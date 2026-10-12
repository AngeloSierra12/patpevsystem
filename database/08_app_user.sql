-- =============================================================================
-- HOTEL INVENTORY SYSTEM FOR IGP PATVEP HOSTEL AND UNIVERSITY CANTEEN
-- File: 08_app_user.sql
-- Purpose: Least-privilege MariaDB account for the PHP backend
-- Run AFTER: 01-06. Safe to re-run (recreates the account).
--
-- The password is NOT stored in this file. Pass it in when running:
--   mysql -uroot -e "SET @app_pw='your-password'; SOURCE 08_app_user.sql;"
--
-- What patvep_app CAN do (only inside bpsu_patvep_inventory):
--   SELECT, INSERT, UPDATE, EXECUTE (call sp_log / sp_adjust_stock)
-- What it CANNOT do:
--   DELETE, DROP, ALTER, CREATE, disable triggers, touch other databases.
--   (Records are deactivated with is_active = 0, never deleted.)
--
-- Triggers and procedures still work: they run with their definer's (root)
-- privileges, so e.g. a stock update fired by an INSERT succeeds even though
-- patvep_app itself cannot write current_stock directly.
-- =============================================================================

USE bpsu_patvep_inventory;

DELIMITER $$
DROP PROCEDURE IF EXISTS tmp_create_app_user $$
CREATE PROCEDURE tmp_create_app_user()
BEGIN
    IF @app_pw IS NULL OR LENGTH(@app_pw) < 12 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Set @app_pw to a password of at least 12 characters first.';
    END IF;

    -- PHP connects to 127.0.0.1; MariaDB may see that as 'localhost' or
    -- '127.0.0.1' depending on name resolution, so create both.
    DROP USER IF EXISTS 'patvep_app'@'localhost';
    DROP USER IF EXISTS 'patvep_app'@'127.0.0.1';

    SET @s = CONCAT('CREATE USER ''patvep_app''@''localhost'' IDENTIFIED BY ', QUOTE(@app_pw));
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
    SET @s = CONCAT('CREATE USER ''patvep_app''@''127.0.0.1'' IDENTIFIED BY ', QUOTE(@app_pw));
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
    SET @s = NULL;
END $$
DELIMITER ;

CALL tmp_create_app_user();
DROP PROCEDURE tmp_create_app_user;
SET @app_pw = NULL;

GRANT SELECT, INSERT, UPDATE, EXECUTE ON bpsu_patvep_inventory.* TO 'patvep_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, EXECUTE ON bpsu_patvep_inventory.* TO 'patvep_app'@'127.0.0.1';
FLUSH PRIVILEGES;

SHOW GRANTS FOR 'patvep_app'@'localhost';
