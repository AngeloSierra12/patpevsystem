<?php

require __DIR__ . '/_common.php';
allow_methods(['GET']);

$user = require_login();
$location = allowed_location($user);

if ($location === null) {
    $locations = ['CANTEEN', 'HOSTEL'];
} else {
    $locations = [$location];
}

$cards = [];
foreach ($locations as $place) {
    $counts = query_one(
        'SELECT COUNT(*) AS items,
                SUM(current_stock <= reorder_level AND current_stock > critical_level) AS low,
                SUM(current_stock <= critical_level) AS critical
         FROM inventory_items
         WHERE is_active = 1 AND location = ?',
        [$place]
    );

    $last = query_one(
        "SELECT d.received_at, s.supplier_name
         FROM deliveries d JOIN suppliers s ON s.supplier_id = d.supplier_id
         WHERE d.location = ? AND d.status = 'RECEIVED'
         ORDER BY d.received_at DESC LIMIT 1",
        [$place]
    );

    $lastDelivery = null;
    if ($last !== null) {
        $lastDelivery = ['date' => $last['received_at'], 'supplier' => $last['supplier_name']];
    }

    $cards[] = [
        'location' => $place,
        'items' => (int) $counts['items'],
        'lowStock' => (int) $counts['low'],
        'critical' => (int) $counts['critical'],
        'lastDelivery' => $lastDelivery,
    ];
}

$today = date('Y-m-d');
$weekStart = date('Y-m-d', strtotime('-' . date('w') . ' days'));
$weekEnd = date('Y-m-d', strtotime($weekStart . ' +7 days'));

$deliverySql = "SELECT DATE(received_at) AS day, COUNT(*) AS total
                FROM deliveries
                WHERE status = 'RECEIVED' AND received_at >= ? AND received_at < ?";
$deliveryParams = [$weekStart, $weekEnd];
if ($location !== null) {
    $deliverySql .= ' AND location = ?';
    $deliveryParams[] = $location;
}
$deliveryRows = query($deliverySql . ' GROUP BY DATE(received_at)', $deliveryParams);

$usageSql = 'SELECT DATE(c.consumption_date) AS day, COUNT(*) AS total
             FROM inventory_consumption c JOIN inventory_items i ON i.item_id = c.item_id
             WHERE c.consumption_date >= ? AND c.consumption_date < ?';
$usageParams = [$weekStart, $weekEnd];
if ($location !== null) {
    $usageSql .= ' AND i.location = ?';
    $usageParams[] = $location;
}
$usageRows = query($usageSql . ' GROUP BY DATE(c.consumption_date)', $usageParams);

$deliveriesByDay = [];
foreach ($deliveryRows as $row) {
    $deliveriesByDay[$row['day']] = (int) $row['total'];
}
$usageByDay = [];
foreach ($usageRows as $row) {
    $usageByDay[$row['day']] = (int) $row['total'];
}

$week = [];
for ($i = 0; $i < 7; $i++) {
    $day = date('Y-m-d', strtotime($weekStart . " +$i days"));

    $deliveries = null;
    $takenOut = null;
    if ($day <= $today) {
        $deliveries = 0;
        if (isset($deliveriesByDay[$day])) {
            $deliveries = $deliveriesByDay[$day];
        }
        $takenOut = 0;
        if (isset($usageByDay[$day])) {
            $takenOut = $usageByDay[$day];
        }
    }

    $week[] = [
        'date' => $day,
        'isToday' => $day === $today,
        'deliveries' => $deliveries,
        'takenOut' => $takenOut,
    ];
}

$recentSql = 'SELECT delivery_id, received_at, delivery_receipt_no, supplier_name, location, status, line_item_count, total_amount
              FROM vw_delivery_summary';
$recentParams = [];
if ($location !== null) {
    $recentSql .= ' WHERE location = ?';
    $recentParams[] = $location;
}
$recentRows = query($recentSql . ' ORDER BY received_at DESC LIMIT 5', $recentParams);

$recentDeliveries = [];
foreach ($recentRows as $row) {
    $recentDeliveries[] = [
        'id' => (int) $row['delivery_id'],
        'date' => $row['received_at'],
        'receiptNo' => $row['delivery_receipt_no'],
        'supplier' => $row['supplier_name'],
        'location' => $row['location'],
        'status' => $row['status'],
        'items' => (int) $row['line_item_count'],
        'total' => (float) $row['total_amount'],
    ];
}

$lowSql = 'SELECT item_id, item_code, item_name, location, unit, current_stock, reorder_level, critical_level, stock_status
           FROM vw_low_stock_items';
$lowParams = [];
if ($location !== null) {
    $lowSql .= ' WHERE location = ?';
    $lowParams[] = $location;
}
$lowRows = query($lowSql . " ORDER BY stock_status = 'CRITICAL' DESC, current_stock / NULLIF(reorder_level, 0), item_name", $lowParams);

$attention = [];
foreach ($lowRows as $row) {
    $attention[] = [
        'itemId' => (int) $row['item_id'],
        'code' => $row['item_code'],
        'name' => $row['item_name'],
        'location' => $row['location'],
        'unit' => $row['unit'],
        'stock' => (float) $row['current_stock'],
        'reorderLevel' => (float) $row['reorder_level'],
        'criticalLevel' => (float) $row['critical_level'],
        'status' => $row['stock_status'],
    ];
}

respond([
    'date' => $today,
    'locations' => $cards,
    'week' => $week,
    'recentDeliveries' => $recentDeliveries,
    'needsAttention' => $attention,
]);
