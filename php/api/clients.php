<?php
/**
 * BizBrain — php/api/clients.php
 * RESTful CRUD for clients.
 *
 * GET    /php/api/clients.php         → list all
 * GET    /php/api/clients.php?id=X    → get one
 * POST   /php/api/clients.php         → create
 * PUT    /php/api/clients.php?id=X    → update
 * DELETE /php/api/clients.php?id=X    → delete
 */

require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';

$user   = requireAuth();
$pdo    = getDB();
$method = getMethod();
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {

    // ── LIST / GET ONE ────────────────────────────────────────
    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare(
                'SELECT * FROM clients WHERE id = ? AND user_id = ? LIMIT 1'
            );
            $stmt->execute([$id, $user['id']]);
            $client = $stmt->fetch();
            $client ? jsonSuccess($client) : jsonError('Client not found', 404);
        }

        $search = sanitize($_GET['q'] ?? '');
        $status = sanitize($_GET['status'] ?? '');
        $where  = ['user_id = ?'];
        $params = [$user['id']];

        if ($search) {
            $where[]  = '(name LIKE ? OR email LIKE ? OR company LIKE ?)';
            $like     = "%$search%";
            $params[] = $like; $params[] = $like; $params[] = $like;
        }
        if ($status) {
            $where[]  = 'status = ?';
            $params[] = $status;
        }

        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM clients WHERE ' . implode(' AND ', $where));
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $pg    = getPagination($total);
        $stmt  = $pdo->prepare(
            'SELECT * FROM clients WHERE ' . implode(' AND ', $where) .
            ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
        );
        $stmt->execute([...$params, $pg['per_page'], $pg['offset']]);
        $clients = $stmt->fetchAll();

        jsonSuccess($clients, 'OK');
        break;

    // ── CREATE ────────────────────────────────────────────────
    case 'POST':
        verifyCsrf();
        $body  = getRequestBody();
        $clean = sanitizeArray($body, [
            'name'    => 'string',
            'email'   => 'email',
            'company' => 'string',
            'phone'   => 'string',
            'address' => 'string',
            'status'  => 'string',
            'notes'   => 'string',
        ]);

        if (empty($clean['name']))  jsonError('Name is required');
        if (empty($clean['email'])) jsonError('Email is required');
        if (!filter_var($clean['email'], FILTER_VALIDATE_EMAIL)) jsonError('Invalid email');

        $clean['status'] = in_array($clean['status'] ?? '', ['active','inactive','prospect']) ? $clean['status'] : 'active';

        $stmt = $pdo->prepare(
            'INSERT INTO clients (user_id, name, email, company, phone, address, status, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())'
        );
        $stmt->execute([
            $user['id'],
            $clean['name'], $clean['email'], $clean['company'] ?? '',
            $clean['phone'] ?? '', $clean['address'] ?? '',
            $clean['status'], $clean['notes'] ?? '',
        ]);
        $newId = (int)$pdo->lastInsertId();

        $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
        $stmt->execute([$newId]);
        $created = $stmt->fetch();

        logActivity($pdo, $user['id'], 'create', 'clients', $newId, "Created client: {$clean['name']}");
        jsonSuccess($created, 'Client created', 201);
        break;

    // ── UPDATE ────────────────────────────────────────────────
    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('Client ID required');

        // Check ownership
        $check = $pdo->prepare('SELECT id FROM clients WHERE id = ? AND user_id = ?');
        $check->execute([$id, $user['id']]);
        if (!$check->fetch()) jsonError('Client not found', 404);

        $body  = getRequestBody();
        $clean = sanitizeArray($body, [
            'name'    => 'string',
            'email'   => 'email',
            'company' => 'string',
            'phone'   => 'string',
            'address' => 'string',
            'status'  => 'string',
            'notes'   => 'string',
        ]);

        $fields = []; $vals = [];
        foreach ($clean as $k => $v) {
            $fields[] = "$k = ?";
            $vals[]   = $v;
        }
        $vals[] = date('Y-m-d H:i:s');
        $vals[] = $id;
        $vals[] = $user['id'];

        $stmt = $pdo->prepare('UPDATE clients SET ' . implode(', ', $fields) . ', updated_at = ? WHERE id = ? AND user_id = ?');
        $stmt->execute($vals);

        $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
        $stmt->execute([$id]);
        $updated = $stmt->fetch();

        logActivity($pdo, $user['id'], 'update', 'clients', $id, "Updated client");
        jsonSuccess($updated, 'Client updated');
        break;

    // ── DELETE ────────────────────────────────────────────────
    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('Client ID required');

        $check = $pdo->prepare('SELECT id FROM clients WHERE id = ? AND user_id = ?');
        $check->execute([$id, $user['id']]);
        if (!$check->fetch()) jsonError('Client not found', 404);

        $pdo->prepare('DELETE FROM clients WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        logActivity($pdo, $user['id'], 'delete', 'clients', $id, "Deleted client");
        jsonSuccess(null, 'Client deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
