<?php
/**
 * BizBrain — php/api/auth/check-username.php
 * Check if a username is already taken.
 *
 * POST /php/api/auth/check-username.php
 * Body: { username: "..." }
 * Success: { success: true, data: { available: bool, message: "..." } }
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/database.php';

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$body   = getRequestBody();
$username = sanitize($body['username'] ?? '');

if (empty($username) || strlen($username) < 3) {
    jsonError('Username must be at least 3 characters');
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
    jsonError('Username can only contain letters, numbers, and underscores');
}

try {
    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $exists = (bool)$stmt->fetch();

    jsonSuccess([
        'available' => !$exists,
        'message'   => $exists ? 'Username is already taken' : 'Username is available',
    ]);
} catch (Exception $e) {
    jsonError('Server error checking username', 500);
}
