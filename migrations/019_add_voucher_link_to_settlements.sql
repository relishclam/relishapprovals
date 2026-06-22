-- Migration 019: Add voucher_id back-link to suspense_settlements
-- When multiple expense entries are combined into one payment voucher,
-- each participating settlement row records the voucher it was rolled into.
-- This enables full traceability: voucher → settlements and settlement → voucher.

ALTER TABLE suspense_settlements
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_settlements_voucher ON suspense_settlements(voucher_id);
