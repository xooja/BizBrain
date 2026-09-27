-- ═══════════════════════════════════════════════════════════
-- BizBrain — database.sql
-- Complete MySQL schema with indexes, constraints, and seed data
-- MySQL 8.0+ / MariaDB 10.5+
-- ═══════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── Create database ──────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS `bizbrain`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `bizbrain`;

-- ─────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(120)    NOT NULL,
  `username`      VARCHAR(60)     DEFAULT NULL,
  `email`         VARCHAR(191)    NOT NULL,
  `phone`         VARCHAR(30)     DEFAULT NULL,
  `password_hash` VARCHAR(255)    NOT NULL,
  `pin_hash`      VARCHAR(255)    DEFAULT NULL,
  `role`          ENUM('admin','user','viewer') NOT NULL DEFAULT 'user',
  `status`        ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `avatar`        VARCHAR(500)    DEFAULT NULL,
  `last_login`    DATETIME        DEFAULT NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- SETTINGS (User-level)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `settings` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED    NOT NULL,
  `setting_key`   VARCHAR(100)    NOT NULL,
  `setting_value` TEXT            DEFAULT NULL,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_user_key` (`user_id`, `setting_key`),
  KEY `idx_settings_user` (`user_id`),
  CONSTRAINT `fk_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- CLIENTS (Existing)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `clients` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED  NOT NULL,
  `name`       VARCHAR(191)  NOT NULL,
  `email`      VARCHAR(191)  NOT NULL,
  `company`    VARCHAR(191)  DEFAULT NULL,
  `phone`      VARCHAR(50)   DEFAULT NULL,
  `address`    VARCHAR(500)  DEFAULT NULL,
  `status`     ENUM('active','inactive','prospect') NOT NULL DEFAULT 'active',
  `notes`      TEXT          DEFAULT NULL,
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_clients_user`   (`user_id`),
  KEY `idx_clients_email`  (`email`),
  KEY `idx_clients_status` (`status`),
  CONSTRAINT `fk_clients_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- PROJECTS (Existing)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `projects` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED  NOT NULL,
  `client_id`   INT UNSIGNED  DEFAULT NULL,
  `name`        VARCHAR(191)  NOT NULL,
  `description` TEXT          DEFAULT NULL,
  `status`      ENUM('active','completed','on-hold','cancelled') NOT NULL DEFAULT 'active',
  `budget`      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `deadline`    DATE          DEFAULT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_projects_user`   (`user_id`),
  KEY `idx_projects_client` (`client_id`),
  KEY `idx_projects_status` (`status`),
  CONSTRAINT `fk_projects_user`   FOREIGN KEY (`user_id`)   REFERENCES `users`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_projects_client` FOREIGN KEY (`client_id`) REFERENCES `clients`  (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- EXPENSES (Existing)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `expenses` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED  NOT NULL,
  `project_id` INT UNSIGNED  DEFAULT NULL,
  `title`      VARCHAR(191)  NOT NULL,
  `amount`     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `date`       DATE          NOT NULL,
  `category`   VARCHAR(100)  NOT NULL DEFAULT 'Other',
  `notes`      TEXT          DEFAULT NULL,
  `receipt`    VARCHAR(500)  DEFAULT NULL,
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenses_user`    (`user_id`),
  KEY `idx_expenses_project` (`project_id`),
  KEY `idx_expenses_date`    (`date`),
  KEY `idx_expenses_category`(`category`),
  CONSTRAINT `fk_expenses_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_expenses_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- INVOICES (Existing — service invoices)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoices` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED  NOT NULL,
  `client_id`  INT UNSIGNED  DEFAULT NULL,
  `status`     ENUM('draft','sent','pending','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
  `date`       DATE          NOT NULL,
  `due_date`   DATE          DEFAULT NULL,
  `items`      JSON          DEFAULT NULL COMMENT 'Line items JSON array',
  `subtotal`   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `tax_rate`   DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total`      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `notes`      TEXT          DEFAULT NULL,
  `sent_at`    DATETIME      DEFAULT NULL,
  `paid_at`    DATETIME      DEFAULT NULL,
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoices_user`   (`user_id`),
  KEY `idx_invoices_client` (`client_id`),
  KEY `idx_invoices_status` (`status`),
  KEY `idx_invoices_date`   (`date`),
  CONSTRAINT `fk_invoices_user`   FOREIGN KEY (`user_id`)   REFERENCES `users`   (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoices_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- FILE UPLOADS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `file_uploads` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED  NOT NULL,
  `entity`        VARCHAR(50)   NOT NULL DEFAULT 'general',
  `entity_id`     INT UNSIGNED  DEFAULT NULL,
  `original_name` VARCHAR(255)  NOT NULL,
  `stored_path`   VARCHAR(500)  NOT NULL,
  `mime_type`     VARCHAR(100)  NOT NULL,
  `file_size`     INT UNSIGNED  NOT NULL DEFAULT 0,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_files_user`      (`user_id`),
  KEY `idx_files_entity`    (`entity`, `entity_id`),
  CONSTRAINT `fk_files_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- ACTIVITY LOGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED    NOT NULL,
  `action`     VARCHAR(50)     NOT NULL,
  `entity`     VARCHAR(50)     NOT NULL,
  `entity_id`  INT UNSIGNED    DEFAULT NULL,
  `detail`     TEXT            DEFAULT NULL,
  `ip_address` VARCHAR(45)     DEFAULT NULL,
  `user_agent` VARCHAR(500)    DEFAULT NULL,
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_user`   (`user_id`),
  KEY `idx_activity_entity` (`entity`, `entity_id`),
  KEY `idx_activity_date`   (`created_at`),
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- BUSINESSES (Registration)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `businesses` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED    NOT NULL,
  `name`        VARCHAR(191)    NOT NULL,
  `type`        VARCHAR(50)     NOT NULL DEFAULT 'Other',
  `owner_name`  VARCHAR(120)    NOT NULL,
  `reg_number`  VARCHAR(100)    DEFAULT NULL,
  `tax_number`  VARCHAR(100)    DEFAULT NULL,
  `description` TEXT            DEFAULT NULL,
  `logo`        VARCHAR(500)    DEFAULT NULL,
  `country`     VARCHAR(100)    NOT NULL DEFAULT '',
  `state`       VARCHAR(100)    NOT NULL DEFAULT '',
  `city`        VARCHAR(100)    NOT NULL DEFAULT '',
  `address`     TEXT            NOT NULL,
  `status`      ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_businesses_user` (`user_id`),
  KEY `idx_businesses_type` (`type`),
  CONSTRAINT `fk_businesses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- BUSINESS SETTINGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `business_settings` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `business_id`   INT UNSIGNED  NOT NULL,
  `currency`      VARCHAR(3)    NOT NULL DEFAULT 'USD',
  `currency_symbol` VARCHAR(10) NOT NULL DEFAULT '$',
  `timezone`      VARCHAR(60)   NOT NULL DEFAULT 'UTC',
  `date_format`   VARCHAR(20)   NOT NULL DEFAULT 'Y-m-d',
  `tax_enabled`   TINYINT(1)    NOT NULL DEFAULT 0,
  `tax_percent`   DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bs_business` (`business_id`),
  CONSTRAINT `fk_bs_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- ═════════════════════════════════════════════════════════════
-- NEW ERP MODULES (v3 Expansion)
-- ═════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- PRODUCT CATEGORIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `categories` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED  NOT NULL,
  `name`        VARCHAR(191)  NOT NULL,
  `description` TEXT          DEFAULT NULL,
  `status`      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_categories_user` (`user_id`),
  CONSTRAINT `fk_categories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration for existing databases: ALTER TABLE categories ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER description;

-- ─────────────────────────────────────────────────────────────
-- PRODUCTS (Inventory)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `products` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED  NOT NULL,
  `category_id`   INT UNSIGNED  DEFAULT NULL,
  `name`          VARCHAR(191)  NOT NULL,
  `sku`           VARCHAR(100)  DEFAULT NULL,
  `barcode`       VARCHAR(100)  DEFAULT NULL,
  `description`   TEXT          DEFAULT NULL,
  `purchase_price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `sale_price`    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `stock`         DECIMAL(15,3) NOT NULL DEFAULT 0.000,
  `min_stock`     DECIMAL(15,3) NOT NULL DEFAULT 0.000,
  `unit`          VARCHAR(30)   NOT NULL DEFAULT 'pcs',
  `status`        ENUM('active','inactive','discontinued') NOT NULL DEFAULT 'active',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_sku` (`user_id`, `sku`),
  KEY `idx_products_user`     (`user_id`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_status`   (`status`),
  CONSTRAINT `fk_products_user`     FOREIGN KEY (`user_id`)     REFERENCES `users`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- SUPPLIERS (Parties)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED  NOT NULL,
  `company_name`  VARCHAR(191)  NOT NULL,
  `contact_person` VARCHAR(120) DEFAULT NULL,
  `email`         VARCHAR(191)  DEFAULT NULL,
  `phone`         VARCHAR(50)   DEFAULT NULL,
  `address`       TEXT          DEFAULT NULL,
  `opening_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `opening_balance_type` ENUM('payable','receivable') NOT NULL DEFAULT 'payable',
  `current_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `credit_limit` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `notes`         TEXT          DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_suppliers_user` (`user_id`),
  KEY `idx_suppliers_status` (`status`),
  CONSTRAINT `fk_suppliers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- CUSTOMERS (Parties)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `customers` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED  NOT NULL,
  `name`          VARCHAR(191)  NOT NULL,
  `company_name`  VARCHAR(191)  DEFAULT NULL,
  `email`         VARCHAR(191)  DEFAULT NULL,
  `phone`         VARCHAR(50)   DEFAULT NULL,
  `address`       TEXT          DEFAULT NULL,
  `opening_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `current_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `notes`         TEXT          DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customers_user` (`user_id`),
  KEY `idx_customers_status` (`status`),
  CONSTRAINT `fk_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- PURCHASE INVOICES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `purchase_invoices` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED  NOT NULL,
  `supplier_id`   INT UNSIGNED  NOT NULL,
  `invoice_no`    VARCHAR(50)   NOT NULL,
  `reference`     VARCHAR(100)  DEFAULT NULL,
  `date`          DATE          NOT NULL,
  `invoice_datetime` DATETIME   DEFAULT NULL,
  `due_date`      DATE          DEFAULT NULL,
  `type`          ENUM('cash','credit','partial') NOT NULL DEFAULT 'cash',
  `status`        ENUM('draft','received','paid','cancelled') NOT NULL DEFAULT 'draft',
  `subtotal`      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount`      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `tax_rate`      DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `tax_amount`    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total`         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount`   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `balance`       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `notes`         TEXT          DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pi_user`     (`user_id`),
  KEY `idx_pi_supplier` (`supplier_id`),
  KEY `idx_pi_status`   (`status`),
  KEY `idx_pi_date`     (`date`),
  CONSTRAINT `fk_pi_user`     FOREIGN KEY (`user_id`)     REFERENCES `users`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pi_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- PURCHASE INVOICE ITEMS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `purchase_invoice_items` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `purchase_invoice_id` INT UNSIGNED NOT NULL,
  `product_id`      INT UNSIGNED  NOT NULL,
  `product_name`    VARCHAR(191)  NOT NULL,
  `quantity`        DECIMAL(15,3) NOT NULL DEFAULT 1.000,
  `purchase_price`  DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `sale_price`      DECIMAL(15,2) DEFAULT NULL,
  `discount`        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `tax_rate`        DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `tax_amount`      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total`           DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_pii_invoice` (`purchase_invoice_id`),
  KEY `idx_pii_product` (`product_id`),
  CONSTRAINT `fk_pii_invoice` FOREIGN KEY (`purchase_invoice_id`) REFERENCES `purchase_invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pii_product` FOREIGN KEY (`product_id`)         REFERENCES `products`          (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- SALES INVOICES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sales_invoices` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED  NOT NULL,
  `customer_id`   INT UNSIGNED  NOT NULL,
  `invoice_no`    VARCHAR(50)   NOT NULL,
  `reference`     VARCHAR(100)  DEFAULT NULL,
  `date`          DATE          NOT NULL,
  `due_date`      DATE          DEFAULT NULL,
  `type`          ENUM('cash','credit','partial') NOT NULL DEFAULT 'cash',
  `status`        ENUM('draft','sent','paid','partial','overdue','cancelled') NOT NULL DEFAULT 'draft',
  `subtotal`      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount`      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `tax_rate`      DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `tax_amount`    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total`         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount`   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `balance`       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `notes`         TEXT          DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_si_user`     (`user_id`),
  KEY `idx_si_customer` (`customer_id`),
  KEY `idx_si_status`   (`status`),
  KEY `idx_si_date`     (`date`),
  CONSTRAINT `fk_si_user`     FOREIGN KEY (`user_id`)     REFERENCES `users`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_si_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- SALES INVOICE ITEMS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sales_invoice_items` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `sales_invoice_id` INT UNSIGNED NOT NULL,
  `product_id`      INT UNSIGNED  NOT NULL,
  `product_name`    VARCHAR(191)  NOT NULL,
  `quantity`        DECIMAL(15,3) NOT NULL DEFAULT 1.000,
  `sale_price`      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount`        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `tax_rate`        DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `tax_amount`      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total`           DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_sii_invoice` (`sales_invoice_id`),
  KEY `idx_sii_product` (`product_id`),
  CONSTRAINT `fk_sii_invoice` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sii_product` FOREIGN KEY (`product_id`)       REFERENCES `products`      (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- PURCHASE RETURNS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `purchase_returns` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`         INT UNSIGNED  NOT NULL,
  `supplier_id`     INT UNSIGNED  NOT NULL,
  `purchase_invoice_id` INT UNSIGNED DEFAULT NULL,
  `return_no`       VARCHAR(50)   NOT NULL,
  `date`            DATE          NOT NULL,
  `reason`          TEXT          DEFAULT NULL,
  `total`           DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `status`          ENUM('draft','completed','cancelled') NOT NULL DEFAULT 'draft',
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pr_user`     (`user_id`),
  KEY `idx_pr_supplier` (`supplier_id`),
  KEY `idx_pr_pi`       (`purchase_invoice_id`),
  KEY `idx_pr_status`   (`status`),
  CONSTRAINT `fk_pr_user`     FOREIGN KEY (`user_id`)     REFERENCES `users`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pr_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pr_pi`       FOREIGN KEY (`purchase_invoice_id`) REFERENCES `purchase_invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- PURCHASE RETURN ITEMS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `purchase_return_items` (
  `id`                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `purchase_return_id` INT UNSIGNED NOT NULL,
  `product_id`        INT UNSIGNED  NOT NULL,
  `product_name`      VARCHAR(191)  NOT NULL,
  `quantity`          DECIMAL(15,3) NOT NULL DEFAULT 1.000,
  `purchase_price`    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total`             DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_pri_return` (`purchase_return_id`),
  KEY `idx_pri_product` (`product_id`),
  CONSTRAINT `fk_pri_return` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pri_product` FOREIGN KEY (`product_id`)        REFERENCES `products`         (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- SALES RETURNS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sales_returns` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`         INT UNSIGNED  NOT NULL,
  `customer_id`     INT UNSIGNED  NOT NULL,
  `sales_invoice_id` INT UNSIGNED DEFAULT NULL,
  `return_no`       VARCHAR(50)   NOT NULL,
  `date`            DATE          NOT NULL,
  `reason`          TEXT          DEFAULT NULL,
  `total`           DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `status`          ENUM('draft','completed','cancelled') NOT NULL DEFAULT 'draft',
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sr_user`     (`user_id`),
  KEY `idx_sr_customer` (`customer_id`),
  KEY `idx_sr_si`       (`sales_invoice_id`),
  KEY `idx_sr_status`   (`status`),
  CONSTRAINT `fk_sr_user`     FOREIGN KEY (`user_id`)     REFERENCES `users`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sr_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sr_si`       FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- SALES RETURN ITEMS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sales_return_items` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `sales_return_id` INT UNSIGNED NOT NULL,
  `product_id`      INT UNSIGNED  NOT NULL,
  `product_name`    VARCHAR(191)  NOT NULL,
  `quantity`        DECIMAL(15,3) NOT NULL DEFAULT 1.000,
  `sale_price`      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total`           DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_sri_return` (`sales_return_id`),
  KEY `idx_sri_product` (`product_id`),
  CONSTRAINT `fk_sri_return` FOREIGN KEY (`sales_return_id`) REFERENCES `sales_returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sri_product` FOREIGN KEY (`product_id`)      REFERENCES `products`     (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- PAYMENTS (Accounts)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payments` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED  NOT NULL,
  `party_type`    ENUM('supplier','customer') NOT NULL,
  `party_id`      INT UNSIGNED  NOT NULL,
  `invoice_type`  ENUM('purchase','sales') DEFAULT NULL,
  `invoice_id`    INT UNSIGNED  DEFAULT NULL,
  `payment_no`    VARCHAR(50)   NOT NULL,
  `date`          DATE          NOT NULL,
  `amount`        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `method`        VARCHAR(50)   NOT NULL DEFAULT 'cash',
  `reference`     VARCHAR(100)  DEFAULT NULL,
  `notes`         TEXT          DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pay_user`      (`user_id`),
  KEY `idx_pay_party`     (`party_type`, `party_id`),
  KEY `idx_pay_invoice`   (`invoice_type`, `invoice_id`),
  KEY `idx_pay_date`      (`date`),
  CONSTRAINT `fk_pay_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- ROLES (Team / RBAC)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `roles` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED  NOT NULL,
  `name`        VARCHAR(100)  NOT NULL,
  `description` TEXT          DEFAULT NULL,
  `is_system`   TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_roles_user` (`user_id`),
  CONSTRAINT `fk_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- PERMISSIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `permissions` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `role_id`     INT UNSIGNED  NOT NULL,
  `module`      VARCHAR(50)   NOT NULL,
  `can_view`    TINYINT(1)    NOT NULL DEFAULT 0,
  `can_create`  TINYINT(1)    NOT NULL DEFAULT 0,
  `can_edit`    TINYINT(1)    NOT NULL DEFAULT 0,
  `can_delete`  TINYINT(1)    NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_perm_role`   (`role_id`),
  KEY `idx_perm_module` (`module`),
  CONSTRAINT `fk_perm_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- TEAM MEMBERS (User role assignments)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `team_members` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED  NOT NULL,
  `role_id`     INT UNSIGNED  DEFAULT NULL,
  `name`        VARCHAR(120)  NOT NULL,
  `email`       VARCHAR(191)  NOT NULL,
  `phone`       VARCHAR(50)   DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL DEFAULT '',
  `status`      ENUM('active','inactive','invited') NOT NULL DEFAULT 'active',
  `last_login`  DATETIME      DEFAULT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tm_email` (`user_id`, `email`),
  KEY `idx_tm_user`   (`user_id`),
  KEY `idx_tm_role`   (`role_id`),
  KEY `idx_tm_status` (`status`),
  CONSTRAINT `fk_tm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tm_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- STOCK MOVEMENT LOG (Audit trail for inventory)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED    NOT NULL,
  `product_id`    INT UNSIGNED    NOT NULL,
  `type`          ENUM('purchase','sale','purchase_return','sales_return','adjustment','opening') NOT NULL,
  `reference_type` VARCHAR(50)    DEFAULT NULL,
  `reference_id`  INT UNSIGNED    DEFAULT NULL,
  `quantity`      DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
  `stock_before`  DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
  `stock_after`   DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
  `unit_price`    DECIMAL(15,2)   DEFAULT NULL,
  `notes`         TEXT            DEFAULT NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sm_product`  (`product_id`),
  KEY `idx_sm_user`     (`user_id`),
  KEY `idx_sm_type`     (`type`),
  KEY `idx_sm_date`     (`created_at`),
  KEY `idx_sm_reference` (`reference_type`, `reference_id`),
  CONSTRAINT `fk_sm_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sm_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════

-- Admin user: password = "password"
INSERT INTO `users` (`name`, `email`, `password_hash`, `role`, `status`) VALUES
 ('Admin User', 'admin@bizbrain.com',
 '$2y$10$UiGGLC1vk.AhVErpwArZYejM7CRbEyqLFtSSFklbEZh83sXnRuBq6',
 'admin', 'active');

-- Default settings for admin
INSERT INTO `settings` (`user_id`, `setting_key`, `setting_value`) VALUES
(1, 'biz_name',       'My Business'),
(1, 'currency',       'USD'),
(1, 'timezone',       'America/New_York'),
(1, 'invoice_prefix', 'INV'),
(1, 'tax_rate',       '0');

-- Sample clients
INSERT INTO `clients` (`user_id`, `name`, `email`, `company`, `phone`, `status`) VALUES
(1, 'Acme Corp',      'billing@acmecorp.com',    'Acme Corp',      '+1 555-100-1000', 'active'),
(1, 'Globex Inc',     'accounts@globex.com',     'Globex Inc',     '+1 555-200-2000', 'active'),
(1, 'Initech LLC',    'finance@initech.com',     'Initech LLC',    '+1 555-300-3000', 'active'),
(1, 'Umbrella Corp',  'ar@umbrellacorp.com',     'Umbrella Corp',  '+1 555-400-4000', 'prospect'),
(1, 'Stark Industries','tony@starkindustries.com','Stark Industries','+1 555-500-5000','active');

-- Sample projects
INSERT INTO `projects` (`user_id`, `client_id`, `name`, `description`, `status`, `budget`, `deadline`) VALUES
(1, 1, 'Website Redesign',    'Full redesign of corporate website',        'active',    8500.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY)),
(1, 2, 'Mobile App MVP',      'iOS and Android app for field teams',       'active',   25000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY)),
(1, 3, 'Brand Identity',      'Logo, colors, and brand guidelines',        'completed',  4500.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
(1, 4, 'SEO Campaign',        'Six-month organic growth strategy',         'on-hold',   6000.00, DATE_ADD(CURDATE(), INTERVAL 180 DAY)),
(1, 5, 'Data Dashboard',      'Executive analytics platform',              'active',   18000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY));

-- Sample expenses
INSERT INTO `expenses` (`user_id`, `project_id`, `title`, `amount`, `date`, `category`) VALUES
(1, 1, 'Adobe Creative Cloud', 52.99,  CURDATE(),                         'Software'),
(1, 2, 'AWS Hosting',          129.40, DATE_SUB(CURDATE(), INTERVAL 5 DAY),'Software'),
(1, NULL, 'Team Lunch',        87.50,  DATE_SUB(CURDATE(), INTERVAL 3 DAY),'Meals'),
(1, 3, 'Figma Pro',            15.00,  DATE_SUB(CURDATE(), INTERVAL 7 DAY),'Software'),
(1, NULL,'Office Supplies',    43.20,  DATE_SUB(CURDATE(), INTERVAL 2 DAY),'Office'),
(1, 5, 'Flight to NYC',       342.00,  DATE_SUB(CURDATE(), INTERVAL 14 DAY),'Travel'),
(1, NULL,'Slack Premium',      7.25,   DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Software'),
(1, 2, 'Contractor Payment',  1500.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY),'Other');

-- Sample invoices
INSERT INTO `invoices` (`user_id`, `client_id`, `status`, `date`, `due_date`, `items`, `total`) VALUES
(1, 1, 'paid',    DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_SUB(CURDATE(), INTERVAL 15 DAY),
 '[{"desc":"Website Redesign Phase 1","qty":1,"rate":4250}]', 4250.00),
(1, 2, 'sent',    DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 15 DAY),
 '[{"desc":"Mobile App Development","qty":1,"rate":12500}]', 12500.00),
