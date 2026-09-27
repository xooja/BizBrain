<?php
/**
 * BizBrain — php/api/stock.php
 * Stock movement history and inventory reports.
 */
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';

$user   = requireAuth();
$pdo    = getDB();
$method = getMethod();

if ($method !== 'GET') jsonError('Method not allowed', 405);

// Stock movement history
$productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : null;
$limit     = min((int)($_GET['limit'] ?? 100), 500);
$type      = sanitize($_GET['type'] ?? '');
$days      = (int)($_GET['days'] ?? 0);

$where  = ['sm.user_id = ?'];
$params = [$user['id']];
if ($productId) { $where[] = 'sm.product_id = ?'; $params[] = $productId; }
if ($type)      { $where[] = 'sm.type = ?'; $params[] = $type; }
if ($days)      { $where[] = 'sm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)'; $params[] = $days; }

$stmt = $pdo->prepare(
    'SELECT sm.*, p.name as product_name, p.sku as product_sku
     FROM stock_movements sm
     LEFT JOIN products p ON p.id = sm.product_id
     WHERE ' . implode(' AND ', $where) . '
     ORDER BY sm.created_at DESC
     LIMIT ' . $limit
);
$stmt->execute($params);
jsonSuccess($stmt->fetchAll());
