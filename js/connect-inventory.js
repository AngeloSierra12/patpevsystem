var inventoryUser = null;
var itemList = [];
var selectedItem = null;
var itemPage = 1;
var itemPages = 1;
var itemTable;
var itemPageText;
var latestRequest = 0;
var formErrors = {};

function field(id) {
    return document.getElementById(id);
}

function findItem(id) {
    for (var i = 0; i < itemList.length; i++) {
        if (itemList[i].id === id) {
            return itemList[i];
        }
    }
    return null;
}

function itemStatus(item) {
    if (!item.isActive) {
        return '<span class="tag grey">Inactive</span>';
    }
    if (item.status === 'CRITICAL') {
        return '<span class="tag red">Critical</span>';
    }
    if (item.status === 'LOW') {
        return '<span class="tag yellow">Low stock</span>';
    }
    return 'OK';
}

function itemTitle(prefix, item) {
    return prefix + ' ' + item.name + ' (' + item.code + ')';
}

function itemRow(item) {
    var actions = '';
    if (item.isActive) {
        actions += '<a href="#" data-act="use" data-id="' + item.id + '">Use</a> - ';
    }
    actions += '<a href="#" data-act="edit" data-id="' + item.id + '">Edit</a> - ';
    if (item.isActive) {
        actions += '<a href="#" data-act="count" data-id="' + item.id + '">Count</a> - ';
    }
    actions += '<a href="#" data-act="details" data-id="' + item.id + '">Details</a>';

    return '<tr><td>' + esc(item.code) + '</td>' +
        '<td>' + esc(item.name) + '</td>' +
        '<td>' + esc(item.categoryName) + '</td>' +
        '<td>' + place(item.location) + '</td>' +
        '<td>' + qty(item.stock) + '</td>' +
        '<td>' + esc(item.unit) + '</td>' +
        '<td>' + qty(item.reorderLevel) + '</td>' +
        '<td>' + itemStatus(item) + '</td>' +
        '<td>' + actions + '</td></tr>';
}

async function loadItems() {
    var inactive = '';
    if (field('inactive').checked) {
        inactive = '1';
    }

    var params = new URLSearchParams({
        page: itemPage,
        search: field('search').value.trim(),
        category: field('category').value,
        status: field('status').value,
        inactive: inactive
    });

    latestRequest = latestRequest + 1;
    var thisRequest = latestRequest;

    var data;
    try {
        data = await api('items.php?' + params);
    } catch (error) {
        if (thisRequest !== latestRequest) {
            return;
        }
        showError(itemPageText, error);
        return;
    }

    if (thisRequest !== latestRequest) {
        return;
    }

    itemList = data.items;
    itemPages = data.pages;
    itemPageText.textContent = 'Page ' + data.page + ' of ' + data.pages + ' (' + data.total + ' items)';

    var html = '<tr><th>Item Code</th><th>Item Name</th><th>Category</th><th>Location</th><th>Current Stock</th>' +
        '<th>Unit</th><th>Reorder Level</th><th>Status</th><th>Quick Actions</th></tr>';
    if (itemList.length === 0) {
        html += '<tr><td colspan="9">No items found.</td></tr>';
    }
    for (var i = 0; i < itemList.length; i++) {
        html += itemRow(itemList[i]);
    }
    itemTable.innerHTML = html;
}

async function fillDropdowns() {
    var data = await api('items.php?page=1');

    var categories = [];
    for (var code in data.categories) {
        categories.push([code, data.categories[code]]);
    }
    makeOptions(field('category'), categories, 'All categories');
    makeOptions(field('add-category'), categories);
    makeOptions(field('edit-category'), categories);
    makeOptions(field('status'), [['OK', 'OK'], ['LOW', 'Low stock'], ['CRITICAL', 'Critical']], 'All statuses');

    var locationOption = [[inventoryUser.location, place(inventoryUser.location)]];
    makeOptions(field('location'), locationOption);
    makeOptions(field('add-location'), locationOption);
    makeOptions(field('edit-location'), locationOption);

    var supplierData = await api('suppliers.php?all=1&status=active');
    var suppliers = [];
    for (var i = 0; i < supplierData.suppliers.length; i++) {
        suppliers.push([supplierData.suppliers[i].id, supplierData.suppliers[i].name]);
    }
    makeOptions(field('add-supplier'), suppliers, 'None');
    makeOptions(field('edit-supplier'), suppliers, 'None');

    if (inventoryUser.location === 'HOSTEL') {
        field('add-code').placeholder = 'H-XXX-013';
    } else {
        field('add-code').placeholder = 'C-XXX-013';
    }
}

