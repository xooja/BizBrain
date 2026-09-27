<?php
/**
 * BizBrain — php/api/payments.php
 * RESTful CRUD for payments and invoice balance updates.
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
            $stmt = $pdo->prepare('SELECT * FROM payments WHERE id = ? AND user_id = ?');
            $stmt->execute([$id, $user['id']]);
            $pay = $stmt->fetch();
            $pay ? jsonSuccess($pay) : jsonError('Not found', 404);
        }
        $partyType = sanitize($_GET['party_type'] ?? '');
        $stmt = $pdo->prepare('SELECT * FROM payments WHERE user_id = ?' . ($partyType ? ' AND party_type = ?' : '') . ' ORDER BY created_at DESC');
        if ($partyType) $stmt->execute([$user['id'], $partyType]);
        else $stmt->execute([$user['id']]);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $body = getRequestBody();
        $partyType = $body['party_type'] ?? '';
        $partyId   = (int)($body['party_id'] ?? 0);
        if (!in_array($partyType, ['supplier','customer']) || !$partyId)
            jsonError('Party type and party ID required');

        $invType = $body['invoice_type'] ?? null;
        $invId   = isset($body['invoice_id']) ? (int)$body['invoice_id'] : null;
        $payNo   = sanitize($body['payment_no'] ?? '');
        if (!$payNo) $payNo = 'PAY-' . date('Ymd') . '-' . rand(100, 999);
        $date    = $body['date'] ?? date('Y-m-d');
        $amount  = (float)($body['amount'] ?? 0);
        $method  = sanitize($body['method'] ?? 'cash');
        $ref     = sanitize($body['reference'] ?? '');
        $notes   = sanitize($body['notes'] ?? '');
        if ($amount <= 0) jsonError('Amount must be greater than zero');

        $pdo->beginTransaction();
        try {
            // Insert payment
            $stmt = $pdo->prepare('INSERT INTO payments (user_id, party_type, party_id, invoice_type, invoice_id, payment_no, date, amount, method, reference, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())');
            $stmt->execute([$user['id'], $partyType, $partyId, $invType, $invId, $payNo, $date, $amount, $method, $ref, $notes]);
            $newId = (int)$pdo->lastInsertId();

            // Update invoice paid_amount and balance
            if ($invType && $invId) {
                $invTable = ($invType === 'purchase') ? 'purchase_invoices' : 'sales_invoices';
                $stmt = $pdo->prepare("UPDATE {$invTable} SET paid_amount = paid_amount + ?, balance = total - paid_amount, updated_at = NOW() WHERE id = ? AND user_id = ?");
                $stmt->execute([$amount, $invId, $user['id']]);
                // Auto-mark as paid if balance <= 0
                $stmt = $pdo->prepare("SELECT total, paid_amount, status FROM {$invTable} WHERE id = ?");
                $stmt->execute([$invId]);
                $inv = $stmt->fetch();
                if ($inv && $inv['paid_amount'] >= $inv['total'] && $inv['status'] !== 'paid' && $invType === 'purchase') {
                    $stmt = $pdo->prepare("UPDATE {$invTable} SET status = 'paid', updated_at = NOW() WHERE id = ?");
                    $stmt->execute([$invId]);
                }
            }

            // Update party balance
            $partyTable = ($partyType === 'supplier') ? 'suppliers' : 'customers';
            $sign = ($partyType === 'supplier') ? ' - ' : ' - '; // Both reduce balance on payment
            $stmt = $pdo->prepare("UPDATE {$partyTable} SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?");
            $stmt->execute([$amount, $partyId, $user['id']]);

            $pdo->commit();
            logActivity($pdo, $user['id'], 'create', 'payments', $newId, "Payment #{$payNo}: {$amount}");
            jsonSuccess(['id' => $newId, 'payment_no' => $payNo], 'Created', 201);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Failed: ' . $e->getMessage(), 500);
        }
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM payments WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
