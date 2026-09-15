/* ============================================================================
 * reservations.js — Hotel Reservation
 *
 * WBS 5.4 Guest Details Profile Menu . Angelo Andrei P. Sierra  (this file)
 * WBS 5.1 UI wireframing ............. Andrew Jacob E. Santos
 * WBS 5.2 Room status and pricing .... John Carlos R. Capuli
 * WBS 5.3 Reservation, check-in/out .. John Carlos R. Capuli
 * WBS 5.5 Billing and receipts ....... John Carlos R. Capuli
 *
 * Reads guests and their reservations. Creating or changing a booking is not
 * this developer's task.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var selected = null;

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Hotel Reservation', nav: 'reservations' });
    S.meta([
      ['Guests', App.DB.guests.length],
      ['Reservations', App.DB.reservations.length],
      ['Rooms', App.DB.rooms.length]
    ]);

    S.el('#notice').innerHTML =
      '<div class="note note--flat">' +
        '<span class="note__icon">' + S.icon('info', 15) + '</span>' +
        '<div>Booking, check-in and billing belong to the reservation logic, ' +
        'which is a separate task. This screen provides the ' +
        '<strong>guest details profile menu</strong>.</div>' +
      '</div>';

    selected = App.DB.guests[0].guest_id;
    renderRooms();
    renderProfile();
  });

  /* Room state comes from the rooms table. Changing it is WBS 5.2. */
  function renderRooms() {
    S.el('#list').innerHTML = S.table([
      { head: 'Room', cls: 'mono', cell: function (r) {
        return '<strong>' + S.esc(r.room_number) + '</strong>';
      } },
      { head: 'Type', cell: function (r) { return S.esc(r.type_name); } },
      { head: 'Rate', cls: 'table__num mono', cell: function (r) {
        return S.esc(S.peso(r.rate_per_night));
      } },
      { head: 'Capacity', cls: 'table__num mono', cell: function (r) { return r.capacity; } },
      { head: 'Status', cell: function (r) { return statusTag(App.Q.roomStatus(r.status)); } }
    ], App.Q.roomsWithType()) +
      S.owned('John Carlos R. Capuli', 'Booking, check-in and check-out',
        'Creating, confirming, modifying and cancelling reservations, and ' +
        'recording payments and receipts.');
  }

  function statusTag(st) {
    return '<span class="tag tag--' + st.tag + '">' + S.esc(st.text) + '</span>';
  }

  /* ---------------------------------------------------------------------- *
   * WBS 5.4 — Guest Details Profile Menu
   * -------------------------------------------------------------------- */
  function renderProfile() {
    var list = App.DB.guests.map(function (g) {
      return '<button class="qa__item" data-guest="' + g.guest_id + '"' +
        (g.guest_id === selected ? ' style="background:var(--red-050)"' : '') + '>' +
        '<span class="avatar">' + S.esc(S.initials(g.full_name)) + '</span>' +
        '<span class="qa__text">' + S.esc(g.full_name) + '</span>' +
      '</button>';
    }).join('');

    var g = App.Q.one(App.DB.guests, 'guest_id', selected);

    var detail = !g ? '<div class="empty">No guest selected.</div>' :
      '<div style="padding:13px">' +
        '<div class="kv">' +
          kv('guest_id', '<code>' + g.guest_id + '</code>') +
          kv('Full name', S.esc(g.full_name)) +
          kv('Contact number', S.esc(g.phone || '—')) +
          kv('Email address', S.esc(g.email || '—')) +
          kv('Address', S.esc(g.address || '—')) +
          kv('ID presented', S.esc(g.id_type || '—')) +
          kv('ID number', '<code>' + S.esc(g.id_number || '—') + '</code>') +
          kv('Linked account', g.guest_user_id
            ? '<code>user_id ' + g.guest_user_id + '</code>'
            : 'Walk-in, no account') +
        '</div>' +
        stays(g.guest_id) +
      '</div>';

    S.el('#guest').innerHTML =
      '<div class="qa" style="border-bottom:1px solid var(--line)">' + list + '</div>' +
      detail;

    S.els('[data-guest]').forEach(function (b) {
      b.addEventListener('click', function () {
        selected = Number(b.dataset.guest);
        renderProfile();
      });
    });
  }

  /* stay history straight from the reservations table */
  function stays(guestId) {
    var rows = App.Q.guestHistory(guestId);
    if (!rows.length) {
      return '<div class="empty" style="padding:16px 0">No reservations on file.</div>';
    }
    return '<div style="margin-top:12px">' +
      '<div class="label">Stay history</div>' +
      rows.map(function (r) {
        var owed = Number(r.balance) > 0;
        return '<div class="rowitem" style="padding:7px 0">' +
          statusTag(App.Q.resStatus(r.status)) +
          '<span class="rowitem__main">' +
            '<span class="rowitem__title">Room ' + S.esc(r.room_number_snapshot) + '</span>' +
            '<span class="rowitem__sub mono">' + S.esc(r.reference_number) + '</span>' +
            '<span class="rowitem__sub">' + S.esc(S.shortDate(r.check_in_date)) +
              ' to ' + S.esc(S.shortDate(r.check_out_date)) + ' · ' +
              r.total_nights + ' nights</span>' +
          '</span>' +
          '<span class="rowitem__end">' + S.esc(S.peso(r.total_amount)) +
            (owed ? '<br><span class="tag tag--warn">' + S.esc(S.peso(r.balance)) +
                    ' due</span>' : '') +
          '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  function kv(k, v) {
    return '<div class="kv__k">' + k + '</div><div>' + v + '</div>';
  }
})(window.App = window.App || {});
