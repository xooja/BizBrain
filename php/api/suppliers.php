<?php
/**
 * BizBrain — php/api/suppliers.php
 * RESTful CRUD for suppliers with enriched profile data.
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
            $stmt = $pdo->prepare('SELECT * FROM suppliers WHERE id = ? AND user_id = ?');
            $stmt->execute([$id, $user['id']]);
            $s = $stmt->fetch();
            if (!$s) jsonError('Not found', 404);

            // ── Enrich with computed KPIs ──────────────────────────
            // Total purchase invoices count & amount
            $invStmt = $pdo->prepare(
                "SELECT COUNT(*) as total_purchases, COALESCE(SUM(total), 0) as total_purchase_amount
                 FROM purchase_invoices WHERE supplier_id = ? AND user_id = ? AND status != 'cancelled'"
            );
            $invStmt->execute([$id, $user['id']]);
            $invData = $invStmt->fetch();

            // Total payments made to this supplier
            $payStmt = $pdo->prepare(
                "SELECT COALESCE(SUM(amount), 0) as total_payments
                 FROM payments WHERE party_type = 'supplier' AND party_id = ? AND user_id = ?"
            );
            $payStmt->execute([$id, $user['id']]);
            $payData = $payStmt->fetch();

            // Last purchase date
            $lastStmt = $pdo->prepare(
                "SELECT MAX(date) as last_purchase_date
                 FROM purchase_invoices WHERE supplier_id = ? AND user_id = ? AND status != 'cancelled'"
            );
            $lastStmt->execute([$id, $user['id']]);
            $lastData = $lastStmt->fetch();

            $s['total_purchases']       = (int)$invData['total_purchases'];
            $s['total_purchase_amount'] = (float)$invData['total_purchase_amount'];
            $s['total_payments']        = (float)$payData['total_payments'];
            $s['last_purchase_date']    = $lastData['last_purchase_date'] ?: null;

            jsonSuccess($s);
        }
        $stmt = $pdo->prepare('SELECT * FROM suppliers WHERE user_id = ? ORDER BY company_name ASC');
        $stmt->execute([$user['id']]);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $body  = getRequestBody();
        $clean = sanitizeArray($body, [
            'company_name'=>'string','contact_person'=>'string','email'=>'email',
            'phone'=>'string','address'=>'string','status'=>'string','notes'=>'string'
        ]);
        $opening = (float)($body['opening_balance'] ?? 0);
        $openingType = in_array($body['opening_balance_type'] ?? '', ['payable','receivable']) ? $body['opening_balance_type'] : 'payable';
        $creditLimit = (float)($body['credit_limit'] ?? 0);
        if (empty($clean['company_name'])) jsonError('Company name is required');
        $clean['status'] = in_array($clean['status'] ?? '', ['active','inactive']) ? $clean['status'] : 'active';

        $stmt = $pdo->prepare('INSERT INTO suppliers (user_id, company_name, contact_person, email, phone, address, opening_balance, opening_balance_type, current_balance, credit_limit, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())');
        $stmt->execute([$user['id'], $clean['company_name'], $clean['contact_person'] ?? '', $clean['email'] ?? '', $clean['phone'] ?? '', $clean['address'] ?? '', $opening, $openingType, $opening, $creditLimit, $clean['status'], $clean['notes'] ?? '']);
        $newId = (int)$pdo->lastInsertId();
        logActivity($pdo, $user['id'], 'create', 'suppliers', $newId, "Supplier: {$clean['company_name']}");
        jsonSuccess(['id'=>$newId], 'Created', 201);
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $check = $pdo->prepare('SELECT id FROM suppliers WHERE id = ? AND user_id = ?');
        $check->execute([$id, $user['id']]);
        if (!$check->fetch()) jsonError('Not found', 404);

        $body  = getRequestBody();
        $clean = sanitizeArray($body, [
            'company_name'=>'string','contact_person'=>'string','email'=>'email',
            'phone'=>'string','address'=>'string','status'=>'string','notes'=>'string',
            'opening_balance_type'=>'string'
        ]);
        if (isset($clean['opening_balance_type'])) {
            $clean['opening_balance_type'] = in_array($clean['opening_balance_type'], ['payable','receivable']) ? $clean['opening_balance_type'] : 'payable';
        }
        $fields = []; $vals = [];
        foreach ($clean as $k => $v) { if ($v !== null) { $fields[] = "$k = ?"; $vals[] = $v; } }
        if (isset($body['credit_limit'])) { $fields[] = 'credit_limit = ?'; $vals[] = (float)$body['credit_limit']; }
        if (isset($body['opening_balance'])) { $fields[] = 'opening_balance = ?'; $vals[] = (float)$body['opening_balance']; }
        if (isset($body['current_balance'])) { $fields[] = 'current_balance = ?'; $vals[] = (float)$body['current_balance']; }
        if (isset($body['city']))            { $fields[] = 'city = ?';           $vals[] = sanitize($body['city']); }
        if (isset($body['whatsapp']))         { $fields[] = 'whatsapp = ?';      $vals[] = sanitize($body['whatsapp']); }
        $vals[] = date('Y-m-d H:i:s'); $vals[] = $id; $vals[] = $user['id'];
        $pdo->prepare('UPDATE suppliers SET ' . implode(', ', $fields) . ', updated_at = ? WHERE id = ? AND user_id = ?')->execute($vals);
        logActivity($pdo, $user['id'], 'update', 'suppliers', $id);
        jsonSuccess(null, 'Updated');
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM suppliers WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        logActivity($pdo, $user['id'], 'delete', 'suppliers', $id);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
