-- Adds the user-editable invoice timestamp for purchase invoices.
ALTER TABLE `purchase_invoices`
  ADD COLUMN `invoice_datetime` DATETIME NULL AFTER `date`;