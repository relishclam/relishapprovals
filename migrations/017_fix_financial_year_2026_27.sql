-- Migration 017: Fix Financial Year 2026-27
-- ============================================================
-- PROBLEM: voucher_series.financial_year was hardcoded '2025-26'.
--          Indian FY runs Apr 1 – Mar 31, so any date on or after
--          Apr 1 2026 must be FY 2026-27.
--
-- WHAT THIS MIGRATION DOES:
--   1. Rewrites get_next_voucher_number() to compute FY dynamically
--      from CURRENT_DATE so it never needs a manual update again.
--   2. Rewrites get_next_suspense_number() the same way.
--   3. Updates voucher_series.financial_year to '2026-27'.
--   4. Renames existing voucher serial numbers that were wrongly
--      stamped '2025-26' but belong to FY 2026-27 (i.e. created
--      on or after 1 Apr 2026 IST = 31 Mar 2026 18:30 UTC).
-- ============================================================

-- ─── 1. Fix get_next_voucher_number ──────────────────────────────────────────
-- Now computes the Indian Financial Year on the fly:
--   Apr–Dec  → YYYY-(YY+1)   e.g. Jun 2026 → 2026-27
--   Jan–Mar  → (YYYY-1)-YY   e.g. Feb 2027 → 2026-27
CREATE OR REPLACE FUNCTION get_next_voucher_number(p_company_id TEXT)
RETURNS TEXT AS $$
DECLARE
    v_series      RECORD;
    v_next_number INTEGER;
    v_serial      TEXT;
    v_current_fy  TEXT;
BEGIN
    -- Compute current Indian Financial Year (Apr 1 – Mar 31)
    v_current_fy := CASE
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
        THEN EXTRACT(YEAR FROM CURRENT_DATE)::TEXT
             || '-'
             || LPAD(((EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1) % 100)::TEXT, 2, '0')
        ELSE (EXTRACT(YEAR FROM CURRENT_DATE)::INT - 1)::TEXT
             || '-'
             || LPAD((EXTRACT(YEAR FROM CURRENT_DATE)::INT % 100)::TEXT, 2, '0')
    END;

    -- Get and lock the series row
    SELECT * INTO v_series FROM voucher_series WHERE company_id = p_company_id FOR UPDATE;

    -- Increment the number
    v_next_number := v_series.current_number + 1;

    -- Update series and keep financial_year in sync for reference
    UPDATE voucher_series
    SET current_number  = v_next_number,
        financial_year  = v_current_fy
    WHERE company_id = p_company_id;

    -- Format: VCH-2026-27-00532
    v_serial := v_series.prefix || '-' || v_current_fy || '-' || LPAD(v_next_number::TEXT, 5, '0');

    RETURN v_serial;
END;
$$ LANGUAGE plpgsql;

-- ─── 2. Fix get_next_suspense_number ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_next_suspense_number(p_company_id TEXT)
RETURNS TEXT AS $$
DECLARE
    v_series      RECORD;
    v_next_number INTEGER;
    v_serial      TEXT;
    v_current_fy  TEXT;
BEGIN
    -- Compute current Indian Financial Year (Apr 1 – Mar 31)
    v_current_fy := CASE
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
        THEN EXTRACT(YEAR FROM CURRENT_DATE)::TEXT
             || '-'
             || LPAD(((EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1) % 100)::TEXT, 2, '0')
        ELSE (EXTRACT(YEAR FROM CURRENT_DATE)::INT - 1)::TEXT
             || '-'
             || LPAD((EXTRACT(YEAR FROM CURRENT_DATE)::INT % 100)::TEXT, 2, '0')
    END;

    SELECT * INTO v_series FROM voucher_series WHERE company_id = p_company_id FOR UPDATE;

    v_next_number := COALESCE(v_series.suspense_current_number, 0) + 1;

    UPDATE voucher_series
    SET suspense_current_number = v_next_number,
        financial_year          = v_current_fy
    WHERE company_id = p_company_id;

    -- Format: SUS-2026-27-00001
    v_serial := 'SUS-' || v_current_fy || '-' || LPAD(v_next_number::TEXT, 5, '0');

    RETURN v_serial;
END;
$$ LANGUAGE plpgsql;

-- ─── 3. Update voucher_series to correct financial year ───────────────────────
UPDATE voucher_series
SET financial_year = '2026-27';

-- ─── 4. Fix existing voucher serial numbers (created ≥ 1 Apr 2026 IST) ───────
-- NOTE: Timestamps are stored as UTC. 1 Apr 2026 00:00 IST = 31 Mar 2026 18:30 UTC.
-- We use the IST-aware cutoff to avoid missing early-morning entries.

UPDATE vouchers
SET serial_number = REPLACE(serial_number, '2025-26', '2026-27')
WHERE serial_number LIKE '%2025-26%'
  AND created_at >= TIMESTAMPTZ '2026-03-31 18:30:00+00';

-- ─── 5. Fix existing suspense voucher serial numbers ─────────────────────────
UPDATE suspense_vouchers
SET serial_number = REPLACE(serial_number, '2025-26', '2026-27')
WHERE serial_number LIKE '%2025-26%'
  AND created_at >= TIMESTAMPTZ '2026-03-31 18:30:00+00';
