/* ============================================================================
 * dashboard.js — Dashboard
 *
 * WBS 8.1 Dashboard UI layout ....... Angelo Andrei P. Sierra   (this file)
 * WBS 8.3 Quick actions panel ....... Angelo Andrei P. Sierra   (this file)
 * WBS 8.2 Hotel metrics integration . Andrew Jacob E. Santos    (placeholder)
 *
 * The layout and the quick actions panel are built. The figures that fill the
 * metric strip, the occupancy panel and the stock panel come from the metrics
 * integration, which is not this developer's task, so those regions show what
 * belongs there and who is building it.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Dashboard', nav: 'dashboard' });
    S.meta([['Rooms', App.DB.rooms.length],
            ['Reservations', App.DB.reservations.length],
            ['Items', App.DB.inventory_items.length]]);

    metricsRegion();
    occupancyRegion();
    stockRegion();
    quickActions();
    alertsRegion();

    S.el('#btnRefresh').addEventListener('click', function () {
      location.reload();
    });
  });

  /* --- regions owned by the metrics integration (WBS 8.2) ----------------- */
  function metricsRegion() {
    S.el('#metrics').outerHTML =
      S.owned('Andrew Jacob E. Santos', 'Metric strip',
        'Occupancy rate, rooms available, arrivals today and low stock count, ' +
        'read from the hostel and canteen records.');
  }

  function occupancyRegion() {
    S.el('#occupancy').innerHTML = S.owned(
      'Andrew Jacob E. Santos', null,
      'Rooms held per night across the coming week.');
  }

  function stockRegion() {
    S.el('#stock').innerHTML = S.owned(
      'Andrew Jacob E. Santos', null,
      'Current quantity for each item against its reorder point.');
  }

  function alertsRegion() {
    S.el('#alerts').innerHTML =
      S.owned('Andrew Jacob E. Santos', null,
        'Items that have fallen to or below their reorder point.');
  }

  /* ---------------------------------------------------------------------- *
   * WBS 8.3 — Quick actions panel
   *
   * Shortcuts to the task a user most often arrives wanting to do. Each entry
   * points at a screen. Entries whose destination module is not built yet stay
   * visible but inert, so the panel shows the finished shape of the system
   * rather than hiding half of it.
   * -------------------------------------------------------------------- */
  var ACTIONS = [
    { text: 'Guest details',      icon: 'account',  href: 'pages/reservations.html', ready: true },
    { text: 'User management',    icon: 'users',    href: 'pages/users.html',        ready: true },
    { text: 'Report summary',     icon: 'report',   href: 'pages/reports.html',      ready: true },
    { text: 'New reservation',    icon: 'plus',     href: null, ready: false },
    { text: 'Record stock',       icon: 'box',      href: null, ready: false },
    { text: 'Open calendar',      icon: 'calendar', href: null, ready: false }
  ];

  function quickActions() {
    S.el('#quick').innerHTML = '<div class="qa">' + ACTIONS.map(function (a) {
      var ico = '<span class="qa__ico">' + S.icon(a.icon, 15) + '</span>';
      var label = '<span class="qa__text">' + S.esc(a.text) + '</span>';

      if (!a.ready) {
        return '<span class="qa__item qa__item--off" ' +
          'title="This module is not built yet.">' + ico + label +
          '<span class="tag" style="margin-left:auto">Not built</span></span>';
      }
      return '<a class="qa__item" href="' + App.path(a.href) + '">' + ico + label + '</a>';
    }).join('') + '</div>';
  }
})(window.App = window.App || {});
