<?php

require __DIR__ . '/_common.php';
allow_methods(['GET', 'POST']);
$admin = require_admin();

const ACTION_GROUPS = [
    'signins' => ['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED'],
    'deliveries' => ['DELIVERY_RECORDED', 'DELIVERY_REJECTED'],
    'stockout' => ['CONSUMPTION_RECORDED', 'STOCK_OUT_FAILED'],
    'counts' => ['STOCK_ADJUSTED', 'STOCK_COUNT_MATCHED', 'STOCK_COUNT_FAILED'],
    'items' => ['ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DEACTIVATED'],
    'suppliers' => ['SUPPLIER_CREATED', 'SUPPLIER_UPDATED', 'SUPPLIER_DEACTIVATED', 'SUPPLIER_ACTIVATED'],
    'users' => ['USER_CREATE', 'USER_UPDATED', 'USER_DEACTIVATED', 'USER_ACTIVATED', 'PASSWORD_RESET', 'PASSWORD_RESET_REQUEST'],
];

const ACTION_LABELS = [
    'LOGIN' => 'Signed in',
    'LOGIN_FAILED' => 'Tried to sign in',
    'LOGOUT' => 'Signed out',
    'PASSWORD_CHANGED' => 'Changed password',
    'DELIVERY_RECORDED' => 'Recorded a delivery',
    'DELIVERY_REJECTED' => 'Rejected a delivery',
    'CONSUMPTION_RECORDED' => 'Took stock out',
    'STOCK_OUT_FAILED' => 'Tried to take stock out',
    'STOCK_ADJUSTED' => 'Counted an item',
    'STOCK_COUNT_MATCHED' => 'Counted an item',
    'STOCK_COUNT_FAILED' => 'Tried to count an item',
    'ITEM_CREATED' => 'Added an item',
    'ITEM_UPDATED' => 'Edited an item',
    'ITEM_DEACTIVATED' => 'Deactivated an item',
    'SUPPLIER_CREATED' => 'Added a supplier',
    'SUPPLIER_UPDATED' => 'Edited a supplier',
    'SUPPLIER_DEACTIVATED' => 'Deactivated a supplier',
    'SUPPLIER_ACTIVATED' => 'Reactivated a supplier',
    'USER_CREATE' => 'Made an account',
    'USER_UPDATED' => 'Edited an account',
    'USER_DEACTIVATED' => 'Deactivated an account',
    'USER_ACTIVATED' => 'Reactivated an account',
    'PASSWORD_RESET' => "Reset a user's password",
    'PASSWORD_RESET_REQUEST' => 'Asked for a password reset',
    'ACCOUNT_UPDATED' => 'Edited own details',
    'AUDIT_ARCHIVED' => 'Archived old audit entries',
    'SYSTEM_INIT' => 'System set up',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = input();

    if (text($data, 'action') !== 'archive') {
        fail('Unknown action');
    }

    $days = 90;
    if (isset($data['days'])) {
        $days = (int) $data['days'];
    }
    if ($days < 1) {
        fail('Days must be 1 or more');
    }

    $result = query_one('CALL sp_archive_audit_logs(?)', [$days]);
    audit('AUDIT_ARCHIVED', 'AUDIT_LOGS', null, 'Moved ' . $result['records_deleted'] . " entries older than $days days to the archive");

    respond(['archived' => (int) $result['records_deleted'], 'olderThan' => $result['archived_before']]);
}

$sql = ' FROM vw_all_audit_logs a WHERE 1 = 1';
$params = [];

$search = '';
if (isset($_GET['search'])) {
    $search = trim($_GET['search']);
}
if ($search !== '') {
    $sql .= " AND (username_snapshot LIKE ? OR description LIKE ? OR action_type LIKE ?
                   OR EXISTS (SELECT 1 FROM inventory_items i
                              WHERE i.item_name LIKE ? AND a.description LIKE CONCAT('%', i.item_code, '%')))";
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$from = null;
if (isset($_GET['from'])) {
    $from = date_param($_GET['from'], 'From');
}
if ($from !== null) {
    $sql .= ' AND logged_at >= ?';
    $params[] = $from;
}

$to = null;
if (isset($_GET['to'])) {
    $to = date_param($_GET['to'], 'To');
}
if ($to !== null) {
    $sql .= ' AND logged_at < DATE_ADD(?, INTERVAL 1 DAY)';
    $params[] = $to;
}

$type = 'all';
if (isset($_GET['type'])) {
    $type = strtolower($_GET['type']);
}
if ($type !== '' && $type !== 'all') {
    if (!isset(ACTION_GROUPS[$type])) {
        fail('Unknown action type');
    }

    $placeholders = [];
    foreach (ACTION_GROUPS[$type] as $action) {
        $placeholders[] = '?';
        $params[] = $action;
    }
    $sql .= ' AND action_type IN (' . implode(', ', $placeholders) . ')';
}

$perPage = 50;
$page = page_number();
$offset = ($page - 1) * $perPage;

$count = query_one('SELECT COUNT(*) AS total' . $sql, $params);
$rows = query('SELECT *' . $sql . " ORDER BY logged_at DESC, log_id DESC LIMIT $perPage OFFSET $offset", $params);

$entries = [];
foreach ($rows as $row) {
    $roleName = ucfirst(strtolower($row['role_snapshot']));
    if (isset(ROLE_NAMES[$row['role_snapshot']])) {
        $roleName = ROLE_NAMES[$row['role_snapshot']];
    }

    $actionLabel = $row['action_type'];
    if (isset(ACTION_LABELS[$row['action_type']])) {
        $actionLabel = ACTION_LABELS[$row['action_type']];
    }

    $recordId = null;
    if ($row['target_id'] !== null) {
        $recordId = (int) $row['target_id'];
    }

    $result = 'OK';
    if (substr($row['action_type'], -7) === '_FAILED') {
        $result = 'FAILED';
    }

    $entries[] = [
        'id' => (int) $row['log_id'],
        'time' => $row['logged_at'],
        'username' => $row['username_snapshot'],
        'role' => $row['role_snapshot'],
        'roleName' => $roleName,
        'action' => $row['action_type'],
        'actionLabel' => $actionLabel,
        'record' => $row['target_entity'],
        'recordId' => $recordId,
        'description' => clean_log_text($row['description']),
        'oldValue' => $row['old_value'],
        'newValue' => $row['new_value'],
        'result' => $result,
        'archived' => $row['log_source'] === 'ARCHIVED',
    ];
}

respond([
    'total' => (int) $count['total'],
    'page' => $page,
    'perPage' => $perPage,
    'entries' => $entries,
]);
