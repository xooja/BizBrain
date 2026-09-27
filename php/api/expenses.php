<?php
/**
 * BizBrain — php/api/expenses.php
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
            $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?');
            $stmt->execute([$id, $user['id']]);
            $r = $stmt->fetch();
            $r ? jsonSuccess($r) : jsonError('Not found', 404);
        }
        $stmt = $pdo->prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC');
        $stmt->execute([$user['id']]);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $b = getRequestBody();
        $c = sanitizeArray($b, [
            'title'      => 'string',
            'amount'     => 'float',
            'date'       => 'string',
            'category'   => 'string',
            'project_id' => 'int',
            'notes'      => 'string',
        ]);
        if (empty($c['title']))  jsonError('Title is required');
        if (empty($c['amount'])) jsonError('Amount is required');

        $stmt = $pdo->prepare(
            'INSERT INTO expenses (user_id, project_id, title, amount, date, category, notes, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,NOW(),NOW())'
        );
        $stmt->execute([
            $user['id'],
            $c['project_id'] ?? null,
            $c['title'],
            $c['amount'],
            $c['date'] ?? date('Y-m-d'),
            $c['category'] ?? 'Other',
            $c['notes'] ?? '',
        ]);
        $newId = (int)$pdo->lastInsertId();
        $stmt  = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
        $stmt->execute([$newId]);
        logActivity($pdo, $user['id'], 'create', 'expenses', $newId, "Expense: {$c['title']}");
        jsonSuccess($stmt->fetch(), 'Expense added', 201);
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $check = $pdo->prepare('SELECT id FROM expenses WHERE id = ? AND user_id = ?');
        $check->execute([$id, $user['id']]);
        if (!$check->fetch()) jsonError('Not found', 404);

        $b = getRequestBody();
        $c = sanitizeArray($b, [
            'title'      => 'string',
            'amount'     => 'float',
            'date'       => 'string',
            'category'   => 'string',
            'project_id' => 'int',
            'notes'      => 'string',
        ]);
        $fields = []; $vals = [];
        foreach ($c as $k => $v) { $fields[] = "$k = ?"; $vals[] = $v; }
        $vals[] = date('Y-m-d H:i:s'); $vals[] = $id; $vals[] = $user['id'];
        $pdo->prepare('UPDATE expenses SET ' . implode(', ', $fields) . ', updated_at = ? WHERE id = ? AND user_id = ?')
            ->execute($vals);
        $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
        $stmt->execute([$id]);
        logActivity($pdo, $user['id'], 'update', 'expenses', $id);
        jsonSuccess($stmt->fetch(), 'Updated');
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        logActivity($pdo, $user['id'], 'delete', 'expenses', $id);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
