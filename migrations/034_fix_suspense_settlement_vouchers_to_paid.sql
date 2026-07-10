-- Migration 034: Fix suspense-settlement vouchers stuck in completed / awaiting_payment
-- ─────────────────────────────────────────────────────────────────────────────────────
-- Vouchers created from suspense settlement entries (is_suspense_settlement = true)
-- are PRE-PAID — the cash was already disbursed as the suspense advance.
-- The server fast-path was incorrectly setting status = 'completed' (OTP Verified)
-- instead of status = 'paid'.  This migration corrects all existing affected rows.
--
-- Covers two stuck states:
--   - 'completed'        → was never queued, sitting with a Queue button
--   - 'awaiting_payment' → was erroneously queued by accounts before fix

UPDATE vouchers
SET
  status          = 'paid',
  paid_at         = COALESCE(completed_at, approved_at, NOW()),
  paid_by         = COALESCE(approved_by, prepared_by),
  payment_notes   = 'Pre-paid via suspense advance'
WHERE
  is_suspense_settlement = true
  AND status IN ('completed', 'awaiting_payment')
  AND COALESCE(approved_by, prepared_by) IS NOT NULL;

-- Safety net: any remaining rows where both approved_by and prepared_by are NULL
-- (should never happen, but just in case — use NOW() and leave paid_by NULL)
UPDATE vouchers
SET
  status        = 'paid',
  paid_at       = COALESCE(completed_at, approved_at, NOW()),
  payment_notes = 'Pre-paid via suspense advance'
WHERE
  is_suspense_settlement = true
  AND status IN ('completed', 'awaiting_payment')
  AND COALESCE(approved_by, prepared_by) IS NULL;
