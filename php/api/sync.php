<?php
/**
 * BizBrain — php/api/sync.php
 * Receives batched offline queue from JS and applies to MySQL.
 * Also supports pulling recent data for a given entity.
 */
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';

$user   = requireAuth();
$pdo    = getDB();
$method = getMethod();

// ── PULL — send recent records back to client ─────────────
if ($method === 'GET') {
    $entity = sanitize($_GET['entity'] ?? '');
    $since  = sanitize($_GET['since']  ?? '1970-01-01 00:00:00');

    $allowed = ['clients', 'projects', 'expenses', 'invoices'];
    if (!in_array($entity, $allowed)) jsonError('Invalid entity');

    $stmt = $pdo->prepare("SELECT * FROM {$entity} WHERE user_id = ? AND updated_at >= ? ORDER BY updated_at DESC LIMIT 200");
    $stmt->execute([$user['id'], $since]);
    jsonSuccess($stmt->fetchAll(), 'Pull OK');
}

// ── PUSH — receive offline queue items ───────────────────
if ($method === 'POST') {
    verifyCsrf();
    $body  = getRequestBody();
    $items = $body['items'] ?? [];

    if (!is_array($items) || empty($items)) {
        jsonError('No items to sync');
    }

    $results = [];
    $pdo->beginTransaction();

    try {
        foreach ($items as $item) {
            $entity  = sanitize($item['entity']  ?? '');
            $action  = sanitize($item['action']  ?? '');
            $payload = $item['payload'] ?? [];
            $queueId = sanitize($item['queue_id'] ?? '');

            $allowed = ['clients', 'projects', 'expenses', 'invoices'];
            if (!in_array($entity, $allowed) || !in_array($action, ['create','update','delete'])) {
                $results[] = ['queue_id' => $queueId, 'status' => 'skipped', 'reason' => 'Invalid entity/action'];
                continue;
            }

            try {
                $newId = applyChange($pdo, $user['id'], $entity, $action, $payload);
                $results[] = ['queue_id' => $queueId, 'status' => 'synced', 'new_id' => $newId];
                logActivity($pdo, $user['id'], "sync_{$action}", $entity, $newId ?? ($payload['id'] ?? null), 'Offline sync');
            } catch (Exception $e) {
                $results[] = ['queue_id' => $queueId, 'status' => 'error', 'reason' => $e->getMessage()];
            }
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Sync transaction failed: ' . $e->getMessage(), 500);
    }

    $synced  = count(array_filter($results, fn($r) => $r['status'] === 'synced'));
    $errors  = count(array_filter($results, fn($r) => $r['status'] === 'error'));
    jsonSuccess(['results' => $results, 'synced' => $synced, 'errors' => $errors], "Synced {$synced} items");
}

jsonError('Method not allowed', 405);

// ── Helper: apply a single change ─────────────────────────
function applyChange(PDO $pdo, int $userId, string $entity, string $action, array $payload): ?int {
    // Strip local_ prefix IDs — these are new records
    $rawId    = $payload['id'] ?? null;
    $isLocal  = $rawId && str_starts_with((string)$rawId, 'local_');
    $dbId     = $isLocal ? null : (int)($rawId ?? 0);

    switch ($action) {
        case 'create':
        case 'update':
            if ($action === 'update' && $dbId) {
                // Verify ownership
                $chk = $pdo->prepare("SELECT id FROM {$entity} WHERE id = ? AND user_id = ?");
                $chk->execute([$dbId, $userId]);
                if (!$chk->fetch()) throw new Exception("Record not found: {$entity} #{$dbId}");
            }
            return upsertRecord($pdo, $userId, $entity, $payload, $dbId);

        case 'delete':
            if (!$dbId) return null;
            $pdo->prepare("DELETE FROM {$entity} WHERE id = ? AND user_id = ?")->execute([$dbId, $userId]);
            return null;
    }
    return null;
}

function upsertRecord(PDO $pdo, int $userId, string $entity, array $payload, ?int $id): ?int {
    // Column whitelist per entity
    $schemas = [
        'clients'  => ['name','email','company','phone','address','status','notes'],
        'projects' => ['name','description','status','budget','deadline','client_id'],
        'expenses' => ['title','amount','date','category','project_id','notes'],
        'invoices' => ['client_id','status','date','due_date','items','total','notes'],
    ];
    $allowed = $schemas[$entity] ?? [];
    $data    = [];
    foreach ($allowed as $col) {
        if (array_key_exists($col, $payload)) {
            $val = $payload[$col];
            // Encode items array to JSON if needed
            if ($col === 'items' && is_array($val)) $val = json_encode($val);
            $data[$col] = $val;
        }
    }
    if (empty($data)) throw new Exception("No valid fields for {$entity}");

    if ($id) {
        // UPDATE
        $sets = implode(', ', array_map(fn($k) => "$k = ?", array_keys($data)));
        $vals = array_values($data);
        $vals[] = date('Y-m-d H:i:s');
        $vals[] = $id;
        $vals[] = $userId;
        $pdo->prepare("UPDATE {$entity} SET {$sets}, updated_at = ? WHERE id = ? AND user_id = ?")->execute($vals);
        return $id;
    }

    // INSERT
    $data['user_id']    = $userId;
    $data['created_at'] = date('Y-m-d H:i:s');
    $data['updated_at'] = date('Y-m-d H:i:s');
    $cols = implode(', ', array_keys($data));
    $phs  = implode(', ', array_fill(0, count($data), '?'));
    $pdo->prepare("INSERT INTO {$entity} ({$cols}) VALUES ({$phs})")->execute(array_values($data));
    return (int)$pdo->lastInsertId();
}
