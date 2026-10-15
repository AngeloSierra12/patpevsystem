<?php

require __DIR__ . '/_common.php';
allow_methods(['POST']);
$user = require_staff();
$location = ROLE_LOCATION[$user['role']];

$data = input();
$action = text($data, 'action', 'Action');

$itemId = 0;
if (isset($data['itemId']) && is_numeric($data['itemId'])) {
    $itemId = (int) $data['itemId'];
}

$item = query_one(
    'SELECT item_id, item_code, item_name, unit, current_stock, is_active
     FROM inventory_items WHERE item_id = ? AND location = ?',
    [$itemId, $location]
);
if ($item === null) {
    fail('Item not found', 404);
}
if (!$item['is_active']) {
    fail('This item is inactive. Reactivate it first.');
}

$stock = (float) $item['current_stock'];

if ($action === 'use') {
    $quantity = number_param($data, 'quantity', 'Quantity', false);

    $purpose = text($data, 'purpose', 'Purpose', 120);
    if ($purpose === '') {
        fail('Purpose is required');
    }

    if ($quantity > $stock) {
        fail('Only ' . $stock . ' ' . $item['unit'] . " available. You can't use more than the available stock.");
    }

    $notes = text($data, 'notes', 'Notes', 2000);
    if ($notes === '') {
        $notes = null;
    }

    query(
        'INSERT INTO inventory_consumption (item_id, quantity, purpose, notes, recorded_by) VALUES (?, ?, ?, ?, ?)',
        [$itemId, $quantity, $purpose, $notes, $user['user_id']]
    );

} elseif ($action === 'count') {
    $counted = number_param($data, 'countedQuantity', 'Counted quantity');

    $reason = text($data, 'reason', 'Reason', 200);
    if ($counted !== $stock && $reason === '') {
        fail('A reason is required because the count is different from the recorded stock');
    }
    if ($reason === '') {
        $reason = 'Physical count';
    }

    query('CALL sp_adjust_stock(?, ?, ?, ?)', [$itemId, $counted, $reason, $user['user_id']]);

} else {
    fail('Unknown action');
}

$after = query_one('SELECT current_stock FROM inventory_items WHERE item_id = ?', [$itemId]);
respond(['itemId' => $itemId, 'stock' => (float) $after['current_stock']]);
