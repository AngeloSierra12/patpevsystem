USE bpsu_patvep_inventory;

DELIMITER $$
DROP PROCEDURE IF EXISTS tmp_create_app_user $$
CREATE PROCEDURE tmp_create_app_user()
BEGIN
    IF @app_pw IS NULL OR LENGTH(@app_pw) < 12 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Set @app_pw to a password of at least 12 characters first.';
    END IF;

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
