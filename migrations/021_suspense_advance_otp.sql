-- Migration 021: OTP verification for suspense advance disbursement
-- Every rupee leaving the organisation must be OTP-verified by the recipient.
-- Suspense advances are no exception: after Admin approval the payee must
-- confirm receipt via OTP before the settlement form link is activated.
-- This makes the is_suspense_settlement flag on final expense vouchers
-- principled — the advance was already OTP-verified, so those vouchers
-- are accounting entries against a proven disbursement, not new payments.

-- 1. Extend suspense_vouchers status to include the OTP-pending state
ALTER TABLE suspense_vouchers
  DROP CONSTRAINT IF EXISTS suspense_vouchers_status_check;

ALTER TABLE suspense_vouchers
  ADD CONSTRAINT suspense_vouchers_status_check
    CHECK (status IN (
      'pending_approval',
      'awaiting_payee_otp',
      'open',
      'partial',
      'closed',
      'rejected'
    ));

-- 2. Audit trail: when did the payee OTP-confirm the advance receipt?
ALTER TABLE suspense_vouchers
  ADD COLUMN IF NOT EXISTS advance_otp_verified_at TIMESTAMPTZ;

-- 3. Allow otp_sessions to reference a suspense voucher (not just a regular voucher)
ALTER TABLE otp_sessions
  ADD COLUMN IF NOT EXISTS suspense_id UUID REFERENCES suspense_vouchers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_otp_sessions_suspense ON otp_sessions(suspense_id);
