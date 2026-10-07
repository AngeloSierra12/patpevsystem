-- =============================================================================
-- HOTEL INVENTORY SYSTEM FOR IGP PATVEP HOSTEL AND UNIVERSITY CANTEEN
-- File: 07_selftest.sql
-- Purpose: Prove the seed + triggers + guards work. Changes NO data.
-- Run AFTER: 06_seed_data.sql
--
-- Output: one row per check with PASS / FAIL. Everything should say PASS.
-- Guard checks try forbidden writes; each must be rejected with an error.
-- =============================================================================

USE bpsu_patvep_inventory;

DROP TEMPORARY TABLE IF EXISTS selftest;
CREATE TEMPORARY TABLE selftest (check_name VARCHAR(120), result VARCHAR(4));

-- ── Expected stock after seed ────────────────────────────────────────────────
INSERT INTO selftest
SELECT CONCAT('stock ', i.item_code, ' = ', e.qty),
       IF(i.current_stock = e.qty, 'PASS', 'FAIL')
FROM inventory_items i
JOIN (
          SELECT 'C-STP-001' code,   5.500 qty UNION ALL SELECT 'C-MEA-002', 19.500
UNION ALL SELECT 'C-MEA-003',  13.500 UNION ALL SELECT 'C-ING-004',   5.000
UNION ALL SELECT 'C-ING-005',   1.000 UNION ALL SELECT 'C-ING-006',  20.000
UNION ALL SELECT 'C-BEV-007',   8.000 UNION ALL SELECT 'C-BEV-008',  42.000
UNION ALL SELECT 'C-BEV-009', 180.000 UNION ALL SELECT 'C-STP-010',  48.000
UNION ALL SELECT 'C-PKG-011', 380.000 UNION ALL SELECT 'C-CLN-012',   4.000
UNION ALL SELECT 'H-LIN-001',  28.000 UNION ALL SELECT 'H-LIN-002',  12.000
UNION ALL SELECT 'H-LIN-003',  24.000 UNION ALL SELECT 'H-TOI-004',  76.000
UNION ALL SELECT 'H-TOI-005', 152.000 UNION ALL SELECT 'H-TOI-006',  56.000
UNION ALL SELECT 'H-RMS-007',   5.000 UNION ALL SELECT 'H-CLN-008',   7.000
) e ON e.code = i.item_code;

-- ── Ledger agrees with stock for every item ──────────────────────────────────
INSERT INTO selftest
SELECT 'ledger net change = current_stock (all items)',
       IF(COUNT(*) = 0, 'PASS', 'FAIL')
FROM inventory_items i
LEFT JOIN (SELECT item_id, SUM(stock_after - stock_before) net
           FROM inventory_transactions GROUP BY item_id) t ON t.item_id = i.item_id
WHERE IFNULL(t.net, 0) <> i.current_stock;

-- ── Delivery totals computed from lines ──────────────────────────────────────
INSERT INTO selftest
SELECT 'delivery totals = sum of lines',
       IF(COUNT(*) = 0, 'PASS', 'FAIL')
FROM deliveries d
LEFT JOIN (SELECT delivery_id, SUM(line_total) s FROM delivery_items GROUP BY delivery_id) x
       ON x.delivery_id = d.delivery_id
WHERE d.total_amount <> IFNULL(x.s, 0);

INSERT INTO selftest
SELECT 'DR-2026-043 total = 17342.00', IF(total_amount = 17342.00, 'PASS', 'FAIL')
FROM deliveries WHERE delivery_receipt_no = 'DR-2026-043';

-- ── Low stock alerts ─────────────────────────────────────────────────────────
INSERT INTO selftest
SELECT 'low stock = sugar CRITICAL, toilet paper LOW, bulb LOW',
       IF(GROUP_CONCAT(CONCAT(item_code, ':', stock_status) ORDER BY item_code)
          = 'C-ING-005:CRITICAL,H-RMS-007:LOW,H-TOI-006:LOW', 'PASS', 'FAIL')
FROM vw_low_stock_items;

