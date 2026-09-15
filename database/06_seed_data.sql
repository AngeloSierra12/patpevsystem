-- =============================================================================
-- BPSU IGP PATVEP HOSTEL & UNIVERSITY CANTEEN SYSTEM
-- File: 06_seed_data.sql
-- Purpose: Demo/seed data — realistic but fictional
-- Run AFTER: 05_triggers.sql
-- NOTE: Triggers are ACTIVE during seed. Delivery items and consumption records
--       will auto-update stock and create transaction records.
--       We therefore seed inventory_items with current_stock = 0 and let
--       the delivery_items inserts drive the stock up to realistic levels.
-- =============================================================================

USE bpsu_patvep;

SET time_zone = '+08:00';

-- =============================================================================
-- 1. USERS  (password_hash shown is bcrypt of "password123" — DEMO ONLY)
-- =============================================================================
INSERT INTO users
    (user_id, username, password_hash, full_name, email, phone, role, department, is_active, created_at)
VALUES
(1, 'admin',         '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oI1Lb7e6ZMOLEf3lG.lU8Qk8IXnFoO', 'Andrew Jacob E. Santos',    'andrew.santos@bpsu.edu.ph',  '+63 917 111 2233', 'ADMIN',         'System Administration',                    1, '2026-09-01 08:00:00'),
(2, 'hostel_staff',  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oI1Lb7e6ZMOLEf3lG.lU8Qk8IXnFoO', 'John Carlos R. Capuli',     'jc.capuli@bpsu.edu.ph',      '+63 918 222 3344', 'STAFF_HOSTEL',  'IGP PATVEP Hostel Front Desk',             1, '2026-09-01 08:05:00'),
(3, 'canteen_staff', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oI1Lb7e6ZMOLEf3lG.lU8Qk8IXnFoO', 'Darren Jude S. Tamayo',     'darren.tamayo@bpsu.edu.ph',  '+63 919 333 4455', 'STAFF_CANTEEN', 'University Canteen Inventory Operations',  1, '2026-09-01 08:10:00'),
(4, 'qa_staff',      '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oI1Lb7e6ZMOLEf3lG.lU8Qk8IXnFoO', 'Fritz Edrick B. Sarmiento', 'fritz.sarmiento@bpsu.edu.ph','+63 920 444 5566', 'STAFF_HOSTEL',  'Quality Assurance & Documentation',        1, '2026-09-01 08:15:00'),
(5, 'guest_demo1',   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oI1Lb7e6ZMOLEf3lG.lU8Qk8IXnFoO', 'Angelo Andrei P. Sierra',   'angelo.sierra@bpsu.edu.ph',  '+63 921 555 6677', 'GUEST',         'BSIT Student / Visiting Delegate',         1, '2026-09-02 09:00:00'),
(6, 'guest_demo2',   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oI1Lb7e6ZMOLEf3lG.lU8Qk8IXnFoO', 'Prof. Albert C. Tria',      'albert.tria@bpsu.edu.ph',    '+63 922 666 7788', 'GUEST',         'BPSU Faculty & Project Mentor',            1, '2026-09-02 09:30:00');

-- =============================================================================
-- 2. GUESTS  (extended profiles)
-- =============================================================================
INSERT INTO guests
    (guest_id, guest_user_id, full_name, email, phone, id_type, id_number, address)
VALUES
(1,  5, 'Angelo Andrei P. Sierra',   'angelo.sierra@bpsu.edu.ph',  '+63 921 555 6677', 'BPSU Student ID',   '2023-01984', 'Balanga City, Bataan'),
(2,  6, 'Prof. Albert C. Tria',      'albert.tria@bpsu.edu.ph',    '+63 922 666 7788', 'BPSU Faculty ID',   'FAC-2018-044','BPSU Main Campus, Bataan'),
-- Walk-in guests (no user account)
(3, NULL,'Dr. Marilyn N. De Jesus',  'mdejesus@ched.gov.ph',       '+63 919 444 8899', 'Government ID / PRC','PRC-0091823','CHED Regional Office, Pampanga'),
(4, NULL,'Engr. Rodrigo M. Salceda', 'rod.salceda@dpwh.gov.ph',    '+63 917 321 9900', 'Government ID',     'GOV-SA-1029','Mariveles, Bataan'),
(5, NULL,'Ms. Lourdes T. Enriquez',  'lenriquez@gmail.com',         '+63 916 870 4412', 'PhilSys ID',        'PSN-1234-5678','Pilar, Bataan'),
(6, NULL,'Mr. Ramon B. Dela Cruz',   'rbdelacruz@yahoo.com',        '+63 920 103 7788', 'Drivers License',   'N03-96-0887','Orion, Bataan');

-- =============================================================================
-- 3. ROOM TYPES
-- =============================================================================
INSERT INTO room_types
    (room_type_id, type_name, description, base_rate_per_night, max_capacity)
VALUES
(1, 'Standard Single Room',    'Single bed, air-conditioned, study desk',                           900.00, 1),
(2, 'Standard Double Room',    'Double bed, LED TV, hot & cold shower',                           1200.00, 2),
(3, 'Deluxe Twin Room',        'Two twin beds, mini-ref, coffee maker, balcony',                  1600.00, 2),
(4, 'Deluxe King Suite',       'King bed, sofa, mini-fridge, panoramic view',                     2200.00, 2),
(5, 'PATVEP Student Dorm',     'Air-conditioned 4-person dorm, secure lockers, campus WiFi',       400.00, 4),
(6, 'VIP Executive Family Suite','Multi-bed, kitchenette, microwave, dining set, lounge',         3200.00, 6),
(7, 'Executive Guest Room',    'Double + single bed, suitable for committees and trainers',        1800.00, 3);

-- =============================================================================
-- 4. ROOMS
-- =============================================================================
INSERT INTO rooms
    (room_id, room_type_id, room_number, floor, capacity, rate_per_night, description, status)
VALUES
(1, 1, '101', 1, 1, 900.00,  'Cozy single, ideal for visiting scholars',         'AVAILABLE'),
(2, 2, '102', 1, 2, 1200.00, 'Spacious double, LED TV, rain shower',             'OCCUPIED'),
(3, 3, '103', 1, 2, 1600.00, 'Twin beds, hotel linens, balcony',                 'AVAILABLE'),
(4, 4, '104', 1, 2, 2200.00, 'King suite, sofa, panoramic campus view',          'RESERVED'),
(5, 5, '201', 2, 4, 400.00,  '4-person dorm for student delegates',              'OCCUPIED'),
(6, 5, '202', 2, 4, 400.00,  '4-person dorm, lockers, WiFi',                     'AVAILABLE'),
(7, 6, '203', 2, 6, 3200.00, 'VIP suite with kitchenette and dining area',       'AVAILABLE'),
(8, 7, '204', 2, 3, 1800.00, 'Flexible layout, double + single bed',             'MAINTENANCE');

-- =============================================================================
-- 5. RESERVATIONS
-- Dates expressed relative to 2026-09-14 (the project launch week reference)
-- =============================================================================
INSERT INTO reservations
    (reservation_id, reference_number, guest_id, room_id,
     room_number_snapshot, room_type_snapshot, rate_per_night_snapshot,
     check_in_date, check_out_date, number_of_guests,
     total_nights, total_amount, paid_amount,
     status, notes, handled_by, created_at, checked_in_at, checked_out_at)
VALUES
-- res-1: Already checked in, fully paid
(1, 'BPSU-RES-202609-0001', 1, 2,
 '102', 'Standard Double Room', 1200.00,
 '2026-09-13', '2026-09-16', 2,
 3, 3600.00, 0.00,
 'CHECKED_IN', 'Guest checked in for CCST Research Conference.',
 2, '2026-09-08 10:00:00', '2026-09-13 14:15:00', NULL),

-- res-2: Checked in, partial payment
(2, 'BPSU-RES-202609-0002', 2, 5,
 '201', 'PATVEP Student Dorm', 400.00,
 '2026-09-14', '2026-09-17', 4,
 3, 1200.00, 0.00,
 'CHECKED_IN', 'Student delegates for regional IT skills competition.',
 2, '2026-09-09 08:30:00', '2026-09-14 13:00:00', NULL),

-- res-3: Confirmed, not yet checked in
(3, 'BPSU-RES-202609-0003', 3, 4,
 '104', 'Deluxe King Suite', 2200.00,
 '2026-09-16', '2026-09-19', 2,
 3, 6600.00, 0.00,
 'CONFIRMED', 'VIP accommodation — CHED Regional Evaluator.',
 2, '2026-09-13 16:40:00', NULL, NULL),

-- res-4: Pending
(4, 'BPSU-RES-202609-0004', 4, 1,
 '101', 'Standard Single Room', 900.00,
 '2026-09-20', '2026-09-22', 1,
 2, 1800.00, 0.00,
 'PENDING', 'Engineer from DPWH for campus inspection.',
 2, '2026-09-14 09:00:00', NULL, NULL),

-- res-5: Checked out, completed stay
(5, 'BPSU-RES-202609-0005', 5, 6,
 '202', 'PATVEP Student Dorm', 400.00,
 '2026-09-05', '2026-09-08', 3,
 3, 1200.00, 0.00,
 'CHECKED_OUT', 'Sports team delegates — completed stay.',
 2, '2026-09-03 11:00:00', '2026-09-05 12:00:00', '2026-09-08 10:30:00'),

-- res-6: Cancelled
(6, 'BPSU-RES-202609-0006', 6, 7,
 '203', 'VIP Executive Family Suite', 3200.00,
 '2026-09-10', '2026-09-12', 4,
 2, 6400.00, 0.00,
 'CANCELLED', NULL,
 2, '2026-09-07 14:00:00', NULL, NULL);

-- =============================================================================
-- 6. PAYMENTS
-- Note: trg_payment_after_insert will update paid_amount on reservations.
-- We pre-set paid_amount above to match so seed is consistent.
-- For simplicity, disable the trigger's update effect during seed by setting
-- paid_amount via direct INSERT on reservations above.
-- =============================================================================

-- Temporarily disable the payment trigger effect on reservations
-- (we already set paid_amount in the reservations insert above)
-- The trigger will still fire but we reset paid_amount below
-- APPROACH: Insert payments, then fix paid_amount if double-counted.
-- Simpler: keep trigger active and seed payments independently;
-- the trigger will update paid_amount but since we seeded it correctly above,
-- we reset it after all payment inserts.

INSERT INTO payments
    (payment_id, reservation_id, receipt_number, amount, payment_method, reference_code, notes, received_by, payment_date)
VALUES
(1, 1, 'OR-2026-00891', 3600.00, 'CASH',                  'CASH-REC-001',    'Full advance settlement at front desk',            2, '2026-09-13 14:30:00'),
(2, 2, 'OR-2026-00892', 600.00,  'UNIVERSITY_CHARGE_SLIP','BPSU-CCST-PO-881','50% university charging for student delegates',    2, '2026-09-14 13:15:00'),
(3, 5, 'OR-2026-00885', 1200.00, 'CASH',                  'CASH-REC-002',    'Full payment — sports delegates completed stay',   2, '2026-09-05 12:30:00');


-- =============================================================================
-- 7. SUPPLIERS
-- =============================================================================
INSERT INTO suppliers
    (supplier_id, supplier_name, contact_person, phone, email, address, supplied_categories, is_active)
VALUES
(1, 'Bataan Fresh Farms & Meat Trading',            'Ramon Bautista',    '+63 917 888 1234', 'ramon@bataanfreshfarms.ph',  'Capitol Drive, Balanga City, Bataan',     'Meat & Poultry, Food Staples',   1),
(2, 'BPSU Agricultural Cooperative & Canteen Supply','Maria Elena Ramos', '+63 918 777 5678', 'coop@bpsu.edu.ph',           'BPSU Abucay Campus, Bataan',              'Food Staples, Ingredients',      1),
(3, 'Balanga Wholesale Grocery & Packaging Center', 'Kenneth Tan',       '+63 919 666 9012', 'sales@balangawholesale.com', 'Don Manuel Banzon Ave, Balanga City',     'Supplies, Cleaning, Ingredients',1),
(4, 'Central Luzon Beverage & Refreshment Corp.',   'Jennifer Cruz',     '+63 920 555 3456', 'jcruz@clbeverage.com.ph',    'Roman Superhighway, Balanga City',        'Beverages',                      1);

-- =============================================================================
-- 8. INVENTORY ITEMS
-- Start all items at current_stock = 0; delivery_items inserts will drive
-- stock up via the trigger.
-- =============================================================================
INSERT INTO inventory_items
    (item_id, item_code, item_name, category, unit, current_stock,
     reorder_level, critical_level, unit_cost, preferred_supplier_id, description)
VALUES
(1,  'STP-001', 'Jasmine Premium Rice (50kg Sack)',     'FOOD_STAPLES',       'sacks',   0.000,  3.000, 1.000, 2350.00, 2, 'Premium quality jasmine rice, 50kg per sack'),
(2,  'MEA-002', 'Fresh Dressed Chicken (Cut)',           'MEAT_POULTRY',       'kg',      0.000, 10.000, 3.000,  195.00, 1, 'Fresh dressed chicken, sold per kilogram'),
(3,  'MEA-003', 'Fresh Pork Liempo (Sliced)',            'MEAT_POULTRY',       'kg',      0.000,  8.000, 2.000,  330.00, 1, 'Fresh sliced pork belly, per kilogram'),
(4,  'ING-004', 'Pure Palm Cooking Oil (20L Tin)',       'INGREDIENTS',        'tins',    0.000,  2.000, 1.000, 1450.00, 3, 'Commercial-grade palm oil, 20-liter tin'),
(5,  'ING-005', 'Refined White Sugar (25kg Bag)',        'INGREDIENTS',        'bags',    0.000,  2.000, 1.000, 1800.00, 3, 'Refined white sugar, 25kg per bag'),
(6,  'ING-006', 'Iodized Fine Salt (1kg Pack)',          'INGREDIENTS',        'packs',   0.000,  5.000, 2.000,   28.00, 3, 'Iodized fine salt, 1kg per pack'),
(7,  'BEV-007', 'Ground Barako Coffee (1kg)',            'BEVERAGES',          'packs',   0.000,  5.000, 2.000,  490.00, 4, 'Batangas Barako ground coffee, 1kg pack'),
(8,  'BEV-008', 'Evaporated Filled Milk (370ml Can)',   'BEVERAGES',          'cans',    0.000, 24.000, 6.000,   39.50, 4, '370ml evaporated milk cans'),
(9,  'BEV-009', 'Purified Bottled Water (500ml)',        'BEVERAGES',          'bottles', 0.000, 48.000,12.000,   11.50, 4, '500ml purified bottled water'),
(10, 'STP-010', 'Canned Corned Beef (260g)',             'FOOD_STAPLES',       'cans',    0.000, 20.000, 5.000,   64.00, 3, 'Canned corned beef, 260g per can'),
(11, 'PKG-011', 'Biodegradable Bento Box 3-Div',        'SUPPLIES_PACKAGING', 'pcs',     0.000,100.000,30.000,    4.25, 3, 'Eco-friendly 3-division meal boxes'),
(12, 'CLN-012', 'Commercial Dishwashing Liquid (1 Gal)','CLEANING',           'gallons', 0.000,  1.000, 0.000,  290.00, 3, 'Commercial-grade dishwashing liquid, 1 gallon');

-- =============================================================================
-- 9. DELIVERIES  (headers)
-- =============================================================================
INSERT INTO deliveries
    (delivery_id, delivery_receipt_no, supplier_id, delivery_date, received_by, total_amount, status, notes)
VALUES
(1, 'DR-2026-041', 2, '2026-09-09', 3, 14100.00, 'RECEIVED', 'Rice delivery from BPSU coop'),
(2, 'DR-2026-042', 4, '2026-09-09', 3,  2300.00, 'RECEIVED', 'Bottled water restocking'),
(3, 'DR-2026-043', 3, '2026-09-10', 3, 17342.00, 'RECEIVED', 'Wholesale grocery & packaging batch'),
(4, 'DR-2026-044', 4, '2026-09-11', 3,  5816.00, 'RECEIVED', 'Beverages replenishment'),
(5, 'DR-2026-045', 1, '2026-09-13', 3,  9990.00, 'RECEIVED', 'Meat & poultry restocking');

-- =============================================================================
-- 10. DELIVERY ITEMS
-- Inserting these triggers trg_delivery_item_after_insert which:
--   a) updates current_stock on inventory_items
--   b) updates unit_cost and last_restocked_at on inventory_items
--   c) inserts STOCK_IN rows in inventory_transactions
-- =============================================================================
INSERT INTO delivery_items
    (delivery_id, item_id, quantity, unit_cost)
VALUES
-- DR-2026-041: 6 sacks of rice
(1, 1,  6.000, 2350.00),

-- DR-2026-042: 200 bottles of water
(2, 9, 200.000,   11.50),

-- DR-2026-043: grocery batch
(3, 4,  5.000, 1450.00),   -- palm oil tins
(3, 5,  2.000, 1800.00),   -- sugar bags
(3, 6, 20.000,   28.00),   -- salt packs
(3,10, 48.000,   64.00),   -- corned beef
(3,11,400.000,    4.25),   -- bento boxes
(3,12,  4.000,  290.00),   -- dishwashing liquid

-- DR-2026-044: beverages
(4, 7,  8.000,  490.00),   -- barako coffee
(4, 8, 48.000,   39.50),   -- evaporated milk

-- DR-2026-045: meat & poultry
(5, 2, 25.000,  195.00),   -- chicken
(5, 3, 15.500,  330.00);   -- pork liempo

-- =============================================================================
-- 11. INVENTORY CONSUMPTION
-- Inserting these triggers trg_consumption_after_insert which:
--   a) decreases current_stock on inventory_items
--   b) inserts STOCK_OUT rows in inventory_transactions
-- =============================================================================
INSERT INTO inventory_consumption
    (consumption_id, item_id, quantity, purpose, notes, recorded_by, consumption_date)
