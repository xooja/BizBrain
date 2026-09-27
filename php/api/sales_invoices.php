<?php
/**
 * BizBrain — php/api/sales_invoices.php
 * RESTful CRUD for sales invoices with items and stock updates.
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
                'SELECT si.*, c.name as customer_name, c.company_name as customer_company
                 FROM sales_invoices si 
                 LEFT JOIN customers c ON c.id = si.customer_id 
                 WHERE si.id = ? AND si.user_id = ?'
            );
            $stmt->execute([$id, $user['id']]);
            $inv = $stmt->fetch();
            if (!$inv) jsonError('Not found', 404);
            $items = $pdo->prepare('SELECT sii.*, p.name as product_name FROM sales_invoice_items sii LEFT JOIN products p ON p.id = sii.product_id WHERE sii.sales_invoice_id = ?');
            $items->execute([$id]);
            $inv['items'] = $items->fetchAll();
            jsonSuccess($inv);
        }
        $customerId = isset($_GET['customer_id']) ? (int)$_GET['customer_id'] : null;
        $where  = ['si.user_id = ?'];
        $params = [$user['id']];
        if ($customerId) { $where[] = 'si.customer_id = ?'; $params[] = $customerId; }
        $stmt = $pdo->prepare(
            'SELECT si.*, c.name as customer_name 
             FROM sales_invoices si 
             LEFT JOIN customers c ON c.id = si.customer_id 
             WHERE ' . implode(' AND ', $where) . ' 
             ORDER BY si.created_at DESC'
        );
        $stmt->execute($params);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $body = getRequestBody();
        $customerId = (int)($body['customer_id'] ?? 0);
        if (!$customerId) jsonError('Customer is required');

        $invNo = sanitize($body['invoice_no'] ?? '');
        if (!$invNo) $invNo = 'SI-' . date('Ymd') . '-' . rand(100, 999);

        $date     = $body['date'] ?? date('Y-m-d');
        $dueDate  = $body['due_date'] ?? null;
        $type     = in_array($body['type'] ?? '', ['cash','credit','partial']) ? $body['type'] : 'cash';
        $status   = in_array($body['status'] ?? '', ['draft','sent','paid','partial','overdue','cancelled']) ? $body['status'] : 'draft';
        $subtotal = (float)($body['subtotal'] ?? 0);
        $discount = (float)($body['discount'] ?? 0);
        $taxRate  = (float)($body['tax_rate'] ?? 0);
        $taxAmt   = (float)($body['tax_amount'] ?? 0);
        $total    = (float)($body['total'] ?? 0);
        $paidAmt  = (float)($body['paid_amount'] ?? 0);
        $balance  = $total - $paidAmt;
        $notes    = sanitize($body['notes'] ?? '');

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO sales_invoices (user_id, customer_id, invoice_no, reference, date, due_date, type, status, subtotal, discount, tax_rate, tax_amount, total, paid_amount, balance, notes, created_at, updated_at) 
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())'
            );
            $stmt->execute([$user['id'], $customerId, $invNo, $body['reference'] ?? '', $date, $dueDate, $type, $status, $subtotal, $discount, $taxRate, $taxAmt, $total, $paidAmt, $balance, $notes]);
            $newId = (int)$pdo->lastInsertId();

            // Insert items and deduct stock
            $items = $body['items'] ?? [];
            foreach ($items as $item) {
                $prodId   = (int)($item['product_id'] ?? 0);
                $prodName = sanitize($item['product_name'] ?? '');
                $qty      = (float)($item['quantity'] ?? 1);
                $sprice   = (float)($item['sale_price'] ?? 0);
                $disc     = (float)($item['discount'] ?? 0);
                $itaxRate = (float)($item['tax_rate'] ?? 0);
                $itaxAmt  = (float)($item['tax_amount'] ?? 0);
                $itotal   = (float)($item['total'] ?? ($qty * $sprice - $disc + $itaxAmt));

                $pdo->prepare('INSERT INTO sales_invoice_items (sales_invoice_id, product_id, product_name, quantity, sale_price, discount, tax_rate, tax_amount, total) VALUES (?,?,?,?,?,?,?,?,?)')
                    ->execute([$newId, $prodId, $prodName, $qty, $sprice, $disc, $itaxRate, $itaxAmt, $itotal]);

                // Deduct stock (only when status is not draft)
                if ($prodId && $status !== 'draft') {
                    $pdo->prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND user_id = ?')->execute([$qty, $prodId, $user['id']]);
                    $prod = $pdo->prepare('SELECT stock FROM products WHERE id = ?');
                    $prod->execute([$prodId]);
                    $stockAfter = (float)$prod->fetchColumn();
                    $stockBefore = $stockAfter + $qty;
                    $pdo->prepare('INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, reference_id, unit_price, created_at) VALUES (?,?,?,?,?,?,?,?,?,NOW())')
                        ->execute([$user['id'], $prodId, 'sale', -$qty, $stockBefore, $stockAfter, 'sales_invoice', $newId, $sprice]);
                }
            }

            // Update customer balance for credit/partial
            if (in_array($type, ['credit','partial']) && $status !== 'draft') {
                $pdo->prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?')->execute([$balance, $customerId, $user['id']]);
            }

            $pdo->commit();
            logActivity($pdo, $user['id'], 'create', 'sales_invoices', $newId, "Sales Invoice #{$invNo}");
            jsonSuccess(['id' => $newId, 'invoice_no' => $invNo], 'Created', 201);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Failed to create sales invoice: ' . $e->getMessage(), 500);
        }
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $newStatus = sanitize($_GET['status'] ?? '');
        if ($newStatus) {
            $check = $pdo->prepare('SELECT id, status, type, balance, customer_id FROM sales_invoices WHERE id = ? AND user_id = ?');
            $check->execute([$id, $user['id']]);
            $old = $check->fetch();
            if (!$old) jsonError('Not found', 404);

            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE sales_invoices SET status = ?, updated_at = NOW() WHERE id = ?")->execute([$newStatus, $id]);

                if ($newStatus === 'paid' && $old['status'] !== 'paid') {
                    // Update customer balance (reduce receivable)
                    if (in_array($old['type'], ['credit','partial'])) {
                        $pdo->prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?')->execute([$old['balance'], $old['customer_id'], $user['id']]);
                    }
                }

                $pdo->commit();
                jsonSuccess(null, 'Status updated');
            } catch (Exception $e) {
                $pdo->rollBack();
                jsonError('Update failed', 500);
            }
            break;
        }
        jsonError('Status parameter required', 400);
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM sales_invoices WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        logActivity($pdo, $user['id'], 'delete', 'sales_invoices', $id);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
