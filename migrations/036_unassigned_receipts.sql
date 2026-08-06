-- Migration 036: Unassigned receipts — review queue for auto-match failures.
--
-- Populated by POST /api/receipts/auto-complete when the share-target receipt
-- cannot be deterministically matched to a voucher (no reference, ambiguous
-- amount, amount mismatch, etc.).  Accounts reviews and assigns manually.

CREATE TABLE IF NOT EXISTS unassigned_receipts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     TEXT NOT NULL REFERENCES companies(id),
  storage_path   TEXT NOT NULL,     -- path in voucher-bills bucket (unassigned-receipts/)
  file_url       TEXT NOT NULL,     -- public URL for preview
  mime_type      TEXT NOT NULL,
  extracted_data JSONB,             -- full structured OCR output for pre-fill
  match_reason   TEXT,              -- why auto-match failed
  status         TEXT NOT NULL DEFAULT 'pending_review'
                 CHECK (status IN ('pending_review', 'assigned', 'dismissed')),
  assigned_to    UUID REFERENCES vouchers(id),
  assigned_by    UUID REFERENCES users(id),
  assigned_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Review-queue UI queries status = 'pending_review' per company constantly
CREATE INDEX IF NOT EXISTS idx_unassigned_receipts_company_status
  ON unassigned_receipts (company_id, status);

ALTER TABLE unassigned_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role"
  ON unassigned_receipts FOR ALL USING (true);
