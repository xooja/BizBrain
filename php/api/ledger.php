<?php
/**
 * BizBrain — php/api/ledger.php
 * Supplier/Customer Ledger — computed from purchase invoices + payments.
 * Returns running balance entries.
 *
 * GET /php/api/ledger.php?supplier_id=X  → ledger for supplier
 * GET /php/api/ledger.php?customer_id=X  → ledger for customer
 */
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';

$user   = requireAuth();
$pdo    = getDB();
$method = getMethod();

if ($method !== 'GET') jsonError('Method not allowed', 405);

$supplierId = isset($_GET['supplier_id']) ? (int)$_GET['supplier_id'] : null;
$customerId = isset($_GET['customer_id']) ? (int)$_GET['customer_id'] : null;

if (!$supplierId && !$customerId) jsonError('Supply supplier_id or customer_id', 400);

// Who is the party?
$partyType = $supplierId ? 'supplier' : 'customer';
$partyId   = $supplierId ?: $customerId;

// Verify party belongs to user
if ($supplierId) {
    $check = $pdo->prepare('SELECT id FROM suppliers WHERE id = ? AND user_id = ?');
} else {
    $check = $pdo->prepare('SELECT id FROM customers WHERE id = ? AND user_id = ?');
}
$check->execute([$partyId, $user['id']]);
if (!$check->fetch()) jsonError('Party not found', 404);

// Get opening balance
if ($supplierId) {
    $stmt = $pdo->prepare('SELECT opening_balance, current_balance, opening_balance_type FROM suppliers WHERE id = ?');
} else {
    $stmt = $pdo->prepare('SELECT opening_balance, current_balance, "payable" as opening_balance_type FROM customers WHERE id = ?');
}
$stmt->execute([$partyId]);
$party = $stmt->fetch();
$openingBalance = (float)$party['opening_balance'];

// Build ledger: combine purchase invoices (debits) and payments (credits)
$entries = [];

// Opening balance entry
$entries[] = [
    'date'        => $party['created_at'] ?? date('Y-m-d'),
    'reference'   => 'Opening Balance',
    'description' => 'Opening balance carried forward',
    'debit'       => $party['opening_balance_type'] === 'payable' ? $openingBalance : 0,
    'credit'      => $party['opening_balance_type'] === 'receivable' ? $openingBalance : 0,
    'type'        => 'opening',
];

// Purchase invoices increase supplier balance (debit to the business)
if ($supplierId) {
    $invStmt = $pdo->prepare(
        "SELECT 'purchase_invoice' as type, date, invoice_no as reference, CONCAT('Purchase Invoice #', invoice_no) as description, total as debit, 0 as credit, created_at
         FROM purchase_invoices WHERE supplier_id = ? AND user_id = ? AND status != 'cancelled'"
    );
    $invStmt->execute([$partyId, $user['id']]);
    foreach ($invStmt->fetchAll() as $row) {
        $entries[] = $row;
    }
}

// Sales invoices increase customer balance (debit)
if ($customerId) {
    $invStmt = $pdo->prepare(
        "SELECT 'sales_invoice' as type, date, invoice_no as reference, CONCAT('Sales Invoice #', invoice_no) as description, total as debit, 0 as credit, created_at
         FROM sales_invoices WHERE customer_id = ? AND user_id = ? AND status != 'cancelled'"
    );
    $invStmt->execute([$partyId, $user['id']]);
    foreach ($invStmt->fetchAll() as $row) {
        $entries[] = $row;
    }
}

// Payments (reduce balance = credit)
$payStmt = $pdo->prepare(
    "SELECT 'payment' as type, date, payment_no as reference, CONCAT('Payment #', payment_no) as description, 0 as debit, amount as credit, created_at
     FROM payments WHERE party_type = ? AND party_id = ? AND user_id = ?"
);
$payStmt->execute([$partyType, $partyId, $user['id']]);
foreach ($payStmt->fetchAll() as $row) {
    $entries[] = $row;
}

// Purchase returns (reduce supplier balance = credit)
if ($supplierId) {
    $retStmt = $pdo->prepare(
        "SELECT 'purchase_return' as type, date, return_no as reference, CONCAT('Purchase Return #', return_no) as description, 0 as debit, total as credit, created_at
         FROM purchase_returns WHERE supplier_id = ? AND user_id = ? AND status = 'completed'"
    );
    $retStmt->execute([$partyId, $user['id']]);
    foreach ($retStmt->fetchAll() as $row) {
        $entries[] = $row;
    }
}

// Sales returns (reduce customer balance = credit)
if ($customerId) {
    $retStmt = $pdo->prepare(
        "SELECT 'sales_return' as type, date, return_no as reference, CONCAT('Sales Return #', return_no) as description, 0 as debit, total as credit, created_at
         FROM sales_returns WHERE customer_id = ? AND user_id = ? AND status = 'completed'"
    );
    $retStmt->execute([$partyId, $user['id']]);
    foreach ($retStmt->fetchAll() as $row) {
        $entries[] = $row;
    }
}

// Sort by date then created_at
usort($entries, function ($a, $b) {
    $cmp = strcmp($a['date'], $b['date']);
    if ($cmp !== 0) return $cmp;
    return strcmp($a['created_at'] ?? '', $b['created_at'] ?? '');
});

// Calculate running balance
$running = 0;
foreach ($entries as &$e) {
    $running += (float)$e['debit'] - (float)$e['credit'];
    $e['running_balance'] = round($running, 2);
}
unset($e);

jsonSuccess([
    'entries'     => $entries,
    'opening'     => $openingBalance,
    'current'     => (float)$party['current_balance'],
    'party_type'  => $partyType,
    'party_id'    => $partyId,
]);
