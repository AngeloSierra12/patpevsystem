(async function () {
    try {
        await startPage();
        var data = await api('dashboard.php');
    } catch (err) {
        showError(document.getElementById('summary'), err);
        return;
    }

    document.getElementById('date').textContent = longDate(data.date);

    var cards = document.querySelectorAll('#summary .box');
    cards.forEach(function (box, i) {
        var loc = data.locations[i];
        if (!loc) {
            box.style.display = 'none';
            return;
        }
        box.innerHTML =
            '<div class="card-top"><h2>' + place(loc.location) + '</h2><span class="small">' + loc.items + ' items</span></div>' +
            '<div class="counts">' +
                '<div class="count' + (loc.lowStock ? ' low' : '') + '"><b>' + loc.lowStock + '</b><span>Low stock</span></div>' +
                '<div class="count' + (loc.critical ? ' critical' : '') + '"><b>' + loc.critical + '</b><span>Critical</span></div>' +
            '</div>' +
            '<p class="small">' + (loc.lastDelivery
                ? 'Last delivery ' + shortDate(loc.lastDelivery.date) + ' from ' + esc(loc.lastDelivery.supplier)
                : 'No deliveries yet') + '</p>' +
            '<a class="more off">See ' + place(loc.location).toLowerCase() + ' stock</a>';
    });

    var tables = document.querySelectorAll('#left-col .box table');

    var head = '<tr><th></th>', delivered = '<tr><td><b>Deliveries</b></td>', taken = '<tr><td><b>Taken out</b></td>';
    data.week.forEach(function (d) {
        var cls = d.isToday ? ' class="today"' : '';
        var date = new Date(d.date + 'T00:00:00');
        head += '<th>' + DAYS[date.getDay()] + ' ' + date.getDate() + '</th>';
        delivered += '<td' + cls + '>' + (d.deliveries === null ? '-' : d.deliveries) + '</td>';
        taken += '<td' + cls + '>' + (d.takenOut === null ? '-' : d.takenOut) + '</td>';
    });
    tables[0].innerHTML = head + '</tr>' + delivered + '</tr>' + taken + '</tr>';

    tables[1].innerHTML = '<tr><th>Date</th><th>Delivery no.</th><th>Supplier</th><th>For</th><th>Items</th></tr>' +
        (data.recentDeliveries.length ? data.recentDeliveries.map(function (d) {
            return '<tr><td>' + shortDate(d.date) + '</td><td>' + esc(d.receiptNo) +
                (d.status === 'REJECTED' ? ' <span class="tag red">Rejected</span>' : '') + '</td><td>' +
                esc(d.supplier) + '</td><td>' + place(d.location) + '</td><td>' + d.items + '</td></tr>';
        }).join('') : '<tr><td colspan="5">No deliveries yet.</td></tr>');

    var attention = document.querySelector('#right-col .box');
    attention.innerHTML = '<h2>Needs attention (' + data.needsAttention.length + ')</h2>' +
        (data.needsAttention.length ? data.needsAttention.map(function (item) {
            var critical = item.status === 'CRITICAL';
            return '<div class="alert"><span class="tag ' + (critical ? 'red' : 'yellow') + '">' +
                (critical ? 'Critical' : 'Low stock') + '</span>' +
                '<p><b>' + esc(item.name) + '</b> - ' + place(item.location).toLowerCase() + ', ' +
                qty(item.stock) + ' ' + esc(item.unit) + ' left.</p><a class="off">See stock</a></div>';
        }).join('') : '<p class="small">Nothing needs attention right now.</p>');
})();