(1, 3, 'paid',    DATE_SUB(CURDATE(), INTERVAL 45 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY),
 '[{"desc":"Brand Identity Package","qty":1,"rate":4500}]', 4500.00),
(1, 4, 'pending', DATE_SUB(CURDATE(), INTERVAL 7 DAY),  DATE_ADD(CURDATE(), INTERVAL 23 DAY),
 '[{"desc":"SEO Audit","qty":1,"rate":1500}]', 1500.00),
(1, 5, 'overdue', DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY),
 '[{"desc":"Dashboard Design","qty":1,"rate":9000}]', 9000.00),
(1, 1, 'draft',   CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY),
 '[{"desc":"Website Redesign Phase 2","qty":1,"rate":4250}]', 4250.00);

-- ═══════════════════════════════════════════════════════════
-- NEW ERP SEED DATA (v3)
-- ═══════════════════════════════════════════════════════════

-- Product Categories
INSERT INTO `categories` (`user_id`, `name`, `description`) VALUES
(1, 'Electronics',    'Electronic devices and accessories'),
(1, 'Furniture',      'Office and home furniture'),
(1, 'Stationery',     'Office stationery and supplies'),
(1, 'Groceries',      'Food and grocery items'),
(1, 'Clothing',       'Apparel and garments');

