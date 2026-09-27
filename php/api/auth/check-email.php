<?php
/**
 * BizBrain — php/api/auth/check-email.php
 * Check if an email is already registered.
 *
 * POST /php/api/auth/check-email.php
 * Body: { email: "..." }
 * Success: { success: true, data: { available: bool, message: "..." } }
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/database.php';

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$body  = getRequestBody();
$email = filter_var($body['email'] ?? '', FILTER_SANITIZE_EMAIL);

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Invalid email address');
}

try {
    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $exists = (bool)$stmt->fetch();

    jsonSuccess([
        'available' => !$exists,
        'message'   => $exists ? 'Email is already registered' : 'Email is available',
    ]);
} catch (Exception $e) {
    jsonError('Server error checking email', 500);
}
