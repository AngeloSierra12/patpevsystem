<?php

require __DIR__ . '/_common.php';
allow_methods(['GET', 'POST']);
$admin = require_admin();

const ACTION_GROUPS = [
    'signins' => ['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED'],
    'deliveries' => ['DELIVERY_RECORDED', 'DELIVERY_REJECTED'],
    'stockout' => ['CONSUMPTION_RECORDED'],
    'counts' => ['STOCK_ADJUSTED', 'STOCK_COUNT_MATCHED'],
    'items' => ['ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DEACTIVATED'],
    'users' => ['USER_CREATE', 'USER_UPDATED', 'USER_DEACTIVATED', 'USER_ACTIVATED', 'PASSWORD_RESET'],
];

const ACTION_LABELS = [
    'LOGIN' => 'Signed in',
    'LOGIN_FAILED' => 'Tried to sign in',
    'LOGOUT' => 'Signed out',
    'PASSWORD_CHANGED' => 'Changed password',
    'DELIVERY_RECORDED' => 'Recorded a delivery',
    'DELIVERY_REJECTED' => 'Rejected a delivery',
    'CONSUMPTION_RECORDED' => 'Took stock out',
    'STOCK_ADJUSTED' => 'Counted an item',
    'STOCK_COUNT_MATCHED' => 'Counted an item',
    'ITEM_CREATED' => 'Added an item',
    'ITEM_UPDATED' => 'Edited an item',
    'ITEM_DEACTIVATED' => 'Deactivated an item',
    'USER_CREATE' => 'Made an account',
    'USER_UPDATED' => 'Edited an account',
    'USER_DEACTIVATED' => 'Deactivated an account',
    'USER_ACTIVATED' => 'Reactivated an account',
    'PASSWORD_RESET' => "Reset a user's password",
    'ACCOUNT_UPDATED' => 'Edited own details',
    'AUDIT_ARCHIVED' => 'Archived old audit entries',
    'SYSTEM_INIT' => 'System set up',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = input();
    if (text($data, 'action') !== 'archive') fail('Unknown action');
    $days = (int) ($data['days'] ?? 90);
    if ($days < 1) fail('Days must be 1 or more');

    $result = query_one('CALL sp_archive_audit_logs(?)', [$days]);
    audit('AUDIT_ARCHIVED', 'AUDIT_LOGS', null, "Moved {$result['records_deleted']} entries older than $days days to the archive");
    respond(['archived' => (int) $result['records_deleted'], 'olderThan' => $result['archived_before']]);
}

$where = ['1 = 1'];
$params = [];

$search = trim($_GET['search'] ?? '');
if ($search !== '') {

    $where[] = "(username_snapshot LIKE ? OR description LIKE ? OR action_type LIKE ?
                 OR EXISTS (SELECT 1 FROM inventory_items i
                            WHERE i.item_name LIKE ? AND a.description LIKE CONCAT('%', i.item_code, '%')))";
    $like = '%' . $search . '%';
    array_push($params, $like, $like, $like, $like);
}
$from = date_param($_GET['from'] ?? '', 'From');
if ($from) {
    $where[] = 'logged_at >= ?';
    $params[] = $from;
}
$to = date_param($_GET['to'] ?? '', 'To');
if ($to) {
    $where[] = 'logged_at < DATE_ADD(?, INTERVAL 1 DAY)';
    $params[] = $to;
}
$type = strtolower($_GET['type'] ?? 'all');
if ($type !== '' && $type !== 'all') {
    if (!isset(ACTION_GROUPS[$type])) fail('Unknown action type');
    $where[] = 'action_type IN (' . implode(',', array_fill(0, count(ACTION_GROUPS[$type]), '?')) . ')';
    $params = array_merge($params, ACTION_GROUPS[$type]);
}

$whereSql = implode(' AND ', $where);
$perPage = 50;
$page = max(1, (int) ($_GET['page'] ?? 1));
$offset = ($page - 1) * $perPage;

$total = (int) query_one("SELECT COUNT(*) AS n FROM vw_all_audit_logs a WHERE $whereSql", $params)['n'];
$rows = query(
    "SELECT * FROM vw_all_audit_logs a WHERE $whereSql ORDER BY logged_at DESC, log_id DESC LIMIT $perPage OFFSET $offset",
    $params
);

$entries = array_map(function ($r) {
    return [
        'id' => (int) $r['log_id'],
        'time' => $r['logged_at'],
        'username' => $r['username_snapshot'],
        'role' => $r['role_snapshot'],
        'roleName' => ROLE_NAMES[$r['role_snapshot']] ?? ucfirst(strtolower($r['role_snapshot'])),
        'action' => $r['action_type'],
        'actionLabel' => ACTION_LABELS[$r['action_type']] ?? $r['action_type'],
        'record' => $r['target_entity'],
        'recordId' => $r['target_id'] === null ? null : (int) $r['target_id'],
        'description' => $r['description'],
        'oldValue' => $r['old_value'],
        'newValue' => $r['new_value'],
        'result' => $r['action_type'] === 'LOGIN_FAILED' ? 'FAILED' : 'OK',
        'archived' => $r['log_source'] === 'ARCHIVED',
    ];
}, $rows);

respond([
    'total' => $total,
    'page' => $page,
    'perPage' => $perPage,
    'entries' => $entries,
]);