-- Products
INSERT INTO `products` (`user_id`, `category_id`, `name`, `sku`, `purchase_price`, `sale_price`, `stock`, `min_stock`, `unit`) VALUES
(1, 1, 'LED Monitor 24"',       'MON-001',  120.00, 180.00, 15.000,  3.000, 'pcs'),
(1, 1, 'Wireless Keyboard',     'KEY-001',   25.00,  45.00, 30.000,  5.000, 'pcs'),
(1, 1, 'USB-C Hub',             'USB-001',   18.00,  35.00, 25.000,  5.000, 'pcs'),
(1, 2, 'Office Chair',          'CHR-001',   85.00, 150.00, 10.000,  2.000, 'pcs'),
(1, 2, 'Standing Desk',         'DSK-001',  250.00, 400.00,  5.000,  1.000, 'pcs'),
(1, 3, 'A4 Printer Paper (Box)','PAP-001',   22.00,  35.00, 50.000, 10.000, 'box'),
(1, 3, 'Ballpoint Pens (Pack)','PEN-001',    5.00,  12.00, 100.000, 20.000, 'pack'),
(1, 4, 'Basmati Rice (5kg)',    'RCE-001',   8.00,  14.00, 40.000, 10.000, 'bag'),
(1, 4, 'Cooking Oil (3L)',      'OIL-001',   6.00,  11.00, 35.000,  8.000, 'bottle'),
(1, 5, 'Cotton T-Shirt',        'TSH-001',    8.00,  20.00, 60.000, 15.000, 'pcs');

