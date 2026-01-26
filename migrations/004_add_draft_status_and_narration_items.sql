-- Migration: Add draft status and narration_items table
-- This migration adds:
-- 1. 'draft' status for vouchers that are saved but not submitted
-- 2. 'narration_items' table for storing line items
-- 3. Updates financial year to 2025-26

-- First, drop the existing status check constraint
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_status_check;

-- Add the new status check constraint that includes 'draft'
ALTER TABLE vouchers ADD CONSTRAINT vouchers_status_check 
CHECK(status IN ('draft', 'pending', 'approved', 'awaiting_payee_otp', 'completed', 'rejected'));

-- Add submitted_at timestamp to track when draft was submitted
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Create index for faster draft queries
CREATE INDEX IF NOT EXISTS idx_vouchers_draft ON vouchers(status) WHERE status = 'draft';

-- Create narration_items table
CREATE TABLE IF NOT EXISTS narration_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for narration_items
CREATE INDEX IF NOT EXISTS idx_narration_items_voucher ON narration_items(voucher_id);

-- Enable RLS for narration_items
ALTER TABLE narration_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for service role" ON narration_items;
CREATE POLICY "Allow all operations for service role" ON narration_items FOR ALL USING (true);

-- Update financial year to 2025-26
UPDATE voucher_series SET financial_year = '2025-26' WHERE financial_year = '2024-25';

-- Comments
COMMENT ON TABLE narration_items IS 'Line items for voucher narration with description and amount';
COMMENT ON COLUMN vouchers.submitted_at IS 'Timestamp when a draft voucher was submitted for approval';
