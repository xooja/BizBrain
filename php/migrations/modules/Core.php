<?php
/**
 * BizBrain ERP — Core Migration
 * Creates all core tables and seeds default data.
 */
class Migration_Core extends Migration
{
    protected string $moduleName = 'core';
    protected int $version = 1;

    public function up(): void
    {
        // ── Users ────────────────────────────────────────────
        $this->createTable('users', [
            'id'            => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'name'          => 'VARCHAR(120) NOT NULL',
            'username'      => 'VARCHAR(60) DEFAULT NULL',
            'email'         => 'VARCHAR(191) NOT NULL',
            'phone'         => 'VARCHAR(30) DEFAULT NULL',
            'password_hash' => 'VARCHAR(255) NOT NULL',
            'pin_hash'      => 'VARCHAR(255) DEFAULT NULL',
            'role'          => "ENUM('admin','user','viewer') NOT NULL DEFAULT 'user'",
            'status'        => "ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active'",
            'avatar'        => 'VARCHAR(500) DEFAULT NULL',
            'last_login'    => 'DATETIME DEFAULT NULL',
            'created_at'    => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'    => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'   => '(id)',
        ], [
            'CREATE UNIQUE INDEX uq_users_username ON users(username)',
            'CREATE UNIQUE INDEX uq_users_email ON users(email)',
        ]);

        // ── Businesses ───────────────────────────────────────
        // CREATE INDEX idx_users_status ON users(status)

        // Seed default admin user (password: "password")
        $this->seed('users', [[
            'id' => 1, 'name' => 'Admin User', 'username' => 'admin',
            'email' => 'admin@bizbrain.com',
            'password_hash' => password_hash('password', PASSWORD_BCRYPT),
            'pin_hash' => password_hash('1234', PASSWORD_BCRYPT),
            'role' => 'admin', 'status' => 'active',
        ]], ['id']);

        // ── Settings ─────────────────────────────────────────
        $this->createTable('settings', [
            'id'            => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'       => 'INT UNSIGNED NOT NULL',
            'setting_key'   => 'VARCHAR(100) NOT NULL',
            'setting_value' => 'TEXT DEFAULT NULL',
            'updated_at'    => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'   => '(id)',
        ], [
            'CREATE UNIQUE INDEX uq_settings_user_key ON settings(user_id, setting_key)',
        ]);

        // ── Clients ──────────────────────────────────────────
        $this->createTable('clients', [
            'id'         => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'    => 'INT UNSIGNED NOT NULL',
            'name'       => 'VARCHAR(191) NOT NULL',
            'email'      => 'VARCHAR(191) NOT NULL',
            'company'    => 'VARCHAR(191) DEFAULT NULL',
            'phone'      => 'VARCHAR(50) DEFAULT NULL',
            'address'    => 'VARCHAR(500) DEFAULT NULL',
            'status'     => "ENUM('active','inactive','prospect') NOT NULL DEFAULT 'active'",
            'notes'      => 'TEXT DEFAULT NULL',
            'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY' => '(id)',
        ]);

        // ── Projects ─────────────────────────────────────────
        $this->createTable('projects', [
            'id'          => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'     => 'INT UNSIGNED NOT NULL',
            'client_id'   => 'INT UNSIGNED DEFAULT NULL',
            'name'        => 'VARCHAR(191) NOT NULL',
            'description' => 'TEXT DEFAULT NULL',
            'status'      => "ENUM('active','completed','on-hold','cancelled') NOT NULL DEFAULT 'active'",
            'budget'      => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'deadline'    => 'DATE DEFAULT NULL',
            'created_at'  => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'  => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY' => '(id)',
        ]);

        // ── Expenses ─────────────────────────────────────────
        $this->createTable('expenses', [
            'id'          => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'     => 'INT UNSIGNED NOT NULL',
            'title'       => 'VARCHAR(191) NOT NULL',
            'description' => 'TEXT DEFAULT NULL',
            'amount'      => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'category'    => 'VARCHAR(100) DEFAULT NULL',
            'date'        => 'DATE NOT NULL',
            'notes'       => 'TEXT DEFAULT NULL',
            'created_at'  => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'  => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY' => '(id)',
        ]);

        // ── Products ─────────────────────────────────────────
        $this->createTable('products', [
            'id'             => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'        => 'INT UNSIGNED NOT NULL',
            'name'           => 'VARCHAR(191) NOT NULL',
            'sku'            => 'VARCHAR(100) DEFAULT NULL',
            'description'    => 'TEXT DEFAULT NULL',
            'category_id'    => 'INT UNSIGNED DEFAULT NULL',
            'purchase_price' => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'sale_price'     => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'stock'          => 'DECIMAL(12,2) NOT NULL DEFAULT 0.00',
            'min_stock'      => 'DECIMAL(12,2) NOT NULL DEFAULT 5.00',
            'unit'           => 'VARCHAR(20) DEFAULT NULL',
            'barcode'        => 'VARCHAR(100) DEFAULT NULL',
            'status'         => "ENUM('active','inactive','discontinued') NOT NULL DEFAULT 'active'",
            'created_at'     => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'     => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'    => '(id)',
        ], [
            'CREATE UNIQUE INDEX uq_products_sku ON products(user_id, sku)',
        ]);

        // ── Categories ───────────────────────────────────────
        $this->createTable('categories', [
            'id'         => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'    => 'INT UNSIGNED NOT NULL',
            'name'       => 'VARCHAR(100) NOT NULL',
            'description'=> 'TEXT DEFAULT NULL',
            'type'       => "ENUM('product','expense','client') NOT NULL DEFAULT 'product'",
            'status'     => "ENUM('active','inactive') NOT NULL DEFAULT 'active'",
            'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'=> '(id)',
        ]);

        // Seed default categories
        $this->seed('categories', [
            ['id' => 1, 'user_id' => 1, 'name' => 'Electronics', 'type' => 'product', 'status' => 'active'],
            ['id' => 2, 'user_id' => 1, 'name' => 'Office Supplies', 'type' => 'product', 'status' => 'active'],
            ['id' => 3, 'user_id' => 1, 'name' => 'Software', 'type' => 'expense', 'status' => 'active'],
            ['id' => 4, 'user_id' => 1, 'name' => 'Travel', 'type' => 'expense', 'status' => 'active'],
            ['id' => 5, 'user_id' => 1, 'name' => 'Meals', 'type' => 'expense', 'status' => 'active'],
            ['id' => 6, 'user_id' => 1, 'name' => 'Marketing', 'type' => 'expense', 'status' => 'active'],
        ], ['id']);

        // ── Customers ────────────────────────────────────────
        $this->createTable('customers', [
            'id'              => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'         => 'INT UNSIGNED NOT NULL',
            'name'            => 'VARCHAR(191) NOT NULL',
            'company_name'    => 'VARCHAR(191) DEFAULT NULL',
            'email'           => 'VARCHAR(191) DEFAULT NULL',
            'phone'           => 'VARCHAR(50) DEFAULT NULL',
            'address'         => 'VARCHAR(500) DEFAULT NULL',
            'city'            => 'VARCHAR(100) DEFAULT NULL',
            'country'         => 'VARCHAR(100) DEFAULT NULL',
            'tax_number'      => 'VARCHAR(60) DEFAULT NULL',
            'balance'         => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'current_balance' => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'notes'           => 'TEXT DEFAULT NULL',
            'status'          => "ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active'",
            'created_at'      => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'      => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'     => '(id)',
        ]);

        // ── Suppliers ────────────────────────────────────────
        $this->createTable('suppliers', [
            'id'              => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'         => 'INT UNSIGNED NOT NULL',
            'company_name'    => 'VARCHAR(191) NOT NULL',
            'contact_person'  => 'VARCHAR(120) DEFAULT NULL',
            'email'           => 'VARCHAR(191) DEFAULT NULL',
            'phone'           => 'VARCHAR(50) DEFAULT NULL',
            'address'         => 'TEXT DEFAULT NULL',
            'opening_balance'         => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'opening_balance_type'    => "ENUM('payable','receivable') NOT NULL DEFAULT 'payable'",
            'current_balance'         => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'credit_limit'            => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'notes'           => 'TEXT DEFAULT NULL',
            'status'          => "ENUM('active','inactive') NOT NULL DEFAULT 'active'",
            'created_at'      => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'      => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'     => '(id)',
        ]);

        // ── Accounts ─────────────────────────────────────────
        $this->createTable('accounts', [
            'id'          => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'     => 'INT UNSIGNED NOT NULL',
            'name'        => 'VARCHAR(120) NOT NULL',
            'type'        => "ENUM('asset','liability','equity','income','expense') NOT NULL DEFAULT 'asset'",
            'balance'     => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
            'currency'    => 'VARCHAR(10) NOT NULL DEFAULT "USD"',
            'description' => 'TEXT DEFAULT NULL',
            'status'      => "ENUM('active','inactive','archived') NOT NULL DEFAULT 'active'",
            'created_at'  => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'  => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY' => '(id)',
        ]);

        // Seed default accounts
        $this->seed('accounts', [
            ['id' => 1, 'user_id' => 1, 'name' => 'Cash', 'type' => 'asset', 'balance' => 0, 'status' => 'active'],
            ['id' => 2, 'user_id' => 1, 'name' => 'Bank Account', 'type' => 'asset', 'balance' => 0, 'status' => 'active'],
            ['id' => 3, 'user_id' => 1, 'name' => 'Sales Revenue', 'type' => 'income', 'balance' => 0, 'status' => 'active'],
            ['id' => 4, 'user_id' => 1, 'name' => 'Cost of Goods Sold', 'type' => 'expense', 'balance' => 0, 'status' => 'active'],
        ], ['id']);

        // ── Roles ────────────────────────────────────────────
        $this->createTable('roles', [
            'id'          => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'     => 'INT UNSIGNED NOT NULL',
            'name'        => 'VARCHAR(100) NOT NULL',
            'description' => 'TEXT DEFAULT NULL',
            'permissions' => 'JSON DEFAULT NULL',
            'created_at'  => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at'  => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY' => '(id)',
        ]);

        // Seed default roles
        $this->seed('roles', [
            ['id' => 1, 'user_id' => 1, 'name' => 'Admin', 'description' => 'Full access to all features', 'permissions' => '{"all": true}'],
            ['id' => 2, 'user_id' => 1, 'name' => 'User',  'description' => 'Standard access', 'permissions' => '{"dashboard": true, "products": true, "suppliers": true, "customers": true, "expenses": true}'],
            ['id' => 3, 'user_id' => 1, 'name' => 'Viewer','description' => 'Read-only access', 'permissions' => '{"dashboard": true, "reports": true}'],
        ], ['id']);

        // ── Team ─────────────────────────────────────────────
        $this->createTable('team', [
            'id'         => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'    => 'INT UNSIGNED NOT NULL',
            'name'       => 'VARCHAR(120) NOT NULL',
            'email'      => 'VARCHAR(191) NOT NULL',
            'role_id'    => 'INT UNSIGNED DEFAULT NULL',
            'phone'      => 'VARCHAR(50) DEFAULT NULL',
            'status'     => "ENUM('active','inactive','invited') NOT NULL DEFAULT 'active'",
            'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            'PRIMARY KEY'=> '(id)',
        ]);

        // ── Activity Logs ────────────────────────────────────
        $this->createTable('activity_logs', [
            'id'         => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'    => 'INT UNSIGNED NOT NULL',
            'action'     => 'VARCHAR(100) NOT NULL',
            'entity'     => 'VARCHAR(100) DEFAULT NULL',
            'entity_id'  => 'VARCHAR(60) DEFAULT NULL',
            'detail'     => 'TEXT DEFAULT NULL',
            'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'PRIMARY KEY'=> '(id)',
        ]);

        // ── Sync Queue ───────────────────────────────────────
        $this->createTable('sync_queue', [
            'id'         => 'INT UNSIGNED NOT NULL AUTO_INCREMENT',
            'user_id'    => 'INT UNSIGNED NOT NULL',
            'table_name' => 'VARCHAR(100) NOT NULL',
            'record_id'  => 'VARCHAR(60) NOT NULL',
            'action'     => "ENUM('insert','update','delete') NOT NULL DEFAULT 'insert'",
            'payload'    => 'JSON NOT NULL',
            'synced'     => 'TINYINT(1) NOT NULL DEFAULT 0',
            'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'PRIMARY KEY'=> '(id)',
        ]);

        $this->log('Core migration completed successfully');
    }
}