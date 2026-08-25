-- rate_applied can now be NULL when per-worker-type rates are used (no single supervisor rate).
-- The effective avg rate is stored by the server; NULL means rates were per worker type.
ALTER TABLE construction_voucher_lines
  ALTER COLUMN rate_applied DROP NOT NULL;
