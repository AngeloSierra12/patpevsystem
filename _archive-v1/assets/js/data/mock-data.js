/* ============================================================================
 * mock-data.js — Seed data for the frontend prototype
 * ----------------------------------------------------------------------------
 * OWNER: Angelo Andrei P. Sierra (Frontend & UI/UX Developer)
 *
 * This file exists ONLY so the front end can be demonstrated before the
 * database (WBS 1.0 — D. Tamayo) and the backend API (J.C. Capuli) are ready.
 * Every consumer reads through App.Store, never from here directly, so this
 * whole file can be deleted once real endpoints exist.
 * ========================================================================== */
(function (App) {
  'use strict';

  /* --- small date helpers so the demo always looks "live" ----------------- */
  var TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);

  /* NOTE: formats in LOCAL time on purpose. toISOString() would convert to UTC
     and shift every seeded date by a day for anyone east or west of Greenwich,
     which quietly breaks the "today" column in the calendar. */
  function day(offset) {
    var d = new Date(TODAY);
    d.setDate(d.getDate() + offset);
    return App.Dates.toIso(d);
  }

  /* --- Users (WBS 2.0 — User Management) ---------------------------------- */
  var users = [
    { id: 'U-1001', fullName: 'Angelo Andrei P. Sierra', username: 'asierra',
      email: 'asierra@bpsu.edu.ph', role: 'admin', status: 'active',
      department: 'IGP PATVEP Hostel', contact: '0917-555-0101',
      lastLogin: day(0) + ' 07:42', createdAt: day(-240), grants: [], revokes: [] },

    { id: 'U-1002', fullName: 'Andrew Jacob E. Santos', username: 'ajsantos',
      email: 'ajsantos@bpsu.edu.ph', role: 'admin', status: 'active',
      department: 'IGP Administration', contact: '0917-555-0102',
      lastLogin: day(0) + ' 06:58', createdAt: day(-240), grants: [], revokes: [] },

    { id: 'U-1003', fullName: 'Maria Liza C. Bautista', username: 'mbautista',
      email: 'mbautista@bpsu.edu.ph', role: 'staff', status: 'active',
      department: 'IGP PATVEP Hostel', contact: '0918-555-0103',
      lastLogin: day(0) + ' 08:15', createdAt: day(-180),
      grants: ['reports.view'], revokes: [] },

    { id: 'U-1004', fullName: 'Ramon T. Dela Cruz', username: 'rdelacruz',
      email: 'rdelacruz@bpsu.edu.ph', role: 'staff', status: 'active',
      department: 'University Canteen', contact: '0918-555-0104',
      lastLogin: day(-1) + ' 16:30', createdAt: day(-175), grants: [], revokes: [] },

    { id: 'U-1005', fullName: 'Jenny R. Ocampo', username: 'jocampo',
      email: 'jocampo@bpsu.edu.ph', role: 'staff', status: 'active',
      department: 'University Canteen', contact: '0919-555-0105',
      lastLogin: day(-2) + ' 11:05', createdAt: day(-150),
      grants: [], revokes: ['inventory.manage'] },

    { id: 'U-1006', fullName: 'Fritz Edrick B. Sarmiento', username: 'fsarmiento',
      email: 'fsarmiento@bpsu.edu.ph', role: 'staff', status: 'inactive',
      department: 'Quality Assurance', contact: '0919-555-0106',
      lastLogin: day(-34) + ' 09:20', createdAt: day(-140), grants: [], revokes: [] },

    { id: 'U-1007', fullName: 'Carla M. Villanueva', username: 'cvillanueva',
      email: 'carla.villanueva@gmail.com', role: 'guest', status: 'active',
      department: 'External Guest', contact: '0920-555-0107',
      lastLogin: day(-1) + ' 20:11', createdAt: day(-60), grants: [], revokes: [] },

    { id: 'U-1008', fullName: 'Noel B. Aguilar', username: 'naguilar',
      email: 'noel.aguilar@yahoo.com', role: 'guest', status: 'active',
      department: 'External Guest', contact: '0920-555-0108',
      lastLogin: day(-5) + ' 14:47', createdAt: day(-45), grants: [], revokes: [] },

    { id: 'U-1009', fullName: 'Grace P. Mendoza', username: 'gmendoza',
      email: 'grace.mendoza@gmail.com', role: 'guest', status: 'suspended',
      department: 'External Guest', contact: '0921-555-0109',
      lastLogin: day(-22) + ' 10:02', createdAt: day(-38), grants: [], revokes: [] },

    { id: 'U-1010', fullName: 'Darren Jude S. Tamayo', username: 'dtamayo',
      email: 'dtamayo@bpsu.edu.ph', role: 'admin', status: 'active',
      department: 'MIS / Database', contact: '0921-555-0110',
      lastLogin: day(-3) + ' 13:26', createdAt: day(-230), grants: [], revokes: [] }
  ];

  /* --- Rooms (owned by WBS 4.0 — read-only here) -------------------------- */
  var roomTypes = {
    'Standard':  { rate: 1200, capacity: 2 },
    'Deluxe':    { rate: 1800, capacity: 3 },
    'Family':    { rate: 2600, capacity: 5 },
    'Dormitory': { rate:  600, capacity: 8 }
  };

  var rooms = [];
  (function buildRooms() {
    var plan = [
      ['Standard', 8, 1], ['Deluxe', 6, 2], ['Family', 4, 3], ['Dormitory', 4, 3]
    ];
    plan.forEach(function (p) {
      var type = p[0], count = p[1], floor = p[2];
      var letter = type === 'Dormitory' ? 'O' : type.charAt(0);
      for (var i = 1; i <= count; i++) {
        var code = String(floor) + String(i).padStart(2, '0') + letter;
        rooms.push({
          id: 'R-' + code, code: code, type: type, floor: floor,
          rate: roomTypes[type].rate, capacity: roomTypes[type].capacity
        });
      }
    });
  })();

  /* --- Reservations (owned by WBS 4.0 — read-only here) ------------------- */
  var reservations = [
    { id: 'RSV-2401', guestId: 'U-1007', guestName: 'Carla M. Villanueva', roomId: 'R-101S',
      checkIn: day(-2), checkOut: day(1), pax: 2, status: 'checked-in', total: 3600,
      notes: 'Faculty seminar attendee' },
    { id: 'RSV-2402', guestId: 'U-1008', guestName: 'Noel B. Aguilar', roomId: 'R-201D',
      checkIn: day(-1), checkOut: day(2), pax: 3, status: 'checked-in', total: 5400, notes: '' },
    { id: 'RSV-2403', guestId: 'U-1009', guestName: 'Grace P. Mendoza', roomId: 'R-202D',
      checkIn: day(0), checkOut: day(3), pax: 2, status: 'confirmed', total: 5400,
      notes: 'Late arrival, around 9PM' },
    { id: 'RSV-2404', guestId: 'U-1007', guestName: 'Villanueva Family', roomId: 'R-301F',
      checkIn: day(1), checkOut: day(4), pax: 5, status: 'confirmed', total: 7800,
      notes: 'Family of alumni guest' },
    { id: 'RSV-2405', guestId: 'U-1008', guestName: 'Noel B. Aguilar', roomId: 'R-102S',
      checkIn: day(0), checkOut: day(1), pax: 1, status: 'checked-in', total: 1200, notes: '' },
    { id: 'RSV-2406', guestId: 'U-1007', guestName: 'Athletics Delegation A', roomId: 'R-301O',
      checkIn: day(2), checkOut: day(6), pax: 8, status: 'confirmed', total: 2400,
      notes: 'CALABARZON meet billeting' },
    { id: 'RSV-2407', guestId: 'U-1008', guestName: 'Athletics Delegation B', roomId: 'R-302O',
      checkIn: day(2), checkOut: day(6), pax: 8, status: 'confirmed', total: 2400,
      notes: 'CALABARZON meet billeting' },
    { id: 'RSV-2408', guestId: 'U-1009', guestName: 'Engr. Paulo S. Rivera', roomId: 'R-103S',
      checkIn: day(3), checkOut: day(5), pax: 2, status: 'pending', total: 2400,
      notes: 'Awaiting staff confirmation' },
    { id: 'RSV-2409', guestId: 'U-1007', guestName: 'Dr. Elena M. Ferrer', roomId: 'R-203D',
      checkIn: day(4), checkOut: day(7), pax: 2, status: 'confirmed', total: 5400,
      notes: 'Accreditation visit' },
    { id: 'RSV-2410', guestId: 'U-1008', guestName: 'Mark Anthony V. Reyes', roomId: 'R-104S',
      checkIn: day(-6), checkOut: day(-3), pax: 1, status: 'checked-out', total: 3600, notes: '' },
    { id: 'RSV-2411', guestId: 'U-1009', guestName: 'Sofia L. Gutierrez', roomId: 'R-302F',
      checkIn: day(-8), checkOut: day(-5), pax: 4, status: 'checked-out', total: 7800, notes: '' },
    { id: 'RSV-2412', guestId: 'U-1007', guestName: 'Walk-in (cancelled)', roomId: 'R-105S',
      checkIn: day(1), checkOut: day(3), pax: 2, status: 'cancelled', total: 2400,
      notes: 'Guest cancelled by phone' },
    { id: 'RSV-2413', guestId: 'U-1008', guestName: 'BPSU Extension Office', roomId: 'R-204D',
      checkIn: day(6), checkOut: day(9), pax: 3, status: 'confirmed', total: 5400,
      notes: 'Community outreach team' },
    { id: 'RSV-2414', guestId: 'U-1009', guestName: 'Alumni Homecoming Group', roomId: 'R-303F',
      checkIn: day(8), checkOut: day(10), pax: 5, status: 'pending', total: 5200, notes: '' },

    /* current in-house guests — these keep the dashboard and timeline populated */
    { id: 'RSV-2415', guestId: 'U-1007', guestName: 'Prof. Ricardo B. Lim', roomId: 'R-106S',
      checkIn: day(-3), checkOut: day(2), pax: 1, status: 'checked-in', total: 6000,
      notes: 'Visiting lecturer, College of Engineering' },
    { id: 'RSV-2416', guestId: 'U-1008', guestName: 'DepEd Regional Observers', roomId: 'R-205D',
      checkIn: day(-1), checkOut: day(3), pax: 3, status: 'checked-in', total: 7200,
      notes: 'Two rooms requested, one confirmed' },
    { id: 'RSV-2417', guestId: 'U-1009', guestName: 'Atty. Helena V. Cruz', roomId: 'R-107S',
      checkIn: day(0), checkOut: day(2), pax: 2, status: 'checked-in', total: 2400,
      notes: '' },
    { id: 'RSV-2418', guestId: 'U-1007', guestName: 'Sto. Domingo Faculty Group', roomId: 'R-304F',
      checkIn: day(-2), checkOut: day(1), pax: 4, status: 'checked-in', total: 7800,
      notes: 'Curriculum benchmarking visit' },
    { id: 'RSV-2419', guestId: 'U-1008', guestName: 'PATVEP Trainees Batch 12', roomId: 'R-304O',
      checkIn: day(-4), checkOut: day(5), pax: 7, status: 'checked-in', total: 5400,
      notes: 'Long-stay training cohort' },
    { id: 'RSV-2420', guestId: 'U-1009', guestName: 'Ms. Divina R. Santos', roomId: 'R-206D',
      checkIn: day(1), checkOut: day(3), pax: 2, status: 'confirmed', total: 3600,
      notes: '' },
    { id: 'RSV-2421', guestId: 'U-1007', guestName: 'Provincial Audit Team', roomId: 'R-108S',
      checkIn: day(2), checkOut: day(5), pax: 2, status: 'confirmed', total: 3600,
      notes: 'COA scheduled visit' }
  ];

  /* --- Non-reservation calendar events (WBS 5.0 — this module) ------------ */
  var events = [
    { id: 'EVT-501', title: 'Aircon servicing, Deluxe wing', type: 'maintenance',
      roomId: 'R-204D', start: day(1), end: day(2),
      notes: 'Contractor: CoolAir Bataan', createdBy: 'U-1003' },
    { id: 'EVT-502', title: 'Canteen delivery, San Miguel Foods', type: 'delivery',
      roomId: null, start: day(0), end: day(0),
      notes: 'AM window, 8:00 to 10:00', createdBy: 'U-1004' },
    { id: 'EVT-503', title: 'Quarterly physical stock count', type: 'inventory',
      roomId: null, start: day(3), end: day(3),
      notes: 'Canteen closed 6AM to 9AM', createdBy: 'U-1004' },
    { id: 'EVT-504', title: 'Deep cleaning, Dormitory block', type: 'maintenance',
      roomId: 'R-303O', start: day(2), end: day(4),
      notes: 'Room blocked from booking', createdBy: 'U-1003' },
    { id: 'EVT-505', title: 'Staff orientation, new system', type: 'other',
      roomId: null, start: day(5), end: day(5),
      notes: 'Hostel lobby, 1PM', createdBy: 'U-1002' },
    { id: 'EVT-506', title: 'Canteen delivery, Bataan Fresh Produce', type: 'delivery',
      roomId: null, start: day(4), end: day(4),
      notes: 'Vegetables and meat', createdBy: 'U-1004' }
  ];

  /* --- Canteen inventory (owned by WBS 3.0 — read-only here) -------------- */
  var inventory = [
    { id: 'ITM-01', name: 'Rice (premium, 25kg)',  category: 'Food',     stock: 14, unit: 'sack', reorder: 10, unitCost: 1450, supplier: 'Bataan Grains Trading' },
    { id: 'ITM-02', name: 'Cooking oil (17L)',     category: 'Food',     stock:  4, unit: 'pail', reorder:  6, unitCost: 1180, supplier: 'San Miguel Foods' },
    { id: 'ITM-03', name: 'Chicken (whole)',       category: 'Food',     stock: 38, unit: 'kg',   reorder: 25, unitCost:  195, supplier: 'Bataan Fresh Produce' },
    { id: 'ITM-04', name: 'Pork (kasim)',          category: 'Food',     stock: 12, unit: 'kg',   reorder: 20, unitCost:  320, supplier: 'Bataan Fresh Produce' },
    { id: 'ITM-05', name: 'Eggs (tray of 30)',     category: 'Food',     stock: 22, unit: 'tray', reorder: 12, unitCost:  245, supplier: 'Orani Poultry Farm' },
    { id: 'ITM-06', name: 'Softdrinks (24 cans)',  category: 'Beverage', stock:  9, unit: 'case', reorder: 10, unitCost:  480, supplier: 'Coca-Cola FEMSA' },
    { id: 'ITM-07', name: 'Bottled water (500mL)', category: 'Beverage', stock: 31, unit: 'case', reorder: 15, unitCost:  210, supplier: 'Aqua Bataan' },
    { id: 'ITM-08', name: '3-in-1 coffee (10s)',   category: 'Beverage', stock:  2, unit: 'box',  reorder:  8, unitCost:  390, supplier: 'Nestle PH' },
    { id: 'ITM-09', name: 'Instant noodles',       category: 'Food',     stock: 46, unit: 'box',  reorder: 20, unitCost:  340, supplier: 'Monde Nissin' },
    { id: 'ITM-10', name: 'Dishwashing liquid',    category: 'Supplies', stock:  7, unit: 'gal',  reorder:  5, unitCost:  265, supplier: 'Peerless Products' },
    { id: 'ITM-11', name: 'Paper cups (100s)',     category: 'Supplies', stock:  3, unit: 'pack', reorder: 10, unitCost:  150, supplier: 'Balanga Packaging' },
    { id: 'ITM-12', name: 'LPG tank (11kg)',       category: 'Supplies', stock:  5, unit: 'tank', reorder:  4, unitCost:  890, supplier: 'Petron Gasul' },
    { id: 'ITM-13', name: 'Bath towels',           category: 'Supplies', stock:  0, unit: 'pc',   reorder: 24, unitCost:  180, supplier: 'Hostel Linens Co.' },
    { id: 'ITM-14', name: 'Bed sheets (double)',   category: 'Supplies', stock: 18, unit: 'set',  reorder: 12, unitCost:  640, supplier: 'Hostel Linens Co.' }
  ];

  App.MockData = {
    today: TODAY,
    day: day,
    users: users,
    rooms: rooms,
    roomTypes: roomTypes,
    reservations: reservations,
    events: events,
    inventory: inventory
  };
})(window.App = window.App || {});
