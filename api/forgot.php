<?php

require __DIR__ . '/_common.php';
allow_methods(['POST']);

// No email or SMS (out of scope), so a forgotten password goes to the admin:
// the request is saved in the audit log and shows up on the Users page.
const MAX_RESET_REQUESTS = 3;

$data = input();
$username = text($data, 'username', 'Username', 50);
$note = text($data, 'note', 'Note', 200);

if ($username === '') {
    fail('Enter your username');
}

$user = query_one('SELECT user_id, username, is_active FROM users WHERE username = ?', [$username]);

// Same answer whether or not the username exists, so this page cannot be used to guess usernames.
$answer = ['ok' => true, 'message' => 'Request sent. Ask the admin for your new password.'];

if ($user === null || !$user['is_active']) {
    respond($answer);
}

$userId = (int) $user['user_id'];

$recent = query_one(
    "SELECT COUNT(*) AS total FROM audit_logs
     WHERE action_type = 'PASSWORD_RESET_REQUEST' AND target_entity = 'USERS' AND target_id = ?
       AND logged_at > NOW() - INTERVAL 1 HOUR",
    [$userId]
);
if ((int) $recent['total'] >= MAX_RESET_REQUESTS) {
    respond($answer);
}

$description = 'Password reset requested for ' . $user['username'];
if ($note !== '') {
    $description .= ': ' . $note;
}
if ($note === '') {
    $note = null;
}
audit('PASSWORD_RESET_REQUEST', 'USERS', $userId, $description, null, $note, $userId);

respond($answer);
