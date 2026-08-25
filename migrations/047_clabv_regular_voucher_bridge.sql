-- Bridge CLABV into the regular payment flow.
-- 1. CLABV voucher links to a regular vouchers entry for payment.
-- 2. CLABV lines gain worker-level detail (individual worker name + type).
-- 3. notes column on CLABV for settle-outside etc.

ALTER TABLE construction_vouchers
  ADD COLUMN IF NOT EXISTS regular_voucher_id UUID REFERENCES vouchers(id),
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE construction_voucher_lines
  ADD COLUMN IF NOT EXISTS worker_id   UUID REFERENCES construction_workers(id),
  ADD COLUMN IF NOT EXISTS worker_name TEXT;
