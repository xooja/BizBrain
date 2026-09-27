<?php
/**
 * BizBrain — php/api/auth/register.php
 * Complete multi-step business registration.
 *
 * POST /php/api/auth/register.php
 * Body: Full registration payload (steps 1-4)
 * Success: { success: true, user: {...}, business_id: int, message: "..." }
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/validation.php';

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$body = getRequestBody();

// ── Validate required fields ──────────────────────────────────
$required = ['username', 'email', 'password', 'pin', 'business_name', 'business_type', 'owner_name'];
$missing  = [];
foreach ($required as $field) {
    if (empty($body[$field]) && $body[$field] !== '0') {
        $missing[] = $field;
    }
}
if (!empty($missing)) {
    jsonError('Missing required fields: ' . implode(', ', $missing));
}

$username  = sanitize($body['username']);
$email     = filter_var($body['email'], FILTER_SANITIZE_EMAIL);
$phone     = sanitize($body['phone'] ?? '');
$password  = $body['password'];
$pin       = $body['pin'];
$name      = sanitize($body['owner_name']);

// ── Validate formats ──────────────────────────────────────────
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Invalid email address');
}
if (strlen($password) < 6) {
    jsonError('Password must be at least 6 characters');
}
if (!preg_match('/^\d{4}$/', $pin)) {
    jsonError('PIN must be exactly 4 digits');
}
if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
    jsonError('Username can only contain letters, numbers, and underscores');
}
if (strlen($username) < 3) {
    jsonError('Username must be at least 3 characters');
}
if (!empty($phone) && !preg_match('/^[\+\d\s\-\(\)]{7,20}$/', $phone)) {
    jsonError('Invalid phone number');
}

try {
    $pdo = getDB();

    // ── Check uniqueness ──────────────────────────────────────
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1');
    $stmt->execute([$email, $username]);
    if ($stmt->fetch()) {
        jsonError('A user with this email or username already exists');
    }

    // ── Hash password & PIN ───────────────────────────────────
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $pinHash      = password_hash($pin, PASSWORD_BCRYPT);

    // ── Begin transaction ──────────────────────────────────────
    $pdo->beginTransaction();

    // 1. Create user
    $stmt = $pdo->prepare(
        'INSERT INTO users (name, username, email, phone, password_hash, pin_hash, role, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, \'user\', \'active\', NOW())'
    );
    $stmt->execute([$name, $username, $email, $phone, $passwordHash, $pinHash]);
    $userId = (int)$pdo->lastInsertId();

    // 2. Create business
    $businessName  = sanitize($body['business_name']);
    $businessType  = sanitize($body['business_type']);
    $regNumber     = sanitize($body['reg_number'] ?? '');
    $taxNumber     = sanitize($body['tax_number'] ?? '');
    $description   = sanitize($body['description'] ?? '');
    $logo          = null;

    // Handle logo upload from base64 data
    if (!empty($body['logo_data'])) {
        try {
            $logoResult = handleBase64Upload($body['logo_data'], 'logos');
            $logo = $logoResult['path'];
        } catch (RuntimeException $e) {
            error_log("[BizBrain Register] Logo upload failed: " . $e->getMessage());
            // Non-fatal - continue without logo
        }
    }

    $stmt = $pdo->prepare(
        'INSERT INTO businesses (user_id, name, type, owner_name, reg_number, tax_number, description, logo, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'active\', NOW())'
    );
    $stmt->execute([$userId, $businessName, $businessType, $name, $regNumber, $taxNumber, $description, $logo]);
    $businessId = (int)$pdo->lastInsertId();

    // 3. Create business settings (location + config)
    $country         = sanitize($body['country'] ?? '');
    $state           = sanitize($body['state'] ?? '');
    $city            = sanitize($body['city'] ?? '');
    $address         = sanitize($body['address'] ?? '');
    $currency        = strtoupper(sanitize($body['currency'] ?? 'USD'));
    $currencySymbol  = $body['currency_symbol'] ?? '$';
    $timezone        = sanitize($body['timezone'] ?? 'UTC');
    $dateFormat      = sanitize($body['date_format'] ?? 'Y-m-d');
    $taxEnabled      = !empty($body['tax_enabled']) ? 1 : 0;
    $taxPercent      = (float)($body['tax_percent'] ?? 0);

    // Update business with location
    $stmt = $pdo->prepare(
        'UPDATE businesses SET country = ?, state = ?, city = ?, address = ? WHERE id = ?'
    );
    $stmt->execute([$country, $state, $city, $address, $businessId]);

    $stmt = $pdo->prepare(
        'INSERT INTO business_settings (business_id, currency, currency_symbol, timezone, date_format, tax_enabled, tax_percent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())'
    );
    $stmt->execute([$businessId, $currency, $currencySymbol, $timezone, $dateFormat, $taxEnabled, $taxPercent]);

    // 4. Create financial setup (optional)
    $openingDate = $body['opening_date'] ?? null;
    $cashInHand  = (float)($body['cash_in_hand'] ?? 0);
    $bankBalance = (float)($body['bank_balance'] ?? 0);
    $capital     = (float)($body['opening_capital'] ?? 0);
    $avgSales    = (float)($body['avg_monthly_sales'] ?? 0);
    $avgExpenses = (float)($body['avg_monthly_expenses'] ?? 0);

    $stmt = $pdo->prepare(
        'INSERT INTO business_financials (business_id, opening_date, cash_in_hand, bank_balance, opening_capital, avg_monthly_sales, avg_monthly_expenses, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())'
    );
    $stmt->execute([$businessId, $openingDate, $cashInHand, $bankBalance, $capital, $avgSales, $avgExpenses]);

    // 5. Create assets (optional)
    $totalValue     = (float)($body['total_assets_value'] ?? 0);
    $equipmentValue = (float)($body['equipment_value'] ?? 0);
    $furnitureValue = (float)($body['furniture_value'] ?? 0);
    $vehicleValue   = (float)($body['vehicle_value'] ?? 0);

    $stmt = $pdo->prepare(
        'INSERT INTO business_assets (business_id, total_value, equipment_value, furniture_value, vehicle_value, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())'
    );
    $stmt->execute([$businessId, $totalValue, $equipmentValue, $furnitureValue, $vehicleValue]);

    // 6. Create inventory (optional)
    $productCount   = (int)($body['product_count'] ?? 0);
    $inventoryValue = (float)($body['inventory_value'] ?? 0);
    $productList    = $body['product_list'] ?? null;

    $stmt = $pdo->prepare(
        'INSERT INTO business_inventory (business_id, product_count, inventory_value, product_list, created_at)
         VALUES (?, ?, ?, ?, NOW())'
    );
    $stmt->execute([$businessId, $productCount, $inventoryValue, $productList]);

    // ── Commit ─────────────────────────────────────────────────
    $pdo->commit();

    // ── Log activity ───────────────────────────────────────────
    logActivity($pdo, $userId, 'register', 'user', $userId, 'New business registration: ' . $businessName);

    // ── Auto-login: Set session ───────────────────────────────
    session_regenerate_id(true);
    $_SESSION['user_id']    = $userId;
    $_SESSION['user_name']  = $name;
    $_SESSION['user_email'] = $email;
    $_SESSION['user_role']  = 'user';
    $_SESSION['logged_in']  = true;
    $_SESSION['login_time'] = time();
    $_SESSION['business_id']= $businessId;

    // ── Response ──────────────────────────────────────────────
    jsonSuccess([
        'user' => [
            'id'    => $userId,
            'name'  => $name,
            'email' => $email,
            'role'  => 'user',
        ],
        'business_id' => $businessId,
        'business_name' => $businessName,
    ], 'Business account created successfully', 201);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("[BizBrain Register] Error: " . $e->getMessage());
    jsonError('Registration failed. Please try again.', 500);
}
