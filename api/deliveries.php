<?php

require __DIR__ . '/_common.php';
allow_methods(['GET', 'POST']);
$user = require_staff();
$location = ROLE_LOCATION[$user['role']];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = 0;
    if (isset($_GET['id'])) {
        $id = (int) $_GET['id'];
    }

    $delivery = query_one('SELECT * FROM vw_delivery_summary WHERE delivery_id = ? AND location = ?', [$id, $location]);
    if ($delivery === null) {
        fail('Delivery not found', 404);
    }

    $rows = query(
        'SELECT di.item_id, i.item_code, i.item_name, i.unit, di.quantity, di.unit_cost, di.line_total
         FROM delivery_items di JOIN inventory_items i ON i.item_id = di.item_id
         WHERE di.delivery_id = ? ORDER BY di.delivery_item_id',
        [$id]
    );

    $lines = [];
    foreach ($rows as $row) {
        $lines[] = [
            'itemId' => (int) $row['item_id'],
            'code' => $row['item_code'],
            'name' => $row['item_name'],
            'unit' => $row['unit'],
            'quantity' => (float) $row['quantity'],
            'unitCost' => (float) $row['unit_cost'],
            'lineTotal' => (float) $row['line_total'],
        ];
    }

    respond([
        'id' => (int) $delivery['delivery_id'],
        'receiptNo' => $delivery['delivery_receipt_no'],
        'supplierId' => (int) $delivery['supplier_id'],
        'supplier' => $delivery['supplier_name'],
        'location' => $delivery['location'],
        'status' => $delivery['status'],
        'date' => $delivery['received_at'],
        'total' => (float) $delivery['total_amount'],
        'notes' => $delivery['notes'],
        'receivedBy' => $delivery['received_by_name'],
        'lines' => $lines,
    ]);
}

$data = input();

$supplierId = 0;
if (isset($data['supplierId']) && is_numeric($data['supplierId'])) {
    $supplierId = (int) $data['supplierId'];
}
$supplier = query_one('SELECT supplier_id, is_active FROM suppliers WHERE supplier_id = ?', [$supplierId]);
if ($supplier === null) {
    fail('Choose a supplier');
}
if (!$supplier['is_active']) {
    fail('This supplier is inactive. Reactivate it first.');
}

$receiptNo = text($data, 'receiptNo', 'Receipt number', 60);
if ($receiptNo === '') {
    fail('Receipt number is required');
}

$status = strtoupper(text($data, 'status', 'Status'));
if ($status === '') {
    $status = 'RECEIVED';
}
if ($status !== 'RECEIVED' && $status !== 'REJECTED') {
    fail('Status must be Received or Rejected');
}

$today = date('Y-m-d');
$date = date_param(text($data, 'date', 'Date received'), 'Date received');
if ($date === null) {
    $date = $today;
}
if ($date > $today) {
    fail("Date received can't be in the future");
}
if ($date === $today) {
    $receivedAt = date('Y-m-d H:i:s');
} else {
    $receivedAt = $date . ' 12:00:00';
}

$lines = [];
if ($status === 'RECEIVED') {
    $sentLines = [];
    if (isset($data['lines'])) {
        $sentLines = $data['lines'];
    }
    if (!is_array($sentLines) || count($sentLines) === 0) {
        fail('Add at least one item to the delivery');
    }
    if (count($sentLines) > 100) {
        fail('Too many items in one delivery');
    }

    $alreadyAdded = [];
    $number = 0;
    foreach ($sentLines as $line) {
        $number++;
        $label = 'Item ' . $number;

        if (!is_array($line)) {
            fail("$label is not filled in correctly");
        }

        $itemId = 0;
        if (isset($line['itemId']) && is_numeric($line['itemId'])) {
            $itemId = (int) $line['itemId'];
        }

        $item = query_one(
            'SELECT item_id, item_name, is_active FROM inventory_items WHERE item_id = ? AND location = ?',
            [$itemId, $location]
        );
        if ($item === null) {
            fail("$label: item not found in this location");
        }
        if (!$item['is_active']) {
            fail("$label: " . $item['item_name'] . ' is inactive');
        }
        if (in_array($itemId, $alreadyAdded)) {
            fail($item['item_name'] . ' is listed twice. Put it on one line.');
        }
        $alreadyAdded[] = $itemId;

        $quantity = number_param($line, 'quantity', "$label quantity", false);

        $unitCost = 0;
        if (isset($line['unitCost']) && $line['unitCost'] !== '') {
            $unitCost = money_param($line, 'unitCost', "$label unit cost");
        }

        $lines[] = ['itemId' => $itemId, 'quantity' => $quantity, 'unitCost' => $unitCost];
    }
}

$notes = text($data, 'notes', 'Notes', 2000);
if ($notes === '') {
    $notes = null;
}

$pdo = db();
$pdo->beginTransaction();

try {
    query(
        'INSERT INTO deliveries (delivery_receipt_no, supplier_id, location, status, received_at, received_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$receiptNo, $supplierId, $location, $status, $receivedAt, $user['user_id'], $notes]
    );
    $deliveryId = (int) $pdo->lastInsertId();

    foreach ($lines as $line) {
        query(
            'INSERT INTO delivery_items (delivery_id, item_id, quantity, unit_cost) VALUES (?, ?, ?, ?)',
            [$deliveryId, $line['itemId'], $line['quantity'], $line['unitCost']]
        );
    }

    $pdo->commit();
} catch (Exception $error) {
    $pdo->rollBack();
    query('SET @ledger_write = NULL');
    throw $error;
}

$saved = query_one('SELECT total_amount FROM deliveries WHERE delivery_id = ?', [$deliveryId]);
respond(['id' => $deliveryId, 'status' => $status, 'total' => (float) $saved['total_amount'], 'items' => count($lines)], 201);
