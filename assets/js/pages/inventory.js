/* ============================================================================
 * inventory.js — Canteen Inventory
 * Angelo Andrei P. Sierra — Frontend and UI/UX Developer
 *
 * Charter deliverable: product, food, beverage and supply management,
 * stock-in and stock-out, purchase recording, replenishment, low stock alerts,
 * supplier data, delivery records, and consumption.
 *
 * Stock is never set directly. It moves because a delivery arrived or because
 * the kitchen used something, and the database triggers do the arithmetic.
 * So these forms write delivery_items and inventory_consumption rows, and
 * current_stock follows. Writing a stock figure by hand is how two people
 * end up disagreeing about what is on the shelf.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var Q = App.Q;

  var q = '', cat = 'all', level = 'all';

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Canteen Inventory', nav: 'inventory' });

    fillCategories();

    var search = S.el('#q'), timer;
    search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { q = search.value.trim().toLowerCase(); items(); }, 150);
    });
    S.el('#fCat').addEventListener('change', function (e) { cat = e.target.value; items(); });
    S.el('#fLevel').addEventListener('change', function (e) { level = e.target.value; items(); });

    S.el('#btnItem').addEventListener('click', function () { itemForm(null); });
    S.el('#btnDelivery').addEventListener('click', delivery);
    S.el('#btnConsume').addEventListener('click', consumption);

    metrics();
    items();
    suppliers();
    deliveries();
    movement();

    if (location.hash === '#movement') {
      S.el('#movement').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  function fillCategories() {
    var seen = {};
    App.DB.inventory_items.forEach(function (i) { seen[i.category] = true; });
    S.el('#fCat').insertAdjacentHTML('beforeend',
      Object.keys(seen).sort().map(function (c) {
        return '<option value="' + S.esc(c) + '">' + S.esc(Q.category(c)) + '</option>';
      }).join(''));
  }

  /* ---------------------------------------------------------------------- *
   * Metric strip.
   * -------------------------------------------------------------------- */
  function metrics() {
    var low = Q.lowStockItems(), crit = Q.criticalStockItems();
    var value = Q.inventoryValue();
    var moves = App.DB.inventory_transactions;

    S.meta([['Items', App.DB.inventory_items.length],
            ['Low stock', low.length],
            ['Suppliers', App.DB.suppliers.length],
            ['Deliveries', App.DB.deliveries.length]]);

    S.el('#metrics').innerHTML =
      tile('Items tracked', App.DB.inventory_items.length, '',
        App.DB.inventory_items.filter(function (i) { return i.is_active !== 0; }).length +
        ' active') +
      tile('Needs reorder', low.length, low.length === 1 ? 'item' : 'items',
        crit.length ? crit.length + ' at critical level' : 'none critical') +
      tile('Stock value', S.peso(Math.round(value)), '',
        'valued at the most recent delivery price') +
      tile('Movements', moves.length, '',
        moves.filter(function (t) { return t.transaction_type === 'STOCK_IN'; }).length +
        ' in, ' +
        moves.filter(function (t) { return t.transaction_type === 'STOCK_OUT'; }).length +
        ' out');
  }

  function tile(label, value, unit, note) {
    return '<div class="metric">' +
      '<div class="metric__label">' + S.esc(label) + '</div>' +
      '<div class="metric__value">' + S.esc(String(value)) +
        (unit ? ' <span class="metric__unit">' + S.esc(unit) + '</span>' : '') + '</div>' +
      '<div class="metric__note">' + S.esc(note) + '</div></div>';
  }

  /* ---------------------------------------------------------------------- *
   * Items.
   * -------------------------------------------------------------------- */
  function visible() {
    return App.DB.inventory_items.filter(function (i) {
      if (cat !== 'all' && i.category !== cat) return false;
      if (level === 'low' && Number(i.current_stock) > Number(i.reorder_level)) return false;
      if (level === 'critical' && Number(i.current_stock) > Number(i.critical_level)) return false;
      if (!q) return true;
      return [i.item_code, i.item_name, Q.category(i.category)]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  function items() {
    var all = App.DB.inventory_items, list = visible();
    S.el('#count').textContent =
      list.length === all.length ? all.length + ' items' : list.length + ' of ' + all.length;

    var host = S.el('#list');
    host.innerHTML = S.table([
      { head: 'Code', cls: 'mono', cell: function (i) { return S.esc(i.item_code); } },
      { head: 'Item', cell: function (i) { return S.esc(i.item_name); } },
      { head: 'Category', cell: function (i) { return S.esc(Q.category(i.category)); } },
      { head: 'On hand', cls: 'table__num mono', cell: function (i) {
        return i.current_stock + ' ' + S.esc(i.unit);
      } },
      { head: 'Reorder', cls: 'table__num mono', cell: function (i) { return i.reorder_level; } },
      { head: 'Critical', cls: 'table__num mono', cell: function (i) { return i.critical_level; } },
      { head: 'Value', cls: 'table__num mono', cell: function (i) {
        return S.esc(S.peso(Math.round(Number(i.current_stock) * Number(i.unit_cost))));
      } },
      { head: 'Level', cell: function (i) {
        var st = Q.stockState(i);
        return '<span class="tag tag--' + st.tag + '">' + S.esc(st.text) + '</span>';
      } },
      { head: 'Actions', cls: 'table__act', cell: function (i) {
        return '<button class="btn btn--sm" data-hist="' + i.item_id + '">History</button> ' +
               '<button class="btn btn--sm" data-edit="' + i.item_id + '">Edit</button>';
      } }
    ], list, 'No item matches that search.');

    S.els('[data-edit]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        itemForm(Q.one(App.DB.inventory_items, 'item_id', Number(b.dataset.edit)));
      });
    });
    S.els('[data-hist]', host).forEach(function (b) {
      b.addEventListener('click', function () { history(Number(b.dataset.hist)); });
    });
  }

  var CATEGORIES = ['FOOD_STAPLES', 'MEAT_POULTRY', 'INGREDIENTS', 'BEVERAGES',
                    'PACKAGING', 'CLEANING_SUPPLIES'];

  function itemForm(item) {
    var editing = !!item, i = item || {};

    S.dialog({
      title: editing ? 'Edit ' + i.item_name : 'Add item',
      okText: editing ? 'Update item' : 'Add item',
      body:
        '<div class="row">' +
          f('Item code', 'item_code', i.item_code, 'text') +
          f('Item name', 'item_name', i.item_name, 'text') +
        '</div>' +
        '<div class="row">' +
          '<div class="field"><label class="field__label" for="category">Category</label>' +
            '<select class="select" id="category" name="category">' +
              CATEGORIES.map(function (c) {
                return '<option value="' + c + '"' + (i.category === c ? ' selected' : '') +
                  '>' + S.esc(Q.category(c)) + '</option>';
              }).join('') + '</select></div>' +
          f('Unit', 'unit', i.unit, 'text') +
        '</div>' +
        '<div class="row">' +
          f('Reorder level', 'reorder_level', i.reorder_level, 'number') +
          f('Critical level', 'critical_level', i.critical_level, 'number') +
        '</div>' +
        '<div class="field__hint" style="margin-bottom:12px">Reorder is when to buy ' +
          'more. Critical is the point below which service is at risk, so it must be ' +
          'the lower of the two.</div>' +
        (editing ? '' :
          '<div class="note note--flat" style="margin-bottom:12px">' +
          '<span class="note__icon">' + S.icon('info', 15) + '</span>' +
          '<div>A new item starts at zero. Stock arrives by recording a delivery, ' +
          'never by typing a figure in.</div></div>') +
        '<div id="iOut"></div>',
      onOk: function (root) {
        var v = S.readForm(root), errs = {};
        if (!v.item_code) errs.item_code = 'A code is required.';
        else {
          var clash = App.DB.inventory_items.filter(function (x) {
            return x.item_code.toLowerCase() === v.item_code.toLowerCase() &&
                   x.item_id !== i.item_id;
          })[0];
          if (clash) errs.item_code = 'That code is already used by ' + clash.item_name + '.';
        }
        if (!v.item_name) errs.item_name = 'A name is required.';
        if (!v.unit) errs.unit = 'Give the unit it is counted in, such as kg or packs.';
        if (v.reorder_level === '' || Number(v.reorder_level) < 0) {
          errs.reorder_level = 'Enter a reorder level of zero or more.';
        }
        if (v.critical_level === '' || Number(v.critical_level) < 0) {
          errs.critical_level = 'Enter a critical level of zero or more.';
        } else if (Number(v.critical_level) > Number(v.reorder_level)) {
          errs.critical_level = 'Critical must not be higher than the reorder level.';
        }
        if (!S.markErrors(root, errs)) return false;

        var record = {
          item_code: v.item_code.toUpperCase(),
          item_name: v.item_name,
          category: v.category,
          unit: v.unit,
          reorder_level: Number(v.reorder_level),
          critical_level: Number(v.critical_level),
          is_active: 1
        };
        if (editing) record.item_id = i.item_id;

        S.el('#iOut', root).innerHTML = S.wouldWrite('inventory_items', record,
          editing ? 'This is the row that would replace item ' + i.item_id + '. ' +
            'current_stock and unit_cost are not included: both are maintained ' +
            'by the stock triggers and must not be overwritten by a form.'
          : 'This is the row that would be written. current_stock starts at zero ' +
            'and rises when a delivery is recorded.');
        S.el('#iOut', root).scrollIntoView({ block: 'nearest' });
        return false;
      }
    });
  }

  function f(label, name, value, type) {
    return '<div class="field"><label class="field__label" for="' + name + '">' +
      S.esc(label) + '</label><input class="input" type="' + type + '" id="' + name +
      '" name="' + name + '" value="' + S.esc(value == null ? '' : value) + '"></div>';
  }

  /* ---------------------------------------------------------------------- *
   * Record a delivery — stock in.
   * -------------------------------------------------------------------- */
  function delivery() {
    S.dialog({
      title: 'Record delivery',
      okText: 'Record delivery',
      body:
        '<div class="row">' +
          '<div class="field"><label class="field__label" for="supplier_id">Supplier</label>' +
            '<select class="select" id="supplier_id" name="supplier_id">' +
              App.DB.suppliers.map(function (s) {
                return '<option value="' + s.supplier_id + '">' +
                  S.esc(s.supplier_name) + '</option>';
              }).join('') + '</select></div>' +
          f('Delivery receipt no.', 'delivery_receipt_no', '', 'text') +
        '</div>' +
        '<div class="row">' +
          '<div class="field"><label class="field__label" for="item_id">Item</label>' +
            '<select class="select" id="item_id" name="item_id">' +
              App.DB.inventory_items.map(function (i) {
                return '<option value="' + i.item_id + '">' + S.esc(i.item_code) +
                  ' · ' + S.esc(i.item_name) + '</option>';
              }).join('') + '</select></div>' +
          f('Delivered on', 'delivery_date', S.today(), 'date') +
        '</div>' +
        '<div class="row">' +
          f('Quantity', 'quantity', '', 'number') +
          f('Unit cost', 'unit_cost', '', 'number') +
        '</div>' +
        '<div id="dOut"></div>',
      onOk: function (root) {
        var v = S.readForm(root), errs = {};
        if (!v.delivery_receipt_no) errs.delivery_receipt_no = 'Record the receipt number.';
        else if (App.DB.deliveries.some(function (d) {
          return String(d.delivery_receipt_no).toLowerCase() ===
                 v.delivery_receipt_no.toLowerCase();
        })) errs.delivery_receipt_no = 'That receipt number is already recorded.';
        if (!Number(v.quantity) || Number(v.quantity) <= 0) {
          errs.quantity = 'Enter a quantity greater than zero.';
        }
        if (v.unit_cost === '' || Number(v.unit_cost) < 0) {
          errs.unit_cost = 'Enter the unit cost.';
        }
        if (!S.markErrors(root, errs)) return false;

        var item = Q.one(App.DB.inventory_items, 'item_id', Number(v.item_id));
        var total = Math.round(Number(v.quantity) * Number(v.unit_cost) * 100) / 100;

        S.el('#dOut', root).innerHTML =
          S.wouldWrite('deliveries', {
            delivery_receipt_no: v.delivery_receipt_no,
            supplier_id: Number(v.supplier_id),
            delivery_date: v.delivery_date,
            received_by: Q.me().user_id,
            total_amount: total,
            status: 'RECEIVED'
          }, 'Two rows, in this order. The header first:') +
          '<div style="height:10px"></div>' +
          S.wouldWrite('delivery_items', {
            delivery_id: '<new delivery_id>',
            item_id: Number(v.item_id),
            quantity: Number(v.quantity),
            unit_cost: Number(v.unit_cost)
          }, 'Then the line. Inserting it is enough: trg_delivery_item_after_insert ' +
             'raises ' + item.item_code + ' from ' + item.current_stock + ' to ' +
             (Math.round((Number(item.current_stock) + Number(v.quantity)) * 1000) / 1000) +
             ' ' + item.unit + ', updates the unit cost, and writes the ledger row ' +
             'with its before and after snapshot.');
        S.el('#dOut', root).scrollIntoView({ block: 'nearest' });
        return false;
      }
    });
  }

  /* ---------------------------------------------------------------------- *
   * Record usage — stock out.
   * -------------------------------------------------------------------- */
  function consumption() {
    S.dialog({
      title: 'Record usage',
      okText: 'Record usage',
      body:
        '<div class="field"><label class="field__label" for="item_id">Item</label>' +
          '<select class="select" id="item_id" name="item_id">' +
            App.DB.inventory_items.map(function (i) {
              return '<option value="' + i.item_id + '">' + S.esc(i.item_code) + ' · ' +
                S.esc(i.item_name) + ' · ' + i.current_stock + ' ' +
                S.esc(i.unit) + ' on hand</option>';
            }).join('') + '</select></div>' +
        '<div class="row">' +
          f('Quantity used', 'quantity', '', 'number') +
          f('Used on', 'consumption_date', S.today(), 'date') +
        '</div>' +
        '<div class="field"><label class="field__label" for="purpose">Purpose</label>' +
          '<input class="input" type="text" id="purpose" name="purpose" ' +
          'placeholder="Daily meal preparation"></div>' +
        '<div id="cOut"></div>',
      onOk: function (root) {
        var v = S.readForm(root), errs = {};
        var item = Q.one(App.DB.inventory_items, 'item_id', Number(v.item_id));
        var qty = Number(v.quantity);
        if (!qty || qty <= 0) errs.quantity = 'Enter a quantity greater than zero.';
        else if (qty > Number(item.current_stock)) {
          errs.quantity = 'Only ' + item.current_stock + ' ' + item.unit +
            ' on hand. The database refuses this too.';
        }
        if (!v.purpose) errs.purpose = 'Record what it was used for.';
        if (!S.markErrors(root, errs)) return false;

        var after = Math.round((Number(item.current_stock) - qty) * 1000) / 1000;
        var willWarn = after <= Number(item.reorder_level);

        S.el('#cOut', root).innerHTML = S.wouldWrite('inventory_consumption', {
          item_id: item.item_id,
          quantity: qty,
          purpose: v.purpose,
          consumption_date: v.consumption_date,
          recorded_by: Q.me().user_id
        }, item.item_code + ' falls from ' + item.current_stock + ' to ' + after + ' ' +
           item.unit + '. trg_consumption_after_insert does that, and refuses the ' +
           'insert outright if the quantity exceeds what is on hand.' +
           (willWarn ? ' That leaves it at or below its reorder level, so it will ' +
             'appear in the low stock alerts.' : ''));
        S.el('#cOut', root).scrollIntoView({ block: 'nearest' });
        return false;
      }
    });
  }

  /* ---------------------------------------------------------------------- *
   * Suppliers, deliveries, and the movement ledger.
   * -------------------------------------------------------------------- */
  function suppliers() {
    S.el('#suppliers').innerHTML = S.table([
      { head: 'Supplier', cell: function (s) { return S.esc(s.supplier_name); } },
      { head: 'Contact', cell: function (s) {
        return S.esc(s.contact_person || '—') +
          '<div class="who-cell__sub">' + S.esc(s.phone || '') + '</div>';
      } },
      { head: 'Deliveries', cls: 'table__num mono', cell: function (s) {
        return App.DB.deliveries.filter(function (d) {
          return d.supplier_id === s.supplier_id;
        }).length;
      } },
      { head: 'Value', cls: 'table__num mono', cell: function (s) {
        return S.esc(S.peso(App.DB.deliveries.filter(function (d) {
          return d.supplier_id === s.supplier_id;
        }).reduce(function (n, d) { return n + Number(d.total_amount); }, 0)));
      } }
    ], App.DB.suppliers);
  }

  function deliveries() {
    S.el('#deliveries').innerHTML = S.table([
      { head: 'Receipt', cls: 'mono', cell: function (d) {
        return S.esc(d.delivery_receipt_no);
      } },
      { head: 'Supplier', cell: function (d) {
        var s = Q.one(App.DB.suppliers, 'supplier_id', d.supplier_id);
        return S.esc(s ? s.supplier_name : '—');
      } },
      { head: 'Date', cls: 'mono', cell: function (d) {
        return S.esc(String(d.delivery_date || '').slice(0, 10));
      } },
      { head: 'Lines', cls: 'table__num mono', cell: function (d) {
        return App.DB.delivery_items.filter(function (x) {
          return x.delivery_id === d.delivery_id;
        }).length;
      } },
      { head: 'Total', cls: 'table__num mono', cell: function (d) {
        return S.esc(S.peso(d.total_amount));
      } }
    ], App.DB.deliveries);
  }

  function movement(itemId) {
    var rows = App.DB.inventory_transactions.filter(function (t) {
      return !itemId || t.item_id === itemId;
    }).slice().reverse();

    S.el('#moveCount').textContent = rows.length + ' movements';
    S.el('#movement').innerHTML = S.table(LEDGER, rows, 'No stock movement recorded.');
  }

  var LEDGER = [
    { head: 'Item', cell: function (t) {
      var i = Q.one(App.DB.inventory_items, 'item_id', t.item_id);
      return S.esc(i ? i.item_name : '—') +
        '<div class="who-cell__sub">' + S.esc(i ? i.item_code : '') + '</div>';
    } },
    { head: 'Movement', cell: function (t) {
      var inward = t.transaction_type === 'STOCK_IN';
      return '<span class="tag tag--' + (inward ? 'ok' : 'warn') + '">' +
        (inward ? 'Stock in' : 'Stock out') + '</span>';
    } },
    { head: 'Quantity', cls: 'table__num mono', cell: function (t) {
      return (t.transaction_type === 'STOCK_IN' ? '+' : '−') + t.quantity;
    } },
    { head: 'Before', cls: 'table__num mono', cell: function (t) { return t.stock_before; } },
    { head: 'After', cls: 'table__num mono', cell: function (t) { return t.stock_after; } },
    { head: 'Reason', cell: function (t) { return S.esc(Q.category(t.reason)); } },
    { head: 'Recorded', cls: 'mono', cell: function (t) {
      return S.esc(String(t.transaction_date || '—').slice(0, 10));
    } }
  ];

  function history(itemId) {
    var i = Q.one(App.DB.inventory_items, 'item_id', itemId);
    var rows = App.DB.inventory_transactions.filter(function (t) {
      return t.item_id === itemId;
    }).slice().reverse();

    S.dialog({
      title: i.item_name + ' — stock history',
      cancelText: 'Close',
      body:
        '<div class="kv" style="margin-bottom:14px">' +
          '<div class="kv__k">Code</div><div class="mono">' + S.esc(i.item_code) + '</div>' +
          '<div class="kv__k">On hand</div><div>' + i.current_stock + ' ' +
            S.esc(i.unit) + '</div>' +
          '<div class="kv__k">Reorder at</div><div>' + i.reorder_level + '</div>' +
          '<div class="kv__k">Critical at</div><div>' + i.critical_level + '</div>' +
        '</div>' +
        (rows.length
          ? S.table(LEDGER.slice(1), rows)
          : '<div class="empty">No movement recorded for this item.</div>')
    });
  }
})(window.App = window.App || {});
