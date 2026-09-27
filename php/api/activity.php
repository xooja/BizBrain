<?php
/**
 * BizBrain — php/api/activity.php
 * Activity Log API.
 * Returns activity logs filtered by entity type and ID.
 *
 * GET /php/api/activity.php?entity=suppliers&entity_id=X  → activity for a resource
 * GET /php/api/activity.php                                 → recent activity (global)
 */
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';

$user   = requireAuth();
$pdo    = getDB();
$method = getMethod();

if ($method !== 'GET') jsonError('Method not allowed', 405);

$entity   = sanitize($_GET['entity'] ?? '');
$entityId = isset($_GET['entity_id']) ? (int)$_GET['entity_id'] : null;
$limit    = min(100, max(1, (int)($_GET['limit'] ?? 50)));

$where  = ['al.user_id = ?'];
$params = [$user['id']];

if ($entity)   { $where[] = 'al.entity = ?';      $params[] = $entity; }
if ($entityId) { $where[] = 'al.entity_id = ?';   $params[] = $entityId; }

$stmt = $pdo->prepare(
    'SELECT al.*, u.name as user_name
     FROM activity_logs al
     LEFT JOIN users u ON u.id = al.user_id
     WHERE ' . implode(' AND ', $where) . '
     ORDER BY al.created_at DESC
     LIMIT ' . $limit
);
$stmt->execute($params);
$logs = $stmt->fetchAll();

// Transform for frontend consumption
$activities = array_map(function ($log) {
    $action = $log['action'] ?? '';
    $entity = $log['entity'] ?? '';
    $detail = $log['detail'] ?? '';

    $title = ucfirst($action) . ' ' . ucfirst(str_replace('_', ' ', $entity));

    return [
        'id'          => (int)$log['id'],
        'type'        => $action,
        'entity'      => $entity,
        'entity_id'   => $log['entity_id'] ? (int)$log['entity_id'] : null,
        'title'       => $title,
        'description' => $detail,
        'created_at'  => $log['created_at'],
        'user_name'   => $log['user_name'] ?? '',
    ];
}, $logs);

jsonSuccess($activities);
