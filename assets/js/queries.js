/* ============================================================================
 * queries.js — reads over App.DB
 *
 * Mirrors the SQL views the screens need, using the same names as 04_views.sql
 * so a reader can match each function to its view. When the API layer exists,
 * each of these becomes a request for the matching view and the screens do not
 * change.
 * ========================================================================== */
(function (App) {
  'use strict';

  var DB = App.DB;

  function by(rows, key, val) {
    return rows.filter(function (r) { return r[key] === val; });
  }
  function one(rows, key, val) {
    return by(rows, key, val)[0] || null;
  }

  /* --- labels for the schema's ENUMs -------------------------------------- */
  var ROLE_LABEL = {
    ADMIN: 'Administrator',
    STAFF_HOSTEL: 'Hostel Staff',
    STAFF_CANTEEN: 'Canteen Staff',
    GUEST: 'Guest'
  };

  var RES_STATUS = {
    PENDING:     { text: 'Pending',     tag: 'warn' },
    CONFIRMED:   { text: 'Confirmed',   tag: 'info' },
    CHECKED_IN:  { text: 'Checked in',  tag: 'ok' },
    CHECKED_OUT: { text: 'Checked out', tag: '' },
    CANCELLED:   { text: 'Cancelled',   tag: 'stop' }
  };

  var ROOM_STATUS = {
    AVAILABLE:   { text: 'Available',   tag: 'ok' },
    OCCUPIED:    { text: 'Occupied',    tag: 'info' },
    RESERVED:    { text: 'Reserved',    tag: 'warn' },
    MAINTENANCE: { text: 'Maintenance', tag: 'stop' }
  };

  /* The database stores these as SCREAMING_SNAKE codes. A code is a fine thing
     for a column to hold and a poor thing to show a canteen supervisor, so
     everything on screen goes through one of these. Anything the maps have not
     seen yet is turned into a sentence rather than leaking the raw code. */
  var ACTION_LABEL = {
    SYSTEM_INIT:            'System set up',
    LOGIN:                  'Signed in',
    LOGOUT:                 'Signed out',
    USER_CREATE:            'Account created',
    RESERVATION_CREATED:    'Reservation created',
    RESERVATION_CONFIRMED:  'Reservation confirmed',
    RESERVATION_CHECKED_IN: 'Guest checked in',
    RESERVATION_CHECKED_OUT:'Guest checked out',
    RESERVATION_CANCELLED:  'Reservation cancelled',
    DELIVERY_RECORD:        'Delivery recorded'
  };

  var ENTITY_LABEL = {
    AUTH:        'Sign-in',
    SYSTEM:      'System',
    USERS:       'User account',
    RESERVATION: 'Reservation',
    DELIVERY:    'Delivery',
    INVENTORY:   'Inventory item'
  };

  function sentence(code) {
    var t = String(code || '').toLowerCase().replace(/_/g, ' ').trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }

  function roleLabel(r) { return ROLE_LABEL[r] || sentence(r); }
  function actionLabel(a) { return ACTION_LABEL[a] || sentence(a); }
  function entityLabel(e) { return ENTITY_LABEL[e] || sentence(e); }
  function category(c) { return sentence(c); }
  function resStatus(s) { return RES_STATUS[s] || { text: s, tag: '' }; }
  function roomStatus(s) { return ROOM_STATUS[s] || { text: s, tag: '' }; }

  /* --- the signed-in account ---------------------------------------------- *
   * Sign-in is WBS 3.2 and access rules are WBS 3.3, neither of which exists
   * yet, so the shell runs as one fixed account from the users table.        */
  function me() {
    return one(DB.users, 'username', 'admin') || DB.users[0];
  }

  /* --- vw_guest_history --------------------------------------------------- */
  function guestHistory(guestId) {
    return by(DB.reservations, 'guest_id', guestId).sort(function (a, b) {
      return a.check_in_date < b.check_in_date ? 1 : -1;
    });
  }

  /* --- vw_payment_totals -------------------------------------------------- */
  function paymentsFor(reservationId) {
    return by(DB.payments, 'reservation_id', reservationId);
  }

  function revenueCollected() {
    return DB.payments.reduce(function (s, p) { return s + Number(p.amount); }, 0);
  }

  function amountBooked() {
    return DB.reservations.filter(function (r) {
      return r.status !== 'CANCELLED';
    }).reduce(function (s, r) { return s + Number(r.total_amount); }, 0);
  }

  function outstandingBalance() {
    return DB.reservations.filter(function (r) {
      return r.status !== 'CANCELLED';
    }).reduce(function (s, r) { return s + Number(r.balance); }, 0);
  }

  /* --- vw_low_stock_items -------------------------------------------------- *
   * The SQL view compares two columns, current_stock <= reorder_level.        */
  function lowStockItems() {
    return DB.inventory_items.filter(function (i) {
      return i.is_active !== 0 && Number(i.current_stock) <= Number(i.reorder_level);
    });
  }

  function criticalStockItems() {
    return DB.inventory_items.filter(function (i) {
      return Number(i.current_stock) <= Number(i.critical_level);
    });
  }

  /* --- vw_inventory_value -------------------------------------------------- */
  function inventoryValue() {
    return DB.inventory_items.reduce(function (s, i) {
      return s + Number(i.current_stock) * Number(i.unit_cost);
    }, 0);
  }

  /* --- vw_delivery_summary -------------------------------------------------- */
  function deliveryTotal() {
    return DB.deliveries.reduce(function (s, d) { return s + Number(d.total_amount); }, 0);
  }

  /* --- rooms joined to their type ------------------------------------------ */
  function roomsWithType() {
    return DB.rooms.map(function (r) {
      var t = one(DB.room_types, 'room_type_id', r.room_type_id);
      return {
        room_id: r.room_id,
        room_number: r.room_number,
        type_name: t ? t.type_name : '',
        floor: r.floor,
        capacity: r.capacity,
        rate_per_night: r.rate_per_night,
        status: r.status
      };
    });
  }

  /* --- vw_audit_log_full ---------------------------------------------------- */
  function auditLog() {
    return DB.audit_logs.slice().sort(function (a, b) {
      return a.logged_at < b.logged_at ? 1 : -1;
    });
  }

  /* --- dashboard reads ------------------------------------------------- *
   * These mirror what vw_occupancy_report and vw_room_availability answer.
   * Room status is the live column; occupancy across nights is computed from
   * the reservation dates, because a room being held on a future night is not
   * something rooms.status can express.
   * --------------------------------------------------------------------- */

  var HELD = ['CONFIRMED', 'CHECKED_IN', 'PENDING'];

  function roomsByStatus() {
    var out = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0 };
    DB.rooms.forEach(function (r) { out[r.status] = (out[r.status] || 0) + 1; });
    return out;
  }

  /* rooms in service = everything not out for maintenance. Counting a room
     under repair as "unsold" would understate how full the hostel really is. */
  function occupancyRate() {
    var by = roomsByStatus();
    var inService = DB.rooms.length - (by.MAINTENANCE || 0);
    if (!inService) return 0;
    return Math.round(((by.OCCUPIED || 0) + (by.RESERVED || 0)) / inService * 100);
  }

  function heldOn(dayIso) {
    return DB.reservations.filter(function (r) {
      return HELD.indexOf(r.status) !== -1 &&
             r.check_in_date <= dayIso && dayIso < r.check_out_date;
    });
  }

  function arrivalsOn(dayIso) {
    return DB.reservations.filter(function (r) {
      return r.status !== 'CANCELLED' && r.check_in_date === dayIso;
    });
  }

  function departuresOn(dayIso) {
    return DB.reservations.filter(function (r) {
      return r.status !== 'CANCELLED' && r.check_out_date === dayIso;
    });
  }

  /* Seven nights of room occupancy. Starts today, but if nothing at all is
     held in that week the window slides back to the last week that had
     bookings, and says so — an empty chart tells the reader nothing, and
     "no bookings this week" is itself worth reporting. */
  function occupancyWeek(startIso) {
    var S = App.Shell;
    var start = startIso || S.today();
    function week(from) {
      var days = [];
      for (var i = 0; i < 7; i++) {
        var d = S.addDays(from, i);
        days.push({ date: d, held: heldOn(d).length });
      }
      return days;
    }
    var days = week(start);
    var total = days.reduce(function (n, d) { return n + d.held; }, 0);
    if (total) return { days: days, shifted: false, start: start };

    var latest = DB.reservations.filter(function (r) {
      return HELD.indexOf(r.status) !== -1;
    }).map(function (r) { return r.check_in_date; }).sort().pop();
    if (!latest) return { days: days, shifted: false, start: start };
    return { days: week(latest), shifted: true, start: latest };
  }

  /* every item, ordered worst first, for the stock panel */
  function stockLevels() {
    return DB.inventory_items.slice().sort(function (a, b) {
      return (a.current_stock / (a.reorder_level || 1)) -
             (b.current_stock / (b.reorder_level || 1));
    });
  }

  function stockState(i) {
    var n = Number(i.current_stock);
    if (n <= Number(i.critical_level)) return { tag: 'stop', text: 'Critical' };
    if (n <= Number(i.reorder_level))  return { tag: 'warn', text: 'Reorder' };
    return { tag: 'ok', text: 'OK' };
  }

  App.Q = {
    one: one,
    roleLabel: roleLabel, resStatus: resStatus, roomStatus: roomStatus,
    roomsByStatus: roomsByStatus, occupancyRate: occupancyRate,
    heldOn: heldOn, arrivalsOn: arrivalsOn, departuresOn: departuresOn,
    occupancyWeek: occupancyWeek, stockLevels: stockLevels, stockState: stockState,
    actionLabel: actionLabel, entityLabel: entityLabel, category: category,
    me: me,
    guestHistory: guestHistory,
    paymentsFor: paymentsFor,
    revenueCollected: revenueCollected,
    amountBooked: amountBooked,
    outstandingBalance: outstandingBalance,
    lowStockItems: lowStockItems,
    criticalStockItems: criticalStockItems,
    inventoryValue: inventoryValue,
    deliveryTotal: deliveryTotal,
    roomsWithType: roomsWithType,
    auditLog: auditLog
  };
})(window.App = window.App || {});
