/* ============================================================================
 * reports.js — Reports
 *
 * WBS 9.4 Report Summary UI ............... Angelo Andrei P. Sierra (this file)
 * WBS 9.1 UI wireframing .................. Angelo Andrei P. Sierra
 * WBS 9.2 Report control panel, filtering . Andrew Jacob E. Santos  (placeholder)
 * WBS 9.3 Data aggregation logic .......... Darren Jude S. Tamayo
 *
 * The summary presents figures counted from the tables. The aggregation logic
 * that a real report would call is a separate task; each block below names the
 * database view it will read once that exists.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var Q = App.Q;

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Reports', nav: 'reports' });
    S.meta([['Tables read', 6], 'figures counted from seeded records']);

    summary();
    S.el('#controls').innerHTML = S.owned(
      'Andrew Jacob E. Santos', 'Report control panel',
      'Report type, date range and filters deciding what the summary covers.');

    var ex = S.els('.page__actions .btn')[0];
    if (ex) {
      ex.disabled = true;
      ex.title = 'Export runs on the aggregation logic, which is a separate task.';
    }
  });

  /* ---------------------------------------------------------------------- *
   * WBS 9.4 — Report Summary UI
   * -------------------------------------------------------------------- */
  function summary() {
    var DB = App.DB;

    var byStatus = {};
    DB.reservations.forEach(function (r) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    var occupied = DB.rooms.filter(function (r) { return r.status === 'OCCUPIED'; }).length;
    var nights = DB.reservations.filter(function (r) {
      return r.status !== 'CANCELLED';
    }).reduce(function (s, r) { return s + Number(r.total_nights); }, 0);

    S.el('#summary').innerHTML =
      block('Hostel occupancy', 'vw_occupancy_report', [
          ['Rooms in inventory', DB.rooms.length],
          ['Rooms currently occupied', occupied],
          ['Room types offered', DB.room_types.length],
          ['Booked nights, excluding cancellations', nights]
        ]) +

        block('Reservations', 'vw_reservation_summary',
          Object.keys(byStatus).map(function (k) {
            return [Q.resStatus(k).text, byStatus[k]];
          }).concat([['Total on file', DB.reservations.length]])) +

        block('Revenue', 'vw_daily_revenue', [
          ['Amount booked', S.peso(Q.amountBooked())],
          ['Collected from payments', S.peso(Q.revenueCollected())],
          ['Outstanding balance', S.peso(Q.outstandingBalance())],
          ['Payments recorded', DB.payments.length]
        ]) +

        block('Canteen inventory', 'vw_inventory_value', [
          ['Items tracked', DB.inventory_items.length],
          ['At or below reorder level', Q.lowStockItems().length],
          ['At or below critical level', Q.criticalStockItems().length],
          ['Stock value', S.peso(Math.round(Q.inventoryValue()))]
        ]) +

        block('Deliveries and suppliers', 'vw_delivery_summary', [
          ['Suppliers on file', DB.suppliers.length],
          ['Deliveries received', DB.deliveries.length],
          ['Delivery line items', DB.delivery_items.length],
          ['Value delivered', S.peso(Q.deliveryTotal())]
      ]);
  }

  function block(heading, view, rows) {
    return '<div style="margin-bottom:16px">' +
      '<div class="label">' + S.esc(heading) +
        '<code>' + S.esc(view) + '</code></div>' +
      rows.map(function (r) {
        return '<div class="rowitem" style="padding:4px 0;border-bottom:none">' +
          '<span class="rowitem__main"><span class="rowitem__title" ' +
            'style="font-weight:400">' + S.esc(r[0]) + '</span></span>' +
          '<span class="rowitem__end mono">' + S.esc(String(r[1])) + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  }
})(window.App = window.App || {});
