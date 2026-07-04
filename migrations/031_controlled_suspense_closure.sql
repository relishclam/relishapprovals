-- Migration 031: Controlled Suspense Voucher Closure
-- Balance = 0 : close directly (no change).
-- Balance < 0 : close directly, Accounts acknowledges the out-of-pocket overspend.
-- Balance > 0 : requires Admin approval before closing.
--               On approval a "Staff Advance Recovery" voucher is auto-created
--               for the unspent amount, using the Head of Account chosen by Accounts.

-- 1. Extend the suspense_vouchers status enum to include the pending-close state
ALTER TABLE suspense_vouchers
  DROP CONSTRAINT IF EXISTS suspense_vouchers_status_check;

ALTER TABLE suspense_vouchers
  ADD CONSTRAINT suspense_vouchers_status_check
    CHECK (status IN (
      'pending_approval',
      'awaiting_payee_otp',
      'open',
      'partial',
      'pending_close_approval',   -- balance > 0, waiting for Admin to approve closure
      'closed',
      'rejected'
    ));

-- 2. Close request tracking columns
ALTER TABLE suspense_vouchers
  ADD COLUMN IF NOT EXISTS close_requested_by    UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS close_requested_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_hoa             TEXT,   -- Head of Account for recovery voucher
  ADD COLUMN IF NOT EXISTS close_sub_hoa         TEXT,
  ADD COLUMN IF NOT EXISTS close_notes           TEXT,
  ADD COLUMN IF NOT EXISTS pre_close_status      TEXT,   -- stored so rejection can revert correctly
  ADD COLUMN IF NOT EXISTS close_approved_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS close_approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_rejected_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS close_rejected_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_suspense_vouchers_pending_close
  ON suspense_vouchers(company_id, status)
  WHERE status = 'pending_close_approval';
