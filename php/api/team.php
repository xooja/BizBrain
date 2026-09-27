<?php
/**
 * BizBrain — php/api/team.php
 * RESTful CRUD for team members.
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
            $stmt = $pdo->prepare('SELECT tm.*, r.name as role_name FROM team_members tm LEFT JOIN roles r ON r.id = tm.role_id WHERE tm.id = ? AND tm.user_id = ?');
            $stmt->execute([$id, $user['id']]);
            $m = $stmt->fetch();
            $m ? jsonSuccess($m) : jsonError('Not found', 404);
        }
        $stmt = $pdo->prepare('SELECT tm.*, r.name as role_name FROM team_members tm LEFT JOIN roles r ON r.id = tm.role_id WHERE tm.user_id = ? ORDER BY tm.name ASC');
        $stmt->execute([$user['id']]);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $body = getRequestBody();
        $name  = sanitize($body['name'] ?? '');
        $email = sanitize($body['email'] ?? '');
        $phone = sanitize($body['phone'] ?? '');
        $roleId = isset($body['role_id']) ? (int)$body['role_id'] : null;
        $status = in_array($body['status'] ?? '', ['active','inactive','invited']) ? $body['status'] : 'active';
        if (!$name || !$email) jsonError('Name and email are required');

        // Check unique email within user scope
        $check = $pdo->prepare('SELECT id FROM team_members WHERE user_id = ? AND email = ?');
        $check->execute([$user['id'], $email]);
        if ($check->fetch()) jsonError('A team member with this email already exists');

        // Generate a default password
        $plainPwd = substr(str_shuffle('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 10);
        $hash = password_hash($plainPwd, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare('INSERT INTO team_members (user_id, role_id, name, email, phone, password_hash, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,NOW(),NOW())');
        $stmt->execute([$user['id'], $roleId, $name, $email, $phone, $hash, $status]);
        $newId = (int)$pdo->lastInsertId();
        logActivity($pdo, $user['id'], 'create', 'team_members', $newId, "Team: {$name}");
        jsonSuccess(['id' => $newId, 'name' => $name, 'email' => $email, 'password' => $plainPwd], 'Created', 201);
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $body = getRequestBody();
        $fields = []; $vals = [];
        foreach (['name'=>'string','email'=>'string','phone'=>'string','status'=>'string'] as $k => $t) {
            if (isset($body[$k]) && $body[$k] !== '') { $fields[] = "$k = ?"; $vals[] = sanitize($body[$k]); }
        }
        if (isset($body['role_id'])) { $fields[] = 'role_id = ?'; $vals[] = (int)$body['role_id']; }
        if (empty($fields)) jsonError('Nothing to update');
        $vals[] = date('Y-m-d H:i:s'); $vals[] = $id; $vals[] = $user['id'];
        $pdo->prepare('UPDATE team_members SET ' . implode(', ', $fields) . ', updated_at = ? WHERE id = ? AND user_id = ?')->execute($vals);
        jsonSuccess(null, 'Updated');
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM team_members WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
