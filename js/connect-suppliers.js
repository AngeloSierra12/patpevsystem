var supplierUser = null;
var supplierList = [];
var selectedSupplier = null;
var supplierPage = 1;
var supplierPages = 1;
var supplierTable;
var supplierPageText;
var latestRequest = 0;
var stockItems = [];
var deliveryLines = [];
var formErrors = {};

function field(id) {
    return document.getElementById(id);
}

function findSupplier(id) {
    for (var i = 0; i < supplierList.length; i++) {
        if (supplierList[i].id === id) {
            return supplierList[i];
        }
    }
    return null;
}

function findStockItem(id) {
    for (var i = 0; i < stockItems.length; i++) {
        if (stockItems[i].id === id) {
            return stockItems[i];
        }
    }
    return null;
}

function supplierRow(supplier) {
    var status = 'Active';
    if (!supplier.isActive) {
        status = '<span class="tag grey">Inactive</span>';
    }

    return '<tr><td>' + esc(supplier.name) + '</td>' +
        '<td>' + esc(supplier.contactPerson || '-') + '</td>' +
        '<td>' + esc(supplier.phone || '-') + '</td>' +
        '<td>' + esc(supplier.email || '-') + '</td>' +
        '<td>' + esc(supplier.categories || '-') + '</td>' +
        '<td>' + status + '</td>' +
        '<td><a href="#" data-act="edit" data-id="' + supplier.id + '">Edit</a> - ' +
        '<a href="#" data-act="details" data-id="' + supplier.id + '">Details</a> - ' +
        '<a href="#" data-act="deliveries" data-id="' + supplier.id + '">Recent Deliveries</a></td></tr>';
}

async function loadSuppliers() {
    var category = field('category').value;
    if (category === 'All categories') {
        category = '';
    }

    var status = '';
    if (field('status').value === 'Active') {
        status = 'active';
    } else if (field('status').value === 'Inactive') {
        status = 'inactive';
    }

    var params = new URLSearchParams({
        page: supplierPage,
        search: field('search').value.trim(),
        category: category,
        status: status
    });

    latestRequest = latestRequest + 1;
    var thisRequest = latestRequest;

    var data;
    try {
        data = await api('suppliers.php?' + params);
    } catch (error) {
        if (thisRequest !== latestRequest) {
            return;
        }
        showError(supplierPageText, error);
        return;
    }

    if (thisRequest !== latestRequest) {
        return;
    }

    supplierList = data.suppliers;
    supplierPages = data.pages;
    supplierPageText.textContent = 'Page ' + data.page + ' of ' + data.pages + ' (' + data.total + ' suppliers)';

    var html = '<tr><th>Supplier Name</th><th>Contact Person</th><th>Phone</th><th>Email</th>' +
        '<th>Supplied Categories</th><th>Status</th><th>Quick Actions</th></tr>';
    if (supplierList.length === 0) {
        html += '<tr><td colspan="7">No suppliers found.</td></tr>';
    }
    for (var i = 0; i < supplierList.length; i++) {
        html += supplierRow(supplierList[i]);
    }
    supplierTable.innerHTML = html;
}

async function loadDeliveryOptions() {
    var supplierData = await api('suppliers.php?all=1&status=active');
    var suppliers = [];
    for (var i = 0; i < supplierData.suppliers.length; i++) {
        suppliers.push([supplierData.suppliers[i].id, supplierData.suppliers[i].name]);
    }
    makeOptions(field('del-supplier'), suppliers, 'Choose a supplier');

    var itemData = await api('items.php?all=1');
    stockItems = itemData.items;
    var items = [];
    for (var j = 0; j < stockItems.length; j++) {
        items.push([stockItems[j].id, stockItems[j].name + ' (' + stockItems[j].code + ')']);
    }
    makeOptions(field('line-item'), items, 'Choose an item');
}

function chosenCategories(select) {
    var chosen = [];
    for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].selected) {
            chosen.push(select.options[i].value);
        }
    }
    return chosen.join(', ');
}

function selectCategories(select, text) {
    var wanted = (text || '').split(',');
    for (var i = 0; i < wanted.length; i++) {
        wanted[i] = wanted[i].trim().toLowerCase();
    }
    for (var j = 0; j < select.options.length; j++) {
        var option = select.options[j];
        option.selected = wanted.indexOf(option.value.toLowerCase()) !== -1;
    }
}

function openSupplierForm(id) {
    formErrors[id].hidden = true;
    document.querySelector('#' + id + ' form').reset();
    openPopup(id);
}

