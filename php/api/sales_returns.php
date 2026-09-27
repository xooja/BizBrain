<?php
/**
 * BizBrain — php/api/sales_returns.php
 * RESTful CRUD for sales returns with stock restoration & customer balance adjustment.
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
                'SELECT sr.*, c.name as customer_name 
                 FROM sales_returns sr 
                 LEFT JOIN customers c ON c.id = sr.customer_id 
                 WHERE sr.id = ? AND sr.user_id = ?'
            );
            $stmt->execute([$id, $user['id']]);
            $ret = $stmt->fetch();
            if (!$ret) jsonError('Not found', 404);
            $items = $pdo->prepare('SELECT sri.*, p.name as product_name FROM sales_return_items sri LEFT JOIN products p ON p.id = sri.product_id WHERE sri.sales_return_id = ?');
            $items->execute([$id]);
            $ret['items'] = $items->fetchAll();
            jsonSuccess($ret);
        }
        $stmt = $pdo->prepare(
            'SELECT sr.*, c.name as customer_name 
             FROM sales_returns sr 
             LEFT JOIN customers c ON c.id = sr.customer_id 
             WHERE sr.user_id = ? ORDER BY sr.created_at DESC'
        );
        $stmt->execute([$user['id']]);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $body = getRequestBody();
        $customerId = (int)($body['customer_id'] ?? 0);
        if (!$customerId) jsonError('Customer is required');

        $retNo  = sanitize($body['return_no'] ?? '');
        if (!$retNo) $retNo = 'SR-' . date('Ymd') . '-' . rand(100, 999);
        $date   = $body['date'] ?? date('Y-m-d');
        $siId   = isset($body['sales_invoice_id']) ? (int)$body['sales_invoice_id'] : null;
        $reason = sanitize($body['reason'] ?? '');
        $status = in_array($body['status'] ?? '', ['draft','completed','cancelled']) ? $body['status'] : 'draft';
        $total  = (float)($body['total'] ?? 0);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO sales_returns (user_id, customer_id, sales_invoice_id, return_no, date, reason, total, status, created_at, updated_at) 
                 VALUES (?,?,?,?,?,?,?,?,NOW(),NOW())'
            );
            $stmt->execute([$user['id'], $customerId, $siId, $retNo, $date, $reason, $total, $status]);
            $newId = (int)$pdo->lastInsertId();

            $items = $body['items'] ?? [];
            foreach ($items as $item) {
                $prodId   = (int)($item['product_id'] ?? 0);
                $prodName = sanitize($item['product_name'] ?? '');
                $qty      = (float)($item['quantity'] ?? 1);
                $sprice   = (float)($item['sale_price'] ?? 0);
                $itotal   = (float)($item['total'] ?? ($qty * $sprice));

                $pdo->prepare('INSERT INTO sales_return_items (sales_return_id, product_id, product_name, quantity, sale_price, total) VALUES (?,?,?,?,?,?)')
                    ->execute([$newId, $prodId, $prodName, $qty, $sprice, $itotal]);

                // Restore stock
                if ($prodId && $status === 'completed') {
                    $pdo->prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND user_id = ?')->execute([$qty, $prodId, $user['id']]);
                    $prod = $pdo->prepare('SELECT stock FROM products WHERE id = ?');
                    $prod->execute([$prodId]);
                    $sa = (float)$prod->fetchColumn();
                    $pdo->prepare('INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, reference_id, unit_price, created_at) VALUES (?,?,?,?,?,?,?,?,?,NOW())')
                        ->execute([$user['id'], $prodId, 'sales_return', $qty, $sa - $qty, $sa, 'sales_return', $newId, $sprice]);
                }
            }

            // Adjust customer balance (reduce receivable)
            if ($status === 'completed') {
                $pdo->prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?')->execute([$total, $customerId, $user['id']]);
            }

            $pdo->commit();
            logActivity($pdo, $user['id'], 'create', 'sales_returns', $newId, "Sales Return #{$retNo}");
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
            $check = $pdo->prepare('SELECT id, status, total, customer_id FROM sales_returns WHERE id = ? AND user_id = ?');
            $check->execute([$id, $user['id']]);
            $old = $check->fetch();
            if (!$old) jsonError('Not found', 404);

            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE sales_returns SET status = ?, updated_at = NOW() WHERE id = ?")->execute([$newStatus, $id]);

                if ($newStatus === 'completed' && $old['status'] !== 'completed') {
                    $items = $pdo->prepare('SELECT * FROM sales_return_items WHERE sales_return_id = ?');
                    $items->execute([$id]);
                    foreach ($items->fetchAll() as $item) {
                        $pdo->prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND user_id = ?')->execute([$item['quantity'], $item['product_id'], $user['id']]);
                    }
                    $pdo->prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?')->execute([$old['total'], $old['customer_id'], $user['id']]);
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
        $pdo->prepare('DELETE FROM sales_returns WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