function openItemForm(id) {
    var form = document.querySelector('#' + id + ' form');
    formErrors[id].hidden = true;
    form.reset();
    openPopup(id);
}

function openUse(item) {
    openItemForm('use-item');
    document.querySelector('#use-item h2').textContent = itemTitle('Use', item);
    document.querySelector('#use-item .stock-note').textContent = 'Available stock: ' + qty(item.stock) + ' ' + item.unit;
}

function openCount(item) {
    openItemForm('count-item');
    document.querySelector('#count-item h2').textContent = itemTitle('Count', item);
    document.querySelector('#count-item .stock-note').textContent = 'Recorded stock: ' + qty(item.stock) + ' ' + item.unit;
    field('count-reason').required = false;
}

function openEdit(item) {
    openItemForm('edit-item');
    document.querySelector('#edit-item h2').textContent = itemTitle('Edit', item);
    field('edit-name').value = item.name;
    field('edit-code').value = item.code;
    field('edit-category').value = item.category;
    field('edit-reorder').value = item.reorderLevel;
    field('edit-unit').value = item.unit;
    field('edit-critical').value = item.criticalLevel;
    field('edit-cost').value = item.unitCost;
    field('edit-supplier').value = item.supplierId || '';
    field('edit-active').checked = item.isActive;
    field('edit-description').value = item.description || '';
}

async function openDetails(item) {
    var data;
    try {
        data = await api('items.php?id=' + item.id);
    } catch (error) {
        alert(error.message);
        return;
    }
    var details = data.item;

    var types = { STOCK_IN: 'Delivery', STOCK_OUT: 'Used', ADJUSTMENT: 'Count' };
    var moves = '';
    for (var i = 0; i < data.recentMovements.length; i++) {
        var move = data.recentMovements[i];
        var sign = '';
        if (move.change > 0) {
            sign = '+';
        }
        moves += '<tr><td>' + shortDate(move.date) + '</td><td>' + (types[move.type] || move.type) + '</td><td>' +
            sign + qty(move.change) + '</td><td>' + qty(move.stockAfter) + '</td></tr>';
    }

    var html = '<h2>' + esc(itemTitle('Details', details)) + '</h2>' +
        '<p class="label">Description</p><p>' + esc(details.description || '-') + '</p>' +
        '<table class="details">' +
        '<tr><td class="label">Category</td><td>' + esc(details.categoryName) + '</td></tr>' +
        '<tr><td class="label">Unit Cost</td><td>' + money(details.unitCost) + '</td></tr>' +
        '<tr><td class="label">Preferred Supplier</td><td>' + esc(details.supplierName || '-') + '</td></tr>' +
        '<tr><td class="label">Current Stock</td><td>' + qty(details.stock) + ' ' + esc(details.unit) + '</td></tr>' +
        '<tr><td class="label">Reorder Level</td><td>' + qty(details.reorderLevel) + ' ' + esc(details.unit) + '</td></tr>' +
        '<tr><td class="label">Critical Level</td><td>' + qty(details.criticalLevel) + ' ' + esc(details.unit) + '</td></tr>' +
        '<tr><td class="label">Last Restocked</td><td>' + dateTime(details.lastRestockedAt) + '</td></tr>' +
        '<tr><td class="label">Status</td><td>' + itemStatus(details) + '</td></tr>' +
        '</table>';

    if (moves !== '') {
        html += '<p class="label">Recent stock changes</p><table class="details">' +
            '<tr><td class="label">Date</td><td class="label">What</td><td class="label">Change</td><td class="label">Left</td></tr>' +
            moves + '</table>';
    }
    html += '<div class="actions"><a class="button" href="#">Close</a></div>';

    var box = document.querySelector('#item-details .popup-box');
    box.innerHTML = html;
    box.querySelector('.actions a').addEventListener('click', function (event) {
        event.preventDefault();
        closePopup();
    });
    openPopup('item-details');
}

function itemFormValues(prefix) {
    return {
        name: field(prefix + '-name').value.trim(),
        code: field(prefix + '-code').value.trim(),
        category: field(prefix + '-category').value,
        unit: field(prefix + '-unit').value.trim(),
        reorderLevel: field(prefix + '-reorder').value.trim(),
        criticalLevel: field(prefix + '-critical').value.trim(),
        unitCost: field(prefix + '-cost').value.trim(),
        supplierId: field(prefix + '-supplier').value,
        description: field(prefix + '-description').value.trim()
    };
}