function openSupplierEdit(supplier) {
    openSupplierForm('edit-supplier');
    document.querySelector('#edit-supplier h2').textContent = 'Edit ' + supplier.name;
    field('edit-name').value = supplier.name;
    field('edit-person').value = supplier.contactPerson || '';
    field('edit-phone').value = supplier.phone || '';
    field('edit-email').value = supplier.email || '';
    field('edit-address').value = supplier.address || '';
    selectCategories(field('edit-categories'), supplier.categories);
    field('edit-active').checked = supplier.isActive;
    field('edit-notes').value = supplier.notes || '';
}

function showPopupContent(id, html) {
    var box = document.querySelector('#' + id + ' .popup-box');
    box.innerHTML = html + '<div class="actions"><a class="button" href="#">Close</a></div>';
    box.querySelector('.actions a').addEventListener('click', function (event) {
        event.preventDefault();
        closePopup();
    });
    openPopup(id);
}

function openSupplierDetails(supplier) {
    var rows = [
        ['Contact Person', supplier.contactPerson],
        ['Address', supplier.address],
        ['Phone', supplier.phone],
        ['Email', supplier.email],
        ['Supplied Categories', supplier.categories],
        ['Status', supplier.isActive ? 'Active' : 'Inactive'],
        ['Notes', supplier.notes]
    ];

    var html = '<h2>Details ' + esc(supplier.name) + '</h2><table class="details">';
    for (var i = 0; i < rows.length; i++) {
        html += '<tr><td class="label">' + rows[i][0] + '</td><td>' + esc(rows[i][1] || '-') + '</td></tr>';
    }
    html += '</table>';
    showPopupContent('supplier-details', html);
}

async function openRecentDeliveries(supplier) {
    var data;
    try {
        data = await api('suppliers.php?deliveries=1&id=' + supplier.id);
    } catch (error) {
        alert(error.message);
        return;
    }

    var html = '<h2>Recent Deliveries ' + esc(supplier.name) + '</h2>';
    if (data.deliveries.length === 0) {
        html += '<p class="small">No deliveries from this supplier for the ' + place(supplierUser.location).toLowerCase() + ' yet.</p>';
    } else {
        html += '<table class="lines"><tr><th>Receipt No.</th><th>Status</th><th>Date Received</th><th>Items</th><th>Total Amount</th><th>Notes</th></tr>';
        for (var i = 0; i < data.deliveries.length; i++) {
            var delivery = data.deliveries[i];
            var status = 'Received';
            if (delivery.status === 'REJECTED') {
                status = '<span class="tag red">Rejected</span>';
            }
            html += '<tr><td>' + esc(delivery.receiptNo) + '</td><td>' + status + '</td>' +
                '<td>' + delivery.date.slice(0, 10) + '</td><td>' + delivery.items + '</td><td>' + money(delivery.total) + '</td><td>' + esc(delivery.notes || '-') + '</td></tr>';
        }
        html += '</table>';
    }
    showPopupContent('recent-deliveries', html);
}

function supplierFormValues(prefix) {
    return {
        name: field(prefix + '-name').value.trim(),
        contactPerson: field(prefix + '-person').value.trim(),
        phone: field(prefix + '-phone').value.trim(),
        email: field(prefix + '-email').value.trim(),
        address: field(prefix + '-address').value.trim(),
        categories: chosenCategories(field(prefix + '-categories')),
        notes: field(prefix + '-notes').value.trim()
    };
}

async function submitSupplierForm(id, path, method, body, successMessage) {
    var button = document.querySelector('#' + id + ' button[type=submit]');
    formErrors[id].hidden = true;
    button.disabled = true;
    try {
        await api(path, method, body);
        closePopup();
        if (successMessage) {
            alert(successMessage);
        }
        loadDeliveryOptions();
        loadSuppliers();
    } catch (error) {
        showFormError(formErrors[id], error.message);
    }
    button.disabled = false;
}

function isRejected() {
    return field('del-status').value === 'Rejected';
}

