-- Migration: Add deductions column to vouchers
-- For tracking advance/part payments to be deducted from a voucher payment

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS deductions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN vouchers.deductions IS 'Array of {description, amount} objects representing advance or part payments to deduct from the gross amount. The voucher amount field stores the NET payable amount after deductions.';
