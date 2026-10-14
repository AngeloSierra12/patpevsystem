<?php

require __DIR__ . '/_common.php';
allow_methods(['GET', 'POST', 'PUT']);
$admin = require_admin();

const USER_COLUMNS = 'user_id, username, full_name, email, phone, role, department, is_active, created_at, last_login_at';

function user_fields($data, $adding)
{
    $out = [];

    if ($adding || isset($data['firstName']) || isset($data['lastName'])) {
        $first = text($data, 'firstName');
        $last = text($data, 'lastName');
        if ($first === '' || $last === '') fail('First name and last name are required');
        $out['full_name'] = "$first $last";
    }
    if ($adding || isset($data['email'])) {
        $email = text($data, 'email');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address');
        $out['email'] = $email;
    }
    if ($adding || isset($data['phone'])) {
        $out['phone'] = text($data, 'phone') ?: null;
    }
    if ($adding || isset($data['role'])) {
        $role = strtoupper(text($data, 'role'));
        if (!isset(ROLE_NAMES[$role])) fail('Role must be ADMIN, STAFF_HOSTEL or STAFF_CANTEEN');
        $out['role'] = $role;
    }
    if ($adding || isset($data['department'])) {

        $out['department'] = text($data, 'department') ?: (isset($out['role']) ? ROLE_NAMES[$out['role']] : null);
    }
    return $out;
}

function check_password($password)
{
    if (strlen($password) < 8) fail('Password must be at least 8 characters');
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = '1 = 1';
    $params = [];
    $search = trim($_GET['search'] ?? '');
    if ($search !== '') {
        $where = "(full_name LIKE ? OR email LIKE ? OR username LIKE ? OR department LIKE ?
                   OR CASE role WHEN 'ADMIN' THEN 'Administrator' WHEN 'STAFF_HOSTEL' THEN 'Hostel Staff'
                                ELSE 'Canteen Staff' END LIKE ?)";
        $params = array_fill(0, 5, "%$search%");
    }
    $sort = [
        'name' => 'full_name',
        'role' => 'role, full_name',
        'status' => 'is_active DESC, full_name',
    ][$_GET['sort'] ?? 'name'] ?? 'full_name';

    $users = query('SELECT ' . USER_COLUMNS . " FROM users WHERE $where ORDER BY $sort", $params);
    $total = (int) query_one('SELECT COUNT(*) AS n FROM users')['n'];
    respond(['total' => $total, 'users' => array_map('public_user', $users)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = input();
    $fields = user_fields($data, true);

    $username = text($data, 'username');
    if (!preg_match('/^[A-Za-z0-9_.]{3,50}$/', $username)) {
        fail('Username must be 3 to 50 letters, numbers, dots or underscores');
    }
    $password = (string) ($data['password'] ?? '');
    check_password($password);

    db()->prepare(
        'INSERT INTO users (username, password_hash, full_name, email, phone, role, department)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $username, password_hash($password, PASSWORD_DEFAULT), $fields['full_name'], $fields['email'],
        $fields['phone'], $fields['role'], $fields['department'],
    ]);
    $id = (int) db()->lastInsertId();

    audit('USER_CREATE', 'USERS', $id, "Made an account: $username (" . ROLE_NAMES[$fields['role']] . ')');
    respond(['user' => public_user(query_one('SELECT ' . USER_COLUMNS . ' FROM users WHERE user_id = ?', [$id]))], 201);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $id = (int) ($_GET['id'] ?? 0);
    $before = query_one('SELECT ' . USER_COLUMNS . ' FROM users WHERE user_id = ?', [$id]);
    if (!$before) fail('User not found', 404);

    $data = input();
    $fields = user_fields($data, false);

    $isSelf = $id === (int) $admin['user_id'];
    if ($isSelf && isset($data['isActive']) && !$data['isActive']) fail("You can't deactivate your own account");
    if ($isSelf && isset($fields['role']) && $fields['role'] !== 'ADMIN') fail("You can't remove your own admin role");

    if (isset($data['isActive'])) $fields['is_active'] = $data['isActive'] ? 1 : 0;

    $newPassword = isset($data['newPassword']) ? (string) $data['newPassword'] : '';
    if ($newPassword !== '') {
        check_password($newPassword);
        $fields['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
    }
    if (!$fields) fail('Nothing to change');

    $set = implode(', ', array_map(fn($col) => "$col = ?", array_keys($fields)));
    db()->prepare("UPDATE users SET $set WHERE user_id = ?")->execute(array_merge(array_values($fields), [$id]));

    $changes = [];
    $old = [];
    $new = [];
    foreach ($fields as $col => $value) {
        if ($col === 'password_hash' || $col === 'is_active') continue;
        if ((string) $before[$col] !== (string) $value) {
            $changes[] = $col;
            $old[$col] = $before[$col];
            $new[$col] = $value;
        }
    }
    if ($changes) {
        audit('USER_UPDATED', 'USERS', $id, "Edited account {$before['username']}: " . implode(', ', $changes),
            json_encode($old), json_encode($new));
    }
    if (isset($fields['is_active']) && (int) $before['is_active'] !== $fields['is_active']) {
        audit($fields['is_active'] ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'USERS', $id,
            ($fields['is_active'] ? 'Reactivated' : 'Deactivated') . " account {$before['username']}");
    }
    if ($newPassword !== '') {
        audit('PASSWORD_RESET', 'USERS', $id, "Reset the password of {$before['username']}");
    }

    respond(['user' => public_user(query_one('SELECT ' . USER_COLUMNS . ' FROM users WHERE user_id = ?', [$id]))]);
}
