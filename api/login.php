<?php

require __DIR__ . '/_common.php';
allow_methods(['POST']);

$data = input();
$username = text($data, 'username', 'Username', 50);
$password = password_param($data, 'password', 'Password');

if ($username === '' || $password === '') {
    fail('Enter your username and password');
}

$user = query_one('SELECT * FROM users WHERE username = ?', [$username]);

$userId = null;
if ($user !== null) {
    $userId = $user['user_id'];
}

if ($user !== null) {
    $lastUnlock = query_one(
        "SELECT MAX(logged_at) AS last_time FROM audit_logs
         WHERE (user_id = ? AND action_type = 'LOGIN')
            OR (target_entity = 'USERS' AND target_id = ? AND action_type IN ('PASSWORD_RESET', 'USER_ACTIVATED'))",
        [$userId, $userId]
    );
    $since = $lastUnlock['last_time'];
    if ($since === null) {
        $since = '2000-01-01';
    }

    $failed = query_one(
        "SELECT COUNT(*) AS total FROM audit_logs
         WHERE user_id = ? AND action_type = 'LOGIN_FAILED'
           AND logged_at > NOW() - INTERVAL " . LOCK_MINUTES . " MINUTE
           AND logged_at > ?",
        [$userId, $since]
    );

    if ((int) $failed['total'] >= MAX_FAILED_LOGINS) {
        fail('Too many wrong passwords. Try again in ' . LOCK_MINUTES . ' minutes or ask the admin.', 429);
    }
}

if ($user === null || !password_verify($password, $user['password_hash'])) {
    audit('LOGIN_FAILED', 'AUTH', $userId, "Failed sign-in for username '$username': wrong username or password", null, null, $userId);
    fail('Wrong username or password', 401);
}

if (!$user['is_active']) {
    audit('LOGIN_FAILED', 'AUTH', $userId, "Failed sign-in for '$username': account is deactivated", null, null, $userId);
    fail('This account has been deactivated. Ask the admin.', 403);
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int) $userId;
$_SESSION['remember'] = !empty($data['remember']);
$_SESSION['last_seen'] = time();

if ($_SESSION['remember']) {
    setcookie(session_name(), session_id(), [
        'expires' => time() + REMEMBER_SECONDS,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

query('SET @app_user_id = ?', [$userId]);
query('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [$userId]);
audit('LOGIN', 'AUTH', $userId, 'User ' . $user['username'] . ' logged in');

respond(['user' => public_user(require_login())]);
