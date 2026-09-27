<?php
/**
 * BizBrain ERP — Base Migration Class
 * 
 * All module migrations extend this class.
 * Provides table creation, column migration, and safe execution helpers.
 */

abstract class Migration
{
    protected PDO $pdo;
    protected array $log = [];

    // Override in child class
    protected string $moduleName = 'core';
    protected int $version = 1;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Run this migration. Must be implemented.
     * @return void
     */
    abstract public function up(): void;

    /**
     * Get module name.
     */
    public function getModuleName(): string
    {
        return $this->moduleName;
    }

    /**
     * Get migration version.
     */
    public function getVersion(): int
    {
        return $this->version;
    }

    /**
     * Create a table if it doesn't exist.
     */
    protected function createTable(string $name, array $columns, array $indexes = []): void
    {
        $existingColumns = $this->getExistingColumns($name);

        if (!empty($existingColumns)) {
            $this->log("[SKIP] Table `{$name}` already exists — column migration will run separately");
            $this->migrateColumns($name, $columns);
            return;
        }

        // Reserved MySQL constraint keywords that should NOT be backtick-quoted
        $constraintKeys = ['PRIMARY KEY', 'UNIQUE', 'INDEX', 'FULLTEXT', 'SPATIAL',
                           'FOREIGN KEY', 'CONSTRAINT', 'CHECK'];

        $colDefs = [];
        foreach ($columns as $col => $def) {
            $colUpper = strtoupper($col);
            if (in_array($colUpper, $constraintKeys, true)) {
                // Constraint: output without backticks (e.g., PRIMARY KEY (id))
                $colDefs[] = "{$col} {$def}";
            } else {
                // Regular column: backtick-quote the name
                $colDefs[] = "`{$col}` {$def}";
            }
        }

        $sql = "CREATE TABLE `{$name}` (" . implode(', ', $colDefs) . ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

        try {
            $this->pdo->exec($sql);
            $this->log("[CREATE] Table `{$name}` created successfully");
        } catch (PDOException $e) {
            $this->log("[ERROR] Failed to create table `{$name}`: " . $e->getMessage());
            throw $e;
        }

        // Add indexes
        foreach ($indexes as $indexSql) {
            try {
                $this->pdo->exec($indexSql);
            } catch (PDOException $e) {
                $this->log("[WARN] Index for `{$name}`: " . $e->getMessage());
            }
        }
    }

    /**
     * Add columns that don't yet exist on an existing table.
     */
    protected function migrateColumns(string $table, array $columns): void
    {
        $existingCols = $this->getExistingColumns($table);

        // Reserved MySQL constraint keywords that should NOT be added as columns
        $constraintKeys = ['PRIMARY KEY', 'UNIQUE', 'INDEX', 'FULLTEXT', 'SPATIAL',
                           'FOREIGN KEY', 'CONSTRAINT', 'CHECK'];

        foreach ($columns as $col => $def) {
            if (in_array(strtoupper($col), $constraintKeys, true)) {
                continue; // Skip constraints — they are not columns
            }
            if (!in_array(strtolower($col), $existingCols, true)) {
                try {
                    $this->pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$def}");
                    $this->log("[COLUMN] Added `{$col}` to `{$table}`");
                } catch (PDOException $e) {
                    $this->log("[ERROR] Failed to add `{$col}` to `{$table}`: " . $e->getMessage());
                    throw $e;
                }
            }
        }
    }

    /**
     * Seed default data (INSERT IGNORE).
     */
    protected function seed(string $table, array $rows, array $uniqueKey = ['id']): void
    {
        if (empty($rows)) return;

        $count = 0;
        foreach ($rows as $row) {
            // Build WHERE clause for uniqueness check
            $conditions = [];
            $params = [];
            foreach ($uniqueKey as $key) {
                if (isset($row[$key])) {
                    $conditions[] = "`{$key}` = ?";
                    $params[] = $row[$key];
                }
            }

            if (!empty($conditions)) {
                $check = $this->pdo->prepare("SELECT COUNT(*) FROM `{$table}` WHERE " . implode(' AND ', $conditions));
                $check->execute($params);
                if ((int)$check->fetchColumn() > 0) continue;
            }

            $cols = array_keys($row);
            $placeholders = array_fill(0, count($cols), '?');
            $sql = "INSERT INTO `{$table}` (`" . implode('`, `', $cols) . "`) VALUES (" . implode(', ', $placeholders) . ")";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(array_values($row));
            $count++;
        }

        if ($count > 0) {
            $this->log("[SEED] Inserted {$count} row(s) into `{$table}`");
        }
    }

    /**
     * Get existing column names for a table (lowercased).
     */
    protected function getExistingColumns(string $table): array
    {
        try {
            $stmt = $this->pdo->query("SHOW COLUMNS FROM `{$table}`");
            return array_map('strtolower', $stmt->fetchAll(PDO::FETCH_COLUMN));
        } catch (PDOException $e) {
            // Table doesn't exist
            return [];
        }
    }

    /**
     * Check if a table exists.
     */
    protected function tableExists(string $table): bool
    {
        try {
            $stmt = $this->pdo->query("SELECT 1 FROM `{$table}` LIMIT 1");
            $stmt->fetchColumn();
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }

    /**
     * Add a log entry.
     */
    protected function log(string $message): void
    {
        $this->log[] = "[{$this->moduleName}] {$message}";
    }

    /**
     * Get all log entries.
     */
    public function getLog(): array
    {
        return $this->log;
    }
}