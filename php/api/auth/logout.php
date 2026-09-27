<?php
/**
 * BizBrain — php/api/auth/logout.php
 * Destroy PHP session and clear session cookie.
 *
 * POST /php/api/auth/logout.php
 * Success: { success: true, message: "Logged out" }
 */

require_once __DIR__ . '/../../config/app.php';

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$userId = $_SESSION['user_id'] ?? null;

// ── Clear all session data ────────────────────────────────────
$_SESSION = [];

// ── Delete session cookie ─────────────────────────────────────
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

// ── Destroy session ───────────────────────────────────────────
session_destroy();

error_log("[BizBrain Auth] Logout: user #{$userId} — session destroyed");

jsonSuccess(null, 'Logged out');
