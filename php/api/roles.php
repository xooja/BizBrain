<?php
/**
 * BizBrain — php/api/roles.php
 * RESTful CRUD for team roles and permissions.
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
            $stmt = $pdo->prepare('SELECT * FROM roles WHERE id = ? AND user_id = ?');
            $stmt->execute([$id, $user['id']]);
            $role = $stmt->fetch();
            if (!$role) jsonError('Not found', 404);
            $perms = $pdo->prepare('SELECT * FROM permissions WHERE role_id = ?');
            $perms->execute([$id]);
            $role['permissions'] = $perms->fetchAll();
            jsonSuccess($role);
        }
        $stmt = $pdo->prepare('SELECT * FROM roles WHERE user_id = ? ORDER BY name ASC');
        $stmt->execute([$user['id']]);
        $roles = $stmt->fetchAll();
        // Add permissions to each role
        foreach ($roles as &$r) {
            $p = $pdo->prepare('SELECT * FROM permissions WHERE role_id = ?');
            $p->execute([$r['id']]);
            $r['permissions'] = $p->fetchAll();
        }
        jsonSuccess($roles);
        break;

    case 'POST':
        verifyCsrf();
        $body = getRequestBody();
        $name = sanitize($body['name'] ?? '');
        $desc = sanitize($body['description'] ?? '');
        if (!$name) jsonError('Role name is required');

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO roles (user_id, name, description, created_at, updated_at) VALUES (?,?,?,NOW(),NOW())');
            $stmt->execute([$user['id'], $name, $desc]);
            $newId = (int)$pdo->lastInsertId();

            // Insert default permissions
            $modules = ['dashboard','products','categories','suppliers','customers','purchases','sales','returns','payments','accounts','team','settings'];
            foreach ($modules as $mod) {
                $stmt2 = $pdo->prepare('INSERT INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete) VALUES (?,?,1,0,0,0)');
                $stmt2->execute([$newId, $mod]);
            }

            $pdo->commit();
            logActivity($pdo, $user['id'], 'create', 'roles', $newId, "Role: {$name}");
            jsonSuccess(['id' => $newId], 'Created', 201);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Failed: ' . $e->getMessage(), 500);
        }
        break;

    case 'PUT':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $body = getRequestBody();
        $name = sanitize($body['name'] ?? '');
        $desc = sanitize($body['description'] ?? '');

        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE roles SET name = ?, description = ?, updated_at = NOW() WHERE id = ? AND user_id = ?')->execute([$name, $desc, $id, $user['id']]);

            // Update permissions if provided
            if (isset($body['permissions']) && is_array($body['permissions'])) {
                $pdo->prepare('DELETE FROM permissions WHERE role_id = ?')->execute([$id]);
                foreach ($body['permissions'] as $perm) {
                    $mod = sanitize($perm['module'] ?? '');
                    if (!$mod) continue;
                    $stmt2 = $pdo->prepare('INSERT INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete) VALUES (?,?,?,?,?,?)');
                    $stmt2->execute([$id, $mod,
                        (int)($perm['can_view'] ?? 0),
                        (int)($perm['can_create'] ?? 0),
                        (int)($perm['can_edit'] ?? 0),
                        (int)($perm['can_delete'] ?? 0)
                    ]);
                }
            }

            $pdo->commit();
            logActivity($pdo, $user['id'], 'update', 'roles', $id);
            jsonSuccess(null, 'Updated');
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Failed: ' . $e->getMessage(), 500);
        }
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('ID required');
        $pdo->prepare('DELETE FROM roles WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
        jsonSuccess(null, 'Deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