VALUES
(1,  2, 3.000, 'KITCHEN_USAGE', 'Morning prep — chicken adobo',     3, '2026-09-10 07:30:00'),
(2,  9, 8.000, 'CANTEEN_SALES', 'Water sold at canteen counter',     3, '2026-09-10 12:00:00'),
(3,  1, 0.500, 'KITCHEN_USAGE', 'Half sack used for day meals',      3, '2026-09-11 06:30:00'),
(4,  2, 2.000, 'KITCHEN_USAGE', 'Lunch prep — chicken tinola',       3, '2026-09-11 08:00:00'),
(5,  3, 2.000, 'KITCHEN_USAGE', 'Pork liempo grilled for lunch',     3, '2026-09-12 07:45:00'),
(6,  9,12.000, 'CANTEEN_SALES', 'Water sold across two meal periods', 3, '2026-09-12 12:00:00'),
(7,  8, 6.000, 'CANTEEN_SALES', 'Evap milk for coffee orders',       3, '2026-09-13 07:00:00'),
(8, 11,20.000, 'CANTEEN_USAGE', 'Bento boxes for packed lunch orders',3, '2026-09-13 11:30:00');

-- =============================================================================
-- 12. AUDIT LOGS  (initial/manual entries — triggers add more automatically)
-- =============================================================================
INSERT INTO audit_logs
    (log_id, user_id, username_snapshot, role_snapshot,
     action_type, target_entity, target_id, description, logged_at)
