<?php

require __DIR__ . '/_common.php';
allow_methods(['POST']);
input();

if (!empty($_SESSION['user_id'])) {
    $user = query_one('SELECT username FROM users WHERE user_id = ?', [$_SESSION['user_id']]);
    audit('LOGOUT', 'AUTH', $_SESSION['user_id'], 'User ' . ($user['username'] ?? '?') . ' logged out');
}

$_SESSION = [];
setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => '/']);
session_destroy();

respond(['ok' => true]);
