<?php
/**
 * BizBrain — php/api/products.php
 * RESTful CRUD for inventory products.
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
            $stmt = $pdo->prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ? AND p.user_id = ?');
            $stmt->execute([$id, $user['id']]);
            $product = $stmt->fetch();
            $product ? jsonSuccess($product) : jsonError('Not found', 404);
        }
        $search = sanitize($_GET['q'] ?? '');
        $catId  = isset($_GET['category_id']) ? (int)$_GET['category_id'] : null;
        $lowStock = isset($_GET['low_stock']) ? (int)$_GET['low_stock'] : 0;

        $where  = ['p.user_id = ?'];
        $params = [$user['id']];
        if ($search)  { $where[] = '(p.name LIKE ? OR p.sku LIKE ?)'; $like = "%$search%"; $params[] = $like; $params[] = $like; }
        if ($catId)   { $where[] = 'p.category_id = ?'; $params[] = $catId; }
        if ($lowStock) { $where[] = 'p.stock <= p.min_stock'; }

        $whereClause = implode(' AND ', $where);
        $stmt = $pdo->prepare("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE $whereClause ORDER BY p.name ASC");
        $stmt->execute($params);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $body  = getRequestBody();
        $clean = sanitizeArray($body, [
            'name'=>'string','sku'=>'string','description'=>'string',
            'purchase_price'=>'float','sale_price'=>'float','stock'=>'float','min_stock'=>'float',
            'unit'=>'string','status'=>'string','barcode'=>'string'
        ]);
        $categoryId = isset($body['category_id']) ? (int)$body['category_id'] : null;
        if (empty($clean['name'])) jsonError('Product name is required');
        $clean['status'] = in_array($clean['status'] ?? '', ['active','inactive','discontinued']) ? $clean['status'] : 'active';
        $clean['unit']   = $clean['unit'] ?: 'pcs';

        $stmt = $pdo->prepare('INSERT INTO products (user_id, category_id, name, sku, barcode, description, purchase_price, sale_price, stock, min_stock, unit, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())');
        $stmt->execute([
            $user['id'], $categoryId,
            $clean['name'], $clean['sku'] ?? '', $clean['barcode'] ?? '', $clean['description'] ?? '',
            $clean['purchase_price'] ?? 0, $clean['sale_price'] ?? 0,
            $clean['stock'] ?? 0, $clean['min_stock'] ?? 0,
            $clean['unit'], $clean['status']
        ]);
        $newId = (int)$pdo->lastInsertId();

        // Log initial stock movement
        $stockVal = $clean['stock'] ?? 0;
        if ($stockVal > 0) {
            $stmt2 = $pdo->prepare('INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, notes, created_at) VALUES (?,?,?,?,?,?,?,NOW())');
            $stmt2->execute([$user['id'], $newId, 'opening', $stockVal, 0, $stockVal, 'Initial stock']);
        }

        logActivity($pdo, $user['id'], 'create', 'products', $newId, "Product: {$clean['name']}");
        jsonSuccess(['id'=>$newId], 'Created', 201);
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $check = $pdo->prepare('SELECT id, stock FROM products WHERE id = ? AND user_id = ?');
        $check->execute([$id, $user['id']]);
        $old = $check->fetch();
        if (!$old) jsonError('Not found', 404);

        $body  = getRequestBody();
        $clean = sanitizeArray($body, [
            'name'=>'string','sku'=>'string','description'=>'string',
            'purchase_price'=>'float','sale_price'=>'float','stock'=>'float','min_stock'=>'float',
            'unit'=>'string','status'=>'string','barcode'=>'string'
        ]);
        $categoryId = isset($body['category_id']) ? (int)$body['category_id'] : null;

        $fields = []; $vals = [];
        foreach ($clean as $k => $v) { $fields[] = "$k = ?"; $vals[] = $v; }
        if (isset($body['category_id'])) { $fields[] = 'category_id = ?'; $vals[] = $categoryId; }
        $vals[] = date('Y-m-d H:i:s'); $vals[] = $id; $vals[] = $user['id'];
        $pdo->prepare('UPDATE products SET ' . implode(', ', $fields) . ', updated_at = ? WHERE id = ? AND user_id = ?')->execute($vals);

        // Log stock adjustment if changed
        $newStock = $clean['stock'] ?? null;
        if ($newStock !== null && (float)$newStock !== (float)$old['stock']) {
            $diff = (float)$newStock - (float)$old['stock'];
            $stmt2 = $pdo->prepare('INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, notes, created_at) VALUES (?,?,?,?,?,?,?,NOW())');
            $stmt2->execute([$user['id'], $id, 'adjustment', $diff, $old['stock'], $newStock, 'Manual adjustment']);
        }

        logActivity($pdo, $user['id'], 'update', 'products', $id);
        jsonSuccess(null, 'Updated');
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM products WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        logActivity($pdo, $user['id'], 'delete', 'products', $id);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
