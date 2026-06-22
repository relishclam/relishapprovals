-- Migration 020: Add is_suspense_settlement flag to vouchers
-- Vouchers created from suspense settlement entries must go through the normal
-- Admin approval flow (pending → approved → completed).
-- This flag tells the approve endpoint to skip the OTP/document step and
-- complete the voucher immediately after Admin approval — since the payment
-- was already disbursed as the suspense advance.

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS is_suspense_settlement BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vouchers_suspense_settlement ON vouchers(is_suspense_settlement)
  WHERE is_suspense_settlement = true;
