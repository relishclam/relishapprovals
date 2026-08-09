-- Migration 037: Record misdirected ₹216 UPI payment (9-Aug-2026)
-- ─────────────────────────────────────────────────────────────────────────────
-- Context: During a KSEB payment retry, RFPL's Federal Bank account sent ₹216
-- to Tarun Philip's personal UPI (UTR 622104000854) instead of to KSEB.
-- This suspense voucher keeps the amount visible in the books until recovered
-- or offset against a future reimbursement to Tarun Philip.
--
-- Run this once in the Supabase SQL Editor for the RFPL (relish-foods) company.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_company_id  TEXT    := 'relish-foods';
  v_payee_id    UUID;
  v_created_by  UUID;
  v_serial      TEXT;
BEGIN
  -- Locate Tarun Philip in the payees table (staff payee for relish-foods)
  SELECT id INTO v_payee_id
    FROM payees
    WHERE company_id = v_company_id
      AND name ILIKE '%Tarun%Philip%'
    LIMIT 1;

  IF v_payee_id IS NULL THEN
    RAISE NOTICE 'Tarun Philip not found in payees for %. Inserting without staff_payee_id.', v_company_id;
  END IF;

  -- Use the first accounts/admin user as the record creator
  SELECT uc.user_id INTO v_created_by
    FROM user_companies uc
    WHERE uc.company_id = v_company_id
      AND uc.role IN ('accounts', 'admin')
    ORDER BY uc.role  -- 'accounts' sorts before 'admin'
    LIMIT 1;

  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'No accounts/admin user found for company %. Cannot insert without created_by.', v_company_id;
  END IF;

  -- Allocate serial number via the existing sequence RPC
  v_serial := get_next_suspense_number(v_company_id);

  INSERT INTO suspense_vouchers (
    company_id,
    serial_number,
    staff_payee_id,
    staff_user_id,
    advance_amount,
    balance_amount,
    purpose,
    narration,
    payment_mode,
    created_by,
    status,
    created_at
  )
  SELECT
    v_company_id,
    v_serial,
    v_payee_id,                         -- NULL if payee not found
    (SELECT id FROM users WHERE name ILIKE '%Tarun%Philip%' LIMIT 1),
    216.00,
    216.00,
    '₹216 misdirected UPI payment — recovery pending',
    '₹216 credited to Tarun Philip''s personal UPI (UTR 622104000854, 9-Aug-2026) '
    'from RFPL Federal Bank account in error during KSEB payment retry. '
    'Amount to be recovered or offset against future reimbursement to Tarun Philip.',
    'UPI',
    v_created_by,
    'open',                             -- already disbursed; no approval gate needed
    '2026-08-09 00:00:00+05:30'         -- backdate to the actual transaction date
  ;

  RAISE NOTICE 'Created suspense voucher % for Tarun Philip (payee_id=%)', v_serial, v_payee_id;
END $$;
