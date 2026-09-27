-- ═══════════════════════════════════════════════════════════
-- BizBrain — Migration: Add missing business registration tables
-- ═══════════════════════════════════════════════════════════
-- Run this SQL against your existing `bizbrain` database to fix
-- the 500 error during registration caused by missing tables.
-- ═══════════════════════════════════════════════════════════

-- ── BUSINESS FINANCIALS ──────────────────────────────────────
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

-- ── BUSINESS ASSETS ─────────────────────────────────────────
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

-- ── BUSINESS INVENTORY ──────────────────────────────────────
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