VALUES
(1,  1, 'admin',        'ADMIN',        'SYSTEM_INIT',          'SYSTEM',       NULL, 'Initial system database seeded for BPSU PATVEP Hostel & Canteen',          '2026-09-01 08:00:00'),
(2,  1, 'admin',        'ADMIN',        'USER_CREATE',          'USERS',        2,    'Created user account: hostel_staff (John Carlos R. Capuli)',               '2026-09-01 08:05:00'),
(3,  1, 'admin',        'ADMIN',        'USER_CREATE',          'USERS',        3,    'Created user account: canteen_staff (Darren Jude S. Tamayo)',              '2026-09-01 08:10:00'),
(4,  1, 'admin',        'ADMIN',        'USER_CREATE',          'USERS',        4,    'Created user account: qa_staff (Fritz Edrick B. Sarmiento)',               '2026-09-01 08:15:00'),
(5,  2, 'hostel_staff', 'STAFF_HOSTEL', 'LOGIN',                'AUTH',         NULL, 'User hostel_staff logged in',                                              '2026-09-08 09:55:00'),
(6,  2, 'hostel_staff', 'STAFF_HOSTEL', 'RESERVATION_CREATED',   'RESERVATION',  1,    'Created reservation BPSU-RES-202609-0001 for Angelo Andrei P. Sierra',     '2026-09-08 10:00:00'),
(7,  2, 'hostel_staff', 'STAFF_HOSTEL', 'RESERVATION_CONFIRMED','RESERVATION',  1,    'Reservation BPSU-RES-202609-0001 confirmed',                               '2026-09-08 10:05:00'),
(8,  2, 'hostel_staff', 'STAFF_HOSTEL', 'RESERVATION_CREATED',   'RESERVATION',  2,    'Created reservation BPSU-RES-202609-0002 for Prof. Albert C. Tria',        '2026-09-09 08:30:00'),
(9,  3, 'canteen_staff','STAFF_CANTEEN','LOGIN',                 'AUTH',         NULL, 'User canteen_staff logged in',                                             '2026-09-09 09:00:00'),
(10, 3, 'canteen_staff','STAFF_CANTEEN','DELIVERY_RECORD',       'DELIVERY',     1,    'Recorded delivery DR-2026-041 from BPSU Agricultural Cooperative',         '2026-09-09 10:00:00'),
(11, 3, 'canteen_staff','STAFF_CANTEEN','DELIVERY_RECORD',       'DELIVERY',     2,    'Recorded delivery DR-2026-042 from Central Luzon Beverage Corp',           '2026-09-09 10:15:00'),
(12, 2, 'hostel_staff', 'STAFF_HOSTEL', 'RESERVATION_CHECKED_IN',             'RESERVATION',  1,    'Guest Angelo Andrei P. Sierra checked in for BPSU-RES-202609-0001',        '2026-09-13 14:15:00'),
(13, 2, 'hostel_staff', 'STAFF_HOSTEL', 'RESERVATION_CHECKED_IN',             'RESERVATION',  2,    'Guest Prof. Albert C. Tria checked in for BPSU-RES-202609-0002',           '2026-09-14 13:00:00'),
(14, 2, 'hostel_staff', 'STAFF_HOSTEL', 'RESERVATION_CANCELLED',   'RESERVATION',  6,    'Reservation BPSU-RES-202609-0006 cancelled — guest no-show after 24 hrs',  '2026-09-11 09:00:00'),
(15, 3, 'canteen_staff','STAFF_CANTEEN','LOGOUT',                'AUTH',         NULL, 'User canteen_staff logged out',                                            '2026-09-14 17:00:00');