function drawDeliveryLines() {
    var linesTable = document.querySelector('#add-delivery table.lines');
    var total = 0;

    var html = '<tr><th>Item</th><th>Quantity</th><th>Unit Cost</th><th>Line Total</th><th></th></tr>';
    for (var i = 0; i < deliveryLines.length; i++) {
        var line = deliveryLines[i];
        var lineTotal = line.quantity * line.unitCost;
        total += lineTotal;
        html += '<tr><td>' + esc(line.name) + '</td>' +
            '<td>' + qty(line.quantity) + ' ' + esc(line.unit) + '</td>' +
            '<td>' + money(line.unitCost) + '</td>' +
            '<td>' + money(lineTotal) + '</td>' +
            '<td><a href="#" data-remove="' + i + '">Remove</a></td></tr>';
    }
    if (deliveryLines.length === 0) {
        if (isRejected()) {
            html += '<tr><td colspan="5">A rejected delivery has no items.</td></tr>';
        } else {
            html += '<tr><td colspan="5">No items yet. Click "Add another item".</td></tr>';
        }
    }
    linesTable.innerHTML = html;

    if (isRejected()) {
        total = 0;
    }
    document.querySelector('#add-delivery p.total').innerHTML = 'Total: <b>' + money(total) + '</b>';

    var addLineLink = document.querySelector('#add-delivery a.add-line');
    if (isRejected()) {
        addLineLink.style.display = 'none';
        linesTable.style.opacity = '0.5';
    } else {
        addLineLink.style.display = '';
        linesTable.style.opacity = '';
    }
}

function updateLineTotal() {
    var quantity = Number(field('line-quantity').value) || 0;
    var cost = Number(field('line-cost').value) || 0;
    document.querySelector('#add-line .stock-note').textContent = 'Line total: ' + money(quantity * cost);
}

function addDeliveryLine(event) {
    event.preventDefault();

    var itemId = Number(field('line-item').value);
    var quantity = Number(field('line-quantity').value);
    var cost = Number(field('line-cost').value);
    if (field('line-cost').value.trim() === '' && findStockItem(itemId)) {
        cost = findStockItem(itemId).unitCost;
    }

    var alreadyAdded = false;
    for (var i = 0; i < deliveryLines.length; i++) {
        if (deliveryLines[i].itemId === itemId) {
            alreadyAdded = true;
        }
    }

    var problem = '';
    if (!itemId) {
        problem = 'Choose an item.';
    } else if (!(quantity > 0)) {
        problem = 'Quantity must be more than 0.';
    } else if (!(cost >= 0)) {
        problem = 'Unit cost must be 0 or more.';
    } else if (alreadyAdded) {
        problem = 'That item is already on this delivery. Remove it first to change it.';
    }
    if (problem !== '') {
        showFormError(formErrors['add-line'], problem);
        return;
    }

    var item = findStockItem(itemId);
    deliveryLines.push({ itemId: itemId, quantity: quantity, unitCost: cost, name: item.name, unit: item.unit });
    formErrors['add-delivery'].hidden = true;
    drawDeliveryLines();
    openPopup('add-delivery');
}

function saveDelivery(event) {
    event.preventDefault();

    var status = 'RECEIVED';
    var lines = deliveryLines;
    var message = 'Delivery recorded. Stock has been added to the inventory.';
    if (isRejected()) {
        status = 'REJECTED';
        lines = [];
        message = 'Rejected delivery recorded.';
    }

    submitSupplierForm('add-delivery', 'deliveries.php', 'POST', {
        supplierId: field('del-supplier').value,
        receiptNo: field('del-receipt').value.trim(),
        date: field('del-date').value,
        status: status,
        notes: field('del-notes').value.trim(),
        lines: lines
    }, message);
}

function setupSupplierForms() {
    var ids = ['add-supplier', 'edit-supplier', 'add-delivery', 'add-line'];
    for (var i = 0; i < ids.length; i++) {
        var form = document.querySelector('#' + ids[i] + ' form');
        form.removeAttribute('action');
        formErrors[ids[i]] = addErrorLine(form);
    }

    var categorySelects = ['add-categories', 'edit-categories'];
    for (var c = 0; c < categorySelects.length; c++) {
        field(categorySelects[c]).multiple = true;
        field(categorySelects[c]).size = 5;
        field(categorySelects[c]).title = 'Hold Ctrl to choose more than one';
    }

    document.querySelector('#add-supplier form').addEventListener('submit', function (event) {
        event.preventDefault();
        submitSupplierForm('add-supplier', 'suppliers.php', 'POST', supplierFormValues('add'));
    });

    document.querySelector('#edit-supplier form').addEventListener('submit', function (event) {
        event.preventDefault();
        var body = supplierFormValues('edit');
        body.isActive = field('edit-active').checked;
        submitSupplierForm('edit-supplier', 'suppliers.php?id=' + selectedSupplier.id, 'PUT', body);
    });

    document.querySelector('#add-delivery form').addEventListener('submit', saveDelivery);
    document.querySelector('#add-line form').addEventListener('submit', addDeliveryLine);

    var cancelButtons = document.querySelectorAll('#add-supplier .actions a.button, #edit-supplier .actions a.button, #add-delivery .actions a.button');
    for (var b = 0; b < cancelButtons.length; b++) {
        cancelButtons[b].addEventListener('click', function (event) {
            event.preventDefault();
            closePopup();
        });
    }

    document.querySelector('#add-line .actions a.button').addEventListener('click', function (event) {
        event.preventDefault();
        openPopup('add-delivery');
    });
}

