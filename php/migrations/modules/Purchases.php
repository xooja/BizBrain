<?php
/**
 * BizBrain ERP — Purchases Module Migration
 */
class Migration_Purchases extends Migration
{
    protected string $moduleName = 'purchases';
    protected int $version = 1;

    public function up(): void
    {
        // ── Purchase Invoices ──────────────────────────────
        $this->createTable('purchase_invoices', [
            'id'                => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'           => 'INT UNSIGNED NOT NULL',
            'invoice_no'        => 'VARCHAR(60) DEFAULT NULL',
            'reference'         => 'VARCHAR(100) DEFAULT NULL',
            'supplier_id'       => 'INT UNSIGNED DEFAULT NULL',
            'supplier_name'     => 'VARCHAR(191) DEFAULT NULL',
            'date'              => 'DATE NOT NULL',
            'due_date'          => 'DATE DEFAULT NULL',
            'subtotal'          => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'discount'          => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'tax'               => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'total'             => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'grand_total'       => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'paid_amount'       => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'status'            => "ENUM('draft','ordered','received','paid','partial','cancelled') NOT NULL DEFAULT 'draft'",
            'notes'             => 'TEXT DEFAULT NULL',
            'created_at'        => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'        => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'       => '(id)',
        ]);

        // ── Purchase Invoice Items ─────────────────────────
        $this->createTable('purchase_invoice_items', [
            'id'               => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'invoice_id'       => 'INT UNSIGNED NOT NULL',
            'product_id'       => 'INT UNSIGNED DEFAULT NULL',
            'product_name'     => 'VARCHAR(191) NOT NULL',
            'description'      => 'TEXT DEFAULT NULL',
            'quantity'         => 'DECIMAL(12,2) NOT NULL DEFAULT 1.00',
            'unit_price'       => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'discount'         => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'tax_rate'         => 'DECIMAL(5,2) NOT NULL DEFAULT 0.00',
            'total'            => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'PRIMARY KEY'      => '(id)',
        ]);

        // ── Purchase Returns ───────────────────────────────
        $this->createTable('purchase_returns', [
            'id'                => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'           => 'INT UNSIGNED NOT NULL',
            'return_no'         => 'VARCHAR(60) DEFAULT NULL',
            'invoice_id'        => 'INT UNSIGNED DEFAULT NULL',
            'supplier_id'       => 'INT UNSIGNED DEFAULT NULL',
            'supplier_name'     => 'VARCHAR(191) DEFAULT NULL',
            'date'              => 'DATE NOT NULL',
            'total'             => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'reason'            => 'TEXT DEFAULT NULL',
            'status'            => "ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'",
            'notes'             => 'TEXT DEFAULT NULL',
            'created_at'        => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'        => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'       => '(id)',
        ]);

        $this->log('Purchases migration completed');
    }
}