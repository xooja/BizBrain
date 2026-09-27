<?php
/**
 * BizBrain — php/api/customers.php
 * RESTful CRUD for customers.
 */
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';

$user   = requireAuth();
$pdo    = getDB();
$method = getMethod();
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?');
            $stmt->execute([$id, $user['id']]);
            $c = $stmt->fetch();
            $c ? jsonSuccess($c) : jsonError('Not found', 404);
        }
        $stmt = $pdo->prepare('SELECT * FROM customers WHERE user_id = ? ORDER BY name ASC');
        $stmt->execute([$user['id']]);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $body  = getRequestBody();
        $clean = sanitizeArray($body, [
            'name'=>'string','company_name'=>'string','email'=>'email',
            'phone'=>'string','address'=>'string','status'=>'string','notes'=>'string'
        ]);
        $opening = (float)($body['opening_balance'] ?? 0);
        if (empty($clean['name'])) jsonError('Customer name is required');
        $clean['status'] = in_array($clean['status'] ?? '', ['active','inactive']) ? $clean['status'] : 'active';

        $stmt = $pdo->prepare('INSERT INTO customers (user_id, name, company_name, email, phone, address, opening_balance, current_balance, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),NOW())');
        $stmt->execute([$user['id'], $clean['name'], $clean['company_name'] ?? '', $clean['email'] ?? '', $clean['phone'] ?? '', $clean['address'] ?? '', $opening, $opening, $clean['status'], $clean['notes'] ?? '']);
        $newId = (int)$pdo->lastInsertId();
        logActivity($pdo, $user['id'], 'create', 'customers', $newId, "Customer: {$clean['name']}");
        jsonSuccess(['id'=>$newId], 'Created', 201);
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $check = $pdo->prepare('SELECT id FROM customers WHERE id = ? AND user_id = ?');
        $check->execute([$id, $user['id']]);
        if (!$check->fetch()) jsonError('Not found', 404);

        $body  = getRequestBody();
        $clean = sanitizeArray($body, [
            'name'=>'string','company_name'=>'string','email'=>'email',
            'phone'=>'string','address'=>'string','status'=>'string','notes'=>'string'
        ]);
        $fields = []; $vals = [];
        foreach ($clean as $k => $v) { $fields[] = "$k = ?"; $vals[] = $v; }
        $vals[] = date('Y-m-d H:i:s'); $vals[] = $id; $vals[] = $user['id'];
        $pdo->prepare('UPDATE customers SET ' . implode(', ', $fields) . ', updated_at = ? WHERE id = ? AND user_id = ?')->execute($vals);
        logActivity($pdo, $user['id'], 'update', 'customers', $id);
        jsonSuccess(null, 'Updated');
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM customers WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        logActivity($pdo, $user['id'], 'delete', 'customers', $id);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
