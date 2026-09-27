<?php
/**
 * BizBrain — php/api/purchase_invoices.php
 * RESTful CRUD for purchase invoices with items and stock updates.
 */
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';

$user   = requireAuth();
$pdo    = getDB();
$method = getMethod();
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        if (isset($_GET['next_invoice_no'])) {
            $prefix = 'PI-' . date('Ymd') . '-';
            $next = $pdo->prepare(
                "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_no, '-', -1) AS UNSIGNED)), 0) + 1
                 FROM purchase_invoices WHERE user_id = ? AND invoice_no LIKE ?"
            );
            $next->execute([$user['id'], $prefix . '%']);
            $sequence = max(1, (int)$next->fetchColumn());
            jsonSuccess(['invoice_no' => $prefix . str_pad((string)$sequence, 3, '0', STR_PAD_LEFT)]);
        }
        if (isset($_GET['check_invoice_no'])) {
            $invoiceNo = sanitize($_GET['check_invoice_no']);
            $checkId = (int)($_GET['exclude_id'] ?? 0);
            $sql = 'SELECT id FROM purchase_invoices WHERE user_id = ? AND invoice_no = ?';
            $params = [$user['id'], $invoiceNo];
            if ($checkId) { $sql .= ' AND id <> ?'; $params[] = $checkId; }
            $check = $pdo->prepare($sql);
            $check->execute($params);
            jsonSuccess(['available' => !$check->fetchColumn()]);
        }
        if ($id) {
            $stmt = $pdo->prepare(
                'SELECT pi.*, s.company_name as supplier_name, s.phone as supplier_phone, s.address as supplier_address
                 FROM purchase_invoices pi 
                 LEFT JOIN suppliers s ON s.id = pi.supplier_id 
                 WHERE pi.id = ? AND pi.user_id = ?'
            );

            $stmt->execute([$id, $user['id']]);
            $inv = $stmt->fetch();
            if (!$inv) jsonError('Not found', 404);
            // Get items
            $items = $pdo->prepare('SELECT pii.*, p.name as product_name FROM purchase_invoice_items pii LEFT JOIN products p ON p.id = pii.product_id WHERE pii.purchase_invoice_id = ?');
            $items->execute([$id]);
            $inv['items'] = $items->fetchAll();
            jsonSuccess($inv);
        }
        $supplierId = isset($_GET['supplier_id']) ? (int)$_GET['supplier_id'] : null;
        $where  = ['pi.user_id = ?'];
        $params = [$user['id']];
        if ($supplierId) { $where[] = 'pi.supplier_id = ?'; $params[] = $supplierId; }
        $stmt = $pdo->prepare(
            'SELECT pi.*, s.company_name as supplier_name 
             FROM purchase_invoices pi 
             LEFT JOIN suppliers s ON s.id = pi.supplier_id 
             WHERE ' . implode(' AND ', $where) . ' 
             ORDER BY pi.created_at DESC'
        );
        $stmt->execute($params);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $body = getRequestBody();
        $supplierId = (int)($body['supplier_id'] ?? 0);
        if (!$supplierId) jsonError('Supplier is required');

        $supplierCheck = $pdo->prepare('SELECT id FROM suppliers WHERE id = ? AND user_id = ?');
        $supplierCheck->execute([$supplierId, $user['id']]);
        if (!$supplierCheck->fetchColumn()) jsonError('Supplier not found', 404);

        $items = is_array($body['items'] ?? null) ? $body['items'] : [];
        $items = array_values(array_filter($items, static function ($item) {
            return is_array($item) && (int)($item['product_id'] ?? 0) > 0 && (float)($item['quantity'] ?? 0) > 0;
        }));
        if (!$items) jsonError('At least one valid product is required');

        $invNo = sanitize($body['invoice_no'] ?? '');
        if (!$invNo) {
            $prefix = 'PI-' . date('Ymd') . '-';
            $next = $pdo->prepare(
                "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_no, '-', -1) AS UNSIGNED)), 0) + 1
                 FROM purchase_invoices WHERE user_id = ? AND invoice_no LIKE ?"
            );
            $next->execute([$user['id'], $prefix . '%']);
            $invNo = $prefix . str_pad((string)max(1, (int)$next->fetchColumn()), 3, '0', STR_PAD_LEFT);
        }
        $duplicate = $pdo->prepare('SELECT id FROM purchase_invoices WHERE user_id = ? AND invoice_no = ?');
        $duplicate->execute([$user['id'], $invNo]);
        if ($duplicate->fetchColumn()) jsonError('Invoice number already exists', 409);

        $invoiceDateTime = $body['invoice_datetime'] ?? null;
        $date = $invoiceDateTime ? date('Y-m-d', strtotime($invoiceDateTime)) : ($body['date'] ?? date('Y-m-d'));
        $invoiceDateTime = $invoiceDateTime ? date('Y-m-d H:i:s', strtotime($invoiceDateTime)) : date('Y-m-d H:i:s');
        $dueDate  = $body['due_date'] ?? null;
        $type     = in_array($body['type'] ?? '', ['cash','credit','partial']) ? $body['type'] : 'cash';
        $status   = in_array($body['status'] ?? '', ['draft','received','paid','cancelled']) ? $body['status'] : 'draft';
        $subtotal = 0.0;
        $discount = (float)($body['discount'] ?? 0);
        $taxRate  = (float)($body['tax_rate'] ?? 0);
        $taxAmt   = (float)($body['tax_amount'] ?? 0);
        $paidAmt  = max(0.0, (float)($body['paid_amount'] ?? 0));
        foreach ($items as &$item) {
            $productId = (int)$item['product_id'];
            $productCheck = $pdo->prepare('SELECT id, name FROM products WHERE id = ? AND user_id = ?');
            $productCheck->execute([$productId, $user['id']]);
            $product = $productCheck->fetch();
            if (!$product) jsonError('One or more products were not found', 422);
            $item['product_name'] = sanitize($product['name']);
            $item['quantity'] = (float)$item['quantity'];
            $item['purchase_price'] = max(0.0, (float)($item['purchase_price'] ?? 0));
            $item['discount'] = max(0.0, (float)($item['discount'] ?? 0));
            $item['tax_amount'] = max(0.0, (float)($item['tax_amount'] ?? 0));
            $item['total'] = max(0.0, $item['quantity'] * $item['purchase_price'] - $item['discount'] + $item['tax_amount']);
            $subtotal += $item['quantity'] * $item['purchase_price'];
        }
        unset($item);
        $discount = max(0.0, min($discount, $subtotal));
        $taxAmt = max(0.0, $taxAmt);
        $total = max(0.0, $subtotal - $discount + $taxAmt);
        $balance  = $total - $paidAmt;
        if ($paidAmt > $total) $paidAmt = $total;
        $balance = $total - $paidAmt;
        $notes    = sanitize($body['notes'] ?? '');

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                 'INSERT INTO purchase_invoices (user_id, supplier_id, invoice_no, reference, date, invoice_datetime, due_date, type, status, subtotal, discount, tax_rate, tax_amount, total, paid_amount, balance, notes)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([$user['id'], $supplierId, $invNo, $body['reference'] ?? '', $date, $invoiceDateTime, $dueDate, $type, $status, $subtotal, $discount, $taxRate, $taxAmt, $total, $paidAmt, $balance, $notes]);
            $newId = (int)$pdo->lastInsertId();

            // Insert items and update stock
            foreach ($items as $item) {
                $prodId   = (int)($item['product_id'] ?? 0);
                $prodName = sanitize($item['product_name']);
                $qty      = (float)($item['quantity'] ?? 1);
                $pprice   = (float)($item['purchase_price'] ?? 0);
                $sprice   = isset($item['sale_price']) ? (float)$item['sale_price'] : null;
                $disc     = (float)($item['discount'] ?? 0);
                $itaxRate = (float)($item['tax_rate'] ?? 0);
                $itaxAmt  = (float)($item['tax_amount'] ?? 0);
                $itotal   = (float)($item['total'] ?? ($qty * $pprice - $disc + $itaxAmt));

                $pdo->prepare('INSERT INTO purchase_invoice_items (purchase_invoice_id, product_id, product_name, quantity, purchase_price, sale_price, discount, tax_rate, tax_amount, total) VALUES (?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$newId, $prodId, $prodName, $qty, $pprice, $sprice, $disc, $itaxRate, $itaxAmt, $itotal]);

                // Update product stock
                if ($prodId && in_array($status, ['received', 'paid'], true)) {
                    $pdo->prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND user_id = ?')->execute([$qty, $prodId, $user['id']]);
                    // Get stock before
                    $prod = $pdo->prepare('SELECT stock FROM products WHERE id = ?');
                    $prod->execute([$prodId]);
                    $stockAfter = (float)$prod->fetchColumn();
                    $stockBefore = $stockAfter - $qty;
                    $pdo->prepare('INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, reference_id, unit_price, created_at) VALUES (?,?,?,?,?,?,?,?,?,NOW())')
                        ->execute([$user['id'], $prodId, 'purchase', $qty, $stockBefore, $stockAfter, 'purchase_invoice', $newId, $pprice]);
                }
            }

            // Update supplier balance for credit/partial
            if (in_array($type, ['credit','partial']) && $status === 'received') {
                $pdo->prepare('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?')->execute([$balance, $supplierId, $user['id']]);
            }

            $pdo->commit();
            logActivity($pdo, $user['id'], 'create', 'purchase_invoices', $newId, "Purchase Invoice #{$invNo}");
            jsonSuccess(['id' => $newId, 'invoice_no' => $invNo], 'Created', 201);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Failed to create purchase invoice: ' . $e->getMessage(), 500);
        }
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');

        // Check if this is a status update (via query param)
        $newStatus = sanitize($_GET['status'] ?? '');
        if ($newStatus) {
            if (!in_array($newStatus, ['draft', 'received', 'paid', 'cancelled'], true)) {
                jsonError('Invalid invoice status', 422);
            }
            $check = $pdo->prepare('SELECT id, status FROM purchase_invoices WHERE id = ? AND user_id = ?');
            $check->execute([$id, $user['id']]);
            $old = $check->fetch();
            if (!$old) jsonError('Not found', 404);

            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE purchase_invoices SET status = ?, updated_at = NOW() WHERE id = ?")->execute([$newStatus, $id]);

                if (in_array($newStatus, ['received', 'paid'], true) && !in_array($old['status'], ['received', 'paid'], true)) {
                    // Add stock for all items
                    $items = $pdo->prepare('SELECT * FROM purchase_invoice_items WHERE purchase_invoice_id = ?');
                    $items->execute([$id]);
                    foreach ($items->fetchAll() as $item) {
                        $pdo->prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND user_id = ?')->execute([$item['quantity'], $item['product_id'], $user['id']]);
                        $prod = $pdo->prepare('SELECT stock FROM products WHERE id = ?');
                        $prod->execute([$item['product_id']]);
                        $sa = (float)$prod->fetchColumn();
                        $pdo->prepare('INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, reference_id, unit_price, created_at) VALUES (?,?,?,?,?,?,?,?,?,NOW())')
                            ->execute([$user['id'], $item['product_id'], 'purchase', $item['quantity'], $sa - $item['quantity'], $sa, 'purchase_invoice', $id, $item['purchase_price']]);
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

        // Full invoice update (edit)
        $check = $pdo->prepare('SELECT id FROM purchase_invoices WHERE id = ? AND user_id = ?');
        $check->execute([$id, $user['id']]);
        if (!$check->fetch()) jsonError('Not found', 404);

        $body = getRequestBody();
        $supplierId = (int)($body['supplier_id'] ?? 0);
        if (!$supplierId) jsonError('Supplier is required');

        $invNo    = sanitize($body['invoice_no'] ?? '');
        if (!$invNo) jsonError('Invoice number is required');
        $duplicate = $pdo->prepare('SELECT id FROM purchase_invoices WHERE user_id = ? AND invoice_no = ? AND id <> ?');
        $duplicate->execute([$user['id'], $invNo, $id]);
        if ($duplicate->fetchColumn()) jsonError('Invoice number already exists', 409);
        $date     = $body['date'] ?? date('Y-m-d');
        $invoiceDateTime = $body['invoice_datetime'] ?? null;
        if ($invoiceDateTime) {
            $date = date('Y-m-d', strtotime($invoiceDateTime));
            $invoiceDateTime = date('Y-m-d H:i:s', strtotime($invoiceDateTime));
        }
        $dueDate  = $body['due_date'] ?? null;
        $type     = in_array($body['type'] ?? '', ['cash','credit','partial']) ? $body['type'] : 'cash';
        $status   = in_array($body['status'] ?? '', ['draft','received','paid','cancelled']) ? $body['status'] : 'draft';
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
            $pdo->prepare(
                'UPDATE purchase_invoices SET supplier_id=?, invoice_no=?, reference=?, date=?, invoice_datetime=?, due_date=?, type=?, status=?, subtotal=?, discount=?, tax_rate=?, tax_amount=?, total=?, paid_amount=?, balance=?, notes=?, updated_at=NOW() WHERE id=? AND user_id=?'
            )->execute([$supplierId, $invNo, $body['reference'] ?? '', $date, $invoiceDateTime, $dueDate, $type, $status, $subtotal, $discount, $taxRate, $taxAmt, $total, $paidAmt, $balance, $notes, $id, $user['id']]);

            // Delete old items and re-insert
            $pdo->prepare('DELETE FROM purchase_invoice_items WHERE purchase_invoice_id = ?')->execute([$id]);

            $items = $body['items'] ?? [];
            foreach ($items as $item) {
                $prodId   = (int)($item['product_id'] ?? 0);
                $prodName = sanitize($item['product_name'] ?? '');
                $qty      = (float)($item['quantity'] ?? 1);
                $pprice   = (float)($item['purchase_price'] ?? 0);
                $sprice   = isset($item['sale_price']) ? (float)$item['sale_price'] : null;
                $disc     = (float)($item['discount'] ?? 0);
                $itaxRate = (float)($item['tax_rate'] ?? 0);
                $itaxAmt  = (float)($item['tax_amount'] ?? 0);
                $itotal   = (float)($item['total'] ?? ($qty * $pprice - $disc + $itaxAmt));

                $pdo->prepare('INSERT INTO purchase_invoice_items (purchase_invoice_id, product_id, product_name, quantity, purchase_price, sale_price, discount, tax_rate, tax_amount, total) VALUES (?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$id, $prodId, $prodName, $qty, $pprice, $sprice, $disc, $itaxRate, $itaxAmt, $itotal]);
            }

            $pdo->commit();
            logActivity($pdo, $user['id'], 'update', 'purchase_invoices', $id, "Purchase Invoice #{$invNo}");
            jsonSuccess(['id' => $id, 'invoice_no' => $invNo], 'Updated');
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Failed to update purchase invoice: ' . $e->getMessage(), 500);
        }
        break;


    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM purchase_invoices WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        logActivity($pdo, $user['id'], 'delete', 'purchase_invoices', $id);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
