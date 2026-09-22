/* ============================================================================
 * reservations.js — Hotel Reservation
 * Angelo Andrei P. Sierra — Frontend and UI/UX Developer
 *
 * Charter deliverable: guest registration and profiles, room management,
 * room reservation, reservation management, room availability check, guest
 * check-in and check-out, reservation history, payment entry, and billing
 * and receipt generation.
 *
 * A night is the unit throughout. A stay from the 13th to the 16th holds the
 * nights of the 13th, 14th and 15th; the room is free again on the 16th. That
 * is why two stays meeting on the same date are not a clash, and why the
 * availability check uses `check_in < to AND from < check_out`.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var Q = App.Q;

  var selected = null;     // guest_id shown in the profile panel
  var statusFilter = 'all';

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Hotel Reservation', nav: 'reservations' });

    S.el('#notice').innerHTML =
      '<div class="note note--flat">' +
        '<span class="note__icon">' + S.icon('info', 15) + '</span>' +
        '<div>Every action on this screen validates against the real records ' +
        'and shows the row it would write. Persisting those rows needs the ' +
        'API layer, which is a separate task.</div>' +
      '</div>';

    selected = App.DB.guests[0].guest_id;

    S.el('#btnBook').addEventListener('click', function () { book(); });
    S.el('#btnGuest').addEventListener('click', function () { registerGuest(); });
    S.el('#fStatus').addEventListener('change', function (e) {
      statusFilter = e.target.value; reservations();
    });

    var today = S.today();
    S.el('#avFrom').value = today;
    S.el('#avTo').value = S.addDays(today, 1);
    S.el('#avCheck').addEventListener('click', rooms);

    meta();
    reservations();
    rooms();
    profile();

    if (location.hash === '#new') book();
  });

  function meta() {
    var live = App.DB.reservations.filter(function (r) {
      return ['PENDING', 'CONFIRMED', 'CHECKED_IN'].indexOf(r.status) !== -1;
    });
    S.meta([['Guests', App.DB.guests.length],
            ['Reservations', App.DB.reservations.length],
            ['Live', live.length],
            ['Rooms', App.DB.rooms.length]]);
  }

  /* ---------------------------------------------------------------------- *
   * Reservations, with the action each status actually allows.
   *
   * A booking cannot be checked in before it is confirmed, and cannot be
   * checked out before it is checked in. Offering every action on every row
   * and rejecting most of them afterwards is how staff learn to distrust a
   * screen, so the row only offers what its status permits.
   * -------------------------------------------------------------------- */
  var NEXT = {
    PENDING:     [['CONFIRMED', 'Confirm'], ['CANCELLED', 'Cancel']],
    CONFIRMED:   [['CHECKED_IN', 'Check in'], ['CANCELLED', 'Cancel']],
    CHECKED_IN:  [['CHECKED_OUT', 'Check out']],
    CHECKED_OUT: [],
    CANCELLED:   []
  };

  var COLUMNS = [
    { head: 'Reference', cls: 'mono', cell: function (r) {
      return '<strong>' + S.esc(r.reference_number) + '</strong>';
    } },
    { head: 'Guest', cls: 'nowrap', cell: function (r) {
      var g = Q.one(App.DB.guests, 'guest_id', r.guest_id);
      return '<a href="#" data-guest="' + r.guest_id + '">' +
        S.esc(g ? g.full_name : 'Unknown') + '</a>';
    } },
    { head: 'Room', cls: 'mono', cell: function (r) {
      return S.esc(r.room_number_snapshot);
    } },
    { head: 'Nights', cls: 'nowrap', cell: function (r) {
      return S.esc(S.shortDate(r.check_in_date)) + ' – ' +
             S.esc(S.shortDate(r.check_out_date)) +
             '<div class="who-cell__sub">' + r.total_nights + ' nights</div>';
    } },
    { head: 'Total', cls: 'table__num mono', cell: function (r) {
      return S.esc(S.peso(r.total_amount));
    } },
    { head: 'Balance', cls: 'table__num mono', cell: function (r) {
      return Number(r.balance) > 0
        ? '<span class="tag tag--warn">' + S.esc(S.peso(r.balance)) + '</span>'
        : '<span class="muted">settled</span>';
    } },
    { head: 'Status', cell: function (r) {
      var st = Q.resStatus(r.status);
      return '<span class="tag tag--' + st.tag + '">' + S.esc(st.text) + '</span>';
    } },
    { head: 'Actions', cls: 'table__act', cell: function (r) {
      var btns = (NEXT[r.status] || []).map(function (n) {
        return '<button class="btn btn--sm" data-move="' + r.reservation_id +
          '" data-to="' + n[0] + '">' + n[1] + '</button>';
      });
      if (Number(r.balance) > 0 && r.status !== 'CANCELLED') {
        btns.unshift('<button class="btn btn--sm" data-pay="' + r.reservation_id +
          '">Payment</button>');
      }
      btns.push('<button class="btn btn--sm" data-bill="' + r.reservation_id +
        '">Bill</button>');
      return btns.join(' ');
    } }
  ];

  function reservations() {
    var rows = App.DB.reservations.filter(function (r) {
      return statusFilter === 'all' || r.status === statusFilter;
    }).sort(function (a, b) { return a.check_in_date < b.check_in_date ? 1 : -1; });

    var host = S.el('#list');
    host.innerHTML = S.table(COLUMNS, rows, 'No reservation with that status.');

    S.els('[data-guest]', host).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault(); selected = Number(a.dataset.guest); profile();
      });
    });
    S.els('[data-move]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        moveStatus(Number(b.dataset.move), b.dataset.to);
      });
    });
    S.els('[data-pay]', host).forEach(function (b) {
      b.addEventListener('click', function () { payment(Number(b.dataset.pay)); });
    });
    S.els('[data-bill]', host).forEach(function (b) {
      b.addEventListener('click', function () { billing(Number(b.dataset.bill)); });
    });
  }

  /* ---------------------------------------------------------------------- *
   * Status change — confirm, check in, check out, cancel.
   * -------------------------------------------------------------------- */
  function moveStatus(id, to) {
    var r = Q.one(App.DB.reservations, 'reservation_id', id);
    var g = Q.one(App.DB.guests, 'guest_id', r.guest_id);
    var label = Q.resStatus(to).text;

    var warn = '';
    if (to === 'CHECKED_OUT' && Number(r.balance) > 0) {
      warn = '<div class="note note--warn" style="margin-bottom:12px">' +
        '<span class="note__icon">' + S.icon('alert', 15) + '</span>' +
        '<div><strong>' + S.esc(S.peso(r.balance)) + ' is still outstanding.</strong> ' +
        'Checking out with a balance leaves the university chasing it afterwards. ' +
        'Record the payment first unless a charge slip covers it.</div></div>';
    }

    var record = { reservation_id: r.reservation_id, status: to };
    if (to === 'CHECKED_IN') record.checked_in_at = S.today() + ' 14:00:00';
    if (to === 'CHECKED_OUT') record.checked_out_at = S.today() + ' 12:00:00';

    S.dialog({
      title: label + ' — ' + r.reference_number,
      okText: label,
      body: warn +
        '<div class="kv" style="margin-bottom:14px">' +
          kv('Guest', S.esc(g ? g.full_name : '')) +
          kv('Room', S.esc(r.room_number_snapshot) + ' · ' +
             S.esc(r.room_type_snapshot)) +
          kv('Nights', S.esc(r.check_in_date) + ' to ' + S.esc(r.check_out_date)) +
          kv('Total', S.esc(S.peso(r.total_amount))) +
          kv('Balance', S.esc(S.peso(r.balance))) +
          kv('Moving from', Q.resStatus(r.status).text + ' to ' + label) +
        '</div><div id="rOut"></div>',
      onOk: function (root) {
        S.el('#rOut', root).innerHTML = S.wouldWrite('reservations', record,
          'This is the update that would be written. The status trigger then ' +
          'writes a matching audit_logs entry by itself — that part already works.');
        return false;
      }
    });
  }

  /* ---------------------------------------------------------------------- *
   * New reservation.
   *
   * The room list offers only rooms actually free for the chosen nights, so
   * a double booking cannot be created from this form in the first place.
   * -------------------------------------------------------------------- */
  function book() {
    var today = S.today();
    var rooms = Q.roomsWithType();

    S.dialog({
      title: 'New reservation',
      okText: 'Create reservation',
      body:
        '<div class="row">' +
          '<div class="field"><label class="field__label" for="guest_id">Guest</label>' +
            '<select class="select" id="guest_id" name="guest_id">' +
              App.DB.guests.map(function (g) {
                return '<option value="' + g.guest_id + '">' + S.esc(g.full_name) + '</option>';
              }).join('') + '</select>' +
            '<div class="field__hint">Not listed? Register the guest first.</div>' +
          '</div>' +
        '</div>' +
        '<div class="row">' +
          '<div class="field"><label class="field__label" for="check_in_date">Check in</label>' +
            '<input class="input" type="date" id="check_in_date" name="check_in_date" value="' +
            today + '"></div>' +
          '<div class="field"><label class="field__label" for="check_out_date">Check out</label>' +
            '<input class="input" type="date" id="check_out_date" name="check_out_date" value="' +
            S.addDays(today, 1) + '"></div>' +
        '</div>' +
        '<div class="field"><label class="field__label" for="room_id">Room</label>' +
          '<select class="select" id="room_id" name="room_id"></select>' +
          '<div class="field__hint" id="roomHint"></div></div>' +
        '<div class="field"><label class="field__label" for="number_of_guests">Guests' +
          '</label><input class="input" type="number" id="number_of_guests" ' +
          'name="number_of_guests" value="1" min="1"></div>' +
        '<div class="field"><label class="field__label" for="notes">Notes ' +
          '<span class="muted">optional</span></label>' +
          '<textarea class="textarea" id="notes" name="notes"></textarea></div>' +
        '<div id="bOut"></div>',
      onOk: function (root) {
        var v = S.readForm(root);
        var errs = {};
        if (!v.check_in_date) errs.check_in_date = 'Pick a check-in date.';
        if (!v.check_out_date) errs.check_out_date = 'Pick a check-out date.';
        if (v.check_in_date && v.check_out_date && v.check_out_date <= v.check_in_date) {
          errs.check_out_date = 'Check out must be after check in.';
        }
        if (!v.room_id) errs.room_id = 'No room is free for those nights.';
        var room = Q.one(App.DB.rooms, 'room_id', Number(v.room_id));
        if (room && Number(v.number_of_guests) > Number(room.capacity)) {
          errs.number_of_guests = 'That room sleeps ' + room.capacity + '.';
        }
        if (!S.markErrors(root, errs)) return false;

        var nights = nightsBetween(v.check_in_date, v.check_out_date);
        var type = Q.one(App.DB.room_types, 'room_type_id', room.room_type_id);
        var record = {
          reference_number: nextReference(),
          guest_id: Number(v.guest_id),
          room_id: room.room_id,
          room_number_snapshot: room.room_number,
          room_type_snapshot: type ? type.type_name : '',
          rate_per_night_snapshot: Number(room.rate_per_night),
          check_in_date: v.check_in_date,
          check_out_date: v.check_out_date,
          number_of_guests: Number(v.number_of_guests),
          total_nights: nights,
          total_amount: Math.round(nights * Number(room.rate_per_night) * 100) / 100,
          paid_amount: 0,
          status: 'PENDING',
          notes: v.notes || null,
          handled_by: Q.me().user_id
        };

        S.el('#bOut', root).innerHTML = S.wouldWrite('reservations', record,
          nights + (nights === 1 ? ' night' : ' nights') + ' at ' +
          S.peso(room.rate_per_night) + ' = ' + S.peso(record.total_amount) +
          '. The rate and room name are copied onto the booking so a later ' +
          'price change cannot rewrite an old receipt.');
        S.el('#bOut', root).scrollIntoView({ block: 'nearest' });
        return false;
      }
    });

    /* keep the room list honest as the dates change */
    function refresh() {
      var from = S.el('.modal [name="check_in_date"]').value;
      var to = S.el('.modal [name="check_out_date"]').value;
      var free = rooms.filter(function (r) {
        return r.status !== 'MAINTENANCE' && isFree(r.room_id, from, to);
      });
      S.el('.modal [name="room_id"]').innerHTML = free.map(function (r) {
        return '<option value="' + r.room_id + '">' + S.esc(r.room_number) + ' · ' +
          S.esc(r.type_name) + ' · ' + S.esc(S.peso(r.rate_per_night)) +
          ' · sleeps ' + r.capacity + '</option>';
      }).join('');
      var out = App.DB.rooms.length - free.length;
      S.el('#roomHint').textContent = free.length
        ? free.length + ' of ' + App.DB.rooms.length + ' rooms free for those nights' +
          (out ? ' · ' + out + ' held or under maintenance' : '')
        : 'No room is free for those nights.';
    }
    S.els('.modal [name="check_in_date"], .modal [name="check_out_date"]')
      .forEach(function (i) { i.addEventListener('change', refresh); });
    refresh();
  }

  function isFree(roomId, from, to) {
    if (!from || !to || to <= from) return false;
    return !App.DB.reservations.some(function (r) {
      return r.room_id === roomId &&
        ['PENDING', 'CONFIRMED', 'CHECKED_IN'].indexOf(r.status) !== -1 &&
        r.check_in_date < to && from < r.check_out_date;
    });
  }

  function nightsBetween(a, b) {
    return Math.round((S.parseIso(b) - S.parseIso(a)) / 86400000);
  }

  function nextReference() {
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
    var n = App.DB.reservations.length + 1;
    return 'BPSU-RES-' + stamp + '-' + String(n).padStart(4, '0');
  }

  /* ---------------------------------------------------------------------- *
   * Payment entry.
   * -------------------------------------------------------------------- */
  var METHODS = [
    ['CASH', 'Cash'],
    ['UNIVERSITY_CHARGE_SLIP', 'University charge slip'],
    ['BANK_TRANSFER', 'Bank transfer'],
    ['GCASH_MANUAL_REF', 'GCash, reference entered by hand']
  ];

  function payment(id) {
    var r = Q.one(App.DB.reservations, 'reservation_id', id);
    var g = Q.one(App.DB.guests, 'guest_id', r.guest_id);

    S.dialog({
      title: 'Record payment — ' + r.reference_number,
      okText: 'Record payment',
      body:
        '<div class="kv" style="margin-bottom:14px">' +
          kv('Guest', S.esc(g ? g.full_name : '')) +
          kv('Total', S.esc(S.peso(r.total_amount))) +
          kv('Paid so far', S.esc(S.peso(r.paid_amount))) +
          kv('Balance', '<strong>' + S.esc(S.peso(r.balance)) + '</strong>') +
        '</div>' +
        '<div class="row">' +
          '<div class="field"><label class="field__label" for="amount">Amount</label>' +
            '<input class="input" type="number" step="0.01" min="0.01" id="amount" ' +
            'name="amount" value="' + r.balance + '"></div>' +
          '<div class="field"><label class="field__label" for="payment_method">Method</label>' +
            '<select class="select" id="payment_method" name="payment_method">' +
              METHODS.map(function (m) {
                return '<option value="' + m[0] + '">' + S.esc(m[1]) + '</option>';
              }).join('') + '</select></div>' +
        '</div>' +
        '<div class="field"><label class="field__label" for="reference_code">Reference ' +
          '<span class="muted">charge slip or bank reference</span></label>' +
          '<input class="input" type="text" id="reference_code" name="reference_code"></div>' +
        '<div id="pOut"></div>',
      onOk: function (root) {
        var v = S.readForm(root);
        var errs = {};
        var amt = Number(v.amount);
        if (!amt || amt <= 0) errs.amount = 'Enter an amount greater than zero.';
        else if (amt > Number(r.balance)) {
          errs.amount = 'That is more than the ' + S.peso(r.balance) + ' outstanding.';
        }
        if (v.payment_method !== 'CASH' && !v.reference_code) {
          errs.reference_code = 'A non-cash payment needs its reference recorded.';
        }
        if (!S.markErrors(root, errs)) return false;

        S.el('#pOut', root).innerHTML = S.wouldWrite('payments', {
          reservation_id: r.reservation_id,
          receipt_number: 'OR-' + new Date().getFullYear() + '-' +
            String(90000 + App.DB.payments.length + 1),
          amount: Math.round(amt * 100) / 100,
          payment_method: v.payment_method,
          reference_code: v.reference_code || null,
          received_by: Q.me().user_id
        }, 'Inserting this row is all that is needed: trg_payment_after_insert ' +
           'then raises paid_amount, recalculates the balance, and writes the ' +
           'audit entry by itself. That trigger is tested and working.');
        return false;
      }
    });
  }

  /* ---------------------------------------------------------------------- *
   * Billing statement and receipt.
   *
   * Built from the rate stored on the booking, never from the room's current
   * rate, so a price change cannot alter a statement that was already issued.
   * -------------------------------------------------------------------- */
  function billing(id) {
    var r = Q.one(App.DB.reservations, 'reservation_id', id);
    var g = Q.one(App.DB.guests, 'guest_id', r.guest_id);
    var paid = Q.paymentsFor(r.reservation_id);

    S.dialog({
      title: 'Billing statement — ' + r.reference_number,
      cancelText: 'Close',
      okText: 'Print',
      onOk: function () { window.print(); return false; },
      body:
        '<div class="kv" style="margin-bottom:14px">' +
          kv('Guest', S.esc(g ? g.full_name : '')) +
          kv('Reference', '<span class="mono">' + S.esc(r.reference_number) + '</span>') +
          kv('Room', S.esc(r.room_number_snapshot) + ' · ' + S.esc(r.room_type_snapshot)) +
          kv('Stay', S.esc(r.check_in_date) + ' to ' + S.esc(r.check_out_date)) +
        '</div>' +
        '<div class="label">Charges</div>' +
        line(r.total_nights + ' nights at ' + S.peso(r.rate_per_night_snapshot),
             S.peso(r.total_amount)) +
        '<div class="label" style="margin-top:14px">Payments received</div>' +
        (paid.length ? paid.map(function (p) {
          return line(S.shortDate(p.payment_date) + ' · ' +
            Q.category(p.payment_method) +
            (p.reference_code ? ' · ' + p.reference_code : '') +
            ' · ' + p.receipt_number, '− ' + S.peso(p.amount));
        }).join('') : '<div class="metric__note" style="padding:4px 0">Nothing received yet.</div>') +
        '<div style="border-top:2px solid var(--ink-900);margin-top:12px;padding-top:8px">' +
          line('<strong>Balance due</strong>', '<strong>' + S.peso(r.balance) + '</strong>') +
        '</div>'
    });
  }

  function line(left, right) {
    return '<div class="rowitem" style="padding:5px 0;border-bottom:none">' +
      '<span class="rowitem__main"><span class="rowitem__title" ' +
        'style="font-weight:400">' + left + '</span></span>' +
      '<span class="rowitem__end mono">' + right + '</span></div>';
  }

  /* ---------------------------------------------------------------------- *
   * Guest registration.
   * -------------------------------------------------------------------- */
  function registerGuest() {
    S.dialog({
      title: 'Register guest',
      okText: 'Register',
      body:
        '<div class="row">' +
          gf('Full name', 'full_name', 'text') + gf('Contact number', 'phone', 'text') +
        '</div>' +
        '<div class="row">' +
          gf('Email', 'email', 'email') + gf('ID presented', 'id_type', 'text') +
        '</div>' +
        '<div class="row">' +
          gf('ID number', 'id_number', 'text') + gf('Address', 'address', 'text') +
        '</div>' +
        '<div id="gOut"></div>',
      onOk: function (root) {
        var v = S.readForm(root);
        var errs = {};
        if (!v.full_name) errs.full_name = 'A name is required.';
        if (!v.phone && !v.email) {
          errs.phone = 'Record at least one way to reach the guest.';
        }
        if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) {
          errs.email = 'That does not look like an email address.';
        }
        if (!v.id_type) errs.id_type = 'Record what identification was presented.';
        if (!S.markErrors(root, errs)) return false;

        S.el('#gOut', root).innerHTML = S.wouldWrite('guests', {
          guest_user_id: null,
          full_name: v.full_name,
          email: v.email || null,
          phone: v.phone || null,
          id_type: v.id_type,
          id_number: v.id_number || null,
          address: v.address || null
        }, 'guest_user_id stays empty for a walk-in. It is filled only when the ' +
           'guest also holds a sign-in account.');
        return false;
      }
    });
  }

  function gf(label, name, type) {
    return '<div class="field"><label class="field__label" for="' + name + '">' +
      S.esc(label) + '</label><input class="input" type="' + type + '" id="' + name +
      '" name="' + name + '"></div>';
  }

  /* ---------------------------------------------------------------------- *
   * Rooms and availability.
   * -------------------------------------------------------------------- */
  function rooms() {
    var from = S.el('#avFrom').value, to = S.el('#avTo').value;
    var checking = from && to && to > from;

    S.el('#rooms').innerHTML = S.table([
      { head: 'Room', cls: 'mono', cell: function (r) {
        return '<strong>' + S.esc(r.room_number) + '</strong>';
      } },
      { head: 'Type', cell: function (r) { return S.esc(r.type_name); } },
      { head: 'Rate', cls: 'table__num mono', cell: function (r) {
        return S.esc(S.peso(r.rate_per_night));
      } },
      { head: 'Sleeps', cls: 'table__num mono', cell: function (r) { return r.capacity; } },
      { head: 'Status', cell: function (r) {
        var st = Q.roomStatus(r.status);
        return '<span class="tag tag--' + st.tag + '">' + S.esc(st.text) + '</span>';
      } },
      { head: checking ? 'For those nights' : 'Availability', cell: function (r) {
        if (!checking) return '<span class="muted">pick two dates</span>';
        if (r.status === 'MAINTENANCE') {
          return '<span class="tag tag--stop">Out of service</span>';
        }
        return isFree(r.room_id, from, to)
          ? '<span class="tag tag--ok">Free</span>'
          : '<span class="tag tag--warn">Held</span>';
      } }
    ], Q.roomsWithType());
  }

  /* ---------------------------------------------------------------------- *
   * Guest details profile menu, with stay history.
   * -------------------------------------------------------------------- */
  function profile() {
    var list = App.DB.guests.map(function (g) {
      return '<button class="qa__item' + (g.guest_id === selected ? ' is-on' : '') +
        '" data-pick="' + g.guest_id + '">' +
        '<span class="avatar">' + S.esc(S.initials(g.full_name)) + '</span>' +
        '<span class="qa__text">' + S.esc(g.full_name) + '</span></button>';
    }).join('');

    var g = Q.one(App.DB.guests, 'guest_id', selected);
    var detail = !g ? '<div class="empty">No guest selected.</div>' :
      '<div style="padding:13px">' +
        '<div class="kv">' +
          kv('Guest number', String(g.guest_id)) +
          kv('Full name', S.esc(g.full_name)) +
          kv('Contact number', S.esc(g.phone || '—')) +
          kv('Email address', S.esc(g.email || '—')) +
          kv('Address', S.esc(g.address || '—')) +
          kv('ID presented', S.esc(g.id_type || '—')) +
          kv('ID number', S.esc(g.id_number || '—')) +
          kv('Linked account', linkedAccount(g)) +
        '</div>' + stays(g.guest_id) +
      '</div>';

    S.el('#guest').innerHTML =
      '<div class="qa" style="border-bottom:1px solid var(--line)">' + list + '</div>' + detail;

    S.els('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        selected = Number(b.dataset.pick); profile();
      });
    });
  }

  function linkedAccount(g) {
    if (!g.guest_user_id) return 'Walk-in, no account';
    var u = Q.one(App.DB.users, 'user_id', g.guest_user_id);
    return u ? S.esc(u.username) + ' · ' + S.esc(Q.roleLabel(u.role))
             : 'Account no. ' + g.guest_user_id;
  }

  function stays(guestId) {
    var rows = Q.guestHistory(guestId);
    if (!rows.length) {
      return '<div class="empty" style="padding:16px 0">No reservations on file.</div>';
    }
    var billed = rows.reduce(function (n, r) {
      return r.status === 'CANCELLED' ? n : n + Number(r.total_amount);
    }, 0);
    var owed = rows.reduce(function (n, r) {
      return r.status === 'CANCELLED' ? n : n + Number(r.balance);
    }, 0);

    return '<div style="margin-top:12px">' +
      '<div class="label">Stay history</div>' +
      rows.map(function (r) {
        var st = Q.resStatus(r.status);
        return '<div class="rowitem" style="padding:7px 0">' +
          '<span class="tag tag--' + st.tag + '">' + S.esc(st.text) + '</span>' +
          '<span class="rowitem__main">' +
            '<span class="rowitem__title">Room ' + S.esc(r.room_number_snapshot) + '</span>' +
            '<span class="rowitem__sub mono">' + S.esc(r.reference_number) + '</span>' +
            '<span class="rowitem__sub">' + S.esc(S.shortDate(r.check_in_date)) +
              ' to ' + S.esc(S.shortDate(r.check_out_date)) + ' · ' +
              r.total_nights + ' nights</span>' +
          '</span>' +
          '<span class="rowitem__end">' + S.esc(S.peso(r.total_amount)) +
            (Number(r.balance) > 0
              ? '<br><span class="tag tag--warn">' + S.esc(S.peso(r.balance)) + ' due</span>'
              : '') +
          '</span></div>';
      }).join('') +
      '<div style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px">' +
        line('Billed across ' + rows.length + ' stays', S.peso(billed)) +
        line('<strong>Outstanding</strong>', '<strong>' + S.peso(owed) + '</strong>') +
      '</div></div>';
  }

  function kv(k, v) {
    return '<div class="kv__k">' + S.esc(k) + '</div><div>' + v + '</div>';
  }
})(window.App = window.App || {});
