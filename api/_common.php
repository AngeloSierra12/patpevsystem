<?php

date_default_timezone_set('Asia/Manila');
ini_set('display_errors', '0');
ini_set('log_errors', '1');

const REMEMBER_SECONDS = 60 * 60 * 24 * 30;
const IDLE_SECONDS = 60 * 60 * 2;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

function respond($data, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function fail($message, $status = 400)
{
    respond(['error' => $message], $status);
}

function allow_methods($methods)
{
    if (!in_array($_SERVER['REQUEST_METHOD'], $methods)) {
        fail('Method not allowed', 405);
    }
}

function input()
{
    static $data = null;
    if ($data === null) {

        $type = $_SERVER['CONTENT_TYPE'] ?? '';
        if ($_SERVER['REQUEST_METHOD'] !== 'GET' && stripos($type, 'application/json') === false) {
            fail('Send the data as JSON (Content-Type: application/json)', 415);
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
    }
    return $data;
}

function text($data, $key)
{
    return isset($data[$key]) ? trim((string) $data[$key]) : '';
}

function date_param($value, $name)
{
    if ($value === null || $value === '') return null;
    $d = DateTime::createFromFormat('Y-m-d', $value);
    if (!$d || $d->format('Y-m-d') !== $value) fail("$name must be a date like 2026-10-14");
    return $value;
}

function db()
{
    static $pdo = null;
    if ($pdo === null) {
        $file = __DIR__ . '/../database/app_db_credentials.local.php';
        if (!file_exists($file)) fail('Database login file is missing (database/app_db_credentials.local.php)', 500);
        $c = require $file;
        try {
            $pdo = new PDO(
                "mysql:host={$c['host']};port={$c['port']};dbname={$c['database']};charset=utf8mb4",
                $c['username'],
                $c['password'],
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        } catch (PDOException $e) {
            fail('Cannot connect to the database. Is MySQL running in XAMPP?', 500);
        }

        $pdo->prepare('SET @app_user_id = ?, @app_ip = ?')
            ->execute([$_SESSION['user_id'] ?? null, $_SERVER['REMOTE_ADDR'] ?? null]);
    }
    return $pdo;
}

function query($sql, $params = [])
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->columnCount() > 0 ? $stmt->fetchAll() : [];

    $stmt->closeCursor();
    return $rows;
}

function query_one($sql, $params = [])
{
    $rows = query($sql, $params);
    return $rows ? $rows[0] : null;
}

function audit($action, $entity, $targetId, $description, $old = null, $new = null, $userId = null)
{
    query('CALL sp_log(?, ?, ?, ?, ?, ?, ?, NOW())',
        [$userId ?? ($_SESSION['user_id'] ?? null), $action, $entity, $targetId, $description, $old, $new]);
}

set_exception_handler(function ($e) {
    if ($e instanceof PDOException) {
        $state = $e->errorInfo[0] ?? '';
        $message = $e->errorInfo[2] ?? $e->getMessage();
        if ($state === '45000') fail($message, 400);
        if ($state === '23000' && ($e->errorInfo[1] ?? 0) == 1062) {
            if (stripos($message, "'username'") !== false) fail('That username is already taken', 409);
            if (stripos($message, "'email'") !== false) fail('That email is already used by another account', 409);
            fail('That value is already used by another record', 409);
        }
        if ($state === '23000') fail('This record is linked to other data and cannot be saved this way', 409);
    }
    error_log($e);
    fail('Something went wrong on the server', 500);
});

ini_set('session.use_strict_mode', '1');
ini_set('session.gc_maxlifetime', (string) REMEMBER_SECONDS);
$sessionDir = rtrim(ini_get('session.save_path') ?: sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'patvep_sessions';
if (is_dir($sessionDir) || @mkdir($sessionDir, 0700, true)) session_save_path($sessionDir);
session_set_cookie_params(['path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
session_start();

if (!empty($_SESSION['user_id'])) {
    $limit = empty($_SESSION['remember']) ? IDLE_SECONDS : REMEMBER_SECONDS;
    if (time() - ($_SESSION['last_seen'] ?? 0) > $limit) {
        $_SESSION = [];
        session_regenerate_id(true);
    } else {
        $_SESSION['last_seen'] = time();
    }
}

const ROLE_NAMES = [
    'ADMIN' => 'Administrator',
    'STAFF_HOSTEL' => 'Hostel Staff',
    'STAFF_CANTEEN' => 'Canteen Staff',
];

const ROLE_LOCATION = [
    'ADMIN' => null,
    'STAFF_HOSTEL' => 'HOSTEL',
    'STAFF_CANTEEN' => 'CANTEEN',
];

function require_login()
{
    static $user = null;
    if ($user !== null) return $user;

    if (empty($_SESSION['user_id'])) fail('Please log in first', 401);

    $user = query_one(
        'SELECT user_id, username, full_name, email, phone, role, department, is_active, created_at, last_login_at
         FROM users WHERE user_id = ?',
        [$_SESSION['user_id']]
    );
    if (!$user || !$user['is_active']) {
        session_destroy();
        fail('Your account is no longer active', 401);
    }
    return $user;
}

function require_admin()
{
    $user = require_login();
    if ($user['role'] !== 'ADMIN') fail('Only administrators can do this', 403);
    return $user;
}

function allowed_location($user, $asked = '')
{
    $own = ROLE_LOCATION[$user['role']];
    if ($own !== null) return $own;

    $asked = strtoupper((string) $asked);
    if ($asked === '' || $asked === 'ALL' || $asked === 'BOTH') return null;
    if (!in_array($asked, ['HOSTEL', 'CANTEEN'])) fail('Location must be HOSTEL, CANTEEN or empty for both');
    return $asked;
}

function location_filter($location, $column = 'location')
{
    return $location === null ? ['', []] : [" AND $column = ?", [$location]];
}

function public_user($u)
{
    return [
        'id' => (int) $u['user_id'],
        'username' => $u['username'],
        'fullName' => $u['full_name'],
        'email' => $u['email'],
        'phone' => $u['phone'],
        'role' => $u['role'],
        'roleName' => ROLE_NAMES[$u['role']] ?? $u['role'],
        'location' => ROLE_LOCATION[$u['role']] ?? null,
        'department' => $u['department'],
        'isActive' => (bool) $u['is_active'],
        'createdAt' => $u['created_at'] ?? null,
        'lastLoginAt' => $u['last_login_at'] ?? null,
    ];
}
