<?php

require __DIR__ . '/_common.php';
allow_methods(['GET']);
$user = require_admin();

$type = 'summary';
if (isset($_GET['type'])) {
    $type = strtolower($_GET['type']);
}

$askedLocation = '';
if (isset($_GET['location'])) {
    $askedLocation = $_GET['location'];
}
$location = allowed_location($user, $askedLocation);

$from = null;
if (isset($_GET['from'])) {
    $from = date_param($_GET['from'], 'From');
}
$to = null;
if (isset($_GET['to'])) {
    $to = date_param($_GET['to'], 'To');
}
if ($from !== null && $to !== null && $from > $to) {
    fail('"From" must be on or before "To"');
}

$report = ['type' => $type, 'location' => $location, 'from' => $from, 'to' => $to];

if ($type === 'summary') {
    $sql = 'SELECT location,
                   COUNT(*) AS items,
                   SUM(current_stock <= reorder_level AND current_stock > critical_level) AS low_stock,
                   SUM(current_stock <= critical_level) AS critical,
                   SUM(ROUND(current_stock * unit_cost, 2)) AS value
            FROM inventory_items
            WHERE is_active = 1';
    $params = [];
    if ($location !== null) {
        $sql .= ' AND location = ?';
        $params[] = $location;
    }
    $rows = query($sql . ' GROUP BY location ORDER BY location', $params);

    $report['locations'] = [];
    foreach ($rows as $row) {
        $report['locations'][] = [
            'location' => $row['location'],
            'items' => (int) $row['items'],
            'lowStock' => (int) $row['low_stock'],
            'critical' => (int) $row['critical'],
            'value' => (float) $row['value'],
        ];
    }

    $sql = "SELECT SUM(transaction_type = 'STOCK_IN') AS stock_in,
                   SUM(transaction_type = 'STOCK_OUT') AS stock_out,
                   SUM(transaction_type = 'ADJUSTMENT') AS adjustments
            FROM vw_stock_movement
            WHERE 1 = 1";
    $params = [];
    if ($location !== null) {
        $sql .= ' AND location = ?';
        $params[] = $location;
    }
    if ($from !== null) {
        $sql .= ' AND transaction_date >= ?';
        $params[] = $from;
    }
    if ($to !== null) {
        $sql .= ' AND transaction_date < DATE_ADD(?, INTERVAL 1 DAY)';
        $params[] = $to;
    }
    $moves = query_one($sql, $params);

    $sql = "SELECT COUNT(*) AS total
            FROM vw_all_audit_logs l JOIN inventory_items i ON i.item_id = l.target_id
            WHERE l.action_type = 'STOCK_COUNT_MATCHED'";
    $params = [];
    if ($location !== null) {
        $sql .= ' AND i.location = ?';
        $params[] = $location;
    }
    if ($from !== null) {
        $sql .= ' AND l.logged_at >= ?';
        $params[] = $from;
    }
    if ($to !== null) {
        $sql .= ' AND l.logged_at < DATE_ADD(?, INTERVAL 1 DAY)';
        $params[] = $to;
    }
    $matched = query_one($sql, $params);

    $stockIn = (int) $moves['stock_in'];
    $stockOut = (int) $moves['stock_out'];
    $itemCounts = (int) $moves['adjustments'] + (int) $matched['total'];
    $report['stockInOut'] = [
        'stockIn' => $stockIn,
        'stockOut' => $stockOut,
        'itemCounts' => $itemCounts,
        'total' => $stockIn + $stockOut + $itemCounts,
    ];

    $sql = "SELECT COUNT(DISTINCT d.delivery_id) AS deliveries,
                   COUNT(DISTINCT d.supplier_id) AS suppliers_used,
                   COUNT(di.delivery_item_id) AS items_delivered,
                   COALESCE(SUM(di.line_total), 0) AS value
            FROM deliveries d LEFT JOIN delivery_items di ON di.delivery_id = d.delivery_id
            WHERE d.status = 'RECEIVED'";
    $params = [];
    if ($location !== null) {
        $sql .= ' AND d.location = ?';
        $params[] = $location;
    }
    if ($from !== null) {
        $sql .= ' AND d.received_at >= ?';
        $params[] = $from;
    }
    if ($to !== null) {
        $sql .= ' AND d.received_at < DATE_ADD(?, INTERVAL 1 DAY)';
        $params[] = $to;
    }
    $deliveries = query_one($sql, $params);

    $activeSuppliers = query_one('SELECT COUNT(*) AS total FROM suppliers WHERE is_active = 1');

    $report['deliveries'] = [
        'activeSuppliers' => (int) $activeSuppliers['total'],
        'suppliersUsed' => (int) $deliveries['suppliers_used'],
        'deliveries' => (int) $deliveries['deliveries'],
        'itemsDelivered' => (int) $deliveries['items_delivered'],
        'value' => (float) $deliveries['value'],
    ];

} elseif ($type === 'stock-levels') {
    $sql = "SELECT i.item_code, i.item_name, i.location, i.category, i.unit,
                   i.current_stock, i.reorder_level, i.critical_level, i.unit_cost,
                   ROUND(i.current_stock * i.unit_cost, 2) AS stock_value,
                   CASE WHEN i.current_stock <= i.critical_level THEN 'CRITICAL'
                        WHEN i.current_stock <= i.reorder_level THEN 'LOW'
                        ELSE 'OK' END AS stock_status,
                   s.supplier_name AS preferred_supplier
            FROM inventory_items i LEFT JOIN suppliers s ON s.supplier_id = i.preferred_supplier_id
            WHERE i.is_active = 1";
    $params = [];
    if ($location !== null) {
        $sql .= ' AND i.location = ?';
        $params[] = $location;
    }
    $report['rows'] = query($sql . ' ORDER BY i.location, i.category, i.item_name', $params);

} elseif ($type === 'low-stock') {
    $sql = 'SELECT item_code, item_name, location, category, unit, current_stock, reorder_level,
                   critical_level, stock_status, preferred_supplier, supplier_phone
            FROM vw_low_stock_items
            WHERE 1 = 1';
    $params = [];
    if ($location !== null) {
        $sql .= ' AND location = ?';
        $params[] = $location;
    }
    $report['rows'] = query($sql . " ORDER BY stock_status = 'CRITICAL' DESC, location, item_name", $params);

} elseif ($type === 'stock-movement') {
    $sql = 'SELECT transaction_date, transaction_type, location, item_code, item_name, unit, quantity,
                   net_change, stock_before, stock_after, unit_cost, total_cost, ref_type, reason, performed_by_name
            FROM vw_stock_movement
            WHERE 1 = 1';
    $params = [];
    if ($location !== null) {
        $sql .= ' AND location = ?';
        $params[] = $location;
    }
    if ($from !== null) {
        $sql .= ' AND transaction_date >= ?';
        $params[] = $from;
    }
    if ($to !== null) {
        $sql .= ' AND transaction_date < DATE_ADD(?, INTERVAL 1 DAY)';
        $params[] = $to;
    }
    $report['rows'] = query($sql . ' ORDER BY transaction_date DESC, txn_id DESC', $params);

} elseif ($type === 'item-counts') {
    $sql = "SELECT l.logged_at AS counted_at, i.location, i.item_code, i.item_name, i.unit,
                   l.old_value AS system_stock, l.new_value AS counted_stock,
                   IF(l.action_type = 'STOCK_COUNT_MATCHED', 'MATCHED', 'CORRECTED') AS result,
                   l.description, l.username_snapshot AS counted_by
            FROM vw_all_audit_logs l JOIN inventory_items i ON i.item_id = l.target_id
            WHERE l.action_type IN ('STOCK_ADJUSTED', 'STOCK_COUNT_MATCHED')";
    $params = [];
    if ($location !== null) {
        $sql .= ' AND i.location = ?';
        $params[] = $location;
    }
    if ($from !== null) {
        $sql .= ' AND l.logged_at >= ?';
        $params[] = $from;
    }
    if ($to !== null) {
        $sql .= ' AND l.logged_at < DATE_ADD(?, INTERVAL 1 DAY)';
        $params[] = $to;
    }
    $report['rows'] = query($sql . ' ORDER BY l.logged_at DESC, l.log_id DESC', $params);

} elseif ($type === 'deliveries') {
    $sql = 'SELECT received_at, delivery_receipt_no, supplier_name, location, status,
                   line_item_count, total_amount, received_by_name, notes
            FROM vw_delivery_summary
            WHERE 1 = 1';
    $params = [];
    if ($location !== null) {
        $sql .= ' AND location = ?';
        $params[] = $location;
    }
    if ($from !== null) {
        $sql .= ' AND received_at >= ?';
        $params[] = $from;
    }
    if ($to !== null) {
        $sql .= ' AND received_at < DATE_ADD(?, INTERVAL 1 DAY)';
        $params[] = $to;
    }
    $report['rows'] = query($sql . ' ORDER BY received_at DESC', $params);

} elseif ($type === 'suppliers') {
    $sql = "SELECT s.supplier_name, s.contact_person, s.phone, s.supplied_categories, s.is_active,
                   COUNT(d.delivery_id) AS deliveries,
                   COALESCE(SUM(d.status = 'RECEIVED'), 0) AS received,
                   COALESCE(SUM(d.status = 'REJECTED'), 0) AS rejected,
                   COALESCE(SUM(IF(d.status = 'RECEIVED', d.total_amount, 0)), 0) AS total_value,
                   MAX(d.received_at) AS last_delivery_at
            FROM suppliers s
            LEFT JOIN deliveries d ON d.supplier_id = s.supplier_id";
    $params = [];
    if ($location !== null) {
        $sql .= ' AND d.location = ?';
        $params[] = $location;
    }
    if ($from !== null) {
        $sql .= ' AND d.received_at >= ?';
        $params[] = $from;
    }
    if ($to !== null) {
        $sql .= ' AND d.received_at < DATE_ADD(?, INTERVAL 1 DAY)';
        $params[] = $to;
    }
    $sql .= ' GROUP BY s.supplier_id, s.supplier_name, s.contact_person, s.phone, s.supplied_categories, s.is_active
              ORDER BY total_value DESC, s.supplier_name';
    $report['rows'] = query($sql, $params);

} elseif ($type === 'monthly-costs') {
    $sql = 'SELECT month_year, location, purchases_value, usage_cost, adjustment_value, transaction_count
            FROM vw_monthly_inventory_finance
            WHERE 1 = 1';
    $params = [];
    if ($location !== null) {
        $sql .= ' AND location = ?';
        $params[] = $location;
    }
    if ($from !== null) {
        $sql .= ' AND month_year >= ?';
        $params[] = substr($from, 0, 7);
    }
    if ($to !== null) {
        $sql .= ' AND month_year <= ?';
        $params[] = substr($to, 0, 7);
    }
    $report['rows'] = query($sql . ' ORDER BY month_year DESC, location', $params);

} else {
    fail('Unknown report type');
}

respond($report);