-- Suppliers
INSERT INTO `suppliers` (`user_id`, `company_name`, `contact_person`, `email`, `phone`, `address`) VALUES
(1, 'TechSource Ltd',      'John Smith',   'john@techsource.com',   '+1 555-111-0001', '123 Tech Street, Silicon Valley, CA'),
(1, 'OfficeWorld Inc',     'Sarah Jones',  'sarah@officeworld.com', '+1 555-111-0002', '456 Office Blvd, Chicago, IL'),
(1, 'FreshGro Supplies',   'Mike Brown',   'mike@freshgro.com',     '+1 555-111-0003', '789 Market Ave, Los Angeles, CA'),
(1, 'FashionDirect',       'Emma Wilson',  'emma@fashiondirect.com','+1 555-111-0004', '321 Style Street, New York, NY'),
(1, 'GlobalParts Co',      'David Lee',    'david@globalparts.com', '+1 555-111-0005', '88 Industrial Pkwy, Houston, TX'),
(1, 'SafeChem Industries', 'Dr. Rachel Green','rachel@safechem.com','+1 555-111-0006', '12 Chemical Lane, Newark, NJ'),
(1, 'BuildRight Hardware', 'Tom Martinez', 'tom@buildright.com',   '+1 555-111-0007', '55 Construction Ave, Dallas, TX'),
(1, 'PackPro Solutions',   'Lisa Chen',    'lisa@packpro.com',      '+1 555-111-0008', '90 Packaging Row, Seattle, WA'),
(1, 'MediSupply Depot',    'Dr. Kevin Park','kevin@medisupply.com',  '+1 555-111-0009', '44 Healthcare Dr, Boston, MA'),
(1, 'EcoPrint Materials',  'Nina Rodriguez','nina@ecoprint.com',     '+1 555-111-0010', '78 Green St, Portland, OR');