-- ── Audit rows written by triggers/procedures ────────────────────────────────
INSERT INTO selftest
SELECT 'audit: 8 deliveries, 15 consumptions, 1 adjust, 1 count match, 1 item edit',
       IF(SUM(action_type IN ('DELIVERY_RECORDED','DELIVERY_REJECTED')) = 8
      AND SUM(action_type = 'CONSUMPTION_RECORDED') = 15
      AND SUM(action_type = 'STOCK_ADJUSTED') = 1
      AND SUM(action_type = 'STOCK_COUNT_MATCHED') = 1
      AND SUM(action_type = 'ITEM_UPDATED' AND user_id = 1) = 1, 'PASS', 'FAIL')
FROM audit_logs;

-- ── Guards: each forbidden write must raise an error ─────────────────────────
DROP PROCEDURE IF EXISTS tmp_expect_error;
DELIMITER $$
CREATE PROCEDURE tmp_expect_error(IN p_name VARCHAR(120), IN p_sql TEXT)
BEGIN
    DECLARE v_failed INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_failed = 1;
    SET @tmp_sql = p_sql;
    PREPARE s FROM @tmp_sql;
    EXECUTE s;
    DEALLOCATE PREPARE s;
    INSERT INTO selftest VALUES (CONCAT('guard: ', p_name), IF(v_failed = 1, 'PASS', 'FAIL'));
END $$
DELIMITER ;

CALL tmp_expect_error('direct stock edit blocked',            'UPDATE inventory_items SET current_stock = 999 WHERE item_id = 1');
CALL tmp_expect_error('new item with stock blocked',          'INSERT INTO inventory_items (item_code,item_name,location,category,unit,current_stock) VALUES (''X-1'',''x'',''CANTEEN'',''CLEANING'',''pcs'',5)');
CALL tmp_expect_error('consume more than stock blocked',      'INSERT INTO inventory_consumption (item_id,quantity,purpose) VALUES (5, 50, ''TEST'')');
CALL tmp_expect_error('hostel item on canteen delivery',      'INSERT INTO delivery_items (delivery_id,item_id,quantity,unit_cost) VALUES (1, 13, 1, 1)');
CALL tmp_expect_error('item on rejected delivery blocked',    'INSERT INTO delivery_items (delivery_id,item_id,quantity,unit_cost) VALUES (8, 2, 1, 1)');
CALL tmp_expect_error('delivery total edit blocked',          'UPDATE deliveries SET total_amount = 1 WHERE delivery_id = 1');
CALL tmp_expect_error('delivery status locked with items',    'UPDATE deliveries SET status = ''REJECTED'' WHERE delivery_id = 1');
CALL tmp_expect_error('delivery line edit blocked',           'UPDATE delivery_items SET quantity = 1 WHERE delivery_item_id = 1');
CALL tmp_expect_error('delivery line delete blocked',         'DELETE FROM delivery_items WHERE delivery_item_id = 1');
CALL tmp_expect_error('delivery with lines cannot be deleted','DELETE FROM deliveries WHERE delivery_id = 1');
CALL tmp_expect_error('consumption edit blocked',             'UPDATE inventory_consumption SET quantity = 1 WHERE consumption_id = 1');
CALL tmp_expect_error('ledger edit blocked',                  'UPDATE inventory_transactions SET quantity = 1 WHERE txn_id = 1');
CALL tmp_expect_error('ledger delete blocked',                'DELETE FROM inventory_transactions WHERE txn_id = 1');
CALL tmp_expect_error('adjustment without reason blocked',    'CALL sp_adjust_stock(1, 1, '''', 1)');
CALL tmp_expect_error('location change with history blocked', 'UPDATE inventory_items SET location = ''HOSTEL'' WHERE item_id = 1');
CALL tmp_expect_error('critical above reorder blocked',       'UPDATE inventory_items SET critical_level = 99 WHERE item_id = 1');

DROP PROCEDURE tmp_expect_error;

-- ── Result ───────────────────────────────────────────────────────────────────
SELECT * FROM selftest;
SELECT IF(SUM(result = 'FAIL') = 0, 'ALL PASS', CONCAT(SUM(result = 'FAIL'), ' FAILED')) AS summary,
       COUNT(*) AS checks
FROM selftest;
