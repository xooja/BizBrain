-- ═══════════════════════════════════════════════════════════════
-- Migration: Add opening_balance, opening_balance_type & credit_limit to suppliers
-- For EXISTING databases only (new installations use database.sql)
-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in your MySQL/MariaDB console or phpMyAdmin:

ALTER TABLE `suppliers` 
  ADD COLUMN `opening_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER `address`,
  ADD COLUMN `opening_balance_type` ENUM('payable','receivable') NOT NULL DEFAULT 'payable' AFTER `opening_balance`,
  ADD COLUMN `credit_limit` DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER `current_balance`;
