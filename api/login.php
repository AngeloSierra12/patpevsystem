<?php

require __DIR__ . '/_common.php';
allow_methods(['POST']);

$data = input();
$username = text($data, 'username');
$password = isset($data['password']) ? (string) $data['password'] : '';
if ($username === '' || $password === '') fail('Enter your username and password');

$user = query_one('SELECT * FROM users WHERE username = ?', [$username]);

if ($user) {
    $failed = query_one(
        "SELECT COUNT(*) AS n FROM audit_logs
         WHERE user_id = ? AND action_type = 'LOGIN_FAILED'
           AND logged_at > NOW() - INTERVAL ? MINUTE
           AND logged_at > COALESCE((SELECT MAX(logged_at) FROM audit_logs
                                     WHERE (user_id = ? AND action_type = 'LOGIN')
                                        OR (target_entity = 'USERS' AND target_id = ?
                                            AND action_type IN ('PASSWORD_RESET', 'USER_ACTIVATED'))), '2000-01-01')",
        [$user['user_id'], LOCK_MINUTES, $user['user_id'], $user['user_id']]
    );
    if ((int) $failed['n'] >= MAX_FAILED_LOGINS) {
        fail('Too many wrong passwords. Try again in ' . LOCK_MINUTES . ' minutes or ask the admin.', 429);
    }
}

if (!$user || !password_verify($password, $user['password_hash'])) {
    audit('LOGIN_FAILED', 'AUTH', $user['user_id'] ?? null,
        "Failed sign-in for username '$username': wrong username or password",
        null, null, $user['user_id'] ?? null);
    fail('Wrong username or password', 401);
}
if (!$user['is_active']) {
    audit('LOGIN_FAILED', 'AUTH', $user['user_id'], "Failed sign-in for '$username': account is deactivated",
        null, null, $user['user_id']);
    fail('This account has been deactivated. Ask the admin.', 403);
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int) $user['user_id'];
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

db()->prepare('SET @app_user_id = ?')->execute([$user['user_id']]);
db()->prepare('UPDATE users SET last_login_at = NOW() WHERE user_id = ?')->execute([$user['user_id']]);
audit('LOGIN', 'AUTH', $user['user_id'], "User {$user['username']} logged in");

respond(['user' => public_user(require_login())]);
