<?php
/**
 * BizBrain — php/api/auth/check.php
 * Verify if current session is authenticated.
 * Called on app init and periodically to validate the session.
 *
 * GET /php/api/auth/check.php
 * Success (authenticated): { success: true, authenticated: true, user: {...} }
 * Success (not auth):     { success: true, authenticated: false }
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/database.php';

if (getMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

// ── Debug logging ─────────────────────────────────────────────
error_log("[BizBrain Auth Check] Session ID: " . (session_id() ?: 'NONE'));
error_log("[BizBrain Auth Check] Session data: " . json_encode([
    'user_id'   => $_SESSION['user_id'] ?? null,
    'logged_in' => $_SESSION['logged_in'] ?? false,
]));

// ── Check if session has user ─────────────────────────────────
if (empty($_SESSION['user_id']) || empty($_SESSION['logged_in'])) {
    http_response_code(200);
    echo json_encode([
        'success'       => true,
        'authenticated' => false,
    ]);
    exit;
}

// ── Verify user still exists in DB ────────────────────────────
try {
    $pdo  = getDB();
    $stmt = $pdo->prepare(
        'SELECT id, name, email, role, avatar, status FROM users WHERE id = ? AND status = ? LIMIT 1'
    );
    $stmt->execute([$_SESSION['user_id'], 'active']);
    $user = $stmt->fetch();

    if (!$user) {
        // User was deleted or deactivated — clear session
        $_SESSION = [];
        session_destroy();

        http_response_code(200);
        echo json_encode([
            'success'       => true,
            'authenticated' => false,
            'message'       => 'User no longer active',
        ]);
        exit;
    }

    // ── Refresh CSRF token if needed ──────────────────────────
    $csrfToken = generateCsrf();

    // ── Return user payload ──────────────────────────────────
    http_response_code(200);
    echo json_encode([
        'success'       => true,
        'authenticated' => true,
        'user'          => [
            'id'     => (int)$user['id'],
            'name'   => $user['name'],
            'email'  => $user['email'],
            'role'   => $user['role'],
            'avatar' => $user['avatar'] ?? ($user['name'][0] ?? 'U'),
        ],
        'csrf_token' => $csrfToken,
    ]);
} catch (Exception $e) {
    error_log("[BizBrain Auth Check] Database error: " . $e->getMessage());
    // If DB fails but session exists, trust session (offline fallback)
    http_response_code(200);
    echo json_encode([
        'success'       => true,
        'authenticated' => true,
        'user'          => [
            'id'    => $_SESSION['user_id'],
            'name'  => $_SESSION['user_name'] ?? 'User',
            'email' => $_SESSION['user_email'] ?? '',
            'role'  => $_SESSION['user_role'] ?? 'user',
        ],
    ]);
}
