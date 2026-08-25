-- The old unique constraint assumed one line per supervisor.
-- Per-worker lines require multiple rows with the same supervisor_id on one voucher.
ALTER TABLE construction_voucher_lines
  DROP CONSTRAINT IF EXISTS construction_voucher_lines_voucher_id_supervisor_id_key;
