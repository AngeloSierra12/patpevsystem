/* ============================================================================
 * calendar.js — Scheduling and Calendar
 *
 * WBS 6.1 UI wireframing ............ Angelo Andrei P. Sierra
 * WBS 6.2 Interactive calendar ....... John Carlos R. Capuli
 * WBS 6.3 Schedule conflict detection  John Carlos R. Capuli
 *
 * This developer's task on this screen is the wireframe only, which is
 * delivered as part of the wireframe document. The working screen belongs to
 * the module owners named below.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Scheduling and Calendar', nav: 'calendar' });
    S.meta([['Reservations', App.DB.reservations.length],
            'schedule view is a separate task']);
    var now = new Date();
    S.el('#calTitle').textContent = S.MONTHS[now.getMonth()] + ' ' + now.getFullYear();

    S.el('#cal').innerHTML = S.owned(
      'John Carlos R. Capuli', null,
      'Reservations and scheduled activities laid out by date, with a room ' +
      'by room timeline view.');

    S.el('#day').innerHTML = S.owned(
      'John Carlos R. Capuli', null,
      'Arrivals, departures and activities for the chosen date.');

    S.el('#conflict').innerHTML = S.owned(
      'John Carlos R. Capuli', null,
      'Checks a new entry against existing bookings and room blocks before ' +
      'it can be saved.');

    S.els('#prev, #next').forEach(function (b) {
      b.disabled = true;
      b.title = 'The calendar module is not built yet.';
    });
  });
})(window.App = window.App || {});
