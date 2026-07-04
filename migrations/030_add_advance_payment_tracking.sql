-- Migration 030: Payment Tracking for the Initial Suspense Advance Disbursement
-- Every suspense advance is an outward payment from the company to the staff payee.
-- The OTP (migration 021) proves the staff received the advance, but nothing currently
-- proves the company sent it with a documented UTR or bank receipt.
-- This migration adds that proof to suspense_vouchers.

ALTER TABLE suspense_vouchers
  ADD COLUMN IF NOT EXISTS advance_payment_status    TEXT
    CHECK (advance_payment_status IN ('paid')),   -- NULL = not yet confirmed; 'paid' = confirmed
  ADD COLUMN IF NOT EXISTS advance_payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS advance_payment_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS advance_payment_notes     TEXT,
  ADD COLUMN IF NOT EXISTS advance_paid_by           UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS advance_paid_at           TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_suspense_vouchers_advance_payment_status
  ON suspense_vouchers(advance_payment_status)
  WHERE advance_payment_status IS NOT NULL;
