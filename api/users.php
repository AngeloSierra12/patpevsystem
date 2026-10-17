<?php

require __DIR__ . '/_common.php';
allow_methods(['GET', 'POST', 'PUT']);
$admin = require_admin();

const USER_COLUMNS = 'user_id, username, full_name, email, phone, role, department, is_active, created_at, last_login_at';

function find_user($id)
{
    return query_one('SELECT ' . USER_COLUMNS . ' FROM users WHERE user_id = ?', [$id]);
}

// Forgot-password requests that the admin has not handled yet:
// a request stays open until that user's password is reset.
function reset_requests()
{
    $rows = query(
        "SELECT r.target_id AS user_id, MAX(r.logged_at) AS requested_at, COUNT(*) AS times
         FROM audit_logs r
         WHERE r.action_type = 'PASSWORD_RESET_REQUEST' AND r.target_entity = 'USERS'
           AND r.logged_at > COALESCE((SELECT MAX(p.logged_at) FROM audit_logs p
                                       WHERE p.action_type = 'PASSWORD_RESET' AND p.target_entity = 'USERS'
                                         AND p.target_id = r.target_id), '2000-01-01')
         GROUP BY r.target_id
         ORDER BY requested_at"
    );

    $requests = [];
    foreach ($rows as $row) {
        $user = find_user((int) $row['user_id']);
        if ($user === null || !$user['is_active']) {
            continue;
        }
        $latest = query_one(
            "SELECT new_value FROM audit_logs
             WHERE action_type = 'PASSWORD_RESET_REQUEST' AND target_entity = 'USERS' AND target_id = ?
             ORDER BY logged_at DESC LIMIT 1",
            [$row['user_id']]
        );
        $requests[] = [
            'user' => public_user($user),
            'requestedAt' => $row['requested_at'],
            'times' => (int) $row['times'],
            'note' => $latest['new_value'],
        ];
    }
    return $requests;
}

function user_fields($data, $adding)
{
    $fields = [];

    if ($adding || isset($data['firstName']) || isset($data['lastName'])) {
        $first = text($data, 'firstName', 'First name');
        $last = text($data, 'lastName', 'Last name');
        if ($first === '' || $last === '') {
            fail('First name and last name are required');
        }
        $fullName = $first . ' ' . $last;
        if (mb_strlen($fullName) > 120) {
            fail('Full name is too long (at most 120 characters)');
        }
        $fields['full_name'] = $fullName;
    }

    if ($adding || isset($data['email'])) {
        $email = text($data, 'email', 'Email', 120);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            fail('Enter a valid email address');
        }
        $fields['email'] = $email;
    }

    if ($adding || isset($data['phone'])) {
        $phone = text($data, 'phone', 'Contact number', 25);
        if ($phone === '') {
            $phone = null;
        }
        $fields['phone'] = $phone;
    }

    if ($adding || isset($data['role'])) {
        $role = strtoupper(text($data, 'role', 'Role'));
        if (!isset(ROLE_NAMES[$role])) {
            fail('Role must be ADMIN, STAFF_HOSTEL or STAFF_CANTEEN');
        }
        $fields['role'] = $role;
    }

    if ($adding || isset($data['department'])) {
        $department = text($data, 'department', 'Department', 120);
        if ($department === '') {
            $department = null;
            if (isset($fields['role'])) {
                $department = ROLE_NAMES[$fields['role']];
            }
        }
        $fields['department'] = $department;
    }

    return $fields;
}

