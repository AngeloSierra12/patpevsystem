/* ============================================================================
 * dashboard.js — Dashboard
 * Angelo Andrei P. Sierra — Frontend and UI/UX Developer
 *
 * Charter deliverable: "Dashboard — an administrative dashboard displaying
 * room occupancy status, current reservations, inventory status, low-stock
 * alerts, and system summary and statistics."
 *
 * Every figure on this screen is counted from the records in App.DB, which is
 * generated from the project database seed. Nothing here is invented and
 * nothing is hard-coded. When the API layer exists, App.Q is the only file
 * that changes.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var Q = App.Q;

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Dashboard', nav: 'dashboard' });
    S.meta([['Rooms', App.DB.rooms.length],
            ['Reservations', App.DB.reservations.length],
            ['Items', App.DB.inventory_items.length]]);

    metrics();
    occupancy();
    stock();
    quickActions();
    alerts();

    S.el('#btnRefresh').addEventListener('click', function () {
      location.reload();
    });
  });

  /* ---------------------------------------------------------------------- *
   * Metric strip — four figures, never more.
   *
   * Occupancy, rooms free, arrivals today and low stock are what a duty
   * officer acts on when they sit down. A fifth tile wraps the row on a
   * laptop and weakens the hierarchy, so anything else belongs in a panel.
   * -------------------------------------------------------------------- */
  function metrics() {
    var by = Q.roomsByStatus();
    var rate = Q.occupancyRate();
    var today = S.today();
    var arriving = Q.arrivalsOn(today).length;
    var leaving = Q.departuresOn(today).length;
    var low = Q.lowStockItems();
    var critical = Q.criticalStockItems();

    S.el('#metrics').innerHTML =
      tile('Occupancy', rate, '%', bar(rate),
        (by.OCCUPIED || 0) + ' occupied, ' + (by.RESERVED || 0) + ' reserved') +

      tile('Rooms free', by.AVAILABLE || 0, 'of ' + App.DB.rooms.length, '',
        (by.MAINTENANCE || 0) + ' out for maintenance') +

      tile('Arrivals today', arriving, '', '',
        leaving ? leaving + (leaving === 1 ? ' departure' : ' departures') + ' today'
                : 'no departures today') +

      tile('Low stock', low.length, low.length === 1 ? 'item' : 'items', '',
        critical.length ? critical.length + ' at critical level' : 'none critical');
  }

  function tile(label, value, unit, extra, note) {
    return '<div class="metric">' +
      '<div class="metric__label">' + S.esc(label) + '</div>' +
      '<div class="metric__value">' + S.esc(String(value)) +
        (unit ? ' <span class="metric__unit">' + S.esc(unit) + '</span>' : '') + '</div>' +
      '<div class="metric__note">' + S.esc(note) + '</div>' + extra +
    '</div>';
  }

  function bar(pct) {
    return '<div class="metric__bar"><i style="width:' +
      Math.max(0, Math.min(100, pct)) + '%"></i></div>';
  }

  /* ---------------------------------------------------------------------- *
   * Room occupancy — seven nights.
   *
   * A week of columns answers "are we filling up" faster than a table, and
   * today is marked so the reader has an anchor. Room status alone cannot
   * answer this: a room held for next Tuesday is not occupied today.
   * -------------------------------------------------------------------- */
  function occupancy() {
    var wk = Q.occupancyWeek();
    var rooms = App.DB.rooms.length;
    var today = S.today();
    var peak = Math.max.apply(null, wk.days.map(function (d) { return d.held; }).concat([1]));

    var cols = wk.days.map(function (d) {
      var h = Math.round(d.held / Math.max(peak, 1) * 100);
      var isToday = d.date === today;
      return '<div class="col' + (isToday ? ' col--today' : '') + '">' +
        '<div class="col__bar' + (d.held ? '' : ' col__bar--none') + '" ' +
          'style="height:' + (d.held ? Math.max(h, 8) : 3) + '%" ' +
          'title="' + S.esc(S.shortDate(d.date)) + ': ' + d.held + ' of ' + rooms + '">' +
          '<span class="col__n">' + d.held + '</span></div>' +
        '<div class="col__foot">' + S.esc(S.dowShort(d.date)) + '<br>' +
          S.esc(String(S.dayNum(d.date))) + '</div>' +
      '</div>';
    }).join('');

    var held = wk.days.reduce(function (n, d) { return n + d.held; }, 0);
    var note = wk.shifted
      ? 'No rooms are held in the coming week. Showing the last week with ' +
        'bookings, from ' + S.shortDate(wk.start) + '.'
      : held + (held === 1 ? ' room-night' : ' room-nights') +
        ' held across the week, peaking at ' + peak + ' of ' + rooms + '.';

    S.el('#occupancy').innerHTML =
      '<div class="cols">' + cols + '</div>' +
      '<div class="metric__note" style="margin-top:10px">' + S.esc(note) + '</div>';
  }

  /* ---------------------------------------------------------------------- *
   * Canteen stock levels — worst first.
   *
   * Each bar is the quantity on hand against the reorder point, so a full bar
   * means "at the level we reorder at", not "full shelf". Sorting by how close
   * an item is to that point puts the ones needing attention at the top,
   * which is the only ordering that makes the panel worth scanning.
   * -------------------------------------------------------------------- */
  function stock() {
    var items = Q.stockLevels().slice(0, 7);

    S.el('#stock').innerHTML = items.map(function (i) {
      var reorder = Number(i.reorder_level) || 1;
      var pct = Math.min(100, Math.round(Number(i.current_stock) / reorder * 100));
      var st = Q.stockState(i);
      var fill = st.tag === 'stop' ? 'var(--stop-700)'
               : st.tag === 'warn' ? 'var(--warn-700)' : 'var(--red-700)';
      return '<div class="bar">' +
        '<span class="bar__label" title="' + S.esc(i.item_name) + '">' +
          S.esc(i.item_name) + '</span>' +
        '<span class="bar__track">' +
          '<i class="bar__fill" style="width:' + pct + '%;background:' + fill + '"></i>' +
        '</span>' +
        '<span class="bar__value">' + S.esc(String(i.current_stock)) + ' ' +
          S.esc(i.unit) + '</span>' +
      '</div>';
    }).join('') +
    '<div class="metric__note" style="margin-top:8px">' +
      'Quantity on hand against each item’s reorder point. ' +
      'Showing ' + items.length + ' of ' + App.DB.inventory_items.length + '.' +
    '</div>';
  }

  /* ---------------------------------------------------------------------- *
   * Low stock alerts.
   *
   * A warning has to name the item and say how far below the line it is. A
   * chart would hide exactly the detail that makes the alert worth showing.
   * -------------------------------------------------------------------- */
  function alerts() {
    var low = Q.lowStockItems();

    if (!low.length) {
      S.el('#alerts').innerHTML =
        '<div class="empty">' + S.icon('check', 24) +
        'Every item is above its reorder point.</div>';
      return;
    }

    S.el('#alerts').innerHTML = low.map(function (i) {
      var st = Q.stockState(i);
      var short = Number(i.reorder_level) - Number(i.current_stock);
      return '<div class="rowitem">' +
        '<span class="rowitem__main">' +
          '<span class="rowitem__title">' + S.esc(i.item_name) + '</span>' +
          '<span class="rowitem__sub">' + S.esc(i.current_stock + ' ' + i.unit) +
            ' on hand · reorder at ' + S.esc(String(i.reorder_level)) +
            (short > 0 ? ' · short by ' + S.esc(String(Math.round(short * 1000) / 1000)) : '') +
          '</span>' +
        '</span>' +
        '<span class="tag tag--' + st.tag + '">' + S.esc(st.text) + '</span>' +
      '</div>';
    }).join('');
  }

  /* ---------------------------------------------------------------------- *
   * Quick actions — shortcuts to the task a user arrived wanting to do.
   * Entries whose destination is not built stay visible but inert, so the
   * panel shows the finished shape of the system rather than hiding half.
   * -------------------------------------------------------------------- */
  var ACTIONS = [
    { text: 'New reservation',   icon: 'plus',     href: 'pages/reservations.html#new' },
    { text: 'Guest details',     icon: 'account',  href: 'pages/reservations.html' },
    { text: 'Record stock',      icon: 'box',      href: 'pages/inventory.html#movement' },
    { text: 'Open calendar',     icon: 'calendar', href: 'pages/calendar.html' },
    { text: 'User management',   icon: 'users',    href: 'pages/users.html' },
    { text: 'Report summary',    icon: 'report',   href: 'pages/reports.html' }
  ];

  function quickActions() {
    S.el('#quick').innerHTML = '<div class="qa">' + ACTIONS.map(function (a) {
      return '<a class="qa__item" href="' + App.path(a.href) + '">' +
        '<span class="qa__ico">' + S.icon(a.icon, 15) + '</span>' +
        '<span class="qa__text">' + S.esc(a.text) + '</span>' +
      '</a>';
    }).join('') + '</div>';
  }
})(window.App = window.App || {});
