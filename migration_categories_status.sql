-- ═══════════════════════════════════════════════════════════════
-- Migration: Add status column to categories table
-- For EXISTING databases only (new installations use database.sql)
-- ═══════════════════════════════════════════════════════════════
-- Run this SQL in your MySQL/MariaDB console or phpMyAdmin:

ALTER TABLE `categories` ADD COLUMN `status` ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER `description`;
