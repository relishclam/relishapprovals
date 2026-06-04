-- Migration 014: Staff payees, settlement approvals, and settlement session login

-- 1. Payees can optionally be linked to a users row and marked as staff
ALTER TABLE payees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_payees_user_id ON payees(user_id);
CREATE INDEX IF NOT EXISTS idx_payees_is_staff ON payees(is_staff);

-- 2. Allow vouchers to be linked to a settlement entry
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS settlement_id UUID REFERENCES suspense_settlements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_settlement_id ON vouchers(settlement_id);

-- 3. Add review workflow metadata to suspense settlements
ALTER TABLE suspense_settlements
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requires_invoice BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS invoice_missing_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_settlements_status ON suspense_settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_reviewed_by ON suspense_settlements(reviewed_by);

-- 4. Settlement session login for payees to access their suspense form
CREATE TABLE IF NOT EXISTS settlement_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suspense_id   UUID NOT NULL REFERENCES suspense_vouchers(id) ON DELETE CASCADE,
  payee_id      UUID NOT NULL REFERENCES payees(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_settlement_sessions_suspense ON settlement_sessions(suspense_id);
CREATE INDEX IF NOT EXISTS idx_settlement_sessions_payee ON settlement_sessions(payee_id);
CREATE INDEX IF NOT EXISTS idx_settlement_sessions_expires ON settlement_sessions(expires_at);

ALTER TABLE settlement_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for service role" ON settlement_sessions;
CREATE POLICY "Allow all for service role" ON settlement_sessions FOR ALL USING (true);

-- 5. Ensure service role can still manage existing tables
ALTER TABLE payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for service role" ON payees;
DROP POLICY IF EXISTS "Allow all operations for service role" ON vouchers;

CREATE POLICY "Allow all operations for service role" ON payees FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON vouchers FOR ALL USING (true);
