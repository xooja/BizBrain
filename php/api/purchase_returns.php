<?php
/**
 * BizBrain — php/api/purchase_returns.php
 * RESTful CRUD for purchase returns with stock deduction & supplier balance adjustment.
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
            $stmt = $pdo->prepare(
                'SELECT pr.*, s.company_name as supplier_name 
                 FROM purchase_returns pr 
                 LEFT JOIN suppliers s ON s.id = pr.supplier_id 
                 WHERE pr.id = ? AND pr.user_id = ?'
            );
            $stmt->execute([$id, $user['id']]);
            $ret = $stmt->fetch();
            if (!$ret) jsonError('Not found', 404);
            $items = $pdo->prepare('SELECT pri.*, p.name as product_name FROM purchase_return_items pri LEFT JOIN products p ON p.id = pri.product_id WHERE pri.purchase_return_id = ?');
            $items->execute([$id]);
            $ret['items'] = $items->fetchAll();
            jsonSuccess($ret);
        }
        $stmt = $pdo->prepare(
            'SELECT pr.*, s.company_name as supplier_name 
             FROM purchase_returns pr 
             LEFT JOIN suppliers s ON s.id = pr.supplier_id 
             WHERE pr.user_id = ? ORDER BY pr.created_at DESC'
        );
        $stmt->execute([$user['id']]);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $body = getRequestBody();
        $supplierId = (int)($body['supplier_id'] ?? 0);
        if (!$supplierId) jsonError('Supplier is required');

        $retNo  = sanitize($body['return_no'] ?? '');
        if (!$retNo) $retNo = 'PR-' . date('Ymd') . '-' . rand(100, 999);
        $date   = $body['date'] ?? date('Y-m-d');
        $piId   = isset($body['purchase_invoice_id']) ? (int)$body['purchase_invoice_id'] : null;
        $reason = sanitize($body['reason'] ?? '');
        $status = in_array($body['status'] ?? '', ['draft','completed','cancelled']) ? $body['status'] : 'draft';
        $total  = (float)($body['total'] ?? 0);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO purchase_returns (user_id, supplier_id, purchase_invoice_id, return_no, date, reason, total, status, created_at, updated_at) 
                 VALUES (?,?,?,?,?,?,?,?,NOW(),NOW())'
            );
            $stmt->execute([$user['id'], $supplierId, $piId, $retNo, $date, $reason, $total, $status]);
            $newId = (int)$pdo->lastInsertId();

            $items = $body['items'] ?? [];
            foreach ($items as $item) {
                $prodId   = (int)($item['product_id'] ?? 0);
                $prodName = sanitize($item['product_name'] ?? '');
                $qty      = (float)($item['quantity'] ?? 1);
                $pprice   = (float)($item['purchase_price'] ?? 0);
                $itotal   = (float)($item['total'] ?? ($qty * $pprice));

                $pdo->prepare('INSERT INTO purchase_return_items (purchase_return_id, product_id, product_name, quantity, purchase_price, total) VALUES (?,?,?,?,?,?)')
                    ->execute([$newId, $prodId, $prodName, $qty, $pprice, $itotal]);

                // Deduct stock (return to supplier)
                if ($prodId && $status === 'completed') {
                    $pdo->prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND user_id = ?')->execute([$qty, $prodId, $user['id']]);
                    $prod = $pdo->prepare('SELECT stock FROM products WHERE id = ?');
                    $prod->execute([$prodId]);
                    $sa = (float)$prod->fetchColumn();
                    $pdo->prepare('INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, reference_id, unit_price, created_at) VALUES (?,?,?,?,?,?,?,?,?,NOW())')
                        ->execute([$user['id'], $prodId, 'purchase_return', -$qty, $sa + $qty, $sa, 'purchase_return', $newId, $pprice]);
                }
            }

            // Adjust supplier balance
            if ($status === 'completed') {
                $pdo->prepare('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?')->execute([$total, $supplierId, $user['id']]);
            }

            $pdo->commit();
            logActivity($pdo, $user['id'], 'create', 'purchase_returns', $newId, "Purchase Return #{$retNo}");
            jsonSuccess(['id' => $newId, 'return_no' => $retNo], 'Created', 201);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Failed: ' . $e->getMessage(), 500);
        }
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $newStatus = sanitize($_GET['status'] ?? '');
        if ($newStatus) {
            $check = $pdo->prepare('SELECT id, status, total, supplier_id FROM purchase_returns WHERE id = ? AND user_id = ?');
            $check->execute([$id, $user['id']]);
            $old = $check->fetch();
            if (!$old) jsonError('Not found', 404);

            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE purchase_returns SET status = ?, updated_at = NOW() WHERE id = ?")->execute([$newStatus, $id]);

                if ($newStatus === 'completed' && $old['status'] !== 'completed') {
                    $items = $pdo->prepare('SELECT * FROM purchase_return_items WHERE purchase_return_id = ?');
                    $items->execute([$id]);
                    foreach ($items->fetchAll() as $item) {
                        $pdo->prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND user_id = ?')->execute([$item['quantity'], $item['product_id'], $user['id']]);
                    }
                    $pdo->prepare('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?')->execute([$old['total'], $old['supplier_id'], $user['id']]);
                }

                $pdo->commit();
                jsonSuccess(null, 'Status updated');
            } catch (Exception $e) { $pdo->rollBack(); jsonError('Failed', 500); }
            break;
        }
        jsonError('Status required', 400);
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM purchase_returns WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
