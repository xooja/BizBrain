<?php
/**
 * BizBrain — php/api/categories.php
 * RESTful CRUD for product categories.
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
            $stmt = $pdo->prepare('
                SELECT c.*, COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON p.category_id = c.id AND p.user_id = c.user_id
                WHERE c.id = ? AND c.user_id = ?
                GROUP BY c.id
                LIMIT 1
            ');
            $stmt->execute([$id, $user['id']]);
            $cat = $stmt->fetch();
            $cat ? jsonSuccess($cat) : jsonError('Not found', 404);
        }
        $stmt = $pdo->prepare('
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id AND p.user_id = c.user_id
            WHERE c.user_id = ?
            GROUP BY c.id
            ORDER BY c.name ASC
        ');
        $stmt->execute([$user['id']]);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $body  = getRequestBody();
        $clean = sanitizeArray($body, ['name'=>'string','description'=>'string','status'=>'string']);
        if (empty($clean['name'])) jsonError('Name is required');
        $clean['status'] = in_array($clean['status'] ?? '', ['active','inactive']) ? $clean['status'] : 'active';
        $stmt = $pdo->prepare('INSERT INTO categories (user_id, name, description, status, created_at, updated_at) VALUES (?,?,?,?,NOW(),NOW())');
        $stmt->execute([$user['id'], $clean['name'], $clean['description'] ?? '', $clean['status']]);
        $newId = (int)$pdo->lastInsertId();
        logActivity($pdo, $user['id'], 'create', 'categories', $newId, "Category: {$clean['name']}");
        jsonSuccess(['id'=>$newId, 'name'=>$clean['name'], 'description'=>$clean['description'] ?? '', 'status'=>$clean['status'], 'product_count'=>0], 'Created', 201);
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $check = $pdo->prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?');
        $check->execute([$id, $user['id']]);
        if (!$check->fetch()) jsonError('Not found', 404);
        $body  = getRequestBody();
        $clean = sanitizeArray($body, ['name'=>'string','description'=>'string','status'=>'string']);
        $fields = []; $vals = [];
        foreach ($clean as $k => $v) { $fields[] = "$k = ?"; $vals[] = $v; }
        $vals[] = date('Y-m-d H:i:s'); $vals[] = $id; $vals[] = $user['id'];
        $pdo->prepare('UPDATE categories SET ' . implode(', ', $fields) . ', updated_at = ? WHERE id = ? AND user_id = ?')->execute($vals);
        logActivity($pdo, $user['id'], 'update', 'categories', $id);
        jsonSuccess(null, 'Updated');
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        // Unlink products from this category before deleting
        $pdo->prepare('UPDATE products SET category_id = NULL WHERE category_id = ? AND user_id = ?')->execute([$id, $user['id']]);
        $pdo->prepare('DELETE FROM categories WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        logActivity($pdo, $user['id'], 'delete', 'categories', $id);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
