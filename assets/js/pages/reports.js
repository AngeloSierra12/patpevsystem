/* ============================================================================
 * reports.js — Report Generation
 * Angelo Andrei P. Sierra — Frontend and UI/UX Developer
 *
 * Charter deliverable: "A reporting system capable of generating reservation
 * reports, room occupancy reports, guest records, inventory level reports,
 * stock movement reports and transaction reports."
 *
 * All six are here, plus the summary. Each one declares where its figures
 * come from in the schema, so when the aggregation logic moves into the
 * database, this file tells you which view replaces which function.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var Q = App.Q;

  var type = 'summary', from = '', to = '';

  /* ---------------------------------------------------------------------- *
   * The report catalogue.
   *
   * Each entry knows its name, the view it will eventually read, whether a
   * date range applies to it, and how to turn records into rows. Adding a
   * report is one entry, not a new screen.
   * -------------------------------------------------------------------- */
  var REPORTS = {
    summary: { name: 'Report summary', view: '—', dated: false, render: summary },

    reservations: {
      name: 'Reservations', view: 'vw_reservation_summary', dated: true,
      dateField: 'check_in_date',
      rows: function () { return App.DB.reservations; },
      cols: [
        { head: 'Reference', cls: 'mono', get: function (r) { return r.reference_number; } },
        { head: 'Guest', get: function (r) {
          var g = Q.one(App.DB.guests, 'guest_id', r.guest_id);
          return g ? g.full_name : '';
        } },
        { head: 'Room', cls: 'mono', get: function (r) { return r.room_number_snapshot; } },
        { head: 'Check in', cls: 'mono', get: function (r) { return r.check_in_date; } },
        { head: 'Check out', cls: 'mono', get: function (r) { return r.check_out_date; } },
        { head: 'Nights', cls: 'table__num mono', get: function (r) { return r.total_nights; } },
        { head: 'Total', cls: 'table__num mono', get: function (r) { return r.total_amount; },
          fmt: S.peso },
        { head: 'Balance', cls: 'table__num mono', get: function (r) { return r.balance; },
          fmt: S.peso },
        { head: 'Status', get: function (r) { return Q.resStatus(r.status).text; },
          tag: function (r) { return Q.resStatus(r.status).tag; } }
      ]
    },

    occupancy: {
      name: 'Room occupancy', view: 'vw_occupancy_report', dated: false,
      rows: function () { return Q.roomsWithType(); },
      cols: [
        { head: 'Room', cls: 'mono', get: function (r) { return r.room_number; } },
        { head: 'Type', get: function (r) { return r.type_name; } },
        { head: 'Floor', cls: 'table__num mono', get: function (r) { return r.floor; } },
        { head: 'Capacity', cls: 'table__num mono', get: function (r) { return r.capacity; } },
        { head: 'Rate', cls: 'table__num mono', get: function (r) { return r.rate_per_night; },
          fmt: S.peso },
        { head: 'Nights booked', cls: 'table__num mono', get: function (r) {
          return App.DB.reservations.filter(function (x) {
            return x.room_id === r.room_id && x.status !== 'CANCELLED';
          }).reduce(function (n, x) { return n + Number(x.total_nights); }, 0);
        } },
        { head: 'Status', get: function (r) { return Q.roomStatus(r.status).text; },
          tag: function (r) { return Q.roomStatus(r.status).tag; } }
      ]
    },

    guests: {
      name: 'Guest records', view: 'vw_guest_history', dated: false,
      rows: function () { return App.DB.guests; },
      cols: [
        { head: 'Guest', get: function (g) { return g.full_name; } },
        { head: 'Contact', get: function (g) { return g.phone || ''; } },
        { head: 'Email', get: function (g) { return g.email || ''; } },
        { head: 'ID presented', get: function (g) { return g.id_type || ''; } },
        { head: 'Stays', cls: 'table__num mono', get: function (g) {
          return Q.guestHistory(g.guest_id).length;
        } },
        { head: 'Billed', cls: 'table__num mono', get: function (g) {
          return Q.guestHistory(g.guest_id).reduce(function (n, r) {
            return r.status === 'CANCELLED' ? n : n + Number(r.total_amount);
          }, 0);
        }, fmt: S.peso },
        { head: 'Outstanding', cls: 'table__num mono', get: function (g) {
          return Q.guestHistory(g.guest_id).reduce(function (n, r) {
            return r.status === 'CANCELLED' ? n : n + Number(r.balance);
          }, 0);
        }, fmt: S.peso }
      ]
    },

    inventory: {
      name: 'Inventory levels', view: 'vw_inventory_value', dated: false,
      rows: function () { return App.DB.inventory_items; },
      cols: [
        { head: 'Code', cls: 'mono', get: function (i) { return i.item_code; } },
        { head: 'Item', get: function (i) { return i.item_name; } },
        { head: 'Category', get: function (i) { return Q.category(i.category); } },
        { head: 'On hand', cls: 'table__num mono', get: function (i) {
          return i.current_stock + ' ' + i.unit;
        } },
        { head: 'Reorder', cls: 'table__num mono', get: function (i) { return i.reorder_level; } },
        { head: 'Critical', cls: 'table__num mono', get: function (i) { return i.critical_level; } },
        { head: 'Unit cost', cls: 'table__num mono', get: function (i) { return i.unit_cost; },
          fmt: S.peso },
        { head: 'Value', cls: 'table__num mono', get: function (i) {
          return Math.round(Number(i.current_stock) * Number(i.unit_cost) * 100) / 100;
        }, fmt: S.peso },
        { head: 'Level', get: function (i) { return Q.stockState(i).text; },
          tag: function (i) { return Q.stockState(i).tag; } }
      ]
    },

    movement: {
      name: 'Stock movement', view: 'vw_stock_movement', dated: true,
      dateField: 'transaction_date',
      rows: function () { return App.DB.inventory_transactions; },
      cols: [
        { head: 'Date', cls: 'mono', get: function (t) { return t.transaction_date || ''; } },
        { head: 'Item', get: function (t) {
          var i = Q.one(App.DB.inventory_items, 'item_id', t.item_id);
          return i ? i.item_name : '';
        } },
        { head: 'Movement', get: function (t) {
          return t.transaction_type === 'STOCK_IN' ? 'Stock in' : 'Stock out';
        }, tag: function (t) {
          return t.transaction_type === 'STOCK_IN' ? 'ok' : 'warn';
        } },
        { head: 'Quantity', cls: 'table__num mono', get: function (t) { return t.quantity; } },
        { head: 'Before', cls: 'table__num mono', get: function (t) { return t.stock_before; } },
        { head: 'After', cls: 'table__num mono', get: function (t) { return t.stock_after; } },
        { head: 'Reason', get: function (t) { return Q.category(t.reason); } }
      ]
    },

    transactions: {
      name: 'Transactions', view: 'vw_payment_totals', dated: true,
      dateField: 'payment_date',
      rows: function () { return App.DB.payments; },
      cols: [
        { head: 'Receipt', cls: 'mono', get: function (p) { return p.receipt_number; } },
        { head: 'Date', cls: 'mono', get: function (p) { return p.payment_date || ''; } },
        { head: 'Reservation', cls: 'mono', get: function (p) {
          var r = Q.one(App.DB.reservations, 'reservation_id', p.reservation_id);
          return r ? r.reference_number : '';
        } },
        { head: 'Guest', get: function (p) {
          var r = Q.one(App.DB.reservations, 'reservation_id', p.reservation_id);
          var g = r && Q.one(App.DB.guests, 'guest_id', r.guest_id);
          return g ? g.full_name : '';
        } },
        { head: 'Method', get: function (p) { return Q.category(p.payment_method); } },
        { head: 'Reference', cls: 'mono', get: function (p) { return p.reference_code || ''; } },
        { head: 'Amount', cls: 'table__num mono', get: function (p) { return p.amount; },
          fmt: S.peso }
      ]
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Reports', nav: 'reports' });
    controls();
    render();

    S.els('.page__actions .btn')[0].addEventListener('click', exportCsv);
  });

  /* ---------------------------------------------------------------------- *
   * Control panel — report type, date range, and what they do.
   *
   * The date inputs disable themselves for reports that have no date to
   * filter on. A control that silently does nothing is worse than one that
   * says it does not apply.
   * -------------------------------------------------------------------- */
  function controls() {
    S.el('#controls').innerHTML =
      '<div class="field">' +
        '<label class="field__label" for="rType">Report type</label>' +
        '<select class="select" id="rType">' +
          Object.keys(REPORTS).map(function (k) {
            return '<option value="' + k + '">' + S.esc(REPORTS[k].name) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="row">' +
        '<div class="field">' +
          '<label class="field__label" for="rFrom">From</label>' +
          '<input class="input" type="date" id="rFrom">' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="rTo">To</label>' +
          '<input class="input" type="date" id="rTo">' +
        '</div>' +
      '</div>' +
      '<div class="field__hint" id="rHint"></div>' +
      '<div style="display:flex;gap:7px;margin-top:12px">' +
        '<button class="btn btn--go" id="rApply">Generate</button>' +
        '<button class="btn" id="rClear">Clear dates</button>' +
      '</div>' +
      '<div class="label" style="margin-top:16px">Source</div>' +
      '<div class="metric__note" id="rSource"></div>';

    S.el('#rType').addEventListener('change', function (e) {
      type = e.target.value; syncDates(); render();
    });
    S.el('#rApply').addEventListener('click', function () {
      from = S.el('#rFrom').value; to = S.el('#rTo').value; render();
    });
    S.el('#rClear').addEventListener('click', function () {
      from = to = ''; S.el('#rFrom').value = ''; S.el('#rTo').value = ''; render();
    });
    syncDates();
  }

  function syncDates() {
    var r = REPORTS[type];
    S.els('#rFrom, #rTo').forEach(function (i) { i.disabled = !r.dated; });
    S.el('#rHint').textContent = r.dated
      ? 'Filters on ' + r.dateField.replace(/_/g, ' ') + '. Leave blank for all records.'
      : 'This report has no date to filter on.';
    S.el('#rSource').textContent = r.view === '—'
      ? 'Counted across seven tables.'
      : 'Will read ' + r.view + ' once the aggregation logic exists.';
  }

  /* ---------------------------------------------------------------------- *
   * Generate.
   * -------------------------------------------------------------------- */
  function rowsFor(r) {
    var rows = r.rows();
    if (!r.dated || (!from && !to)) return rows;
    return rows.filter(function (x) {
      var d = String(x[r.dateField] || '').slice(0, 10);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  function render() {
    var r = REPORTS[type];
    S.el('#outTitle').textContent = r.name;

    if (!r.cols) {
      S.el('#outCount').textContent = '';
      S.el('#out').innerHTML = '<div style="padding:13px">' + r.render() + '</div>';
      return;
    }

    var rows = rowsFor(r);
    S.el('#outCount').textContent = rows.length + (rows.length === 1 ? ' row' : ' rows') +
      (r.dated && (from || to) ? ' in range' : '');

    S.el('#out').innerHTML = S.table(r.cols.map(function (c) {
      return { head: c.head, cls: c.cls, cell: function (x) {
        var v = c.get(x);
        var text = c.fmt ? c.fmt(v) : String(v == null ? '' : v);
        if (c.tag) return '<span class="tag tag--' + c.tag(x) + '">' + S.esc(text) + '</span>';
        return S.esc(text);
      } };
    }), rows, 'No records in that range.') + totals(r, rows);
  }

  /* a money column is worth nothing without its total */
  function totals(r, rows) {
    if (!r.cols) return '';
    var money = r.cols.filter(function (c) { return c.fmt === S.peso && c.head !== 'Rate' &&
                                                    c.head !== 'Unit cost'; });
    if (!money.length || !rows.length) return '';
    return '<div style="padding:9px 13px;border-top:1px solid var(--line);' +
      'background:var(--surface-2);display:flex;gap:18px;flex-wrap:wrap">' +
      money.map(function (c) {
        var sum = rows.reduce(function (n, x) { return n + Number(c.get(x) || 0); }, 0);
        return '<span class="metric__note"><strong>' + S.esc(c.head) + ':</strong> ' +
          S.esc(S.peso(Math.round(sum * 100) / 100)) + '</span>';
      }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------------- *
   * Export. Builds a CSV from exactly what is on screen and hands it to the
   * browser. Values are quoted and internal quotes doubled, so a guest name
   * containing a comma cannot shift every later column.
   * -------------------------------------------------------------------- */
  function exportCsv() {
    var r = REPORTS[type];
    if (!r.cols) { window.print(); return; }

    var rows = rowsFor(r);
    function cell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }

    var csv = [r.cols.map(function (c) { return cell(c.head); }).join(',')]
      .concat(rows.map(function (x) {
        return r.cols.map(function (c) { return cell(c.get(x)); }).join(',');
      })).join('\r\n');

    var name = 'PATVEP-' + r.name.replace(/\s+/g, '-').toLowerCase() +
      (from || to ? '-' + (from || 'start') + '_' + (to || 'end') : '') + '.csv';

    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ---------------------------------------------------------------------- *
   * The summary, kept as the default view.
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

    return block('Hostel occupancy', [                   /* vw_occupancy_report */
        ['Rooms in inventory', DB.rooms.length],
        ['Rooms currently occupied', occupied],
        ['Room types offered', DB.room_types.length],
        ['Booked nights, excluding cancellations', nights]
      ]) +
      block('Reservations',                              /* vw_reservation_summary */
        Object.keys(byStatus).map(function (k) {
          return [Q.resStatus(k).text, byStatus[k]];
        }).concat([['Total on file', DB.reservations.length]])) +
      block('Revenue', [                                 /* vw_daily_revenue */
        ['Amount booked', S.peso(Q.amountBooked())],
        ['Collected from payments', S.peso(Q.revenueCollected())],
        ['Outstanding balance', S.peso(Q.outstandingBalance())],
        ['Payments recorded', DB.payments.length]
      ]) +
      block('Canteen inventory', [                       /* vw_inventory_value */
        ['Items tracked', DB.inventory_items.length],
        ['At or below reorder level', Q.lowStockItems().length],
        ['At or below critical level', Q.criticalStockItems().length],
        ['Stock value', S.peso(Math.round(Q.inventoryValue()))]
      ]) +
      block('Stock movement', [                          /* inventory_transactions */
        ['Movements recorded', DB.inventory_transactions.length],
        ['Stock received', DB.inventory_transactions.filter(function (t) {
          return t.transaction_type === 'STOCK_IN'; }).length],
        ['Stock issued', DB.inventory_transactions.filter(function (t) {
          return t.transaction_type === 'STOCK_OUT'; }).length]
      ]) +
      block('Deliveries and suppliers', [                /* vw_delivery_summary */
        ['Suppliers on file', DB.suppliers.length],
        ['Deliveries received', DB.deliveries.length],
        ['Delivery line items', DB.delivery_items.length],
        ['Value delivered', S.peso(Q.deliveryTotal())]
      ]);
  }

  function block(heading, rows) {
    return '<div class="repblock">' +
      '<div class="label">' + S.esc(heading) + '</div>' +
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
