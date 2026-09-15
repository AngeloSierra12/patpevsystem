-- =============================================================================
-- BPSU IGP PATVEP HOSTEL & UNIVERSITY CANTEEN SYSTEM
-- File: 07_audit_archive.sql
-- Purpose: Audit log archiving stored procedure and archive table
-- Run AFTER: 02_tables.sql
-- =============================================================================

USE bpsu_patvep;

-- ── AUDIT ARCHIVE TABLE ───────────────────────────────────────────────────────
-- Identical structure to audit_logs but separated for long-term storage.
-- Records move here when older than 90 days (configurable via procedure).
-- This keeps the active audit_logs table lean for fast filtering/search.
-- The archive is never automatically deleted — only moved to.

DROP TABLE IF EXISTS audit_logs_archive;
CREATE TABLE audit_logs_archive (
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
-- sp_archive_audit_logs(days_to_keep INT)
--   Moves audit_logs records older than `days_to_keep` days into
--   audit_logs_archive. Skips any that already exist in archive.
--   Returns count of moved records.
--
-- Usage:
--   CALL sp_archive_audit_logs(90);   -- archive records older than 90 days
--   CALL sp_archive_audit_logs(180);  -- or 6 months

DROP PROCEDURE IF EXISTS sp_archive_audit_logs;

DELIMITER $$

CREATE PROCEDURE sp_archive_audit_logs(IN p_days_to_keep INT)
BEGIN
    DECLARE v_cutoff   DATETIME;
    DECLARE v_moved    INT DEFAULT 0;

    SET p_days_to_keep = IF(p_days_to_keep IS NULL OR p_days_to_keep < 1, 90, p_days_to_keep);
    SET v_cutoff = DATE_SUB(NOW(), INTERVAL p_days_to_keep DAY);

    -- Copy eligible records to archive (skip duplicates)
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

    SET v_moved = ROW_COUNT();

    -- Delete from active table only those successfully inserted
    DELETE FROM audit_logs
    WHERE logged_at < v_cutoff
      AND log_id IN (SELECT log_id FROM audit_logs_archive WHERE logged_at < v_cutoff);

    SELECT v_moved AS records_archived, v_cutoff AS archived_before;
END $$

DELIMITER ;


-- ── AUDIT SEARCH HELPER VIEW ──────────────────────────────────────────────────
-- Union of active + archived logs for cross-table search.
-- The application's "search logs" feature can query this view.
-- For performance, always filter by logged_at or action_type.

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
