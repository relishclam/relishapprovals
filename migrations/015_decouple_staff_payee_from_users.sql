-- Migration 015: Decouple staff payees from system users
--
-- Previously, suspense vouchers required staff to have a system login account
-- (staff_user_id FK to users). Most field staff don't have accounts — they
-- only interact via the SMS settlement link. This migration:
--   1. Adds staff_payee_id to suspense_vouchers (direct payee reference)
--   2. Makes staff_user_id nullable (staff may not have system accounts)
--   3. Makes submitted_by nullable in suspense_settlements (SMS-link submissions
--      have no user account behind them)

-- 1. Add direct payee reference on suspense vouchers
ALTER TABLE suspense_vouchers
  ADD COLUMN IF NOT EXISTS staff_payee_id UUID REFERENCES payees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_suspense_vouchers_staff_payee ON suspense_vouchers(staff_payee_id);

-- 2. Make staff_user_id nullable (was NOT NULL)
ALTER TABLE suspense_vouchers
  ALTER COLUMN staff_user_id DROP NOT NULL;

-- 3. Make submitted_by nullable in suspense_settlements (was NOT NULL)
ALTER TABLE suspense_settlements
  ALTER COLUMN submitted_by DROP NOT NULL;

-- 4. Add payee_id to settlements for direct traceability
ALTER TABLE suspense_settlements
  ADD COLUMN IF NOT EXISTS settlement_payee_id UUID REFERENCES payees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_settlements_payee ON suspense_settlements(settlement_payee_id);