-- Customers
INSERT INTO `customers` (`user_id`, `name`, `company_name`, `email`, `phone`, `address`, `opening_balance`, `current_balance`) VALUES
(1, 'Alex Taylor',   'Taylor Supply Co.','alex@example.com',         '+1 555-000-0001', '100 Demo Street',     0.00, 1500.00),
(1, 'Sara Khan',     'Khan Enterprises', 'sara@khanent.com',        '+1 555-222-0002', '34 Park Ave, Chicago', 0.00,  750.00),
(1, 'Usman Ahmed',   'Ahmed & Sons',     'usman@ahmedsons.com',     '+1 555-222-0003', '56 Lake Rd, Boston',   0.00,  320.00),
(1, 'Fatima Ali',    'Ali General Store','fatima@aligen.com',       '+1 555-222-0004', '78 Hill St, LA',       0.00,    0.00);

-- Default roles
INSERT INTO `roles` (`user_id`, `name`, `description`, `is_system`) VALUES
(1, 'Admin',     'Full system access', 1),
(1, 'Manager',   'Can manage operations', 1),
(1, 'Staff',     'Limited access', 1);

-- Admin permissions (full access to all modules)
INSERT INTO `permissions` (`role_id`, `module`, `can_view`, `can_create`, `can_edit`, `can_delete`) VALUES
(1, 'dashboard', 1, 0, 0, 0),
(1, 'products',  1, 1, 1, 1),
(1, 'categories',1, 1, 1, 1),
(1, 'suppliers', 1, 1, 1, 1),
(1, 'customers', 1, 1, 1, 1),
(1, 'purchases', 1, 1, 1, 1),
(1, 'sales',     1, 1, 1, 1),
(1, 'returns',   1, 1, 1, 1),
(1, 'payments',  1, 1, 1, 1),
(1, 'accounts',  1, 1, 1, 1),
(1, 'team',      1, 1, 1, 1),
(1, 'settings',  1, 1, 1, 1);

