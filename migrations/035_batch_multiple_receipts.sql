-- Migration 035: Multiple Receipts per Payment Batch
-- Allows uploading more than one transaction receipt per Combine & Pay batch.
-- Scenario: Accounts creates a combined batch but later makes individual payments,
--   needing to attach each individual transaction receipt to the same batch record.
--
-- Changes:
--   1. payment_batch_receipts — stores one row per uploaded receipt (replaces the
--      single payment_batches.payment_receipt_url for the multi-receipt case).
--      The existing payment_receipt_url column on payment_batches is RETAINED for
--      backward-compatibility and set to the first/primary receipt URL.
--
--   2. batch_id column on vouchers — back-link so the frontend can identify which
--      batch paid a given voucher without an extra join query.
--
--   3. batch_mark_paid RPC updated — sets batch_id on each voucher row when marking
--      the batch as paid (mirrors the existing payment_reference / paid_at / etc.
--      update already in the function).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. payment_batch_receipts table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_batch_receipts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id          UUID NOT NULL REFERENCES payment_batches(id) ON DELETE CASCADE,
  receipt_url       TEXT NOT NULL,
  payment_reference TEXT,    -- UTR / transaction ID for THIS individual receipt (optional)
  notes             TEXT,
  uploaded_by       UUID NOT NULL REFERENCES users(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_batch_receipts_batch
  ON payment_batch_receipts (batch_id);

ALTER TABLE payment_batch_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for service role"
  ON payment_batch_receipts FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. batch_id back-link on vouchers
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES payment_batches(id);

CREATE INDEX IF NOT EXISTS idx_vouchers_batch_id
  ON vouchers (batch_id)
  WHERE batch_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. batch_mark_paid — updated to set batch_id on voucher rows
--    Replaces the function created in migration 032.
--    All logic is identical to 032 except the vouchers UPDATE now includes
--    "batch_id = p_batch_id" so the frontend can find the batch from a voucher.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION batch_mark_paid(
  p_batch_id          UUID,
  p_paid_by           UUID,
  p_payment_reference TEXT DEFAULT NULL,
  p_payment_notes     TEXT DEFAULT NULL,
  p_receipt_url       TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_batch       RECORD;
  v_now         TIMESTAMPTZ := NOW();
  v_voucher_ids UUID[];
  v_count       INTEGER;
BEGIN
  -- Lock the batch row to prevent concurrent mark-paid on the same batch
  SELECT * INTO v_batch FROM payment_batches
    WHERE id = p_batch_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment batch % not found', p_batch_id;
  END IF;

  IF v_batch.status <> 'pending' THEN
    RAISE EXCEPTION 'Batch % is already % — cannot mark paid again',
      v_batch.batch_reference, v_batch.status;
  END IF;

  -- Count all vouchers in the batch
  SELECT COUNT(*) INTO v_count
    FROM payment_batch_vouchers WHERE batch_id = p_batch_id;

  -- Collect only the vouchers that are STILL in a payable state
  SELECT ARRAY_AGG(v.id) INTO v_voucher_ids
    FROM payment_batch_vouchers bv
    JOIN vouchers v ON v.id = bv.voucher_id
    WHERE bv.batch_id = p_batch_id
      AND v.status IN ('awaiting_payment', 'completed');

  -- If any voucher is no longer payable, reject the entire batch mark-paid.
  -- Caller should cancel the batch (via cancel_payment_batch) to release
  -- the remaining vouchers if this error is unrecoverable.
  IF COALESCE(ARRAY_LENGTH(v_voucher_ids, 1), 0) <> v_count THEN
    RAISE EXCEPTION
      'One or more vouchers in batch % are no longer in a payable state (status not in awaiting_payment/completed). '
      'Use cancel_payment_batch(''%'') to release the remaining vouchers, then handle each individually.',
      v_batch.batch_reference, p_batch_id;
  END IF;

  -- Transition all vouchers to paid atomically; also stamp batch_id for easy back-lookup.
  UPDATE vouchers SET
    status              = 'paid',
    payment_reference   = p_payment_reference,
    payment_notes       = p_payment_notes,
    payment_receipt_url = p_receipt_url,
    paid_by             = p_paid_by,
    paid_at             = v_now,
    batch_id            = p_batch_id
  WHERE id = ANY(v_voucher_ids);

  -- Mark the batch itself as paid
  UPDATE payment_batches SET
    status              = 'paid',
    payment_reference   = p_payment_reference,
    payment_notes       = p_payment_notes,
    payment_receipt_url = p_receipt_url,
    paid_by             = p_paid_by,
    paid_at             = v_now
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success',         true,
    'batch_reference', v_batch.batch_reference,
    'vouchers_paid',   ARRAY_LENGTH(v_voucher_ids, 1)
  );
END;
$$ LANGUAGE plpgsql;
