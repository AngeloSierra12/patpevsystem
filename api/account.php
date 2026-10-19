<?php

require __DIR__ . '/_common.php';
allow_methods(['GET', 'PUT', 'POST']);
$user = require_login();
$id = (int) $user['user_id'];

const PERMISSIONS = [
    'ADMIN' => [
        'Inventory' => 'No access',
        'Suppliers' => 'No access',
        'Deliveries' => 'No access',
        'Reports' => 'Full',
        'User management' => 'Full',
        'Audit trail' => 'Full',
    ],
    'STAFF_HOSTEL' => [
        'Inventory' => 'Hostel only',
        'Suppliers' => 'Full',
        'Deliveries' => 'Hostel only',
        'Reports' => 'No access',
        'User management' => 'No access',
        'Audit trail' => 'No access',
    ],
    'STAFF_CANTEEN' => [
        'Inventory' => 'Canteen only',
        'Suppliers' => 'Full',
        'Deliveries' => 'Canteen only',
        'Reports' => 'No access',
        'User management' => 'No access',
        'Audit trail' => 'No access',
    ],
];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = query(
        'SELECT action_type, description, logged_at FROM audit_logs
         WHERE user_id = ? ORDER BY logged_at DESC, log_id DESC LIMIT 5',
        [$id]
    );

    $activity = [];
    foreach ($rows as $row) {
        $activity[] = [
            'action' => $row['action_type'],
            'description' => $row['description'],
            'time' => $row['logged_at'],
            'failed' => $row['action_type'] === 'LOGIN_FAILED',
        ];
    }

    $nameParts = explode(' ', $user['full_name']);
    $lastName = array_pop($nameParts);
    $firstName = implode(' ', $nameParts);

    $profile = public_user($user);
    $profile['firstName'] = $firstName;
    $profile['lastName'] = $lastName;

    respond([
        'user' => $profile,
        'permissions' => PERMISSIONS[$user['role']],
        'recentActivity' => $activity,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = input();
    $first = text($data, 'firstName', 'First name');
    $last = text($data, 'lastName', 'Last name');
    $email = text($data, 'email', 'Email', 120);
    $phone = phone_param($data, 'phone', 'Contact number');

    if ($first === '' || $last === '') {
        fail('First name and last name are required');
    }
    $fullName = $first . ' ' . $last;
    if (mb_strlen($fullName) > 120) {
        fail('Full name is too long (at most 120 characters)');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Enter a valid email address');
    }

    query('UPDATE users SET full_name = ?, email = ?, phone = ? WHERE user_id = ?', [$fullName, $email, $phone, $id]);

    $oldValues = ['full_name' => $user['full_name'], 'email' => $user['email'], 'phone' => $user['phone']];
    $newValues = ['full_name' => $fullName, 'email' => $email, 'phone' => $phone];
    if ($oldValues != $newValues) {
        audit('ACCOUNT_UPDATED', 'USERS', $id, $user['username'] . ' edited their own details',
            json_encode($oldValues), json_encode($newValues));
    }

    respond(['user' => public_user(query_one('SELECT * FROM users WHERE user_id = ?', [$id]))]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = input();
    $currentPassword = password_param($data, 'currentPassword', 'Current password');
    $newPassword = password_param($data, 'newPassword', 'New password');

    $saved = query_one('SELECT password_hash FROM users WHERE user_id = ?', [$id]);
    if (!password_verify($currentPassword, $saved['password_hash'])) {
        fail('Your current password is wrong');
    }
    if (strlen($newPassword) < 8) {
        fail('New password must be at least 8 characters');
    }
    if ($newPassword === $currentPassword) {
        fail('New password must be different from the current one');
    }

    query('UPDATE users SET password_hash = ? WHERE user_id = ?', [password_hash($newPassword, PASSWORD_DEFAULT), $id]);
    audit('PASSWORD_CHANGED', 'USERS', $id, $user['username'] . ' changed their password');
    respond(['ok' => true]);
}
