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

  /* --- vw_reservation_summary --------------------------------------------- */
  function reservationSummary() {
    return DB.reservations.map(function (r) {
      var g = one(DB.guests, 'guest_id', r.guest_id);
      return {
        reservation_id: r.reservation_id,
        reference_number: r.reference_number,
        guest_name: g ? g.full_name : '',
        room_number: r.room_number_snapshot,
        room_type: r.room_type_snapshot,
        check_in_date: r.check_in_date,
        check_out_date: r.check_out_date,
        total_nights: r.total_nights,
        number_of_guests: r.number_of_guests,
        total_amount: r.total_amount,
        paid_amount: r.paid_amount,
        balance: r.balance,
        status: r.status
      };
    });
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

  App.Q = {
    by: by, one: one,
    roleLabel: roleLabel, resStatus: resStatus, roomStatus: roomStatus,
    actionLabel: actionLabel, entityLabel: entityLabel, category: category,
    me: me,
    reservationSummary: reservationSummary,
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
