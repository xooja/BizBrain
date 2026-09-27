<?php
/**
 * BizBrain ERP - Purchases compatibility migration.
 */
class Migration_Purchases_v2 extends Migration
{
    protected string $moduleName = 'purchases';
    protected int $version = 2;

    public function up(): void
    {
        $invoiceColumns = [];
        foreach ($this->pdo->query('SHOW COLUMNS FROM purchase_invoices') as $column) {
            $invoiceColumns[strtolower($column['Field'])] = true;
        }
        foreach ([
            'invoice_datetime' => 'DATETIME DEFAULT NULL',
            'type' => "ENUM('cash','credit','partial') NOT NULL DEFAULT 'cash'",
            'tax_rate' => 'DECIMAL(5,2) NOT NULL DEFAULT 0.00',
            'tax_amount' => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'balance' => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
        ] as $column => $definition) {
            if (!isset($invoiceColumns[$column])) {
                $this->pdo->exec("ALTER TABLE purchase_invoices ADD COLUMN `{$column}` {$definition}");
            }
        }
        $this->pdo->exec('UPDATE purchase_invoices SET tax_amount = COALESCE(tax, 0), balance = GREATEST(total - paid_amount, 0)');

        $itemColumns = [];
        foreach ($this->pdo->query('SHOW COLUMNS FROM purchase_invoice_items') as $column) {
            $itemColumns[strtolower($column['Field'])] = true;
        }
        foreach ([
            'purchase_invoice_id' => 'INT UNSIGNED DEFAULT NULL',
            'purchase_price' => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'sale_price' => 'DECIMAL(15,2) DEFAULT NULL',
            'tax_amount' => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
        ] as $column => $definition) {
            if (!isset($itemColumns[$column])) {
                $this->pdo->exec("ALTER TABLE purchase_invoice_items ADD COLUMN `{$column}` {$definition}");
            }
        }
        $this->pdo->exec('UPDATE purchase_invoice_items SET purchase_invoice_id = invoice_id, purchase_price = unit_price WHERE purchase_invoice_id IS NULL');
        $this->log('Purchases compatibility migration completed');
    }
}
