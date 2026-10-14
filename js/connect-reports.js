(async function () {
    var user;
    try {
        user = await startPage();
    } catch (err) {
        return;
    }
    if (user.role !== 'ADMIN') {
        adminOnly();
        return;
    }

    var box = document.querySelector('#left-col .box');
    var form = document.getElementById('controls');
    form.removeAttribute('action');

    var typeSelect = document.getElementById('type');
    if (!Array.prototype.some.call(typeSelect.options, function (o) { return o.text === 'Monthly costs'; })) {
        typeSelect.add(new Option('Monthly costs'));
    }

    var TYPES = {
        'Summary': 'summary',
        'Stock levels': 'stock-levels',
        'Low stock': 'low-stock',
        'Stock in and out': 'stock-movement',
        'Item counts': 'item-counts',
        'Deliveries': 'deliveries',
        'Suppliers': 'suppliers',
        'Monthly costs': 'monthly-costs',
    };
    var WHERE = { 'Canteen and hostel': '', 'Canteen': 'CANTEEN', 'Hostel': 'HOSTEL' };

    function rowsTable(r) {
        return '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td></tr>';
    }

    function grid(headers, rows) {
        if (!rows.length) return '<p class="small">Nothing found for these dates.</p>';
        return '<table><tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' +
            rows.map(function (cells) {
                return '<tr>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
            }).join('') + '</table>';
    }

    function statusTag(status) {
        if (status === 'CRITICAL') return '<span class="tag red">Critical</span>';
        if (status === 'LOW') return '<span class="tag yellow">Low</span>';
        if (status === 'REJECTED') return '<span class="tag red">Rejected</span>';
        return 'OK';
    }

    function render(type, d) {
        var html = '<h2>' + esc(type) + '</h2><p class="small">' + place(d.location) +
            (d.from || d.to ? ', ' + (d.from ? shortDate(d.from) + ', ' + d.from.slice(0, 4) : 'start') + ' to ' +
                (d.to ? shortDate(d.to) + ', ' + d.to.slice(0, 4) : 'today') : ', all dates') + '</p>';

        if (d.type === 'summary') {
            d.locations.forEach(function (l) {
                html += '<h3>' + (l.location === 'CANTEEN' ? 'Canteen stock' : 'Hostel supplies') + '</h3><table>' +
                    rowsTable(['Items', l.items]) + rowsTable(['Low stock', l.lowStock]) +
                    rowsTable(['Critical', l.critical]) + rowsTable(['Value of stock on hand', money(l.value)]) + '</table>';
            });
            var s = d.stockInOut;
            html += '<h3>Stock in and out</h3><table>' +
                rowsTable(['Times stock came in', s.stockIn]) + rowsTable(['Times stock was taken out', s.stockOut]) +
                rowsTable(['Item counts recorded', s.itemCounts]) +
                '<tr class="total"><td>Total</td><td class="num">' + s.total + '</td></tr></table>';
            var dl = d.deliveries;
            html += '<h3>Deliveries and suppliers</h3><table>' +
                rowsTable(['Suppliers', dl.activeSuppliers]) + rowsTable(['Deliveries', dl.deliveries]) +
                rowsTable(['Items delivered', dl.itemsDelivered]) + rowsTable(['Value delivered', money(dl.value)]) + '</table>';
        } else if (d.type === 'stock-levels') {
            html += grid(['Item', 'For', 'On hand', 'Reorder at', 'Value', 'Status'], d.rows.map(function (r) {
                return [esc(r.item_name), place(r.location), qty(r.current_stock) + ' ' + esc(r.unit),
                    qty(r.reorder_level), money(r.stock_value), statusTag(r.stock_status)];
            }));
        } else if (d.type === 'low-stock') {
            html += grid(['Item', 'For', 'On hand', 'Reorder at', 'Status', 'Supplier'], d.rows.map(function (r) {
                return [esc(r.item_name), place(r.location), qty(r.current_stock) + ' ' + esc(r.unit),
                    qty(r.reorder_level), statusTag(r.stock_status), esc(r.preferred_supplier || '-')];
            }));
        } else if (d.type === 'stock-movement') {
            var labels = { STOCK_IN: 'In', STOCK_OUT: 'Out', ADJUSTMENT: 'Count' };
            html += grid(['Date', 'Item', 'Type', 'Change', 'Left', 'By'], d.rows.map(function (r) {
                var change = Number(r.net_change);
                return [shortDate(r.transaction_date), esc(r.item_name), labels[r.transaction_type] || r.transaction_type,
                    (change > 0 ? '+' : '') + qty(change) + ' ' + esc(r.unit), qty(r.stock_after), esc(r.performed_by_name || '-')];
            }));
        } else if (d.type === 'item-counts') {
            html += grid(['Date', 'Item', 'System had', 'Counted', 'Result', 'By'], d.rows.map(function (r) {
                return [shortDate(r.counted_at), esc(r.item_name), r.system_stock ? qty(r.system_stock) : '-',
                    r.counted_stock ? qty(r.counted_stock) : '-', r.result === 'MATCHED' ? 'Matches' : '<span class="tag yellow">Corrected</span>',
                    esc(r.counted_by)];
            }));
        } else if (d.type === 'deliveries') {
            html += grid(['Date', 'Delivery no.', 'Supplier', 'For', 'Items', 'Total'], d.rows.map(function (r) {
                return [shortDate(r.received_at), esc(r.delivery_receipt_no) + (r.status === 'REJECTED' ? ' ' + statusTag('REJECTED') : ''),
                    esc(r.supplier_name), place(r.location), r.line_item_count, money(r.total_amount)];
            }));
        } else if (d.type === 'suppliers') {
            html += grid(['Supplier', 'Contact', 'Deliveries', 'Rejected', 'Value', 'Last delivery'], d.rows.map(function (r) {
                return [esc(r.supplier_name), esc(r.contact_person || '-'), r.received, r.rejected,
                    money(r.total_value), shortDate(r.last_delivery_at)];
            }));
        } else if (d.type === 'monthly-costs') {
            html += grid(['Month', 'For', 'Bought', 'Used', 'Count losses'], d.rows.map(function (r) {
                var p = r.month_year.split('-');
                return [FULL_MONTHS[Number(p[1]) - 1] + ' ' + p[0], place(r.location), money(r.purchases_value),
                    money(r.usage_cost), money(r.adjustment_value)];
            }));
        }
        box.innerHTML = html;
    }

    async function makeReport() {
        var type = typeSelect.value;
        var params = new URLSearchParams({
            type: TYPES[type],
            location: WHERE[document.getElementById('where').value],
            from: document.getElementById('from').value,
            to: document.getElementById('to').value,
        });
        box.innerHTML = '<h2>' + esc(type) + '</h2><p class="small">Loading...</p>';
        try {
            render(type, await api('reports.php?' + params));
        } catch (err) {
            box.innerHTML = '<h2>' + esc(type) + '</h2>';
            showError(box.appendChild(document.createElement('div')), err);
        }
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        makeReport();
    });
    makeReport();
})();