function setupDeliveryForm() {
    makeOptions(field('del-location'), [[supplierUser.location, place(supplierUser.location)]]);

    document.querySelector('main a.button[href="#add-delivery"]').addEventListener('click', function (event) {
        event.preventDefault();
        openSupplierForm('add-delivery');
        deliveryLines = [];
        field('del-date').value = todayText();
        field('del-date').max = todayText();
        drawDeliveryLines();
    });

    document.querySelector('#add-delivery a.add-line').addEventListener('click', function (event) {
        event.preventDefault();
        document.querySelector('#add-line form').reset();
        formErrors['add-line'].hidden = true;
        updateLineTotal();
        openPopup('add-line');
    });

    document.querySelector('#add-delivery table.lines').addEventListener('click', function (event) {
        var index = event.target.getAttribute('data-remove');
        if (index === null) {
            return;
        }
        event.preventDefault();
        deliveryLines.splice(Number(index), 1);
        drawDeliveryLines();
    });

    field('del-status').addEventListener('change', drawDeliveryLines);
    field('line-quantity').addEventListener('input', updateLineTotal);
    field('line-cost').addEventListener('input', updateLineTotal);
    field('line-item').addEventListener('change', function () {
        var item = findStockItem(Number(field('line-item').value));
        if (item && field('line-cost').value === '') {
            field('line-cost').value = item.unitCost || '';
        }
        updateLineTotal();
    });
}

function setupSupplierFilters() {
    var filterForm = field('filter');
    filterForm.removeAttribute('action');
    filterForm.addEventListener('submit', function (event) {
        event.preventDefault();
        supplierPage = 1;
        loadSuppliers();
    });

    var dropdowns = ['category', 'status'];
    for (var i = 0; i < dropdowns.length; i++) {
        field(dropdowns[i]).addEventListener('change', function () {
            supplierPage = 1;
            loadSuppliers();
        });
    }

    var timer;
    field('search').addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
            supplierPage = 1;
            loadSuppliers();
        }, 300);
    });

    var pageLinks = document.querySelectorAll('.pages a');
    pageLinks[0].addEventListener('click', function (event) {
        event.preventDefault();
        if (supplierPage > 1) {
            supplierPage = supplierPage - 1;
            loadSuppliers();
        }
    });
    pageLinks[1].addEventListener('click', function (event) {
        event.preventDefault();
        if (supplierPage < supplierPages) {
            supplierPage = supplierPage + 1;
            loadSuppliers();
        }
    });
}

async function setupSuppliersPage() {
    try {
        supplierUser = await startPage();
    } catch (error) {
        return;
    }
    if (!supplierUser.location) {
        adminOnly('Only hostel and canteen staff can open this page.');
        return;
    }

    field('date').textContent = longDate(todayText());
    supplierTable = document.querySelector('main > .box > table');
    supplierPageText = document.querySelector('.pages p.small');

    setupSupplierForms();
    setupDeliveryForm();
    setupSupplierFilters();

    document.querySelector('main a.button[href="#add-supplier"]').addEventListener('click', function (event) {
        event.preventDefault();
        openSupplierForm('add-supplier');
    });

    supplierTable.addEventListener('click', function (event) {
        var action = event.target.getAttribute('data-act');
        if (!action) {
            return;
        }
        event.preventDefault();
        selectedSupplier = findSupplier(Number(event.target.getAttribute('data-id')));

        if (action === 'edit') {
            openSupplierEdit(selectedSupplier);
        } else if (action === 'details') {
            openSupplierDetails(selectedSupplier);
        } else if (action === 'deliveries') {
            openRecentDeliveries(selectedSupplier);
        }
    });

    loadSuppliers();
    try {
        await loadDeliveryOptions();
    } catch (error) {
        showError(supplierPageText, error);
    }
}

setupSuppliersPage();
