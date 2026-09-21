-- =============================================================================
-- BPSU IGP PATVEP HOSTEL & UNIVERSITY CANTEEN SYSTEM
-- File: 07_audit_archive.sql
-- Purpose: Audit log archiving stored procedure and archive table
-- Run AFTER: 02_tables.sql (can be run independently of seed data)
--
-- SAFE TO RE-RUN: Uses CREATE TABLE IF NOT EXISTS — will NOT destroy existing
-- archived records when run against a database that already has archive data.
-- If you need to fully reset the archive during development, manually run:
--   DROP TABLE IF EXISTS audit_logs_archive;
-- before running this file.
-- =============================================================================

USE bpsu_patvep;

-- ── AUDIT ARCHIVE TABLE ───────────────────────────────────────────────────────
-- Identical structure to audit_logs but separated for long-term storage.
-- Records move here when older than 90 days (configurable via procedure).
-- This keeps the active audit_logs table lean for fast filtering/search.
-- The archive is never automatically deleted — only moved to.
--
-- No FK to users.user_id is intentional: archived records must remain
-- meaningful even if the operational user account is later deleted.
-- The username_snapshot and role_snapshot columns preserve that identity.

CREATE TABLE IF NOT EXISTS audit_logs_archive (
    log_id           INT UNSIGNED PRIMARY KEY,   -- preserved original ID
    user_id          INT UNSIGNED NULL,
    username_snapshot VARCHAR(50) NOT NULL,
    role_snapshot    VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    action_type      VARCHAR(60) NOT NULL,
    target_entity    VARCHAR(60) NOT NULL,
    target_id        INT UNSIGNED NULL,
    description      TEXT,
    old_value        TEXT NULL,
    new_value        TEXT NULL,
    ip_address       VARCHAR(45),
    logged_at        DATETIME NOT NULL,
    archived_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_arch_user   (user_id),
    INDEX idx_arch_action (action_type),
    INDEX idx_arch_entity (target_entity),
    INDEX idx_arch_date   (logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── ARCHIVE PROCEDURE ─────────────────────────────────────────────────────────
-- sp_archive_audit_logs(p_days_to_keep INT)
--   Moves audit_logs records older than `p_days_to_keep` days into
--   audit_logs_archive. Skips records already present in archive (INSERT IGNORE).
--   The INSERT and DELETE are wrapped in a transaction so the operation is
--   atomic: if the DELETE fails, the INSERTs are rolled back, leaving no
--   partial state where records exist in both tables.
--
-- Returns:
--   records_inserted  — rows newly copied into the archive table
--   records_deleted   — rows removed from the active audit_logs table
--   archived_before   — the cutoff datetime used
--
-- Usage:
--   CALL sp_archive_audit_logs(90);   -- archive records older than 90 days
--   CALL sp_archive_audit_logs(180);  -- or 6 months

DROP PROCEDURE IF EXISTS sp_archive_audit_logs;

DELIMITER $$

CREATE PROCEDURE sp_archive_audit_logs(IN p_days_to_keep INT)
BEGIN
    DECLARE v_cutoff    DATETIME;
    DECLARE v_inserted  INT DEFAULT 0;
    DECLARE v_deleted   INT DEFAULT 0;

    -- Default to 90 days if NULL or invalid value supplied
    SET p_days_to_keep = IF(p_days_to_keep IS NULL OR p_days_to_keep < 1, 90, p_days_to_keep);
    SET v_cutoff = DATE_SUB(NOW(), INTERVAL p_days_to_keep DAY);

    START TRANSACTION;

        -- Copy eligible records to archive; INSERT IGNORE skips duplicates
        -- (records already archived from a previous run)
        INSERT IGNORE INTO audit_logs_archive
            (log_id, user_id, username_snapshot, role_snapshot,
             action_type, target_entity, target_id,
             description, old_value, new_value, ip_address, logged_at)
        SELECT
            log_id, user_id, username_snapshot, role_snapshot,
            action_type, target_entity, target_id,
            description, old_value, new_value, ip_address, logged_at
        FROM audit_logs
        WHERE logged_at < v_cutoff;

        -- ROW_COUNT() after INSERT IGNORE = rows actually inserted (not skipped)
        SET v_inserted = ROW_COUNT();

        -- Remove from active table only those confirmed present in archive
        -- (safe even if some were skipped by INSERT IGNORE above)
        DELETE FROM audit_logs
        WHERE logged_at < v_cutoff
          AND log_id IN (
              SELECT log_id FROM audit_logs_archive
              WHERE logged_at < v_cutoff
          );

        SET v_deleted = ROW_COUNT();

    COMMIT;

    -- Report results
    SELECT
        v_inserted    AS records_inserted,
        v_deleted     AS records_deleted,
        v_cutoff      AS archived_before;
END $$

DELIMITER ;


-- ── AUDIT SEARCH HELPER VIEW ──────────────────────────────────────────────────
-- Union of active + archived logs for cross-table search.
-- The application's "search logs" feature can query this view.
-- For performance, always filter by logged_at or action_type.
-- log_source indicates whether the record is from the active or archive table.

DROP VIEW IF EXISTS vw_all_audit_logs;
CREATE VIEW vw_all_audit_logs AS
SELECT
    log_id, user_id, username_snapshot, role_snapshot,
    action_type, target_entity, target_id,
    description, old_value, new_value, ip_address, logged_at,
    'ACTIVE' AS log_source
FROM audit_logs
UNION ALL
SELECT
    log_id, user_id, username_snapshot, role_snapshot,
    action_type, target_entity, target_id,
    description, old_value, new_value, ip_address, logged_at,
    'ARCHIVED' AS log_source
FROM audit_logs_archive;
