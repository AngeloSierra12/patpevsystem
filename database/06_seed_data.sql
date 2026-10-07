-- =============================================================================
-- HOTEL INVENTORY SYSTEM FOR IGP PATVEP HOSTEL AND UNIVERSITY CANTEEN
-- File: 06_seed_data.sql
-- Purpose: Demo data for both locations (fictional)
-- Run AFTER: 05_views.sql   (triggers must exist — they compute stock)
--
-- Items start at 0 stock. Deliveries push stock up, consumption pulls it down,
-- and sp_adjust_stock shows a weekly-count correction — all through triggers,
-- so the ledger and audit log fill themselves.
-- Final expected stock levels are checked by 07_selftest.sql.
-- =============================================================================

USE bpsu_patvep_inventory;
SET time_zone = '+08:00';
SET @app_ip = '127.0.0.1';

-- =============================================================================
-- 1. USERS — all demo passwords are "password" (bcrypt, DEMO ONLY)
-- =============================================================================
INSERT INTO users
    (user_id, username, password_hash, full_name, email, phone, role, department, created_at)
VALUES
(1, 'admin',         '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oI1Lb7e6ZMOLEf3lG.lU8Qk8IXnFoO', 'Andrew Jacob E. Santos',    'andrew.santos@bpsu.edu.ph',   '+63 917 111 2233', 'ADMIN',         'System Administration',       '2026-09-01 08:00:00'),
(2, 'hostel_staff',  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oI1Lb7e6ZMOLEf3lG.lU8Qk8IXnFoO', 'John Carlos R. Capuli',     'jc.capuli@bpsu.edu.ph',       '+63 918 222 3344', 'STAFF_HOSTEL',  'IGP PATVEP Hostel Housekeeping','2026-09-01 08:05:00'),
(3, 'canteen_staff', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oI1Lb7e6ZMOLEf3lG.lU8Qk8IXnFoO', 'Darren Jude S. Tamayo',     'darren.tamayo@bpsu.edu.ph',   '+63 919 333 4455', 'STAFF_CANTEEN', 'University Canteen',          '2026-09-01 08:10:00'),
(4, 'qa_staff',      '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oI1Lb7e6ZMOLEf3lG.lU8Qk8IXnFoO', 'Fritz Edrick B. Sarmiento', 'fritz.sarmiento@bpsu.edu.ph', '+63 920 444 5566', 'STAFF_CANTEEN', 'Quality Assurance',           '2026-09-01 08:15:00');

CALL sp_log(1, 'SYSTEM_INIT', 'SYSTEM', NULL, 'Inventory database initialised for PATVEP Hostel and University Canteen', NULL, NULL, '2026-09-01 08:00:00');
CALL sp_log(1, 'USER_CREATE', 'USERS', 2, 'Created user hostel_staff (John Carlos R. Capuli)',     NULL, NULL, '2026-09-01 08:05:00');
CALL sp_log(1, 'USER_CREATE', 'USERS', 3, 'Created user canteen_staff (Darren Jude S. Tamayo)',    NULL, NULL, '2026-09-01 08:10:00');
CALL sp_log(1, 'USER_CREATE', 'USERS', 4, 'Created user qa_staff (Fritz Edrick B. Sarmiento)',     NULL, NULL, '2026-09-01 08:15:00');
CALL sp_log(3, 'LOGIN',       'AUTH',  NULL, 'User canteen_staff logged in', NULL, NULL, '2026-09-09 07:55:00');
CALL sp_log(2, 'LOGIN',       'AUTH',  NULL, 'User hostel_staff logged in',  NULL, NULL, '2026-09-10 08:50:00');

-- =============================================================================
-- 2. SUPPLIERS
-- =============================================================================
INSERT INTO suppliers
    (supplier_id, supplier_name, contact_person, phone, email, address, supplied_categories)
VALUES
(1, 'Bataan Fresh Farms & Meat Trading',             'Ramon Bautista',    '+63 917 888 1234', 'ramon@bataanfreshfarms.ph',  'Capitol Drive, Balanga City, Bataan',  'Meat & Poultry, Food Staples'),
(2, 'BPSU Agricultural Cooperative & Canteen Supply', 'Maria Elena Ramos', '+63 918 777 5678', 'coop@bpsu.edu.ph',           'BPSU Abucay Campus, Bataan',           'Food Staples, Ingredients'),
(3, 'Balanga Wholesale Grocery & Packaging Center',  'Kenneth Tan',       '+63 919 666 9012', 'sales@balangawholesale.com', 'Don Manuel Banzon Ave, Balanga City',  'Ingredients, Packaging, Cleaning, Toiletries, Room Supplies'),
(4, 'Central Luzon Beverage & Refreshment Corp.',    'Jennifer Cruz',     '+63 920 555 3456', 'jcruz@clbeverage.com.ph',    'Roman Superhighway, Balanga City',     'Beverages'),
(5, 'Bataan Linen & Hotel Supply Co.',               'Grace Villanueva',  '+63 921 444 7890', 'orders@bataanlinen.ph',      'Tuyo, Balanga City, Bataan',           'Linens & Bedding');

-- =============================================================================
-- 3. INVENTORY ITEMS (all at 0 stock)
-- =============================================================================
INSERT INTO inventory_items
    (item_id, item_code, item_name, location, category, unit,
     reorder_level, critical_level, unit_cost, preferred_supplier_id, description)
VALUES
-- Canteen
(1,  'C-STP-001', 'Jasmine Premium Rice (50kg Sack)',      'CANTEEN', 'FOOD_STAPLES',       'sacks',    3.000,  1.000, 2350.00, 2, 'Premium jasmine rice, 50kg per sack'),
(2,  'C-MEA-002', 'Fresh Dressed Chicken (Cut)',           'CANTEEN', 'MEAT_POULTRY',       'kg',      10.000,  3.000,  195.00, 1, 'Fresh dressed chicken, per kg'),
(3,  'C-MEA-003', 'Fresh Pork Liempo (Sliced)',            'CANTEEN', 'MEAT_POULTRY',       'kg',       8.000,  2.000,  330.00, 1, 'Sliced pork belly, per kg'),
(4,  'C-ING-004', 'Pure Palm Cooking Oil (20L Tin)',       'CANTEEN', 'INGREDIENTS',        'tins',     2.000,  1.000, 1450.00, 3, 'Commercial palm oil, 20L tin'),
(5,  'C-ING-005', 'Refined White Sugar (25kg Bag)',        'CANTEEN', 'INGREDIENTS',        'bags',     2.000,  1.000, 1800.00, 3, 'Refined sugar, 25kg bag'),
(6,  'C-ING-006', 'Iodized Fine Salt (1kg Pack)',          'CANTEEN', 'INGREDIENTS',        'packs',    5.000,  2.000,   28.00, 3, 'Iodized salt, 1kg pack'),
(7,  'C-BEV-007', 'Ground Barako Coffee (1kg)',            'CANTEEN', 'BEVERAGES',          'packs',    5.000,  2.000,  490.00, 4, 'Batangas barako, 1kg pack'),
(8,  'C-BEV-008', 'Evaporated Filled Milk (370ml Can)',    'CANTEEN', 'BEVERAGES',          'cans',    24.000,  6.000,   39.50, 4, '370ml cans'),
(9,  'C-BEV-009', 'Purified Bottled Water (500ml)',        'CANTEEN', 'BEVERAGES',          'bottles', 48.000, 12.000,   11.50, 4, '500ml bottles'),
(10, 'C-STP-010', 'Canned Corned Beef (260g)',             'CANTEEN', 'FOOD_STAPLES',       'cans',    20.000,  5.000,   64.00, 3, '260g cans'),
(11, 'C-PKG-011', 'Biodegradable Bento Box 3-Div',         'CANTEEN', 'SUPPLIES_PACKAGING', 'pcs',    100.000, 30.000,    4.25, 3, '3-division meal boxes'),
(12, 'C-CLN-012', 'Commercial Dishwashing Liquid (1 Gal)', 'CANTEEN', 'CLEANING',           'gallons',  1.000,  0.000,  290.00, 3, 'Dishwashing liquid, 1 gallon'),
-- Hostel
(13, 'H-LIN-001', 'Bath Towel (White, 27x54)',             'HOSTEL',  'LINENS_BEDDING',     'pcs',     20.000,  8.000,  185.00, 5, 'Cotton bath towel'),
(14, 'H-LIN-002', 'Bed Sheet Set (Single)',                'HOSTEL',  'LINENS_BEDDING',     'sets',    10.000,  4.000,  650.00, 5, 'Fitted + flat sheet, single'),
(15, 'H-LIN-003', 'Pillowcase (Standard)',                 'HOSTEL',  'LINENS_BEDDING',     'pcs',     20.000,  8.000,   95.00, 5, 'Standard pillowcase'),
(16, 'H-TOI-004', 'Bath Soap (60g Bar)',                   'HOSTEL',  'TOILETRIES',         'pcs',     50.000, 20.000,   18.00, 3, 'Guest bath soap'),
(17, 'H-TOI-005', 'Shampoo Sachet (12ml)',                 'HOSTEL',  'TOILETRIES',         'sachets', 100.000, 40.000,   7.00, 3, 'Guest shampoo sachet'),
(18, 'H-TOI-006', 'Toilet Paper (2-ply Roll)',             'HOSTEL',  'TOILETRIES',         'rolls',   48.000, 20.000,   14.50, 3, '2-ply roll'),
(19, 'H-RMS-007', 'LED Bulb (9W)',                         'HOSTEL',  'ROOM_SUPPLIES',      'pcs',      6.000,  2.000,  120.00, 3, 'Replacement room bulb'),
(20, 'H-CLN-008', 'Laundry Detergent Powder (1kg)',        'HOSTEL',  'CLEANING',           'packs',    6.000,  2.000,   98.00, 3, 'For linen laundry');

-- =============================================================================
-- 4. DELIVERIES (headers — total_amount is filled in by trigger)
-- =============================================================================
INSERT INTO deliveries
    (delivery_id, delivery_receipt_no, supplier_id, location, status, received_at, received_by, notes)
VALUES
(1, 'DR-2026-041', 2, 'CANTEEN', 'RECEIVED', '2026-09-09 08:00:00', 3, 'Rice delivery from BPSU coop'),
(2, 'DR-2026-042', 4, 'CANTEEN', 'RECEIVED', '2026-09-09 09:30:00', 3, 'Bottled water restocking'),
(3, 'DR-2026-043', 3, 'CANTEEN', 'RECEIVED', '2026-09-10 08:15:00', 3, 'Wholesale grocery & packaging batch'),
(4, 'DR-2026-044', 4, 'CANTEEN', 'RECEIVED', '2026-09-11 08:00:00', 3, 'Beverages replenishment'),
(5, 'DR-2026-045', 1, 'CANTEEN', 'RECEIVED', '2026-09-13 06:30:00', 3, 'Meat & poultry restocking'),
(6, 'DR-2026-101', 5, 'HOSTEL',  'RECEIVED', '2026-09-10 09:00:00', 2, 'Linen batch for room turnover'),
(7, 'DR-2026-102', 3, 'HOSTEL',  'RECEIVED', '2026-09-12 10:00:00', 2, 'Toiletries and room supplies'),
(8, 'DR-2026-046', 1, 'CANTEEN', 'REJECTED', '2026-09-15 06:45:00', 3, 'Chicken failed temperature check on arrival — returned to supplier');

-- =============================================================================
-- 5. DELIVERY ITEMS → stock in
-- Expected header totals after triggers:
--   DR-2026-041  14,100.00   DR-2026-101  15,630.00
--   DR-2026-042   2,300.00   DR-2026-102   6,292.00
--   DR-2026-043  17,342.00   DR-2026-046       0.00 (rejected)
--   DR-2026-044   5,816.00
--   DR-2026-045   9,990.00
-- =============================================================================
INSERT INTO delivery_items (delivery_id, item_id, quantity, unit_cost) VALUES
(1, 1,    6.000, 2350.00),
(2, 9,  200.000,   11.50),
(3, 4,    5.000, 1450.00),
(3, 5,    2.000, 1800.00),
(3, 6,   20.000,   28.00),
(3, 10,  48.000,   64.00),
(3, 11, 400.000,    4.25),
(3, 12,   4.000,  290.00),
(4, 7,    8.000,  490.00),
(4, 8,   48.000,   39.50),
(5, 2,   25.000,  195.00),
(5, 3,   15.500,  330.00),
(6, 13,  30.000,  185.00),
(6, 14,  12.000,  650.00),
(6, 15,  24.000,   95.00),
(7, 16, 100.000,   18.00),
(7, 17, 200.000,    7.00),
(7, 18,  96.000,   14.50),
(7, 19,   6.000,  120.00),
(7, 20,  10.000,   98.00);

-- =============================================================================
-- 6. CONSUMPTION → stock out
-- =============================================================================
INSERT INTO inventory_consumption (item_id, quantity, purpose, notes, recorded_by, consumption_date) VALUES
-- Canteen
(2,   3.000, 'KITCHEN_USAGE', 'Morning prep — chicken adobo',        3, '2026-09-10 07:30:00'),
(9,   8.000, 'CANTEEN_SALES', 'Water sold at canteen counter',        3, '2026-09-10 12:00:00'),
(1,   0.500, 'KITCHEN_USAGE', 'Half sack used for day meals',         3, '2026-09-11 06:30:00'),
(2,   2.000, 'KITCHEN_USAGE', 'Lunch prep — chicken tinola',          3, '2026-09-13 08:00:00'),
(3,   2.000, 'KITCHEN_USAGE', 'Pork liempo grilled for lunch',        3, '2026-09-13 09:45:00'),
(9,  12.000, 'CANTEEN_SALES', 'Water sold across two meal periods',   3, '2026-09-12 12:00:00'),
(8,   6.000, 'CANTEEN_SALES', 'Evap milk for coffee orders',          3, '2026-09-13 07:00:00'),
(11, 20.000, 'CANTEEN_SALES', 'Bento boxes for packed lunch orders',  3, '2026-09-13 11:30:00'),
(5,   1.000, 'KITCHEN_USAGE', 'Sugar for desserts and drinks',        3, '2026-09-14 07:00:00'),
-- Hostel
(16, 24.000, 'ROOM_RESTOCK',  'Restocked 12 rooms after checkout',    2, '2026-09-13 10:00:00'),
(17, 48.000, 'ROOM_RESTOCK',  'Restocked 12 rooms after checkout',    2, '2026-09-13 10:00:00'),
(18, 40.000, 'ROOM_RESTOCK',  'Weekly toilet paper restock',          2, '2026-09-13 10:30:00'),
(20,  3.000, 'LAUNDRY',       'Linen wash cycle',                     2, '2026-09-14 08:00:00'),
(13,  2.000, 'DAMAGED',       'Two towels stained beyond cleaning',   2, '2026-09-14 08:30:00'),
(19,  1.000, 'MAINTENANCE',   'Replaced bulb in room 204',            2, '2026-09-14 15:00:00');

-- =============================================================================
-- 7. WEEKLY COUNT (charter metric: physical stock matches records)
-- =============================================================================
CALL sp_adjust_stock(2, 19.500, 'Weekly count — 0.5 kg chicken spoiled (freezer door left open)', 3);
CALL sp_adjust_stock(1,  5.500, 'Weekly count', 3);

-- =============================================================================
-- 8. ITEM EDIT (shows trg_item_after_update logging with @app_user_id)
-- =============================================================================
SET @app_user_id = 1;
UPDATE inventory_items SET reorder_level = 60.000 WHERE item_code = 'H-TOI-006';
SET @app_user_id = NULL;
