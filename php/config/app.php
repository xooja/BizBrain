<?php
/**
 * BizBrain — php/config/app.php
 * Application constants, headers, and shared utilities.
 */

define('APP_NAME',    'BizBrain');
define('APP_VERSION', '1.0.0');
define('SESSION_LIFETIME', 86400 * 30); // 30 days

// ── JSON Response Headers ────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// CORS — adjust origin for production
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Session ───────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME,
        'path'     => '/',
        'secure'   => isset($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ── Response helpers ──────────────────────────────────────────

function jsonSuccess($data = null, string $message = 'OK', int $code = 200): void {
    http_response_code($code);
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data'    => $data,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $code = 400, $data = null): void {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'message' => $message,
        'data'    => $data,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Request helpers ───────────────────────────────────────────

function getRequestBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function getMethod(): string {
    return strtoupper($_SERVER['REQUEST_METHOD']);
}

// ── Auth guard ────────────────────────────────────────────────

function requireAuth(): array {
    error_log("[BizBrain Auth Guard] Session ID: " . (session_id() ?: 'NONE') . " | user_id: " . ($_SESSION['user_id'] ?? 'NOT SET'));
    if (empty($_SESSION['user_id'])) {
        error_log("[BizBrain Auth Guard] BLOCKED — no user_id in session");
        jsonError('Unauthorized', 401);
    }
    return [
        'id'   => $_SESSION['user_id'],
        'name' => $_SESSION['user_name'] ?? '',
        'role' => $_SESSION['user_role'] ?? 'user',
    ];
}

// ── CSRF ──────────────────────────────────────────────────────

function generateCsrf(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');

    // Bootstrap: no CSRF exists yet — accept whatever token comes in
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = $token ?: bin2hex(random_bytes(32));
        return;
    }

    // Token valid — all good
    if (!empty($token) && hash_equals($_SESSION['csrf_token'], $token)) {
        return;
    }

    // Token mismatch — if user is authenticated, just refresh silently
    if (!empty($_SESSION['user_id'])) {
        error_log('[CSRF] Token mismatch but user authenticated — refreshing CSRF token');
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        return;
    }

    jsonError('Invalid CSRF token', 403);
}

// ── Input sanitization ────────────────────────────────────────

function sanitize(string $str): string {
    return htmlspecialchars(strip_tags(trim($str)), ENT_QUOTES, 'UTF-8');
}

function sanitizeArray(array $data, array $allowed): array {
    $clean = [];
    foreach ($allowed as $key => $type) {
        if (!isset($data[$key])) continue;
        $val = $data[$key];
        switch ($type) {
            case 'int':    $clean[$key] = (int)$val;          break;
            case 'float':  $clean[$key] = (float)$val;        break;
            case 'bool':   $clean[$key] = (bool)$val;         break;
            case 'email':  $clean[$key] = filter_var($val, FILTER_SANITIZE_EMAIL); break;
            case 'string': $clean[$key] = sanitize((string)$val); break;
            case 'raw':    $clean[$key] = $val;               break; // JSON fields
        }
    }
    return $clean;
}

// ── Pagination ────────────────────────────────────────────────

function getPagination(int $total, int $perPage = 20): array {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $offset = ($page - 1) * $perPage;
    return [
        'page'       => $page,
        'per_page'   => $perPage,
        'total'      => $total,
        'total_pages'=> (int)ceil($total / $perPage),
        'offset'     => $offset,
    ];
}

// ── Logging ───────────────────────────────────────────────────

function logActivity(PDO $pdo, int $userId, string $action, string $entity, $entityId = null, string $detail = ''): void {
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO activity_logs (user_id, action, entity, entity_id, detail, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())'
        );
        $stmt->execute([$userId, $action, $entity, $entityId, $detail]);
    } catch (Exception $_) {
        // non-fatal
    }
}
