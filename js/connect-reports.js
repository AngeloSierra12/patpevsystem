var REPORT_TYPES = {
    'Summary': 'summary',
    'Stock levels': 'stock-levels',
    'Low stock': 'low-stock',
    'Stock in and out': 'stock-movement',
    'Item counts': 'item-counts',
    'Deliveries': 'deliveries',
    'Suppliers': 'suppliers',
    'Monthly costs': 'monthly-costs'
};

var REPORT_LOCATIONS = {
    'Canteen and hostel': '',
    'Canteen': 'CANTEEN',
    'Hostel': 'HOSTEL'
};

function summaryRow(label, value) {
    return '<tr><td>' + label + '</td><td class="num">' + value + '</td></tr>';
}

function reportTable(headers, rows) {
    if (rows.length === 0) {
        return '<p class="small">Nothing found for these dates.</p>';
    }

    var html = '<table><tr>';
    for (var i = 0; i < headers.length; i++) {
        html += '<th>' + headers[i] + '</th>';
    }
    html += '</tr>';

    for (var r = 0; r < rows.length; r++) {
        html += '<tr>';
        for (var c = 0; c < rows[r].length; c++) {
            html += '<td>' + rows[r][c] + '</td>';
        }
        html += '</tr>';
    }
    return html + '</table>';
}

function reportStatusTag(status) {
    if (status === 'CRITICAL') {
        return '<span class="tag red">Critical</span>';
    }
    if (status === 'LOW') {
        return '<span class="tag yellow">Low</span>';
    }
    if (status === 'REJECTED') {
        return '<span class="tag red">Rejected</span>';
    }
    return 'OK';
}

function dateRangeText(report) {
    if (!report.from && !report.to) {
        return ', all dates';
    }

    var start = 'start';
    if (report.from) {
        start = shortDate(report.from) + ', ' + report.from.slice(0, 4);
    }
    var end = 'today';
    if (report.to) {
        end = shortDate(report.to) + ', ' + report.to.slice(0, 4);
    }
    return ', ' + start + ' to ' + end;
}

function summaryReport(report) {
    var html = '';

    for (var i = 0; i < report.locations.length; i++) {
        var area = report.locations[i];
        var title = 'Hostel supplies';
        if (area.location === 'CANTEEN') {
            title = 'Canteen stock';
        }
        html += '<h3>' + title + '</h3><table>' +
            summaryRow('Items', area.items) +
            summaryRow('Low stock', area.lowStock) +
            summaryRow('Critical', area.critical) +
            summaryRow('Value of stock on hand', money(area.value)) +
            '</table>';
    }

    var moves = report.stockInOut;
    html += '<h3>Stock in and out</h3><table>' +
        summaryRow('Times stock came in', moves.stockIn) +
        summaryRow('Times stock was taken out', moves.stockOut) +
        summaryRow('Item counts recorded', moves.itemCounts) +
        '<tr class="total"><td>Total</td><td class="num">' + moves.total + '</td></tr></table>';

    var deliveries = report.deliveries;
    html += '<h3>Deliveries and suppliers</h3><table>' +
        summaryRow('Suppliers', deliveries.activeSuppliers) +
        summaryRow('Deliveries', deliveries.deliveries) +
        summaryRow('Items delivered', deliveries.itemsDelivered) +
        summaryRow('Value delivered', money(deliveries.value)) +
        '</table>';

    return html;
}

