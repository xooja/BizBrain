<?php
/**
 * BizBrain ERP — Finance & Stock Module Migration
 */
class Migration_Finance extends Migration
{
    protected string $moduleName = 'finance';
    protected int $version = 1;

    public function up(): void
    {
        // ── Stock Movements ─────────────────────────────────
        $this->createTable('stock_movements', [
            'id'            => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'       => 'INT UNSIGNED NOT NULL',
            'product_id'    => 'INT UNSIGNED NOT NULL',
            'product_name'  => 'VARCHAR(191) DEFAULT NULL',
            'type'          => "ENUM('in','out','adjustment','return','damage') NOT NULL DEFAULT 'in'",
            'quantity'      => 'DECIMAL(12,2) NOT NULL DEFAULT 0.00',
            'reference'     => 'VARCHAR(100) DEFAULT NULL',
            'reference_type'=> "ENUM('purchase','sale','return','manual') DEFAULT NULL",
            'notes'         => 'TEXT DEFAULT NULL',
            'created_at'    => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'PRIMARY KEY'   => '(id)',
        ]);

        // ── Order Book ──────────────────────────────────────
        $this->createTable('order_book', [
            'id'            => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'       => 'INT UNSIGNED NOT NULL',
            'order_no'      => 'VARCHAR(60) DEFAULT NULL',
            'party_type'    => "ENUM('customer','supplier') NOT NULL DEFAULT 'customer'",
            'party_id'      => 'INT UNSIGNED DEFAULT NULL',
            'party_name'    => 'VARCHAR(191) DEFAULT NULL',
            'product_id'    => 'INT UNSIGNED DEFAULT NULL',
            'product_name'  => 'VARCHAR(191) DEFAULT NULL',
            'quantity'      => 'DECIMAL(12,2) NOT NULL DEFAULT 1.00',
            'unit_price'    => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'total'         => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'order_date'    => 'DATE NOT NULL',
            'delivery_date' => 'DATE DEFAULT NULL',
            'status'        => "ENUM('pending','confirmed','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending'",
            'notes'         => 'TEXT DEFAULT NULL',
            'created_at'    => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'    => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'   => '(id)',
        ]);

        // ── Damaged Stock ───────────────────────────────────
        $this->createTable('damaged_stock', [
            'id'           => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'      => 'INT UNSIGNED NOT NULL',
            'product_id'   => 'INT UNSIGNED NOT NULL',
            'product_name' => 'VARCHAR(191) DEFAULT NULL',
            'quantity'     => 'DECIMAL(12,2) NOT NULL DEFAULT 0.00',
            'reason'       => 'TEXT DEFAULT NULL',
            'cost'         => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'date'         => 'DATE NOT NULL',
            'status'       => "ENUM('reported','reviewed','disposed') NOT NULL DEFAULT 'reported'",
            'notes'        => 'TEXT DEFAULT NULL',
            'created_at'   => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'   => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'  => '(id)',
        ]);

        // ── Ledger ──────────────────────────────────────────
        $this->createTable('ledger', [
            'id'            => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'       => 'INT UNSIGNED NOT NULL',
            'account_id'    => 'INT UNSIGNED DEFAULT NULL',
            'transaction_type'=> "ENUM('debit','credit') NOT NULL DEFAULT 'debit'",
            'amount'        => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'description'   => 'TEXT DEFAULT NULL',
            'reference'     => 'VARCHAR(100) DEFAULT NULL',
            'reference_type'=> 'VARCHAR(60) DEFAULT NULL',
            'date'          => 'DATE NOT NULL',
            'created_at'    => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'PRIMARY KEY'   => '(id)',
        ]);

        $this->log('Finance & Stock migration completed');
    }
}