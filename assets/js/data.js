/* ============================================================================
 * data.js — records from the project database
 *
 * Generated from database/06_seed_data.sql. Table and column names match the
 * schema exactly (users, guests, room_types, rooms, reservations, payments,
 * suppliers, inventory_items, deliveries, delivery_items,
 * inventory_consumption, audit_logs), so the screens already speak the same
 * language as the database.
 *
 * Values the triggers derive are applied here as they would be in MariaDB:
 *   reservations.paid_amount  = sum of that reservation's payments
 *   inventory_items.current_stock = deliveries in, minus consumption out
 *
 * users.password_hash is deliberately absent: this file is plain text served
 * to the client, and no screen reads it.
 *
 * A browser cannot open a MariaDB connection, so this stands in for the live
 * database until the API layer exists. Regenerate with:
 *     python scripts/sql2js.py
 * ========================================================================== */
(function (App) {
  'use strict';

  App.DB = {
    users: [
      {"user_id": 1, "username": "admin", "full_name": "Andrew Jacob E. Santos", "email": "andrew.santos@bpsu.edu.ph", "phone": "+63 917 111 2233", "role": "ADMIN", "department": "System Administration", "is_active": 1, "created_at": "2026-09-01 08:00:00"},
      {"user_id": 2, "username": "hostel_staff", "full_name": "John Carlos R. Capuli", "email": "jc.capuli@bpsu.edu.ph", "phone": "+63 918 222 3344", "role": "STAFF_HOSTEL", "department": "IGP PATVEP Hostel Front Desk", "is_active": 1, "created_at": "2026-09-01 08:05:00"},
      {"user_id": 3, "username": "canteen_staff", "full_name": "Darren Jude S. Tamayo", "email": "darren.tamayo@bpsu.edu.ph", "phone": "+63 919 333 4455", "role": "STAFF_CANTEEN", "department": "University Canteen Inventory Operations", "is_active": 1, "created_at": "2026-09-01 08:10:00"},
      {"user_id": 4, "username": "qa_staff", "full_name": "Fritz Edrick B. Sarmiento", "email": "fritz.sarmiento@bpsu.edu.ph", "phone": "+63 920 444 5566", "role": "STAFF_HOSTEL", "department": "Quality Assurance & Documentation", "is_active": 1, "created_at": "2026-09-01 08:15:00"},
      {"user_id": 5, "username": "guest_demo1", "full_name": "Angelo Andrei P. Sierra", "email": "angelo.sierra@bpsu.edu.ph", "phone": "+63 921 555 6677", "role": "GUEST", "department": "BSIT Student / Visiting Delegate", "is_active": 1, "created_at": "2026-09-02 09:00:00"},
      {"user_id": 6, "username": "guest_demo2", "full_name": "Prof. Albert C. Tria", "email": "albert.tria@bpsu.edu.ph", "phone": "+63 922 666 7788", "role": "GUEST", "department": "BPSU Faculty & Project Mentor", "is_active": 1, "created_at": "2026-09-02 09:30:00"}
    ],

    guests: [
      {"guest_id": 1, "guest_user_id": 5, "full_name": "Angelo Andrei P. Sierra", "email": "angelo.sierra@bpsu.edu.ph", "phone": "+63 921 555 6677", "id_type": "BPSU Student ID", "id_number": "2023-01984", "address": "Balanga City, Bataan"},
      {"guest_id": 2, "guest_user_id": 6, "full_name": "Prof. Albert C. Tria", "email": "albert.tria@bpsu.edu.ph", "phone": "+63 922 666 7788", "id_type": "BPSU Faculty ID", "id_number": "FAC-2018-044", "address": "BPSU Main Campus, Bataan"},
      {"guest_id": 3, "guest_user_id": null, "full_name": "Dr. Marilyn N. De Jesus", "email": "mdejesus@ched.gov.ph", "phone": "+63 919 444 8899", "id_type": "Government ID / PRC", "id_number": "PRC-0091823", "address": "CHED Regional Office, Pampanga"},
      {"guest_id": 4, "guest_user_id": null, "full_name": "Engr. Rodrigo M. Salceda", "email": "rod.salceda@dpwh.gov.ph", "phone": "+63 917 321 9900", "id_type": "Government ID", "id_number": "GOV-SA-1029", "address": "Mariveles, Bataan"},
      {"guest_id": 5, "guest_user_id": null, "full_name": "Ms. Lourdes T. Enriquez", "email": "lenriquez@gmail.com", "phone": "+63 916 870 4412", "id_type": "PhilSys ID", "id_number": "PSN-1234-5678", "address": "Pilar, Bataan"},
      {"guest_id": 6, "guest_user_id": null, "full_name": "Mr. Ramon B. Dela Cruz", "email": "rbdelacruz@yahoo.com", "phone": "+63 920 103 7788", "id_type": "Drivers License", "id_number": "N03-96-0887", "address": "Orion, Bataan"}
    ],

    room_types: [
      {"room_type_id": 1, "type_name": "Standard Single Room", "description": "Single bed, air-conditioned, study desk", "base_rate_per_night": 900.0, "max_capacity": 1},
      {"room_type_id": 2, "type_name": "Standard Double Room", "description": "Double bed, LED TV, hot & cold shower", "base_rate_per_night": 1200.0, "max_capacity": 2},
      {"room_type_id": 3, "type_name": "Deluxe Twin Room", "description": "Two twin beds, mini-ref, coffee maker, balcony", "base_rate_per_night": 1600.0, "max_capacity": 2},
      {"room_type_id": 4, "type_name": "Deluxe King Suite", "description": "King bed, sofa, mini-fridge, panoramic view", "base_rate_per_night": 2200.0, "max_capacity": 2},
      {"room_type_id": 5, "type_name": "PATVEP Student Dorm", "description": "Air-conditioned 4-person dorm, secure lockers, campus WiFi", "base_rate_per_night": 400.0, "max_capacity": 4},
      {"room_type_id": 6, "type_name": "VIP Executive Family Suite", "description": "Multi-bed, kitchenette, microwave, dining set, lounge", "base_rate_per_night": 3200.0, "max_capacity": 6},
      {"room_type_id": 7, "type_name": "Executive Guest Room", "description": "Double + single bed, suitable for committees and trainers", "base_rate_per_night": 1800.0, "max_capacity": 3}
    ],

    rooms: [
      {"room_id": 1, "room_type_id": 1, "room_number": "101", "floor": 1, "capacity": 1, "rate_per_night": 900.0, "description": "Cozy single, ideal for visiting scholars", "status": "AVAILABLE"},
      {"room_id": 2, "room_type_id": 2, "room_number": "102", "floor": 1, "capacity": 2, "rate_per_night": 1200.0, "description": "Spacious double, LED TV, rain shower", "status": "OCCUPIED"},
      {"room_id": 3, "room_type_id": 3, "room_number": "103", "floor": 1, "capacity": 2, "rate_per_night": 1600.0, "description": "Twin beds, hotel linens, balcony", "status": "AVAILABLE"},
      {"room_id": 4, "room_type_id": 4, "room_number": "104", "floor": 1, "capacity": 2, "rate_per_night": 2200.0, "description": "King suite, sofa, panoramic campus view", "status": "RESERVED"},
      {"room_id": 5, "room_type_id": 5, "room_number": "201", "floor": 2, "capacity": 4, "rate_per_night": 400.0, "description": "4-person dorm for student delegates", "status": "OCCUPIED"},
      {"room_id": 6, "room_type_id": 5, "room_number": "202", "floor": 2, "capacity": 4, "rate_per_night": 400.0, "description": "4-person dorm, lockers, WiFi", "status": "AVAILABLE"},
      {"room_id": 7, "room_type_id": 6, "room_number": "203", "floor": 2, "capacity": 6, "rate_per_night": 3200.0, "description": "VIP suite with kitchenette and dining area", "status": "AVAILABLE"},
      {"room_id": 8, "room_type_id": 7, "room_number": "204", "floor": 2, "capacity": 3, "rate_per_night": 1800.0, "description": "Flexible layout, double + single bed", "status": "MAINTENANCE"}
    ],

    reservations: [
      {"reservation_id": 1, "reference_number": "BPSU-RES-202609-0001", "guest_id": 1, "room_id": 2, "room_number_snapshot": "102", "room_type_snapshot": "Standard Double Room", "rate_per_night_snapshot": 1200.0, "check_in_date": "2026-09-13", "check_out_date": "2026-09-16", "number_of_guests": 2, "total_nights": 3, "total_amount": 3600.0, "paid_amount": 3600.0, "status": "CHECKED_IN", "notes": "Guest checked in for CCST Research Conference.", "handled_by": 2, "created_at": "2026-09-08 10:00:00", "checked_in_at": "2026-09-13 14:15:00", "checked_out_at": null, "balance": 0.0},
      {"reservation_id": 2, "reference_number": "BPSU-RES-202609-0002", "guest_id": 2, "room_id": 5, "room_number_snapshot": "201", "room_type_snapshot": "PATVEP Student Dorm", "rate_per_night_snapshot": 400.0, "check_in_date": "2026-09-14", "check_out_date": "2026-09-17", "number_of_guests": 4, "total_nights": 3, "total_amount": 1200.0, "paid_amount": 600.0, "status": "CHECKED_IN", "notes": "Student delegates for regional IT skills competition.", "handled_by": 2, "created_at": "2026-09-09 08:30:00", "checked_in_at": "2026-09-14 13:00:00", "checked_out_at": null, "balance": 600.0},
      {"reservation_id": 3, "reference_number": "BPSU-RES-202609-0003", "guest_id": 3, "room_id": 4, "room_number_snapshot": "104", "room_type_snapshot": "Deluxe King Suite", "rate_per_night_snapshot": 2200.0, "check_in_date": "2026-09-16", "check_out_date": "2026-09-19", "number_of_guests": 2, "total_nights": 3, "total_amount": 6600.0, "paid_amount": 0.0, "status": "CONFIRMED", "notes": "VIP accommodation — CHED Regional Evaluator.", "handled_by": 2, "created_at": "2026-09-13 16:40:00", "checked_in_at": null, "checked_out_at": null, "balance": 6600.0},
      {"reservation_id": 4, "reference_number": "BPSU-RES-202609-0004", "guest_id": 4, "room_id": 1, "room_number_snapshot": "101", "room_type_snapshot": "Standard Single Room", "rate_per_night_snapshot": 900.0, "check_in_date": "2026-09-20", "check_out_date": "2026-09-22", "number_of_guests": 1, "total_nights": 2, "total_amount": 1800.0, "paid_amount": 0.0, "status": "PENDING", "notes": "Engineer from DPWH for campus inspection.", "handled_by": 2, "created_at": "2026-09-14 09:00:00", "checked_in_at": null, "checked_out_at": null, "balance": 1800.0},
      {"reservation_id": 5, "reference_number": "BPSU-RES-202609-0005", "guest_id": 5, "room_id": 6, "room_number_snapshot": "202", "room_type_snapshot": "PATVEP Student Dorm", "rate_per_night_snapshot": 400.0, "check_in_date": "2026-09-05", "check_out_date": "2026-09-08", "number_of_guests": 3, "total_nights": 3, "total_amount": 1200.0, "paid_amount": 1200.0, "status": "CHECKED_OUT", "notes": "Sports team delegates — completed stay.", "handled_by": 2, "created_at": "2026-09-03 11:00:00", "checked_in_at": "2026-09-05 12:00:00", "checked_out_at": "2026-09-08 10:30:00", "balance": 0.0},
      {"reservation_id": 6, "reference_number": "BPSU-RES-202609-0006", "guest_id": 6, "room_id": 7, "room_number_snapshot": "203", "room_type_snapshot": "VIP Executive Family Suite", "rate_per_night_snapshot": 3200.0, "check_in_date": "2026-09-10", "check_out_date": "2026-09-12", "number_of_guests": 4, "total_nights": 2, "total_amount": 6400.0, "paid_amount": 0.0, "status": "CANCELLED", "notes": null, "handled_by": 2, "created_at": "2026-09-07 14:00:00", "checked_in_at": null, "checked_out_at": null, "balance": 6400.0}
    ],

    payments: [
      {"payment_id": 1, "reservation_id": 1, "receipt_number": "OR-2026-00891", "amount": 3600.0, "payment_method": "CASH", "reference_code": "CASH-REC-001", "notes": "Full advance settlement at front desk", "received_by": 2, "payment_date": "2026-09-13 14:30:00"},
      {"payment_id": 2, "reservation_id": 2, "receipt_number": "OR-2026-00892", "amount": 600.0, "payment_method": "UNIVERSITY_CHARGE_SLIP", "reference_code": "BPSU-CCST-PO-881", "notes": "50% university charging for student delegates", "received_by": 2, "payment_date": "2026-09-14 13:15:00"},
      {"payment_id": 3, "reservation_id": 5, "receipt_number": "OR-2026-00885", "amount": 1200.0, "payment_method": "CASH", "reference_code": "CASH-REC-002", "notes": "Full payment — sports delegates completed stay", "received_by": 2, "payment_date": "2026-09-05 12:30:00"}
    ],

    suppliers: [
      {"supplier_id": 1, "supplier_name": "Bataan Fresh Farms & Meat Trading", "contact_person": "Ramon Bautista", "phone": "+63 917 888 1234", "email": "ramon@bataanfreshfarms.ph", "address": "Capitol Drive, Balanga City, Bataan", "supplied_categories": "Meat & Poultry, Food Staples", "is_active": 1},
      {"supplier_id": 2, "supplier_name": "BPSU Agricultural Cooperative & Canteen Supply", "contact_person": "Maria Elena Ramos", "phone": "+63 918 777 5678", "email": "coop@bpsu.edu.ph", "address": "BPSU Abucay Campus, Bataan", "supplied_categories": "Food Staples, Ingredients", "is_active": 1},
      {"supplier_id": 3, "supplier_name": "Balanga Wholesale Grocery & Packaging Center", "contact_person": "Kenneth Tan", "phone": "+63 919 666 9012", "email": "sales@balangawholesale.com", "address": "Don Manuel Banzon Ave, Balanga City", "supplied_categories": "Supplies, Cleaning, Ingredients", "is_active": 1},
      {"supplier_id": 4, "supplier_name": "Central Luzon Beverage & Refreshment Corp.", "contact_person": "Jennifer Cruz", "phone": "+63 920 555 3456", "email": "jcruz@clbeverage.com.ph", "address": "Roman Superhighway, Balanga City", "supplied_categories": "Beverages", "is_active": 1}
    ],

    inventory_items: [
      {"item_id": 1, "item_code": "STP-001", "item_name": "Jasmine Premium Rice (50kg Sack)", "category": "FOOD_STAPLES", "unit": "sacks", "current_stock": 5.5, "reorder_level": 3.0, "critical_level": 1.0, "unit_cost": 2350.0, "preferred_supplier_id": 2, "description": "Premium quality jasmine rice, 50kg per sack"},
      {"item_id": 2, "item_code": "MEA-002", "item_name": "Fresh Dressed Chicken (Cut)", "category": "MEAT_POULTRY", "unit": "kg", "current_stock": 20.0, "reorder_level": 10.0, "critical_level": 3.0, "unit_cost": 195.0, "preferred_supplier_id": 1, "description": "Fresh dressed chicken, sold per kilogram"},
      {"item_id": 3, "item_code": "MEA-003", "item_name": "Fresh Pork Liempo (Sliced)", "category": "MEAT_POULTRY", "unit": "kg", "current_stock": 13.5, "reorder_level": 8.0, "critical_level": 2.0, "unit_cost": 330.0, "preferred_supplier_id": 1, "description": "Fresh sliced pork belly, per kilogram"},
      {"item_id": 4, "item_code": "ING-004", "item_name": "Pure Palm Cooking Oil (20L Tin)", "category": "INGREDIENTS", "unit": "tins", "current_stock": 5.0, "reorder_level": 2.0, "critical_level": 1.0, "unit_cost": 1450.0, "preferred_supplier_id": 3, "description": "Commercial-grade palm oil, 20-liter tin"},
      {"item_id": 5, "item_code": "ING-005", "item_name": "Refined White Sugar (25kg Bag)", "category": "INGREDIENTS", "unit": "bags", "current_stock": 2.0, "reorder_level": 2.0, "critical_level": 1.0, "unit_cost": 1800.0, "preferred_supplier_id": 3, "description": "Refined white sugar, 25kg per bag"},
      {"item_id": 6, "item_code": "ING-006", "item_name": "Iodized Fine Salt (1kg Pack)", "category": "INGREDIENTS", "unit": "packs", "current_stock": 20.0, "reorder_level": 5.0, "critical_level": 2.0, "unit_cost": 28.0, "preferred_supplier_id": 3, "description": "Iodized fine salt, 1kg per pack"},
      {"item_id": 7, "item_code": "BEV-007", "item_name": "Ground Barako Coffee (1kg)", "category": "BEVERAGES", "unit": "packs", "current_stock": 8.0, "reorder_level": 5.0, "critical_level": 2.0, "unit_cost": 490.0, "preferred_supplier_id": 4, "description": "Batangas Barako ground coffee, 1kg pack"},
      {"item_id": 8, "item_code": "BEV-008", "item_name": "Evaporated Filled Milk (370ml Can)", "category": "BEVERAGES", "unit": "cans", "current_stock": 42.0, "reorder_level": 24.0, "critical_level": 6.0, "unit_cost": 39.5, "preferred_supplier_id": 4, "description": "370ml evaporated milk cans"},
      {"item_id": 9, "item_code": "BEV-009", "item_name": "Purified Bottled Water (500ml)", "category": "BEVERAGES", "unit": "bottles", "current_stock": 180.0, "reorder_level": 48.0, "critical_level": 12.0, "unit_cost": 11.5, "preferred_supplier_id": 4, "description": "500ml purified bottled water"},
      {"item_id": 10, "item_code": "STP-010", "item_name": "Canned Corned Beef (260g)", "category": "FOOD_STAPLES", "unit": "cans", "current_stock": 48.0, "reorder_level": 20.0, "critical_level": 5.0, "unit_cost": 64.0, "preferred_supplier_id": 3, "description": "Canned corned beef, 260g per can"},
      {"item_id": 11, "item_code": "PKG-011", "item_name": "Biodegradable Bento Box 3-Div", "category": "SUPPLIES_PACKAGING", "unit": "pcs", "current_stock": 380.0, "reorder_level": 100.0, "critical_level": 30.0, "unit_cost": 4.25, "preferred_supplier_id": 3, "description": "Eco-friendly 3-division meal boxes"},
      {"item_id": 12, "item_code": "CLN-012", "item_name": "Commercial Dishwashing Liquid (1 Gal)", "category": "CLEANING", "unit": "gallons", "current_stock": 4.0, "reorder_level": 1.0, "critical_level": 0.0, "unit_cost": 290.0, "preferred_supplier_id": 3, "description": "Commercial-grade dishwashing liquid, 1 gallon"}
    ],

    deliveries: [
      {"delivery_id": 1, "delivery_receipt_no": "DR-2026-041", "supplier_id": 2, "delivery_date": "2026-09-09", "received_by": 3, "total_amount": 14100.0, "status": "RECEIVED", "notes": "Rice delivery from BPSU coop"},
      {"delivery_id": 2, "delivery_receipt_no": "DR-2026-042", "supplier_id": 4, "delivery_date": "2026-09-09", "received_by": 3, "total_amount": 2300.0, "status": "RECEIVED", "notes": "Bottled water restocking"},
      {"delivery_id": 3, "delivery_receipt_no": "DR-2026-043", "supplier_id": 3, "delivery_date": "2026-09-10", "received_by": 3, "total_amount": 17342.0, "status": "RECEIVED", "notes": "Wholesale grocery & packaging batch"},
      {"delivery_id": 4, "delivery_receipt_no": "DR-2026-044", "supplier_id": 4, "delivery_date": "2026-09-11", "received_by": 3, "total_amount": 5816.0, "status": "RECEIVED", "notes": "Beverages replenishment"},
      {"delivery_id": 5, "delivery_receipt_no": "DR-2026-045", "supplier_id": 1, "delivery_date": "2026-09-13", "received_by": 3, "total_amount": 9990.0, "status": "RECEIVED", "notes": "Meat & poultry restocking"}
    ],

    delivery_items: [
      {"delivery_id": 1, "item_id": 1, "quantity": 6.0, "unit_cost": 2350.0},
      {"delivery_id": 2, "item_id": 9, "quantity": 200.0, "unit_cost": 11.5},
      {"delivery_id": 3, "item_id": 4, "quantity": 5.0, "unit_cost": 1450.0},
      {"delivery_id": 3, "item_id": 5, "quantity": 2.0, "unit_cost": 1800.0},
      {"delivery_id": 3, "item_id": 6, "quantity": 20.0, "unit_cost": 28.0},
      {"delivery_id": 3, "item_id": 10, "quantity": 48.0, "unit_cost": 64.0},
      {"delivery_id": 3, "item_id": 11, "quantity": 400.0, "unit_cost": 4.25},
      {"delivery_id": 3, "item_id": 12, "quantity": 4.0, "unit_cost": 290.0},
      {"delivery_id": 4, "item_id": 7, "quantity": 8.0, "unit_cost": 490.0},
      {"delivery_id": 4, "item_id": 8, "quantity": 48.0, "unit_cost": 39.5},
      {"delivery_id": 5, "item_id": 2, "quantity": 25.0, "unit_cost": 195.0},
      {"delivery_id": 5, "item_id": 3, "quantity": 15.5, "unit_cost": 330.0}
    ],

    inventory_consumption: [
      {"consumption_id": 1, "item_id": 2, "quantity": 3.0, "purpose": "KITCHEN_USAGE", "notes": "Morning prep — chicken adobo", "recorded_by": 3, "consumption_date": "2026-09-10 07:30:00"},
      {"consumption_id": 2, "item_id": 9, "quantity": 8.0, "purpose": "CANTEEN_SALES", "notes": "Water sold at canteen counter", "recorded_by": 3, "consumption_date": "2026-09-10 12:00:00"},
      {"consumption_id": 3, "item_id": 1, "quantity": 0.5, "purpose": "KITCHEN_USAGE", "notes": "Half sack used for day meals", "recorded_by": 3, "consumption_date": "2026-09-11 06:30:00"},
      {"consumption_id": 4, "item_id": 2, "quantity": 2.0, "purpose": "KITCHEN_USAGE", "notes": "Lunch prep — chicken tinola", "recorded_by": 3, "consumption_date": "2026-09-11 08:00:00"},
      {"consumption_id": 5, "item_id": 3, "quantity": 2.0, "purpose": "KITCHEN_USAGE", "notes": "Pork liempo grilled for lunch", "recorded_by": 3, "consumption_date": "2026-09-12 07:45:00"},
      {"consumption_id": 6, "item_id": 9, "quantity": 12.0, "purpose": "CANTEEN_SALES", "notes": "Water sold across two meal periods", "recorded_by": 3, "consumption_date": "2026-09-12 12:00:00"},
      {"consumption_id": 7, "item_id": 8, "quantity": 6.0, "purpose": "CANTEEN_SALES", "notes": "Evap milk for coffee orders", "recorded_by": 3, "consumption_date": "2026-09-13 07:00:00"},
      {"consumption_id": 8, "item_id": 11, "quantity": 20.0, "purpose": "CANTEEN_USAGE", "notes": "Bento boxes for packed lunch orders", "recorded_by": 3, "consumption_date": "2026-09-13 11:30:00"}
    ],

    audit_logs: [
      {"log_id": 1, "user_id": 1, "username_snapshot": "admin", "role_snapshot": "ADMIN", "action_type": "SYSTEM_INIT", "target_entity": "SYSTEM", "target_id": null, "description": "Initial system database seeded for BPSU PATVEP Hostel & Canteen", "logged_at": "2026-09-01 08:00:00"},
      {"log_id": 2, "user_id": 1, "username_snapshot": "admin", "role_snapshot": "ADMIN", "action_type": "USER_CREATE", "target_entity": "USERS", "target_id": 2, "description": "Created user account: hostel_staff (John Carlos R. Capuli)", "logged_at": "2026-09-01 08:05:00"},
      {"log_id": 3, "user_id": 1, "username_snapshot": "admin", "role_snapshot": "ADMIN", "action_type": "USER_CREATE", "target_entity": "USERS", "target_id": 3, "description": "Created user account: canteen_staff (Darren Jude S. Tamayo)", "logged_at": "2026-09-01 08:10:00"},
      {"log_id": 4, "user_id": 1, "username_snapshot": "admin", "role_snapshot": "ADMIN", "action_type": "USER_CREATE", "target_entity": "USERS", "target_id": 4, "description": "Created user account: qa_staff (Fritz Edrick B. Sarmiento)", "logged_at": "2026-09-01 08:15:00"},
      {"log_id": 5, "user_id": 2, "username_snapshot": "hostel_staff", "role_snapshot": "STAFF_HOSTEL", "action_type": "LOGIN", "target_entity": "AUTH", "target_id": null, "description": "User hostel_staff logged in", "logged_at": "2026-09-08 09:55:00"},
      {"log_id": 6, "user_id": 2, "username_snapshot": "hostel_staff", "role_snapshot": "STAFF_HOSTEL", "action_type": "RESERVATION_CREATED", "target_entity": "RESERVATION", "target_id": 1, "description": "Created reservation BPSU-RES-202609-0001 for Angelo Andrei P. Sierra", "logged_at": "2026-09-08 10:00:00"},
      {"log_id": 7, "user_id": 2, "username_snapshot": "hostel_staff", "role_snapshot": "STAFF_HOSTEL", "action_type": "RESERVATION_CONFIRMED", "target_entity": "RESERVATION", "target_id": 1, "description": "Reservation BPSU-RES-202609-0001 confirmed", "logged_at": "2026-09-08 10:05:00"},
      {"log_id": 8, "user_id": 2, "username_snapshot": "hostel_staff", "role_snapshot": "STAFF_HOSTEL", "action_type": "RESERVATION_CREATED", "target_entity": "RESERVATION", "target_id": 2, "description": "Created reservation BPSU-RES-202609-0002 for Prof. Albert C. Tria", "logged_at": "2026-09-09 08:30:00"},
      {"log_id": 9, "user_id": 3, "username_snapshot": "canteen_staff", "role_snapshot": "STAFF_CANTEEN", "action_type": "LOGIN", "target_entity": "AUTH", "target_id": null, "description": "User canteen_staff logged in", "logged_at": "2026-09-09 09:00:00"},
      {"log_id": 10, "user_id": 3, "username_snapshot": "canteen_staff", "role_snapshot": "STAFF_CANTEEN", "action_type": "DELIVERY_RECORD", "target_entity": "DELIVERY", "target_id": 1, "description": "Recorded delivery DR-2026-041 from BPSU Agricultural Cooperative", "logged_at": "2026-09-09 10:00:00"},
      {"log_id": 11, "user_id": 3, "username_snapshot": "canteen_staff", "role_snapshot": "STAFF_CANTEEN", "action_type": "DELIVERY_RECORD", "target_entity": "DELIVERY", "target_id": 2, "description": "Recorded delivery DR-2026-042 from Central Luzon Beverage Corp", "logged_at": "2026-09-09 10:15:00"},
      {"log_id": 12, "user_id": 2, "username_snapshot": "hostel_staff", "role_snapshot": "STAFF_HOSTEL", "action_type": "RESERVATION_CHECKED_IN", "target_entity": "RESERVATION", "target_id": 1, "description": "Guest Angelo Andrei P. Sierra checked in for BPSU-RES-202609-0001", "logged_at": "2026-09-13 14:15:00"},
      {"log_id": 13, "user_id": 2, "username_snapshot": "hostel_staff", "role_snapshot": "STAFF_HOSTEL", "action_type": "RESERVATION_CHECKED_IN", "target_entity": "RESERVATION", "target_id": 2, "description": "Guest Prof. Albert C. Tria checked in for BPSU-RES-202609-0002", "logged_at": "2026-09-14 13:00:00"},
      {"log_id": 14, "user_id": 2, "username_snapshot": "hostel_staff", "role_snapshot": "STAFF_HOSTEL", "action_type": "RESERVATION_CANCELLED", "target_entity": "RESERVATION", "target_id": 6, "description": "Reservation BPSU-RES-202609-0006 cancelled — guest no-show after 24 hrs", "logged_at": "2026-09-11 09:00:00"},
      {"log_id": 15, "user_id": 3, "username_snapshot": "canteen_staff", "role_snapshot": "STAFF_CANTEEN", "action_type": "LOGOUT", "target_entity": "AUTH", "target_id": null, "description": "User canteen_staff logged out", "logged_at": "2026-09-14 17:00:00"}
    ]
  };
})(window.App = window.App || {});
