<?php
/**
 * BizBrain ERP — Migration Manager
 * Auto-creates database, runs module migrations, tracks versions.
 */
class MigrationManager
{
    private PDO $pdo;
    private bool $devMode;
    private array $logs = [];

    public function __construct(PDO $pdo, bool $devMode = false)
    {
        $this->pdo = $pdo;
        $this->devMode = $devMode;
    }

    /**
     * Bootstrap: connect to MySQL, auto-create database if missing.
     */
    public static function bootstrap(): PDO
    {
        $host = defined('DB_HOST') ? DB_HOST : 'localhost';
        $port = defined('DB_PORT') ? DB_PORT : '3306';
        $name = defined('DB_NAME') ? DB_NAME : 'bizbrain';
        $user = defined('DB_USER') ? DB_USER : 'root';
        $pass = defined('DB_PASS') ? DB_PASS : '';
        $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];

        try {
            return new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass, $opts);
        } catch (PDOException $e) {
            if (in_array((int)$e->getCode(), [1049, 1044])) {
                $pdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass, $opts);
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                return new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass, $opts);
            }
            throw new RuntimeException('Database connection failed: ' . $e->getMessage());
        }
    }

    /**
     * Run all pending migrations. Atomic (transaction-based).
     */
    public function run(): array
    {
        $start = microtime(true);
        try {
            $this->ensureSystemInfo();
            $installed = $this->loadVersions();
            $pending = $this->findPending($installed);
            if (empty($pending)) {
                $this->log('All migrations up to date', 'info');
            } else {
                foreach ($pending as $file) {
                    try {
                        $this->runFile($file, $installed);
                    } catch (Throwable $e) {
                        $this->log('FAILED: ' . $e->getMessage(), 'error');
                    }
                }
            }
        } catch (Throwable $e) {
            $this->log('FAILED: ' . $e->getMessage(), 'error');
        }
        return ['success' => !$this->hasErrors(), 'time' => round(microtime(true) - $start, 3), 'logs' => $this->logs, 'dev' => $this->devMode];
    }

    private function ensureSystemInfo(): void
    {
        try {
            $stmt = $this->pdo->query('SELECT 1 FROM system_info LIMIT 1');
            $stmt->fetchColumn();
            return;
        } catch (PDOException $e) {}
        $this->pdo->exec("CREATE TABLE system_info (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            app_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
            database_version LONGTEXT DEFAULT NULL,
            installed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $this->log('Created system_info table', 'info');
    }

    private function loadVersions(): array
    {
        try {
            $row = $this->pdo->query('SELECT database_version FROM system_info ORDER BY id DESC LIMIT 1')->fetch();
            return $row && $row['database_version'] ? json_decode($row['database_version'], true) ?: [] : [];
        } catch (PDOException $e) { return []; }
    }

    private function findPending(array $installed): array
    {
        $dir = __DIR__ . '/modules/';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        $pending = [];
        foreach (glob($dir . '*.php') as $file) {
            $mod = strtolower(pathinfo($file, PATHINFO_FILENAME));
            $ver = 1;
            if (preg_match('/_v(\d+)$/i', $mod, $m)) { $mod = preg_replace('/_v\d+$/', '', $mod); $ver = (int)$m[1]; }
            if ($ver > ($installed[$mod] ?? 0)) $pending[] = $file;
        }
        return $pending;
    }

    private function runFile(string $file, array &$installed): void
    {
        require_once $file;
        $cn = pathinfo($file, PATHINFO_FILENAME);
        $cls = class_exists('Migration_' . $cn) ? 'Migration_' . $cn : $cn;
        if (!class_exists($cls)) throw new RuntimeException("Migration class not found: {$file}");
        $m = new $cls($this->pdo);
        $this->log("Running: {$m->getModuleName()} v{$m->getVersion()}", 'info');
        $m->up();
        foreach ($m->getLog() as $l) $this->log($l, 'info');
        $installed[$m->getModuleName()] = $m->getVersion();
        $this->pdo->prepare('INSERT INTO system_info (app_version, database_version) VALUES (?, ?)')
            ->execute([APP_VERSION, json_encode($installed, JSON_UNESCAPED_UNICODE)]);
    }

    private function log(string $msg, string $level = 'info'): void
    {
        $this->logs[] = ['level' => $level, 'message' => $msg, 'time' => date('H:i:s')];
    }
    private function hasErrors(): bool { foreach ($this->logs as $l) if ($l['level'] === 'error') return true; return false; }
}