-- Migration: Add payment-tracking statuses and columns to vouchers
-- Extends the lifecycle: completed → awaiting_payment → paid
-- Run in Supabase SQL Editor after 008_add_document_verification.sql

-- 1. Extend the status CHECK constraint
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_status_check;
ALTER TABLE vouchers ADD CONSTRAINT vouchers_status_check
  CHECK(status IN (
    'draft', 'pending', 'approved',
    'awaiting_payee_otp', 'awaiting_document',
    'completed',
    'awaiting_payment', 'paid',
    'rejected'
  ));

-- 2. Payment tracking columns
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS payment_reference        TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS payment_notes            TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS paid_by                  UUID REFERENCES users(id);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS paid_at                  TIMESTAMPTZ;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS queued_for_payment_by    UUID REFERENCES users(id);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS queued_at                TIMESTAMPTZ;

-- 3. Index for fast lookup of the payment queue
CREATE INDEX IF NOT EXISTS idx_vouchers_awaiting_payment
  ON vouchers (company_id, status)
  WHERE status = 'awaiting_payment';

-- 4. Documentation
COMMENT ON COLUMN vouchers.payment_reference     IS 'UTR / transaction ID entered by admin when marking paid';
COMMENT ON COLUMN vouchers.payment_notes         IS 'Free-text notes recorded when marking payment done';
COMMENT ON COLUMN vouchers.paid_by               IS 'User who marked the voucher as paid';
COMMENT ON COLUMN vouchers.paid_at               IS 'Timestamp when voucher was marked as paid';
COMMENT ON COLUMN vouchers.queued_for_payment_by IS 'User who moved voucher to awaiting_payment queue';
COMMENT ON COLUMN vouchers.queued_at             IS 'Timestamp when voucher entered awaiting_payment queue';
