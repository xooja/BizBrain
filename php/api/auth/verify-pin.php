<?php
/**
 * BizBrain — verify-pin.php
 * Verifies the user's PIN before allowing destructive/management actions.
 * Method: POST
 * Body: { pin: "1234" }
 * Response: { success: true, message: "PIN verified" } or error
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/db.php';

// ── Auth guard ────────────────────────────────────────────────
$user = requireAuth();

// ── Only POST ────────────────────────────────────────────────
if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

// ── Get PIN from request ─────────────────────────────────────
$body   = getRequestBody();
$pin    = $body['pin'] ?? '';

if (empty($pin)) {
    jsonError('PIN is required');
}

if (!preg_match('/^\d{4}$/', $pin)) {
    jsonError('PIN must be exactly 4 digits');
}

try {
    // ── Get database connection ──────────────────────────────
    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT pin_hash FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $row  = $stmt->fetch();

    if (!$row) {
        jsonError('User not found', 404);
    }

    $pinHash = $row['pin_hash'];

    // ── Verify PIN ───────────────────────────────────────────
    if (password_verify($pin, $pinHash)) {
        jsonSuccess(['verified' => true], 'PIN verified');
    } else {
        jsonError('Incorrect PIN', 403);
    }
} catch (Exception $e) {
    error_log('[BizBrain Verify PIN] Error: ' . $e->getMessage());
    jsonError('PIN verification failed. Please try again.', 500);
}
