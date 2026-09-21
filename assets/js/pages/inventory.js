/* ============================================================================
 * inventory.js — Canteen Inventory
 *
 * WBS 4.1 UI wireframing ............ Andrew Jacob E. Santos
 * WBS 4.2 Low stock alert logic ..... John Carlos R. Capuli
 * WBS 4.3 Add, edit, delete items ... John Carlos R. Capuli
 * WBS 4.4 Suppliers and deliveries .. Darren Jude S. Tamayo
 * WBS 4.5 Usage and consumption ..... Darren Jude S. Tamayo
 *
 * This developer's task on this screen is the wireframe only, which is
 * delivered as part of the wireframe document. The working screen belongs to
 * the module owners named below.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Canteen Inventory', nav: 'inventory' });
    S.meta([['Items', App.DB.inventory_items.length],
            ['Low stock', App.Q.lowStockItems().length],
            ['Suppliers', App.DB.suppliers.length]]);
    S.el('#metrics').outerHTML =
      S.owned('John Carlos R. Capuli', 'Stock summary and low stock alerts',
        'Item counts, items at or below their reorder point, and stock value.');

    S.el('#list').innerHTML = S.table([
      { head: 'Code', cls: 'mono', cell: function (i) { return S.esc(i.item_code); } },
      { head: 'Item', cell: function (i) { return S.esc(i.item_name); } },
      { head: 'Category', cell: function (i) {
        return S.esc(App.Q.category(i.category));
      } },
      { head: 'Stock', cls: 'table__num mono', cell: function (i) {
        return i.current_stock + ' ' + S.esc(i.unit);
      } },
      { head: 'Reorder', cls: 'table__num mono', cell: function (i) { return i.reorder_level; } },
      { head: 'Level', cell: function (i) { return level(i); } }
    ], App.DB.inventory_items) +
      S.owned('John Carlos R. Capuli', 'Add, edit and delete items, low stock alerts',
        'Recording stock in and out, and raising alerts at the reorder point.');

    S.el('#pending').innerHTML = S.owned(
      'Darren Jude S. Tamayo', null,
      'Stock in and out, supplier records, delivery logs and consumption.');
  });

  /* the schema carries two thresholds per item, so the tag reports which one
     the current quantity has reached */
  function level(i) {
    var stock = Number(i.current_stock);
    var t = stock <= Number(i.critical_level) ? ['stop', 'Critical']
          : stock <= Number(i.reorder_level)  ? ['warn', 'Reorder']
          :                                     ['ok',   'OK'];
    return '<span class="tag tag--' + t[0] + '">' + t[1] + '</span>';
  }
})(window.App = window.App || {});
