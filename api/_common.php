<?php

date_default_timezone_set('Asia/Manila');
ini_set('display_errors', '0');
ini_set('log_errors', '1');

const REMEMBER_SECONDS = 60 * 60 * 24 * 30;
const IDLE_SECONDS = 60 * 60 * 2;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

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

const CATEGORIES = [
    'CANTEEN' => [
        'FOOD_STAPLES' => 'Food Staples',
        'MEAT_POULTRY' => 'Meat & Poultry',
        'INGREDIENTS' => 'Ingredients',
        'BEVERAGES' => 'Beverages',
        'SUPPLIES_PACKAGING' => 'Supplies & Packaging',
        'CLEANING' => 'Cleaning',
    ],
    'HOSTEL' => [
        'LINENS_BEDDING' => 'Linens & Bedding',
        'TOILETRIES' => 'Toiletries',
        'ROOM_SUPPLIES' => 'Room Supplies',
        'CLEANING' => 'Cleaning',
    ],
];

$pdo = null;
$input = null;
$current_user = null;

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
    global $input;

    if ($input !== null) {
        return $input;
    }

    $type = '';
    if (isset($_SERVER['CONTENT_TYPE'])) {
        $type = $_SERVER['CONTENT_TYPE'];
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'GET' && stripos($type, 'application/json') === false) {
        fail('Send the data as JSON (Content-Type: application/json)', 415);
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        $input = [];
    }
    return $input;
}

function text($data, $key, $label = null, $max = null)
{
    if ($label === null) {
        $label = $key;
    }

    $value = '';
    if (isset($data[$key])) {
        $value = $data[$key];
    }
    if (is_array($value)) {
        fail("$label must be text");
    }

    $value = trim((string) $value);
    if ($max !== null && mb_strlen($value) > $max) {
        fail("$label is too long (at most $max characters)");
    }
    return $value;
}

function password_param($data, $key, $label)
{
    $value = '';
    if (isset($data[$key])) {
        $value = $data[$key];
    }
    if (is_array($value)) {
        fail("$label must be text");
    }

    $value = (string) $value;
    if (strlen($value) > 72) {
        fail("$label is too long (at most 72 characters)");
    }
    return $value;
}

function number_param($data, $key, $label, $allowZero = true, $decimals = 3, $max = 999999999)
{
    $value = '';
    if (isset($data[$key])) {
        $value = $data[$key];
    }
    if ($value === '') {
        fail("$label is required");
    }
    if (is_array($value) || !is_numeric($value)) {
        fail("$label must be a number");
    }

    $number = round((float) $value, $decimals);
    if ($allowZero && $number < 0) {
        fail("$label must be 0 or more");
    }
    if (!$allowZero && $number <= 0) {
        fail("$label must be more than 0");
    }
    if ($number > $max) {
        fail("$label is too large");
    }
    return $number;
}

function money_param($data, $key, $label)
{
    return number_param($data, $key, $label, true, 2, 99999999.99);
}

function date_param($value, $label)
{
    if ($value === null || $value === '') {
        return null;
    }

    $date = DateTime::createFromFormat('Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        fail("$label must be a date like 2026-10-14");
    }
    return $value;
}

function page_number()
{
    $page = 1;
    if (isset($_GET['page'])) {
        $page = (int) $_GET['page'];
    }
    if ($page < 1) {
        $page = 1;
    }
    return $page;
}

