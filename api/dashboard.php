<?php

require __DIR__ . '/_common.php';
allow_methods(['GET']);

$user = require_login();
$location = allowed_location($user);
$locations = $location === null ? ['CANTEEN', 'HOSTEL'] : [$location];

$cards = [];
foreach ($locations as $loc) {
    $counts = query_one(
        'SELECT COUNT(*) AS items,
                SUM(current_stock <= reorder_level AND current_stock > critical_level) AS low,
                SUM(current_stock <= critical_level) AS critical
         FROM inventory_items
         WHERE is_active = 1 AND location = ?',
        [$loc]
    );
    $last = query_one(
        "SELECT d.received_at, s.supplier_name
         FROM deliveries d JOIN suppliers s ON s.supplier_id = d.supplier_id
         WHERE d.location = ? AND d.status = 'RECEIVED'
         ORDER BY d.received_at DESC LIMIT 1",
        [$loc]
    );
    $cards[] = [
        'location' => $loc,
        'items' => (int) $counts['items'],
        'lowStock' => (int) $counts['low'],
        'critical' => (int) $counts['critical'],
        'lastDelivery' => $last ? ['date' => $last['received_at'], 'supplier' => $last['supplier_name']] : null,
    ];
}

$sunday = new DateTime('today');
$sunday->modify('-' . $sunday->format('w') . ' days');
$weekStart = $sunday->format('Y-m-d');
$weekEnd = (clone $sunday)->modify('+7 days')->format('Y-m-d');

[$locSql, $locParams] = location_filter($location, 'd.location');
$deliveriesByDay = query(
    "SELECT DATE(d.received_at) AS day, COUNT(*) AS n
     FROM deliveries d
     WHERE d.status = 'RECEIVED' AND d.received_at >= ? AND d.received_at < ? $locSql
     GROUP BY DATE(d.received_at)",
    array_merge([$weekStart, $weekEnd], $locParams)
);
[$locSql, $locParams] = location_filter($location, 'i.location');
$usageByDay = query(
    "SELECT DATE(c.consumption_date) AS day, COUNT(*) AS n
     FROM inventory_consumption c JOIN inventory_items i ON i.item_id = c.item_id
     WHERE c.consumption_date >= ? AND c.consumption_date < ? $locSql
     GROUP BY DATE(c.consumption_date)",
    array_merge([$weekStart, $weekEnd], $locParams)
);
$byDay = function ($rows) {
    $out = [];
    foreach ($rows as $r) $out[$r['day']] = (int) $r['n'];
    return $out;
};
$deliveriesByDay = $byDay($deliveriesByDay);
$usageByDay = $byDay($usageByDay);

$week = [];
$today = date('Y-m-d');
for ($i = 0; $i < 7; $i++) {
    $day = (clone $sunday)->modify("+$i days")->format('Y-m-d');
    $week[] = [
        'date' => $day,
        'isToday' => $day === $today,

        'deliveries' => $day > $today ? null : ($deliveriesByDay[$day] ?? 0),
        'takenOut' => $day > $today ? null : ($usageByDay[$day] ?? 0),
    ];
}

[$locSql, $locParams] = location_filter($location);
$recent = query(
    "SELECT delivery_id, received_at, delivery_receipt_no, supplier_name, location, status, line_item_count, total_amount
     FROM vw_delivery_summary
     WHERE 1 = 1 $locSql
     ORDER BY received_at DESC LIMIT 5",
    $locParams
);
$recentDeliveries = array_map(function ($d) {
    return [
        'id' => (int) $d['delivery_id'],
        'date' => $d['received_at'],
        'receiptNo' => $d['delivery_receipt_no'],
        'supplier' => $d['supplier_name'],
        'location' => $d['location'],
        'status' => $d['status'],
        'items' => (int) $d['line_item_count'],
        'total' => (float) $d['total_amount'],
    ];
}, $recent);

$low = query(
    "SELECT item_id, item_code, item_name, location, unit, current_stock, reorder_level, critical_level, stock_status
     FROM vw_low_stock_items
     WHERE 1 = 1 $locSql
     ORDER BY stock_status = 'CRITICAL' DESC, current_stock / NULLIF(reorder_level, 0), item_name",
    $locParams
);
$attention = array_map(function ($i) {
    return [
        'itemId' => (int) $i['item_id'],
        'code' => $i['item_code'],
        'name' => $i['item_name'],
        'location' => $i['location'],
        'unit' => $i['unit'],
        'stock' => (float) $i['current_stock'],
        'reorderLevel' => (float) $i['reorder_level'],
        'criticalLevel' => (float) $i['critical_level'],
        'status' => $i['stock_status'],
    ];
}, $low);

respond([
    'date' => $today,
    'locations' => $cards,
    'week' => $week,
    'recentDeliveries' => $recentDeliveries,
    'needsAttention' => $attention,
]);