async function submitItemForm(id, path, method, body) {
    var button = document.querySelector('#' + id + ' button[type=submit]');
    formErrors[id].hidden = true;
    button.disabled = true;
    try {
        await api(path, method, body);
        closePopup();
        loadItems();
    } catch (error) {
        showFormError(formErrors[id], error.message);
    }
    button.disabled = false;
}

function setupItemForms() {
    var ids = ['add-item', 'edit-item', 'use-item', 'count-item'];
    for (var i = 0; i < ids.length; i++) {
        var form = document.querySelector('#' + ids[i] + ' form');
        form.removeAttribute('action');
        formErrors[ids[i]] = addErrorLine(form);
    }

    document.querySelector('#add-item form').addEventListener('submit', function (event) {
        event.preventDefault();
        submitItemForm('add-item', 'items.php', 'POST', itemFormValues('add'));
    });

    document.querySelector('#edit-item form').addEventListener('submit', function (event) {
        event.preventDefault();
        var body = itemFormValues('edit');
        body.isActive = field('edit-active').checked;
        submitItemForm('edit-item', 'items.php?id=' + selectedItem.id, 'PUT', body);
    });

    document.querySelector('#use-item form').addEventListener('submit', function (event) {
        event.preventDefault();
        submitItemForm('use-item', 'stock.php', 'POST', {
            action: 'use',
            itemId: selectedItem.id,
            quantity: field('use-quantity').value.trim(),
            purpose: field('use-purpose').value.trim(),
            notes: field('use-notes').value.trim()
        });
    });

    document.querySelector('#count-item form').addEventListener('submit', function (event) {
        event.preventDefault();
        submitItemForm('count-item', 'stock.php', 'POST', {
            action: 'count',
            itemId: selectedItem.id,
            countedQuantity: field('count-quantity').value.trim(),
            reason: field('count-reason').value.trim()
        });
    });

    var cancelButtons = document.querySelectorAll('.popup .actions a.button');
    for (var c = 0; c < cancelButtons.length; c++) {
        cancelButtons[c].addEventListener('click', function (event) {
            event.preventDefault();
            closePopup();
        });
    }
}

function setupItemFilters() {
    var filterForm = field('filter');
    filterForm.removeAttribute('action');
    filterForm.addEventListener('submit', function (event) {
        event.preventDefault();
        itemPage = 1;
        loadItems();
    });

    var dropdowns = ['category', 'status', 'inactive'];
    for (var i = 0; i < dropdowns.length; i++) {
        field(dropdowns[i]).addEventListener('change', function () {
            itemPage = 1;
            loadItems();
        });
    }

    var timer;
    field('search').addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
            itemPage = 1;
            loadItems();
        }, 300);
    });

    var pageLinks = document.querySelectorAll('.pages a');
    pageLinks[0].addEventListener('click', function (event) {
        event.preventDefault();
        if (itemPage > 1) {
            itemPage = itemPage - 1;
            loadItems();
        }
    });
    pageLinks[1].addEventListener('click', function (event) {
        event.preventDefault();
        if (itemPage < itemPages) {
            itemPage = itemPage + 1;
            loadItems();
        }
    });
}

async function setupInventoryPage() {
    try {
        inventoryUser = await startPage();
    } catch (error) {
        return;
    }
    if (!inventoryUser.location) {
        adminOnly('Only hostel and canteen staff can open this page.');
        return;
    }

    field('date').textContent = longDate(todayText());
    itemTable = document.querySelector('main > .box > table');
    itemPageText = document.querySelector('.pages p.small');

    setupItemForms();
    setupItemFilters();

    document.querySelector('main a.button[href="#add-item"]').addEventListener('click', function (event) {
        event.preventDefault();
        openItemForm('add-item');
    });

    itemTable.addEventListener('click', function (event) {
        var action = event.target.getAttribute('data-act');
        if (!action) {
            return;
        }
        event.preventDefault();
        selectedItem = findItem(Number(event.target.getAttribute('data-id')));

        if (action === 'use') {
            openUse(selectedItem);
        } else if (action === 'count') {
            openCount(selectedItem);
        } else if (action === 'edit') {
            openEdit(selectedItem);
        } else if (action === 'details') {
            openDetails(selectedItem);
        }
    });

    try {
        await fillDropdowns();
    } catch (error) {
        showError(itemPageText, error);
        return;
    }
    loadItems();
}

setupInventoryPage();