-- Stock history entries
INSERT INTO `stock_movements` (`user_id`, `product_id`, `type`, `quantity`, `stock_before`, `stock_after`, `notes`) VALUES
(1, 1, 'opening', 15.000, 0.000, 15.000, 'Initial stock'),
(1, 2, 'opening', 30.000, 0.000, 30.000, 'Initial stock'),
(1, 3, 'opening', 25.000, 0.000, 25.000, 'Initial stock'),
(1, 4, 'opening', 10.000, 0.000, 10.000, 'Initial stock'),
(1, 5, 'opening',  5.000, 0.000,  5.000, 'Initial stock'),
(1, 6, 'opening', 50.000, 0.000, 50.000, 'Initial stock'),
(1, 7, 'opening', 100.000, 0.000, 100.000, 'Initial stock'),
(1, 8, 'opening', 40.000, 0.000, 40.000, 'Initial stock'),
(1, 9, 'opening', 35.000, 0.000, 35.000, 'Initial stock'),
(1, 10, 'opening', 60.000, 0.000, 60.000, 'Initial stock');

-- ─────────────────────────────────────────────────────────────
-- BUSINESS FINANCIALS (Registration Step 4)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `business_financials` (
  `id`                  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `business_id`         INT UNSIGNED  NOT NULL,
  `opening_date`        DATE          DEFAULT NULL,
  `cash_in_hand`        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `bank_balance`        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `opening_capital`     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `avg_monthly_sales`   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `avg_monthly_expenses` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bf_business` (`business_id`),
  CONSTRAINT `fk_bf_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- BUSINESS ASSETS (Registration Step 4)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `business_assets` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `business_id`     INT UNSIGNED  NOT NULL,
  `total_value`     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `equipment_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `furniture_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `vehicle_value`   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ba_business` (`business_id`),
  CONSTRAINT `fk_ba_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- BUSINESS INVENTORY (Registration Step 4)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `business_inventory` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `business_id`     INT UNSIGNED  NOT NULL,
  `product_count`   INT UNSIGNED  NOT NULL DEFAULT 0,
  `inventory_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `product_list`    JSON          DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bi_business` (`business_id`),
  CONSTRAINT `fk_bi_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

