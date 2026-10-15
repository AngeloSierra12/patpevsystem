<?php

require __DIR__ . '/_common.php';
allow_methods(['GET', 'POST', 'PUT']);
$user = require_staff();
$location = ROLE_LOCATION[$user['role']];

function supplier_out($row)
{
    return [
        'id' => (int) $row['supplier_id'],
        'name' => $row['supplier_name'],
        'contactPerson' => $row['contact_person'],
        'phone' => $row['phone'],
        'email' => $row['email'],
        'address' => $row['address'],
        'categories' => $row['supplied_categories'],
        'notes' => $row['notes'],
        'isActive' => (bool) $row['is_active'],
        'createdAt' => $row['created_at'],
    ];
}

function find_supplier($id)
{
    $supplier = query_one('SELECT * FROM suppliers WHERE supplier_id = ?', [$id]);
    if ($supplier === null) {
        fail('Supplier not found', 404);
    }
    return $supplier;
}

function empty_to_null($value)
{
    if ($value === '') {
        return null;
    }
    return $value;
}

function supplier_fields($data)
{
    $fields = [
        'supplier_name' => text($data, 'name', 'Supplier name', 120),
        'contact_person' => text($data, 'contactPerson', 'Contact person', 100),
        'phone' => text($data, 'phone', 'Phone', 25),
        'email' => empty_to_null(text($data, 'email', 'Email', 120)),
        'address' => text($data, 'address', 'Address', 500),
        'supplied_categories' => empty_to_null(text($data, 'categories', 'Supplied categories', 500)),
        'notes' => empty_to_null(text($data, 'notes', 'Notes', 2000)),
    ];

    if ($fields['supplier_name'] === '') {
        fail('Supplier name is required');
    }
    if ($fields['contact_person'] === '') {
        fail('Contact person is required');
    }
    if ($fields['phone'] === '') {
        fail('Phone is required');
    }
    if ($fields['address'] === '') {
        fail('Address is required');
    }
    if ($fields['email'] !== null && !filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) {
        fail('Enter a valid email address');
    }
    return $fields;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['id']) && !empty($_GET['deliveries'])) {
    $supplier = find_supplier((int) $_GET['id']);

    $rows = query(
        'SELECT delivery_id, delivery_receipt_no, status, received_at, total_amount, line_item_count, received_by_name
         FROM vw_delivery_summary WHERE supplier_id = ? AND location = ?
         ORDER BY received_at DESC LIMIT 10',
        [$supplier['supplier_id'], $location]
    );

    $deliveries = [];
    foreach ($rows as $row) {
        $deliveries[] = [
            'id' => (int) $row['delivery_id'],
            'receiptNo' => $row['delivery_receipt_no'],
            'status' => $row['status'],
            'date' => $row['received_at'],
            'total' => (float) $row['total_amount'],
            'items' => (int) $row['line_item_count'],
            'receivedBy' => $row['received_by_name'],
        ];
    }

    respond(['supplier' => supplier_out($supplier), 'deliveries' => $deliveries]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['id'])) {
    respond(['supplier' => supplier_out(find_supplier((int) $_GET['id']))]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = ' WHERE 1 = 1';
    $params = [];

    $search = '';
    if (isset($_GET['search'])) {
        $search = trim($_GET['search']);
    }
    if ($search !== '') {
        $where .= ' AND (supplier_name LIKE ? OR contact_person LIKE ?)';
        $params[] = '%' . $search . '%';
        $params[] = '%' . $search . '%';
    }

    $category = '';
    if (isset($_GET['category'])) {
        $category = trim($_GET['category']);
    }
    if ($category !== '' && strtolower($category) !== 'all') {
        $where .= ' AND supplied_categories LIKE ?';
        $params[] = '%' . $category . '%';
    }

    $status = '';
    if (isset($_GET['status'])) {
        $status = strtolower($_GET['status']);
    }
    if ($status === 'active') {
        $where .= ' AND is_active = 1';
    } elseif ($status === 'inactive') {
        $where .= ' AND is_active = 0';
    } elseif ($status !== '' && $status !== 'all') {
        fail('Unknown status');
    }

    $perPage = 15;
    if (!empty($_GET['all'])) {
        $perPage = 1000;
    }
    $page = page_number();
    $offset = ($page - 1) * $perPage;

    $count = query_one('SELECT COUNT(*) AS total FROM suppliers' . $where, $params);
    $total = (int) $count['total'];
    $rows = query('SELECT * FROM suppliers' . $where . " ORDER BY is_active DESC, supplier_name LIMIT $perPage OFFSET $offset", $params);

    $suppliers = [];
    foreach ($rows as $row) {
        $suppliers[] = supplier_out($row);
    }

    $pages = (int) ceil($total / $perPage);
    if ($pages < 1) {
        $pages = 1;
    }

    respond([
        'total' => $total,
        'page' => $page,
        'pages' => $pages,
        'suppliers' => $suppliers,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $fields = supplier_fields(input());

    query(
        'INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, supplied_categories, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            $fields['supplier_name'],
            $fields['contact_person'],
            $fields['phone'],
            $fields['email'],
            $fields['address'],
            $fields['supplied_categories'],
            $fields['notes'],
        ]
    );
    $id = (int) db()->lastInsertId();

    audit('SUPPLIER_CREATED', 'SUPPLIERS', $id, 'Added supplier ' . $fields['supplier_name']);
    respond(['supplier' => supplier_out(find_supplier($id))], 201);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $id = 0;
    if (isset($_GET['id'])) {
        $id = (int) $_GET['id'];
    }
    $before = find_supplier($id);

    $data = input();
    $currentValues = [
        'name' => $before['supplier_name'],
        'contactPerson' => $before['contact_person'],
        'phone' => $before['phone'],
        'email' => $before['email'],
        'address' => $before['address'],
        'categories' => $before['supplied_categories'],
        'notes' => $before['notes'],
    ];
    foreach ($currentValues as $key => $value) {
        if (!array_key_exists($key, $data)) {
            if ($value === null) {
                $value = '';
            }
            $data[$key] = $value;
        }
    }

    $fields = supplier_fields($data);

    $isActive = (int) $before['is_active'];
    if (isset($data['isActive'])) {
        if ($data['isActive']) {
            $isActive = 1;
        } else {
            $isActive = 0;
        }
    }

    query(
        'UPDATE suppliers
         SET supplier_name = ?, contact_person = ?, phone = ?, email = ?, address = ?,
             supplied_categories = ?, notes = ?, is_active = ?
         WHERE supplier_id = ?',
        [
            $fields['supplier_name'],
            $fields['contact_person'],
            $fields['phone'],
            $fields['email'],
            $fields['address'],
            $fields['supplied_categories'],
            $fields['notes'],
            $isActive,
            $id,
        ]
    );

    $oldValues = [];
    $newValues = [];
    foreach ($fields as $column => $value) {
        if ((string) $before[$column] !== (string) $value) {
            $oldValues[$column] = $before[$column];
            $newValues[$column] = $value;
        }
    }
    if (count($newValues) > 0) {
        audit('SUPPLIER_UPDATED', 'SUPPLIERS', $id,
            'Edited supplier ' . $fields['supplier_name'] . ': ' . implode(', ', array_keys($newValues)),
            json_encode($oldValues), json_encode($newValues));
    }

    if ($isActive !== (int) $before['is_active']) {
        if ($isActive === 1) {
            audit('SUPPLIER_ACTIVATED', 'SUPPLIERS', $id, 'Reactivated supplier ' . $fields['supplier_name']);
        } else {
            audit('SUPPLIER_DEACTIVATED', 'SUPPLIERS', $id, 'Deactivated supplier ' . $fields['supplier_name']);
        }
    }

    respond(['supplier' => supplier_out(find_supplier($id))]);
}
