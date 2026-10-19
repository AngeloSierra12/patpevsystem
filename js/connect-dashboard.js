function locationCard(card, user) {
    var lowClass = '';
    if (card.lowStock > 0) {
        lowClass = ' low';
    }
    var criticalClass = '';
    if (card.critical > 0) {
        criticalClass = ' critical';
    }

    var lastDelivery = 'No deliveries yet';
    if (card.lastDelivery) {
        lastDelivery = 'Last delivery ' + shortDate(card.lastDelivery.date) + ' from ' + esc(card.lastDelivery.supplier);
    }

    var stockLink = '';
    if (user.location) {
        stockLink = '<a class="more" href="inventory.html">See ' + place(card.location).toLowerCase() + ' stock</a>';
    }

    return '<div class="card-top"><h2>' + place(card.location) + '</h2><span class="small">' + card.items + ' items</span></div>' +
        '<div class="counts">' +
        '<div class="count' + lowClass + '"><b>' + card.lowStock + '</b><span>Low stock</span></div>' +
        '<div class="count' + criticalClass + '"><b>' + card.critical + '</b><span>Critical</span></div>' +
        '</div>' +
        '<p class="small">' + lastDelivery + '</p>' +
        stockLink;
}

function weekTable(week) {
    var header = '<tr><th></th>';
    var deliveries = '<tr><td><b>Deliveries</b></td>';
    var takenOut = '<tr><td><b>Taken out</b></td>';

    for (var i = 0; i < week.length; i++) {
        var day = week[i];
        var cellClass = '';
        if (day.isToday) {
            cellClass = ' class="today"';
        }

        var date = new Date(day.date + 'T00:00:00');
        header += '<th>' + DAYS[date.getDay()] + ' ' + date.getDate() + '</th>';

        var delivered = day.deliveries;
        if (delivered === null) {
            delivered = '-';
        }
        var used = day.takenOut;
        if (used === null) {
            used = '-';
        }
        deliveries += '<td' + cellClass + '>' + delivered + '</td>';
        takenOut += '<td' + cellClass + '>' + used + '</td>';
    }

    return header + '</tr>' + deliveries + '</tr>' + takenOut + '</tr>';
}

function recentDeliveriesTable(deliveries) {
    var html = '<tr><th>Date</th><th>Delivery no.</th><th>Supplier</th><th>For</th><th>Items</th></tr>';
    if (deliveries.length === 0) {
        return html + '<tr><td colspan="5">No deliveries yet.</td></tr>';
    }

    for (var i = 0; i < deliveries.length; i++) {
        var delivery = deliveries[i];
        var rejected = '';
        if (delivery.status === 'REJECTED') {
            rejected = ' <span class="tag red">Rejected</span>';
        }
        html += '<tr><td>' + shortDate(delivery.date) + '</td>' +
            '<td>' + esc(delivery.receiptNo) + rejected + '</td>' +
            '<td>' + esc(delivery.supplier) + '</td>' +
            '<td>' + place(delivery.location) + '</td>' +
            '<td>' + delivery.items + '</td></tr>';
    }
    return html;
}

function attentionBox(items, user) {
    var html = '<h2>Needs attention (' + items.length + ')</h2>';
    if (items.length === 0) {
        return html + '<p class="small">Nothing needs attention right now.</p>';
    }

    var stockLink = '';
    if (user.location) {
        stockLink = '<a href="inventory.html">See stock</a>';
    }

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var tag = '<span class="tag yellow">Low stock</span>';
        if (item.status === 'CRITICAL') {
            tag = '<span class="tag red">Critical</span>';
        }
        html += '<div class="alert">' + tag +
            '<p><b>' + esc(item.name) + '</b> - ' + place(item.location).toLowerCase() + ', ' +
            qty(item.stock) + ' ' + esc(unitName(item.stock, item.unit)) + ' left.</p>' + stockLink + '</div>';
    }
    return html;
}

async function setupDashboard() {
    var user;
    var data;
    try {
        user = await startPage();
        data = await api('dashboard.php');
    } catch (error) {
        showError(document.getElementById('summary'), error);
        return;
    }

    document.getElementById('date').textContent = longDate(data.date);

    var cards = document.querySelectorAll('#summary .box');
    for (var i = 0; i < cards.length; i++) {
        if (i < data.locations.length) {
            cards[i].innerHTML = locationCard(data.locations[i], user);
        } else {
            cards[i].style.display = 'none';
        }
    }

    var tables = document.querySelectorAll('#left-col .box table');
    tables[0].innerHTML = weekTable(data.week);
    tables[1].innerHTML = recentDeliveriesTable(data.recentDeliveries);

    document.querySelector('#right-col .box').innerHTML = attentionBox(data.needsAttention, user);
}

setupDashboard();