function reportRows(report) {
    var rows = [];

    for (var i = 0; i < report.rows.length; i++) {
        var row = report.rows[i];

        if (report.type === 'stock-levels') {
            rows.push([esc(row.item_name), place(row.location), qty(row.current_stock) + ' ' + esc(row.unit),
                qty(row.reorder_level), money(row.stock_value), reportStatusTag(row.stock_status)]);

        } else if (report.type === 'low-stock') {
            rows.push([esc(row.item_name), place(row.location), qty(row.current_stock) + ' ' + esc(row.unit),
                qty(row.reorder_level), reportStatusTag(row.stock_status), esc(row.preferred_supplier || '-')]);

        } else if (report.type === 'stock-movement') {
            var types = { STOCK_IN: 'In', STOCK_OUT: 'Out', ADJUSTMENT: 'Count' };
            var change = Number(row.net_change);
            var sign = '';
            if (change > 0) {
                sign = '+';
            }
            rows.push([shortDate(row.transaction_date), esc(row.item_name), types[row.transaction_type] || row.transaction_type,
                sign + qty(change) + ' ' + esc(row.unit), qty(row.stock_after), esc(row.performed_by_name || '-')]);

        } else if (report.type === 'item-counts') {
            var systemStock = '-';
            if (row.system_stock) {
                systemStock = qty(row.system_stock);
            }
            var countedStock = '-';
            if (row.counted_stock) {
                countedStock = qty(row.counted_stock);
            }
            var result = '<span class="tag yellow">Corrected</span>';
            if (row.result === 'MATCHED') {
                result = 'Matches';
            }
            rows.push([shortDate(row.counted_at), esc(row.item_name), systemStock, countedStock, result, esc(row.counted_by)]);

        } else if (report.type === 'deliveries') {
            var receipt = esc(row.delivery_receipt_no);
            if (row.status === 'REJECTED') {
                receipt += ' ' + reportStatusTag('REJECTED');
            }
            rows.push([shortDate(row.received_at), receipt, esc(row.supplier_name), place(row.location),
                row.line_item_count, money(row.total_amount)]);

        } else if (report.type === 'suppliers') {
            rows.push([esc(row.supplier_name), esc(row.contact_person || '-'), row.received, row.rejected,
                money(row.total_value), shortDate(row.last_delivery_at)]);

        } else if (report.type === 'monthly-costs') {
            var parts = row.month_year.split('-');
            rows.push([FULL_MONTHS[Number(parts[1]) - 1] + ' ' + parts[0], place(row.location),
                money(row.purchases_value), money(row.usage_cost), money(row.adjustment_value)]);
        }
    }
    return rows;
}

var REPORT_HEADERS = {
    'stock-levels': ['Item', 'For', 'On hand', 'Reorder at', 'Value', 'Status'],
    'low-stock': ['Item', 'For', 'On hand', 'Reorder at', 'Status', 'Supplier'],
    'stock-movement': ['Date', 'Item', 'Type', 'Change', 'Left', 'By'],
    'item-counts': ['Date', 'Item', 'System had', 'Counted', 'Result', 'By'],
    'deliveries': ['Date', 'Delivery no.', 'Supplier', 'For', 'Items', 'Total'],
    'suppliers': ['Supplier', 'Contact', 'Deliveries', 'Rejected', 'Value', 'Last delivery'],
    'monthly-costs': ['Month', 'For', 'Bought', 'Used', 'Count losses']
};

async function makeReport() {
    var box = document.querySelector('#left-col .box');
    var title = document.getElementById('type').value;

    var params = new URLSearchParams({
        type: REPORT_TYPES[title],
        location: REPORT_LOCATIONS[document.getElementById('where').value],
        from: document.getElementById('from').value,
        to: document.getElementById('to').value
    });

    box.innerHTML = '<h2>' + esc(title) + '</h2><p class="small">Loading...</p>';

    var report;
    try {
        report = await api('reports.php?' + params);
    } catch (error) {
        box.innerHTML = '<h2>' + esc(title) + '</h2>';
        var errorBox = document.createElement('div');
        box.appendChild(errorBox);
        showError(errorBox, error);
        return;
    }

    var html = '<h2>' + esc(title) + '</h2><p class="small">' + place(report.location) + dateRangeText(report) + '</p>';
    if (report.type === 'summary') {
        html += summaryReport(report);
    } else {
        html += reportTable(REPORT_HEADERS[report.type], reportRows(report));
    }
    box.innerHTML = html;
}

async function setupReportsPage() {
    var user;
    try {
        user = await startPage();
    } catch (error) {
        return;
    }
    if (user.role !== 'ADMIN') {
        adminOnly();
        return;
    }

    var form = document.getElementById('controls');
    form.removeAttribute('action');

    var typeSelect = document.getElementById('type');
    var hasMonthly = false;
    for (var i = 0; i < typeSelect.options.length; i++) {
        if (typeSelect.options[i].text === 'Monthly costs') {
            hasMonthly = true;
        }
    }
    if (!hasMonthly) {
        typeSelect.add(new Option('Monthly costs'));
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        makeReport();
    });

    makeReport();
}

setupReportsPage();
