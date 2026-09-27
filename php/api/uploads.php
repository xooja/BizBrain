<?php
/**
 * BizBrain — php/api/uploads.php
 * File upload & management API.
 *
 * POST   /php/api/uploads.php          → upload file
 * GET    /php/api/uploads.php          → list files
 * DELETE /php/api/uploads.php?id=X     → delete file
 */
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/validation.php';

$user   = requireAuth();
$pdo    = getDB();
$method = getMethod();
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {

    case 'GET':
        $entity   = sanitize($_GET['entity']    ?? '');
        $entityId = isset($_GET['entity_id']) ? (int)$_GET['entity_id'] : null;

        $where  = ['user_id = ?'];
        $params = [$user['id']];
        if ($entity)   { $where[] = 'entity = ?';    $params[] = $entity; }
        if ($entityId) { $where[] = 'entity_id = ?'; $params[] = $entityId; }

        $stmt = $pdo->prepare(
            'SELECT * FROM file_uploads WHERE ' . implode(' AND ', $where) .
            ' ORDER BY created_at DESC LIMIT 100'
        );
        $stmt->execute($params);
        jsonSuccess($stmt->fetchAll());
        break;

    case 'POST':
        verifyCsrf();
        $entity   = sanitize($_POST['entity']    ?? 'general');
        $entityId = isset($_POST['entity_id']) ? (int)$_POST['entity_id'] : null;
        $subdir   = preg_replace('/[^a-z0-9_]/', '', strtolower($entity));

        // Determine allowed mime types based on entity
        $allowedMime = in_array($entity, ['invoices','expenses'])
            ? array_merge(ALLOWED_IMAGES, ALLOWED_DOCS)
            : ALLOWED_ALL;

        try {
            $result = handleUpload('file', $subdir, $allowedMime);
        } catch (RuntimeException $e) {
            jsonError($e->getMessage());
        }

        $stmt = $pdo->prepare(
            'INSERT INTO file_uploads (user_id, entity, entity_id, original_name, stored_path, mime_type, file_size, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())'
        );
        $stmt->execute([
            $user['id'],
            $entity,
            $entityId,
            $result['name'],
            $result['path'],
            $result['mime'],
            $result['size'],
        ]);
        $fileId = (int)$pdo->lastInsertId();

        logActivity($pdo, $user['id'], 'upload', 'files', $fileId, $result['name']);
        jsonSuccess([
            'id'   => $fileId,
            'path' => $result['path'],
            'name' => $result['name'],
            'mime' => $result['mime'],
            'size' => $result['size'],
        ], 'File uploaded', 201);
        break;

    case 'DELETE':
        verifyCsrf();
        if (!$id) jsonError('File ID required');

        $stmt = $pdo->prepare('SELECT * FROM file_uploads WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $user['id']]);
        $file = $stmt->fetch();
        if (!$file) jsonError('File not found', 404);

        deleteUpload($file['stored_path']);
        $pdo->prepare('DELETE FROM file_uploads WHERE id = ?')->execute([$id]);

        logActivity($pdo, $user['id'], 'delete', 'files', $id, $file['original_name']);
        jsonSuccess(null, 'File deleted');
        break;

    default:
        jsonError('Method not allowed', 405);
}
