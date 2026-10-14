<?php

require __DIR__ . '/_common.php';
allow_methods(['GET']);
$user = require_admin();

$type = strtolower($_GET['type'] ?? 'summary');
$location = allowed_location($user, $_GET['location'] ?? '');
$from = date_param($_GET['from'] ?? '', 'From');
$to = date_param($_GET['to'] ?? '', 'To');
if ($from && $to && $from > $to) fail('"From" must be on or before "To"');

function date_filter($column, $from, $to)
{
    $sql = '';
    $params = [];
    if ($from) {
        $sql .= " AND $column >= ?";
        $params[] = $from;
    }
    if ($to) {
        $sql .= " AND $column < DATE_ADD(?, INTERVAL 1 DAY)";
        $params[] = $to;
    }
    return [$sql, $params];
}

[$locSql, $locParams] = location_filter($location);
$report = ['type' => $type, 'location' => $location, 'from' => $from, 'to' => $to];

switch ($type) {

    case 'summary':
        $stock = query(
            "SELECT location,
                    COUNT(*) AS items,
                    SUM(current_stock <= reorder_level AND current_stock > critical_level) AS low_stock,
                    SUM(current_stock <= critical_level) AS critical,
                    SUM(ROUND(current_stock * unit_cost, 2)) AS value
             FROM inventory_items
             WHERE is_active = 1 $locSql
             GROUP BY location ORDER BY location",
            $locParams
        );
        $report['locations'] = array_map(function ($r) {
            return [
                'location' => $r['location'],
                'items' => (int) $r['items'],
                'lowStock' => (int) $r['low_stock'],
                'critical' => (int) $r['critical'],
                'value' => (float) $r['value'],
            ];
        }, $stock);

        [$dateSql, $dateParams] = date_filter('transaction_date', $from, $to);
        $moves = query_one(
            "SELECT SUM(transaction_type = 'STOCK_IN') AS stock_in,
                    SUM(transaction_type = 'STOCK_OUT') AS stock_out,
                    SUM(transaction_type = 'ADJUSTMENT') AS adjustments
             FROM vw_stock_movement WHERE 1 = 1 $locSql $dateSql",
            array_merge($locParams, $dateParams)
        );

        [$dateSql2, $dateParams2] = date_filter('l.logged_at', $from, $to);
        [$locSql2, $locParams2] = location_filter($location, 'i.location');
        $matched = query_one(
            "SELECT COUNT(*) AS n FROM vw_all_audit_logs l JOIN inventory_items i ON i.item_id = l.target_id
             WHERE l.action_type = 'STOCK_COUNT_MATCHED' $locSql2 $dateSql2",
            array_merge($locParams2, $dateParams2)
        );
        $report['stockInOut'] = [
            'stockIn' => (int) $moves['stock_in'],
            'stockOut' => (int) $moves['stock_out'],
            'itemCounts' => (int) $moves['adjustments'] + (int) $matched['n'],
        ];
        $report['stockInOut']['total'] = array_sum($report['stockInOut']);

        [$dateSql, $dateParams] = date_filter('d.received_at', $from, $to);
        [$locSql2, $locParams2] = location_filter($location, 'd.location');
        $deliveries = query_one(
            "SELECT COUNT(DISTINCT d.delivery_id) AS deliveries,
                    COUNT(DISTINCT d.supplier_id) AS suppliers_used,
                    COUNT(di.delivery_item_id) AS items_delivered,
                    COALESCE(SUM(di.line_total), 0) AS value
             FROM deliveries d LEFT JOIN delivery_items di ON di.delivery_id = d.delivery_id
             WHERE d.status = 'RECEIVED' $locSql2 $dateSql",
            array_merge($locParams2, $dateParams)
        );
        $report['deliveries'] = [
            'activeSuppliers' => (int) query_one('SELECT COUNT(*) AS n FROM suppliers WHERE is_active = 1')['n'],
            'suppliersUsed' => (int) $deliveries['suppliers_used'],
            'deliveries' => (int) $deliveries['deliveries'],
            'itemsDelivered' => (int) $deliveries['items_delivered'],
            'value' => (float) $deliveries['value'],
        ];
        break;

    case 'stock-levels':
        $report['rows'] = query(
            "SELECT i.item_code, i.item_name, i.location, i.category, i.unit,
                    i.current_stock, i.reorder_level, i.critical_level, i.unit_cost,
                    ROUND(i.current_stock * i.unit_cost, 2) AS stock_value,
                    CASE WHEN i.current_stock <= i.critical_level THEN 'CRITICAL'
                         WHEN i.current_stock <= i.reorder_level THEN 'LOW'
                         ELSE 'OK' END AS stock_status,
                    s.supplier_name AS preferred_supplier
             FROM inventory_items i LEFT JOIN suppliers s ON s.supplier_id = i.preferred_supplier_id
             WHERE i.is_active = 1 " . location_filter($location, 'i.location')[0] . "
             ORDER BY i.location, i.category, i.item_name",
            $locParams
        );
        break;

    case 'low-stock':
        $report['rows'] = query(
            "SELECT item_code, item_name, location, category, unit, current_stock, reorder_level,
                    critical_level, stock_status, preferred_supplier, supplier_phone
             FROM vw_low_stock_items WHERE 1 = 1 $locSql
             ORDER BY stock_status = 'CRITICAL' DESC, location, item_name",
            $locParams
        );
        break;

    case 'stock-movement':
        [$dateSql, $dateParams] = date_filter('transaction_date', $from, $to);
        $report['rows'] = query(
            "SELECT transaction_date, transaction_type, location, item_code, item_name, unit, quantity,
                    net_change, stock_before, stock_after, unit_cost, total_cost, ref_type, reason, performed_by_name
             FROM vw_stock_movement WHERE 1 = 1 $locSql $dateSql
             ORDER BY transaction_date DESC, txn_id DESC",
            array_merge($locParams, $dateParams)
        );
        break;

    case 'item-counts':
        [$dateSql, $dateParams] = date_filter('l.logged_at', $from, $to);
        [$locSql2, $locParams2] = location_filter($location, 'i.location');
        $report['rows'] = query(
            "SELECT l.logged_at AS counted_at, i.location, i.item_code, i.item_name, i.unit,
                    l.old_value AS system_stock, l.new_value AS counted_stock,
                    IF(l.action_type = 'STOCK_COUNT_MATCHED', 'MATCHED', 'CORRECTED') AS result,
                    l.description, l.username_snapshot AS counted_by
             FROM vw_all_audit_logs l JOIN inventory_items i ON i.item_id = l.target_id
             WHERE l.action_type IN ('STOCK_ADJUSTED', 'STOCK_COUNT_MATCHED') $locSql2 $dateSql
             ORDER BY l.logged_at DESC, l.log_id DESC",
            array_merge($locParams2, $dateParams)
        );
        break;

    case 'deliveries':
        [$dateSql, $dateParams] = date_filter('received_at', $from, $to);
        $report['rows'] = query(
            "SELECT received_at, delivery_receipt_no, supplier_name, location, status,
                    line_item_count, total_amount, received_by_name, notes
             FROM vw_delivery_summary WHERE 1 = 1 $locSql $dateSql
             ORDER BY received_at DESC",
            array_merge($locParams, $dateParams)
        );
        break;

    case 'suppliers':
        [$dateSql, $dateParams] = date_filter('d.received_at', $from, $to);
        [$locSql2, $locParams2] = location_filter($location, 'd.location');
        $report['rows'] = query(
            "SELECT s.supplier_name, s.contact_person, s.phone, s.supplied_categories, s.is_active,
                    COUNT(d.delivery_id) AS deliveries,
                    COALESCE(SUM(d.status = 'RECEIVED'), 0) AS received,
                    COALESCE(SUM(d.status = 'REJECTED'), 0) AS rejected,
                    COALESCE(SUM(IF(d.status = 'RECEIVED', d.total_amount, 0)), 0) AS total_value,
                    MAX(d.received_at) AS last_delivery_at
             FROM suppliers s
             LEFT JOIN deliveries d ON d.supplier_id = s.supplier_id $locSql2 $dateSql
             GROUP BY s.supplier_id, s.supplier_name, s.contact_person, s.phone, s.supplied_categories, s.is_active
             ORDER BY total_value DESC, s.supplier_name",
            array_merge($locParams2, $dateParams)
        );
        break;

    case 'monthly-costs':
        $fromMonth = $from ? substr($from, 0, 7) : null;
        $toMonth = $to ? substr($to, 0, 7) : null;
        $sql = "SELECT month_year, location, purchases_value, usage_cost, adjustment_value, transaction_count
                FROM vw_monthly_inventory_finance WHERE 1 = 1 $locSql";
        $params = $locParams;
        if ($fromMonth) {
            $sql .= ' AND month_year >= ?';
            $params[] = $fromMonth;
        }
        if ($toMonth) {
            $sql .= ' AND month_year <= ?';
            $params[] = $toMonth;
        }
        $report['rows'] = query($sql . ' ORDER BY month_year DESC, location', $params);
        break;

    default:
        fail('Unknown report type');
}

respond($report);
