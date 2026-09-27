<?php
/**
 * BizBrain ERP - Stock movement compatibility migration.
 */
class Migration_Purchases_v3 extends Migration
{
    protected string $moduleName = 'purchases';
    protected int $version = 3;

    public function up(): void
    {
        $columns = [];
        foreach ($this->pdo->query('SHOW COLUMNS FROM stock_movements') as $column) {
            $columns[strtolower($column['Field'])] = true;
        }
        foreach ([
            'reference_id' => 'INT UNSIGNED DEFAULT NULL',
            'stock_before' => 'DECIMAL(15,3) NOT NULL DEFAULT 0.000',
            'stock_after' => 'DECIMAL(15,3) NOT NULL DEFAULT 0.000',
            'unit_price' => 'DECIMAL(15,2) DEFAULT NULL',
        ] as $column => $definition) {
            if (!isset($columns[$column])) {
                $this->pdo->exec("ALTER TABLE stock_movements ADD COLUMN `{$column}` {$definition}");
            }
        }
        $this->log('Stock movement compatibility migration completed');
    }
}
