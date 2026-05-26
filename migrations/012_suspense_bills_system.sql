-- Migration 012: Suspense Voucher System + Bill Attachments
-- Run this in the Supabase SQL Editor

-- ─── 1. Add suspense_current_number to voucher_series ────────────────────────
ALTER TABLE voucher_series
  ADD COLUMN IF NOT EXISTS suspense_current_number INTEGER DEFAULT 0;

-- ─── 2. suspense_vouchers table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suspense_vouchers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        TEXT NOT NULL REFERENCES companies(id),
  serial_number     TEXT NOT NULL,
  staff_user_id     UUID NOT NULL REFERENCES users(id),
  advance_amount    DECIMAL(15,2) NOT NULL,
  currency          TEXT DEFAULT 'INR',
  purpose           TEXT NOT NULL,
  narration         TEXT,
  status            TEXT NOT NULL DEFAULT 'pending_approval'
                      CHECK (status IN ('pending_approval','open','partial','closed','rejected')),
  payment_mode      TEXT CHECK (payment_mode IN ('Cash','UPI','Account Transfer')),
  approved_by       UUID REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  rejected_by       UUID REFERENCES users(id),
  rejected_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  closed_at         TIMESTAMPTZ,
  balance_amount    DECIMAL(15,2)
);

CREATE INDEX IF NOT EXISTS idx_suspense_vouchers_company   ON suspense_vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_suspense_vouchers_staff     ON suspense_vouchers(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_suspense_vouchers_status    ON suspense_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_suspense_vouchers_created_by ON suspense_vouchers(created_by);

-- ─── 3. suspense_settlements table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suspense_settlements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suspense_id       UUID NOT NULL REFERENCES suspense_vouchers(id) ON DELETE CASCADE,
  company_id        TEXT NOT NULL REFERENCES companies(id),
  entry_type        TEXT NOT NULL CHECK (entry_type IN ('expense','refund','topup')),
  amount            DECIMAL(15,2) NOT NULL,
  description       TEXT NOT NULL,
  head_of_account   TEXT,
  reference_number  TEXT,
  submitted_by      UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_suspense ON suspense_settlements(suspense_id);
CREATE INDEX IF NOT EXISTS idx_settlements_company  ON suspense_settlements(company_id);

-- ─── 4. voucher_attachments table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voucher_attachments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      TEXT NOT NULL REFERENCES companies(id),
  voucher_id      UUID,           -- NULL when attached to suspense
  voucher_type    TEXT NOT NULL DEFAULT 'regular'
                    CHECK (voucher_type IN ('regular','suspense','settlement')),
  suspense_id     UUID REFERENCES suspense_vouchers(id) ON DELETE CASCADE,
  settlement_id   UUID REFERENCES suspense_settlements(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  public_url      TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  file_size_bytes INTEGER,
  capture_session_id UUID,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_voucher    ON voucher_attachments(voucher_id);
CREATE INDEX IF NOT EXISTS idx_attachments_suspense   ON voucher_attachments(suspense_id);
CREATE INDEX IF NOT EXISTS idx_attachments_settlement ON voucher_attachments(settlement_id);
CREATE INDEX IF NOT EXISTS idx_attachments_company    ON voucher_attachments(company_id);
CREATE INDEX IF NOT EXISTS idx_attachments_session    ON voucher_attachments(capture_session_id);

-- ─── 5. capture_sessions table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capture_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      TEXT NOT NULL REFERENCES companies(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  voucher_id      UUID,           -- linked regular voucher (if any)
  suspense_id     UUID REFERENCES suspense_vouchers(id) ON DELETE CASCADE,
  settlement_id   UUID REFERENCES suspense_settlements(id) ON DELETE CASCADE,
  context_type    TEXT NOT NULL DEFAULT 'regular'
                    CHECK (context_type IN ('regular','suspense','settlement')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','used','expired')),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  used_at         TIMESTAMPTZ,
  attachment_id   UUID REFERENCES voucher_attachments(id)
);

CREATE INDEX IF NOT EXISTS idx_capture_sessions_created ON capture_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_status  ON capture_sessions(status);

-- ─── 6. RLS Policies (all data goes through service-role server so use USING(true)) ──
ALTER TABLE suspense_vouchers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspense_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_sessions     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service role" ON suspense_vouchers;
DROP POLICY IF EXISTS "Allow all for service role" ON suspense_settlements;
DROP POLICY IF EXISTS "Allow all for service role" ON voucher_attachments;
DROP POLICY IF EXISTS "Allow all for service role" ON capture_sessions;

CREATE POLICY "Allow all for service role" ON suspense_vouchers    FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON suspense_settlements FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON voucher_attachments  FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON capture_sessions     FOR ALL USING (true);

-- ─── 7. get_next_suspense_number RPC ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_next_suspense_number(p_company_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_series      RECORD;
  v_next_number INTEGER;
  v_serial      TEXT;
BEGIN
  SELECT * INTO v_series FROM voucher_series WHERE company_id = p_company_id FOR UPDATE;

  v_next_number := COALESCE(v_series.suspense_current_number, 0) + 1;

  UPDATE voucher_series
    SET suspense_current_number = v_next_number
  WHERE company_id = p_company_id;

  v_serial := 'SUS-' || COALESCE(v_series.financial_year, '2025-26') || '-' || LPAD(v_next_number::TEXT, 5, '0');

  RETURN v_serial;
END;
$$ LANGUAGE plpgsql;
