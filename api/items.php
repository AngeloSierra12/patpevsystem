<?php

require __DIR__ . '/_common.php';
allow_methods(['GET', 'POST', 'PUT']);
$user = require_staff();
$location = ROLE_LOCATION[$user['role']];
$categories = CATEGORIES[$location];

if ($location === 'HOSTEL') {
    $codePrefix = 'H-';
} else {
    $codePrefix = 'C-';
}

const ITEM_SELECT = "SELECT i.*, s.supplier_name,
        CASE WHEN i.current_stock <= i.critical_level THEN 'CRITICAL'
             WHEN i.current_stock <= i.reorder_level THEN 'LOW'
             ELSE 'OK' END AS stock_status
    FROM inventory_items i LEFT JOIN suppliers s ON s.supplier_id = i.preferred_supplier_id";

function item_out($row, $categories)
{
    $categoryName = $row['category'];
    if (isset($categories[$row['category']])) {
        $categoryName = $categories[$row['category']];
    }

    $supplierId = null;
    if ($row['preferred_supplier_id'] !== null) {
        $supplierId = (int) $row['preferred_supplier_id'];
    }

    return [
        'id' => (int) $row['item_id'],
        'code' => $row['item_code'],
        'name' => $row['item_name'],
        'location' => $row['location'],
        'category' => $row['category'],
        'categoryName' => $categoryName,
        'unit' => $row['unit'],
        'stock' => (float) $row['current_stock'],
        'reorderLevel' => (float) $row['reorder_level'],
        'criticalLevel' => (float) $row['critical_level'],
        'unitCost' => (float) $row['unit_cost'],
        'supplierId' => $supplierId,
        'supplierName' => $row['supplier_name'],
        'description' => $row['description'],
        'isActive' => (bool) $row['is_active'],
        'status' => $row['stock_status'],
        'lastRestockedAt' => $row['last_restocked_at'],
        'createdAt' => $row['created_at'],
    ];
}

function find_item($id, $location)
{
    $item = query_one(ITEM_SELECT . ' WHERE i.item_id = ? AND i.location = ?', [$id, $location]);
    if ($item === null) {
        fail('Item not found', 404);
    }
    return $item;
}

