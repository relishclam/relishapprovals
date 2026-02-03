-- Migration: Add invoice_reference field to vouchers
-- This is an optional field for referencing invoice numbers

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS invoice_reference TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN vouchers.invoice_reference IS 'Optional field for storing invoice reference/number';
