<?php
/**
 * BizBrain — php/api/projects.php
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
            $stmt = $pdo->prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?');
            $stmt->execute([$id, $user['id']]);
            $r = $stmt->fetch();
            $r ? jsonSuccess($r) : jsonError('Not found', 404);
        }
        $stmt = $pdo->prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC');
        $stmt->execute([$user['id']]);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $b = getRequestBody();
        $c = sanitizeArray($b, ['name'=>'string','description'=>'string','status'=>'string','budget'=>'float','deadline'=>'string','client_id'=>'int']);
        if (empty($c['name'])) jsonError('Name required');
        $c['status'] = in_array($c['status']??'', ['active','completed','on-hold','cancelled']) ? $c['status'] : 'active';

        $stmt = $pdo->prepare(
            'INSERT INTO projects (user_id, client_id, name, description, status, budget, deadline, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,NOW(),NOW())'
        );
        $stmt->execute([$user['id'], $c['client_id']??null, $c['name'], $c['description']??'', $c['status'], $c['budget']??0, $c['deadline']??null]);
        $newId = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare('SELECT * FROM projects WHERE id=?');
        $stmt->execute([$newId]);
        logActivity($pdo, $user['id'], 'create', 'projects', $newId, "Created: {$c['name']}");
        jsonSuccess($stmt->fetch(), 'Project created', 201);
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $check = $pdo->prepare('SELECT id FROM projects WHERE id=? AND user_id=?');
        $check->execute([$id, $user['id']]);
        if (!$check->fetch()) jsonError('Not found', 404);

        $b = getRequestBody();
        $c = sanitizeArray($b, ['name'=>'string','description'=>'string','status'=>'string','budget'=>'float','deadline'=>'string','client_id'=>'int']);
        $fields=[]; $vals=[];
        foreach($c as $k=>$v){ $fields[]="$k=?"; $vals[]=$v; }
        $vals[] = date('Y-m-d H:i:s'); $vals[] = $id; $vals[] = $user['id'];
        $pdo->prepare('UPDATE projects SET '.implode(',',$fields).', updated_at=? WHERE id=? AND user_id=?')->execute($vals);
        $stmt = $pdo->prepare('SELECT * FROM projects WHERE id=?'); $stmt->execute([$id]);
        logActivity($pdo, $user['id'], 'update', 'projects', $id);
        jsonSuccess($stmt->fetch(), 'Updated');
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM projects WHERE id=? AND user_id=?')->execute([$id, $user['id']]);
        logActivity($pdo, $user['id'], 'delete', 'projects', $id);
        jsonSuccess(null, 'Deleted');
        break;

    default: jsonError('Method not allowed', 405);
}
