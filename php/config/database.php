<?php
/**
 * BizBrain — php/config/database.php
 * Database connection using PDO and safe startup initialization.
 */

define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'bizbrain');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

if (!defined('APP_VERSION')) {
    define('APP_VERSION', '1.0.0');
}

/**
 * Get a PDO database connection (singleton).
 */
function getDB(): PDO {
    static $pdo = null;
    static $initialized = false;

    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;charset=%s',
            DB_HOST, DB_PORT, DB_CHARSET
        );

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
        ];

        try {
            $serverPdo = new PDO($dsn, DB_USER, DB_PASS, $options);

            try {
                $serverPdo->query('USE `' . DB_NAME . '`');
                $pdo = new PDO(
                    sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', DB_HOST, DB_PORT, DB_NAME, DB_CHARSET),
                    DB_USER,
                    DB_PASS,
                    $options
                );
            } catch (PDOException $e) {
                // PDO::getCode() returns SQLSTATE, not the MySQL error number.
                // Use errorInfo[1] to get the driver-specific error code.
                $driverCode = (int)($e->errorInfo[1] ?? 0);
                if ($driverCode === 1049) {
                    $serverPdo->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
                    error_log('[BizBrain DB Init] Database Created: ' . DB_NAME);
                    $pdo = new PDO(
                        sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', DB_HOST, DB_PORT, DB_NAME, DB_CHARSET),
                        DB_USER,
                        DB_PASS,
                        $options
                    );
                } else {
                    throw $e;
                }
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database connection failed']);
            exit;
        }

        if ($pdo !== null && !$initialized) {
            $initialized = true;

            try {
                require_once __DIR__ . '/../migrations/Migration.php';
                require_once __DIR__ . '/../migrations/MigrationManager.php';
                require_once __DIR__ . '/../migrations/modules/Core.php';
                require_once __DIR__ . '/../migrations/modules/Finance.php';
                require_once __DIR__ . '/../migrations/modules/Purchases.php';
                require_once __DIR__ . '/../migrations/modules/Sales.php';

                $manager = new MigrationManager($pdo, false);
                $result = $manager->run();

                foreach ($result['logs'] ?? [] as $entry) {
                    $message = $entry['message'] ?? '';

                    if (str_contains($message, '[CREATE] Table')) {
                        $table = trim((string)preg_replace('/^.*`([^`]+)`.*$/', '$1', $message));
                        if ($table !== '') {
                            error_log('[BizBrain DB Init] Table Created: ' . $table);
                        }
                    } elseif (str_contains($message, '[COLUMN] Added')) {
                        if (preg_match('/Added `([^`]+)` to `([^`]+)`/', $message, $matches)) {
                            error_log('[BizBrain DB Init] Column Added: ' . $matches[2] . '.' . $matches[1]);
                        }
                    }
                }
            } catch (Throwable $e) {
                error_log('[BizBrain DB Init] Initialization skipped: ' . $e->getMessage());
            }
        }
    }

    return $pdo;
}
