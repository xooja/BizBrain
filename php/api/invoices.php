<?php
/**
 * BizBrain — php/api/invoices.php
 */
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';

$user   = requireAuth();
$pdo    = getDB();
$method = getMethod();
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$action = sanitize($_GET['action'] ?? '');

switch ($method) {
    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare(
                'SELECT i.*, c.name as client_name, c.email as client_email
                 FROM invoices i
                 LEFT JOIN clients c ON c.id = i.client_id
                 WHERE i.id = ? AND i.user_id = ?'
            );
            $stmt->execute([$id, $user['id']]);
            $inv = $stmt->fetch();
            if (!$inv) jsonError('Not found', 404);
            // Decode items JSON
            $inv['items'] = json_decode($inv['items'] ?? '[]', true) ?: [];
            jsonSuccess($inv);
        }
        $stmt = $pdo->prepare(
            'SELECT i.*, c.name as client_name
             FROM invoices i
             LEFT JOIN clients c ON c.id = i.client_id
             WHERE i.user_id = ?
             ORDER BY i.created_at DESC'
        );
        $stmt->execute([$user['id']]);
        $invoices = $stmt->fetchAll();
        foreach ($invoices as &$inv) {
            $inv['items'] = json_decode($inv['items'] ?? '[]', true) ?: [];
        }
        jsonSuccess($invoices);
        break;

    case 'POST':
        // Handle "send" action
        if ($action === 'send' && $id) {
            verifyCsrf();
            $pdo->prepare("UPDATE invoices SET status = 'sent', updated_at = NOW() WHERE id = ? AND user_id = ?")
                ->execute([$id, $user['id']]);
            logActivity($pdo, $user['id'], 'send', 'invoices', $id);
            jsonSuccess(null, 'Invoice marked as sent');
        }

        verifyCsrf();
        $b = getRequestBody();
        $c = sanitizeArray($b, [
            'client_id'   => 'int',
            'client_name' => 'string',
            'status'      => 'string',
            'date'        => 'string',
            'due_date'    => 'string',
            'notes'       => 'string',
            'total'       => 'float',
        ]);

        if (empty($c['client_id'])) jsonError('Client is required');

        $validStatuses = ['draft','sent','pending','paid','overdue','cancelled'];
        $c['status']   = in_array($c['status'] ?? '', $validStatuses) ? $c['status'] : 'draft';

        // Items is a JSON string from client
        $itemsRaw = $b['items'] ?? '[]';
        $items    = is_string($itemsRaw) ? $itemsRaw : json_encode($itemsRaw);

        $stmt = $pdo->prepare(
            'INSERT INTO invoices (user_id, client_id, status, date, due_date, items, total, notes, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,NOW(),NOW())'
        );
        $stmt->execute([
            $user['id'],
            $c['client_id'],
            $c['status'],
            $c['date']     ?? date('Y-m-d'),
            $c['due_date'] ?? null,
            $items,
            $c['total']    ?? 0,
            $c['notes']    ?? '',
        ]);
        $newId = (int)$pdo->lastInsertId();
        $stmt  = $pdo->prepare(
            'SELECT i.*, c.name as client_name FROM invoices i
             LEFT JOIN clients c ON c.id = i.client_id WHERE i.id = ?'
        );
        $stmt->execute([$newId]);
        $created = $stmt->fetch();
        $created['items'] = json_decode($created['items'] ?? '[]', true) ?: [];
        logActivity($pdo, $user['id'], 'create', 'invoices', $newId, "Invoice #{$newId}");
        jsonSuccess($created, 'Invoice created', 201);
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $check = $pdo->prepare('SELECT id FROM invoices WHERE id = ? AND user_id = ?');
        $check->execute([$id, $user['id']]);
        if (!$check->fetch()) jsonError('Not found', 404);

        $b = getRequestBody();
        $c = sanitizeArray($b, [
            'client_id' => 'int',
            'status'    => 'string',
            'date'      => 'string',
            'due_date'  => 'string',
            'notes'     => 'string',
            'total'     => 'float',
        ]);

        $itemsRaw = $b['items'] ?? null;
        if ($itemsRaw !== null) {
            $c['items'] = is_string($itemsRaw) ? $itemsRaw : json_encode($itemsRaw);
        }

        $fields = []; $vals = [];
        foreach ($c as $k => $v) { $fields[] = "$k = ?"; $vals[] = $v; }
        $vals[] = date('Y-m-d H:i:s'); $vals[] = $id; $vals[] = $user['id'];
        $pdo->prepare('UPDATE invoices SET ' . implode(', ', $fields) . ', updated_at = ? WHERE id = ? AND user_id = ?')
            ->execute($vals);

        $stmt = $pdo->prepare('SELECT i.*, c.name as client_name FROM invoices i LEFT JOIN clients c ON c.id=i.client_id WHERE i.id=?');
        $stmt->execute([$id]);
        $updated = $stmt->fetch();
        $updated['items'] = json_decode($updated['items'] ?? '[]', true) ?: [];
        logActivity($pdo, $user['id'], 'update', 'invoices', $id);
        jsonSuccess($updated, 'Updated');
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM invoices WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        logActivity($pdo, $user['id'], 'delete', 'invoices', $id);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