function check_password($password)
{
    if (strlen($password) < 8) {
        fail('Password must be at least 8 characters');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sql = 'SELECT ' . USER_COLUMNS . ' FROM users';
    $params = [];

    $search = '';
    if (isset($_GET['search'])) {
        $search = trim($_GET['search']);
    }
    if ($search !== '') {
        $sql .= " WHERE full_name LIKE ? OR email LIKE ? OR username LIKE ? OR department LIKE ?
                  OR CASE role WHEN 'ADMIN' THEN 'Administrator' WHEN 'STAFF_HOSTEL' THEN 'Hostel Staff'
                               ELSE 'Canteen Staff' END LIKE ?";
        $like = '%' . $search . '%';
        $params = [$like, $like, $like, $like, $like];
    }

    $sort = 'name';
    if (isset($_GET['sort'])) {
        $sort = $_GET['sort'];
    }
    if ($sort === 'role') {
        $sql .= ' ORDER BY role, full_name';
    } elseif ($sort === 'status') {
        $sql .= ' ORDER BY is_active DESC, full_name';
    } else {
        $sql .= ' ORDER BY full_name';
    }

    $rows = query($sql, $params);
    $count = query_one('SELECT COUNT(*) AS total FROM users');

    $users = [];
    foreach ($rows as $row) {
        $users[] = public_user($row);
    }
    respond(['total' => (int) $count['total'], 'users' => $users, 'resetRequests' => reset_requests()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = input();
    $fields = user_fields($data, true);

    $username = text($data, 'username', 'Username');
    if (!preg_match('/^[A-Za-z0-9_.]{3,50}$/', $username)) {
        fail('Username must be 3 to 50 letters, numbers, dots or underscores');
    }

    $password = password_param($data, 'password', 'Password');
    check_password($password);

    query(
        'INSERT INTO users (username, password_hash, full_name, email, phone, role, department)
         VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            $username,
            password_hash($password, PASSWORD_DEFAULT),
            $fields['full_name'],
            $fields['email'],
            $fields['phone'],
            $fields['role'],
            $fields['department'],
        ]
    );
    $id = (int) db()->lastInsertId();

    audit('USER_CREATE', 'USERS', $id, "Made an account: $username (" . ROLE_NAMES[$fields['role']] . ')');
    respond(['user' => public_user(find_user($id))], 201);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $id = 0;
    if (isset($_GET['id'])) {
        $id = (int) $_GET['id'];
    }
    $before = find_user($id);
    if ($before === null) {
        fail('User not found', 404);
    }

    $data = input();
    $fields = user_fields($data, false);

    $isSelf = $id === (int) $admin['user_id'];
    if ($isSelf && isset($data['isActive']) && !$data['isActive']) {
        fail("You can't deactivate your own account");
    }
    if ($isSelf && isset($fields['role']) && $fields['role'] !== 'ADMIN') {
        fail("You can't remove your own admin role");
    }

    if (isset($data['isActive'])) {
        if ($data['isActive']) {
            $fields['is_active'] = 1;
        } else {
            $fields['is_active'] = 0;
        }
    }

    $newPassword = password_param($data, 'newPassword', 'New password');
    if ($newPassword !== '') {
        check_password($newPassword);
        $fields['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
    }

    if (count($fields) === 0) {
        fail('Nothing to change');
    }

    $setParts = [];
    $params = [];
    foreach ($fields as $column => $value) {
        $setParts[] = "$column = ?";
        $params[] = $value;
    }
    $params[] = $id;
    query('UPDATE users SET ' . implode(', ', $setParts) . ' WHERE user_id = ?', $params);

    $changed = [];
    $oldValues = [];
    $newValues = [];
    foreach ($fields as $column => $value) {
        if ($column === 'password_hash' || $column === 'is_active') {
            continue;
        }
        if ((string) $before[$column] !== (string) $value) {
            $changed[] = $column;
            $oldValues[$column] = $before[$column];
            $newValues[$column] = $value;
        }
    }

    if (count($changed) > 0) {
        audit('USER_UPDATED', 'USERS', $id, 'Edited account ' . $before['username'] . ': ' . implode(', ', $changed),
            json_encode($oldValues), json_encode($newValues));
    }

    if (isset($fields['is_active']) && (int) $before['is_active'] !== $fields['is_active']) {
        if ($fields['is_active'] === 1) {
            audit('USER_ACTIVATED', 'USERS', $id, 'Reactivated account ' . $before['username']);
        } else {
            audit('USER_DEACTIVATED', 'USERS', $id, 'Deactivated account ' . $before['username']);
        }
    }

    if ($newPassword !== '') {
        audit('PASSWORD_RESET', 'USERS', $id, 'Reset the password of ' . $before['username']);
    }

    respond(['user' => public_user(find_user($id))]);
}