function item_fields($data, $categories)
{
    $name = text($data, 'name', 'Item name', 120);
    $code = strtoupper(text($data, 'code', 'Item code'));
    $unit = text($data, 'unit', 'Unit', 30);

    if ($name === '') {
        fail('Item name is required');
    }
    if (!preg_match('/^[A-Z0-9-]{2,25}$/', $code)) {
        fail('Item code must be 2 to 25 letters, numbers or dashes, like C-STP-013');
    }
    if ($unit === '') {
        fail('Unit is required');
    }

    $category = strtoupper(text($data, 'category', 'Category'));
    if (!isset($categories[$category])) {
        fail('Choose a category for this location');
    }

    $reorderLevel = number_param($data, 'reorderLevel', 'Reorder level');
    $criticalLevel = number_param($data, 'criticalLevel', 'Critical level');
    if ($criticalLevel > $reorderLevel) {
        fail('Critical level cannot be higher than the reorder level');
    }

    $unitCost = 0;
    if (isset($data['unitCost']) && $data['unitCost'] !== '') {
        $unitCost = money_param($data, 'unitCost', 'Unit cost');
    }

    $supplierId = null;
    if (isset($data['supplierId'])) {
        $supplierId = $data['supplierId'];
    }
    if (is_array($supplierId)) {
        fail('Choose a supplier');
    }
    if ($supplierId === '') {
        $supplierId = null;
    }
    if ($supplierId !== null) {
        $supplierId = (int) $supplierId;
        $supplier = query_one('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [$supplierId]);
        if ($supplier === null) {
            fail('Supplier not found');
        }
    }

    $description = text($data, 'description', 'Description', 2000);
    if ($description === '') {
        $description = null;
    }

    return [
        'item_name' => $name,
        'item_code' => $code,
        'category' => $category,
        'unit' => $unit,
        'reorder_level' => $reorderLevel,
        'critical_level' => $criticalLevel,
        'unit_cost' => $unitCost,
        'preferred_supplier_id' => $supplierId,
        'description' => $description,
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['id'])) {
    $item = find_item((int) $_GET['id'], $location);

    $rows = query(
        'SELECT transaction_date, transaction_type, net_change, stock_after, reason, performed_by_name
         FROM vw_stock_movement WHERE item_code = ? ORDER BY transaction_date DESC, txn_id DESC LIMIT 5',
        [$item['item_code']]
    );

    $movements = [];
    foreach ($rows as $row) {
        $movements[] = [
            'date' => $row['transaction_date'],
            'type' => $row['transaction_type'],
            'change' => (float) $row['net_change'],
            'stockAfter' => (float) $row['stock_after'],
            'reason' => $row['reason'],
            'by' => $row['performed_by_name'],
        ];
    }

    respond(['item' => item_out($item, $categories), 'recentMovements' => $movements]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = ' WHERE i.location = ?';
    $params = [$location];

    if (empty($_GET['inactive'])) {
        $where .= ' AND i.is_active = 1';
    }

    $search = '';
    if (isset($_GET['search'])) {
        $search = trim($_GET['search']);
    }
    if ($search !== '') {
        $where .= ' AND (i.item_name LIKE ? OR i.item_code LIKE ?)';
        $params[] = '%' . $search . '%';
        $params[] = '%' . $search . '%';
    }

    $category = '';
    if (isset($_GET['category'])) {
        $category = strtoupper($_GET['category']);
    }
    if ($category !== '' && $category !== 'ALL') {
        if (!isset($categories[$category])) {
            fail('Unknown category');
        }
        $where .= ' AND i.category = ?';
        $params[] = $category;
    }

    $status = '';
    if (isset($_GET['status'])) {
        $status = strtoupper($_GET['status']);
    }
    if ($status === 'OK') {
        $where .= ' AND i.current_stock > i.reorder_level';
    } elseif ($status === 'LOW') {
        $where .= ' AND i.current_stock <= i.reorder_level AND i.current_stock > i.critical_level';
    } elseif ($status === 'CRITICAL') {
        $where .= ' AND i.current_stock <= i.critical_level';
    } elseif ($status !== '' && $status !== 'ALL') {
        fail('Unknown status');
    }

    $perPage = 15;
    if (!empty($_GET['all'])) {
        $perPage = 1000;
    }
    $page = page_number();
    $offset = ($page - 1) * $perPage;

    $count = query_one('SELECT COUNT(*) AS total FROM inventory_items i' . $where, $params);
    $total = (int) $count['total'];
    $rows = query(ITEM_SELECT . $where . " ORDER BY i.item_code LIMIT $perPage OFFSET $offset", $params);

    $items = [];
    foreach ($rows as $row) {
        $items[] = item_out($row, $categories);
    }

    $pages = (int) ceil($total / $perPage);
    if ($pages < 1) {
        $pages = 1;
    }

    respond([
        'location' => $location,
        'categories' => $categories,
        'total' => $total,
        'page' => $page,
        'pages' => $pages,
        'items' => $items,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $fields = item_fields(input(), $categories);

    if (strpos($fields['item_code'], $codePrefix) !== 0) {
        fail("Item codes for this location start with $codePrefix, like {$codePrefix}XXX-013");
    }

    query(
        'INSERT INTO inventory_items
            (item_code, item_name, location, category, unit, reorder_level, critical_level, unit_cost, preferred_supplier_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $fields['item_code'],
            $fields['item_name'],
            $location,
            $fields['category'],
            $fields['unit'],
            $fields['reorder_level'],
            $fields['critical_level'],
            $fields['unit_cost'],
            $fields['preferred_supplier_id'],
            $fields['description'],
        ]
    );
    $id = (int) db()->lastInsertId();

    $categoryName = $categories[$fields['category']];
    audit('ITEM_CREATED', 'INVENTORY_ITEM', $id,
        'Item ' . $fields['item_code'] . ' added: ' . $fields['item_name'] . " ($categoryName, " . strtolower($location) . ')');

    respond(['item' => item_out(find_item($id, $location), $categories)], 201);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $id = 0;
    if (isset($_GET['id'])) {
        $id = (int) $_GET['id'];
    }
    $before = find_item($id, $location);

    $data = input();
    $currentValues = [
        'name' => $before['item_name'],
        'code' => $before['item_code'],
        'category' => $before['category'],
        'unit' => $before['unit'],
        'reorderLevel' => $before['reorder_level'],
        'criticalLevel' => $before['critical_level'],
        'unitCost' => $before['unit_cost'],
        'supplierId' => $before['preferred_supplier_id'],
        'description' => $before['description'],
    ];
    foreach ($currentValues as $key => $value) {
        if (!array_key_exists($key, $data)) {
            if ($value === null) {
                $value = '';
            }
            $data[$key] = $value;
        }
    }

    $fields = item_fields($data, $categories);

    if ($fields['item_code'] !== $before['item_code']) {
        if (strpos($fields['item_code'], $codePrefix) !== 0) {
            fail("Item codes for this location start with $codePrefix");
        }
        $history = query_one('SELECT txn_id FROM inventory_transactions WHERE item_id = ? LIMIT 1', [$id]);
        if ($history !== null) {
            fail("The item code can't change once the item has stock history");
        }
    }

    $isActive = (int) $before['is_active'];
    if (isset($data['isActive'])) {
        if ($data['isActive']) {
            $isActive = 1;
        } else {
            $isActive = 0;
        }
    }

    query(
        'UPDATE inventory_items
         SET item_name = ?, item_code = ?, category = ?, unit = ?, reorder_level = ?, critical_level = ?,
             unit_cost = ?, preferred_supplier_id = ?, description = ?, is_active = ?
         WHERE item_id = ?',
        [
            $fields['item_name'],
            $fields['item_code'],
            $fields['category'],
            $fields['unit'],
            $fields['reorder_level'],
            $fields['critical_level'],
            $fields['unit_cost'],
            $fields['preferred_supplier_id'],
            $fields['description'],
            $isActive,
            $id,
        ]
    );

    $changes = [];
    if ($fields['item_code'] !== $before['item_code']) {
        $changes[] = 'code: ' . $before['item_code'] . ' -> ' . $fields['item_code'];
    }
    if ((float) $fields['unit_cost'] !== (float) $before['unit_cost']) {
        $changes[] = 'unit_cost: ' . $before['unit_cost'] . ' -> ' . $fields['unit_cost'];
    }
    if ((string) $fields['description'] !== (string) $before['description']) {
        $changes[] = 'description changed';
    }
    if (count($changes) > 0) {
        audit('ITEM_UPDATED', 'INVENTORY_ITEM', $id, 'Item ' . $fields['item_code'] . ' updated: ' . implode('; ', $changes));
    }

    respond(['item' => item_out(find_item($id, $location), $categories)]);
}
