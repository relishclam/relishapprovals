-- Migration 029: Payment Tracking for Suspense Top-Ups
-- Every approved top-up is an outward payment to the staff payee and must be
-- reconciled with a UTR reference and/or receipt — the same way regular vouchers are.

ALTER TABLE suspense_settlements
  ADD COLUMN IF NOT EXISTS payment_status   TEXT
    CHECK (payment_status IN ('paid')),          -- NULL = not yet paid; 'paid' = confirmed
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_notes    TEXT,
  ADD COLUMN IF NOT EXISTS paid_by          UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS paid_at          TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_settlements_payment_status
  ON suspense_settlements(payment_status)
  WHERE payment_status IS NOT NULL;