function db()
{
    global $pdo;

    if ($pdo !== null) {
        return $pdo;
    }

    $file = __DIR__ . '/../database/app_db_credentials.local.php';
    if (!file_exists($file)) {
        fail('Database login file is missing (database/app_db_credentials.local.php)', 500);
    }
    $login = require $file;

    try {
        $pdo = new PDO(
            'mysql:host=' . $login['host'] . ';port=' . $login['port'] . ';dbname=' . $login['database'] . ';charset=utf8mb4',
            $login['username'],
            $login['password']
        );
    } catch (PDOException $e) {
        fail('Cannot connect to the database. Is MySQL running in XAMPP?', 500);
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);

    $pdo->exec("SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    $pdo->exec("SET time_zone = '+08:00'");

    $userId = null;
    if (isset($_SESSION['user_id'])) {
        $userId = $_SESSION['user_id'];
    }
    $statement = $pdo->prepare('SET @app_user_id = ?, @app_ip = ?');
    $statement->execute([$userId, $_SERVER['REMOTE_ADDR']]);

    return $pdo;
}

function query($sql, $params = [])
{
    $statement = db()->prepare($sql);
    $statement->execute($params);

    $rows = [];
    if ($statement->columnCount() > 0) {
        $rows = $statement->fetchAll();
    }
    $statement->closeCursor();
    return $rows;
}

function query_one($sql, $params = [])
{
    $rows = query($sql, $params);
    if (count($rows) === 0) {
        return null;
    }
    return $rows[0];
}

function audit($action, $entity, $targetId, $description, $oldValue = null, $newValue = null, $userId = null)
{
    if ($userId === null && isset($_SESSION['user_id'])) {
        $userId = $_SESSION['user_id'];
    }
    query(
        'CALL sp_log(?, ?, ?, ?, ?, ?, ?, NOW())',
        [$userId, $action, $entity, $targetId, $description, $oldValue, $newValue]
    );
}

function handle_error($error)
{
    if ($error instanceof PDOException && is_array($error->errorInfo)) {
        $state = $error->errorInfo[0];
        $code = (int) $error->errorInfo[1];
        $message = $error->errorInfo[2];

        if ($state === '45000') {
            fail($message);
        }

        if ($code === 1062) {
            $duplicates = [
                "'username'" => 'That username is already taken',
                "'email'" => 'That email is already used by another account',
                "'supplier_name'" => 'A supplier with that name already exists',
                "'item_code'" => 'That item code is already used',
                "'uq_item_name_per_location'" => 'An item with that name already exists in this location',
                "'delivery_receipt_no'" => 'That receipt number was already recorded',
            ];
            foreach ($duplicates as $key => $text) {
                if (stripos($message, $key) !== false) {
                    fail($text, 409);
                }
            }
            fail('That value is already used by another record', 409);
        }

        if ($code === 1406 || $code === 1264) {
            $column = 'A value';
            if (preg_match("/column '([a-z_]+)'/i", $message, $match)) {
                $column = str_replace('_', ' ', $match[1]);
            }
            if ($code === 1406) {
                fail(ucfirst($column) . ' is too long');
            }
            fail(ucfirst($column) . ' is too large');
        }

        if ($code === 4025) {
            if (stripos($message, 'chk_item_levels') !== false) {
                fail('Critical level must be 0 or more and not higher than the reorder level');
            }
            fail('One of the values is not allowed. Check the numbers and try again.');
        }

        if ($state === '23000') {
            fail('This record is linked to other data and cannot be saved this way', 409);
        }
    }

    error_log($error);
    fail('Something went wrong on the server', 500);
}

set_exception_handler('handle_error');

$sessionFolder = ini_get('session.save_path');
if ($sessionFolder === '' || $sessionFolder === false) {
    $sessionFolder = sys_get_temp_dir();
}
$sessionFolder = rtrim($sessionFolder, '/\\') . DIRECTORY_SEPARATOR . 'patvep_sessions';
if (!is_dir($sessionFolder)) {
    @mkdir($sessionFolder, 0700, true);
}
if (is_dir($sessionFolder)) {
    session_save_path($sessionFolder);
}

ini_set('session.use_strict_mode', '1');
ini_set('session.gc_maxlifetime', (string) REMEMBER_SECONDS);
session_set_cookie_params(['path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
session_start();

if (!empty($_SESSION['user_id'])) {
    $limit = IDLE_SECONDS;
    if (!empty($_SESSION['remember'])) {
        $limit = REMEMBER_SECONDS;
    }

    $lastSeen = 0;
    if (isset($_SESSION['last_seen'])) {
        $lastSeen = $_SESSION['last_seen'];
    }

    if (time() - $lastSeen > $limit) {
        $_SESSION = [];
        session_regenerate_id(true);
    } else {
        $_SESSION['last_seen'] = time();
    }
}

function require_login()
{
    global $current_user;

    if ($current_user !== null) {
        return $current_user;
    }

    if (empty($_SESSION['user_id'])) {
        fail('Please log in first', 401);
    }

    $current_user = query_one(
        'SELECT user_id, username, full_name, email, phone, role, department, is_active, created_at, last_login_at
         FROM users WHERE user_id = ?',
        [$_SESSION['user_id']]
    );

    if ($current_user === null || !$current_user['is_active']) {
        session_destroy();
        fail('Your account is no longer active', 401);
    }
    return $current_user;
}

function require_admin()
{
    $user = require_login();
    if ($user['role'] !== 'ADMIN') {
        fail('Only administrators can do this', 403);
    }
    return $user;
}

function require_staff()
{
    $user = require_login();
    if ($user['role'] === 'ADMIN') {
        fail('Only hostel and canteen staff can do this', 403);
    }
    return $user;
}

function allowed_location($user, $asked = '')
{
    if ($user['role'] !== 'ADMIN') {
        return ROLE_LOCATION[$user['role']];
    }

    $asked = strtoupper((string) $asked);
    if ($asked === '' || $asked === 'ALL' || $asked === 'BOTH') {
        return null;
    }
    if ($asked !== 'HOSTEL' && $asked !== 'CANTEEN') {
        fail('Location must be HOSTEL, CANTEEN or empty for both');
    }
    return $asked;
}

function public_user($row)
{
    return [
        'id' => (int) $row['user_id'],
        'username' => $row['username'],
        'fullName' => $row['full_name'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'role' => $row['role'],
        'roleName' => ROLE_NAMES[$row['role']],
        'location' => ROLE_LOCATION[$row['role']],
        'department' => $row['department'],
        'isActive' => (bool) $row['is_active'],
        'createdAt' => $row['created_at'],
        'lastLoginAt' => $row['last_login_at'],
    ];
}
