<?php

require __DIR__ . '/_common.php';
allow_methods(['GET', 'PUT', 'POST']);
$user = require_login();
$id = (int) $user['user_id'];

const PERMISSIONS = [
    'ADMIN' => [
        'Inventory' => 'View only', 'Suppliers' => 'View only', 'Deliveries' => 'View only',
        'Reports' => 'Full', 'User management' => 'Full', 'Audit trail' => 'Full',
    ],
    'STAFF_HOSTEL' => [
        'Inventory' => 'Hostel only', 'Suppliers' => 'Full', 'Deliveries' => 'Hostel only',
        'Reports' => 'No access', 'User management' => 'No access', 'Audit trail' => 'No access',
    ],
    'STAFF_CANTEEN' => [
        'Inventory' => 'Canteen only', 'Suppliers' => 'Full', 'Deliveries' => 'Canteen only',
        'Reports' => 'No access', 'User management' => 'No access', 'Audit trail' => 'No access',
    ],
];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $activity = query(
        'SELECT action_type, description, logged_at FROM audit_logs
         WHERE user_id = ? ORDER BY logged_at DESC, log_id DESC LIMIT 5',
        [$id]
    );

    $parts = explode(' ', $user['full_name']);
    $last = array_pop($parts);

    respond([
        'user' => public_user($user) + ['firstName' => implode(' ', $parts), 'lastName' => $last],
        'permissions' => PERMISSIONS[$user['role']],
        'recentActivity' => array_map(fn($a) => [
            'action' => $a['action_type'],
            'description' => $a['description'],
            'time' => $a['logged_at'],
            'failed' => $a['action_type'] === 'LOGIN_FAILED',
        ], $activity),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = input();
    $first = text($data, 'firstName');
    $last = text($data, 'lastName');
    $email = text($data, 'email');
    $phone = text($data, 'phone');
    if ($first === '' || $last === '') fail('First name and last name are required');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address');

    $new = ['full_name' => "$first $last", 'email' => $email, 'phone' => $phone ?: null];
    db()->prepare('UPDATE users SET full_name = ?, email = ?, phone = ? WHERE user_id = ?')
        ->execute([$new['full_name'], $new['email'], $new['phone'], $id]);

    $old = ['full_name' => $user['full_name'], 'email' => $user['email'], 'phone' => $user['phone']];
    if ($old != $new) {
        audit('ACCOUNT_UPDATED', 'USERS', $id, "{$user['username']} edited their own details",
            json_encode($old), json_encode($new));
    }
    respond(['user' => public_user(query_one('SELECT * FROM users WHERE user_id = ?', [$id]))]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = input();
    $current = (string) ($data['currentPassword'] ?? '');
    $newPassword = (string) ($data['newPassword'] ?? '');

    $hash = query_one('SELECT password_hash FROM users WHERE user_id = ?', [$id])['password_hash'];
    if (!password_verify($current, $hash)) fail('Your current password is wrong');
    if (strlen($newPassword) < 8) fail('New password must be at least 8 characters');
    if ($newPassword === $current) fail('New password must be different from the current one');

    db()->prepare('UPDATE users SET password_hash = ? WHERE user_id = ?')
        ->execute([password_hash($newPassword, PASSWORD_DEFAULT), $id]);
    audit('PASSWORD_CHANGED', 'USERS', $id, "{$user['username']} changed their password");
    respond(['ok' => true]);
}
