-- Rate lookup priority: exact worker_type match → 'Common' category rate → supervisor rate → NULL
-- This allows single-rate categories (e.g. Painting "Common" ₹1200) to apply to all workers
-- while multi-rate categories (e.g. Civil Mason/Helper) still use per-type rates.

DROP VIEW IF EXISTS v_unpaid_attendance;
CREATE OR REPLACE VIEW v_unpaid_attendance AS
SELECT
  cs.id               AS category_supervisor_id,
  cs.supervisor_id,
  cs.category_id,
  s.name              AS supervisor_name,
  s.mobile,
  s.upi_id,
  cs.approved_rate,
  SUM(a.attendance_value)                                                                              AS total_days,
  SUM(a.attendance_value * COALESCE(wr.approved_rate, wr_common.approved_rate, cs.approved_rate))     AS total_dues,
  MIN(a.attendance_date)                                                                               AS earliest_date,
  MAX(a.attendance_date)                                                                               AS latest_date
FROM construction_attendance a
JOIN construction_category_supervisors cs
  ON cs.category_id = a.category_id AND cs.supervisor_id = a.supervisor_id
JOIN construction_supervisors s ON s.id = a.supervisor_id
LEFT JOIN construction_workers w ON w.id = a.worker_id
-- Exact worker-type rate (e.g. Mason ₹1200 in Civil)
LEFT JOIN construction_worker_rates wr
  ON wr.category_id  = a.category_id
 AND wr.worker_type  = COALESCE(a.worker_type, w.worker_type)
 AND wr.approved_rate IS NOT NULL
-- 'Common' fallback rate — used when no specific type rate exists (e.g. Painting ₹1200)
LEFT JOIN construction_worker_rates wr_common
  ON wr_common.category_id = a.category_id
 AND wr_common.worker_type = 'Common'
 AND wr_common.approved_rate IS NOT NULL
WHERE a.voucher_id IS NULL
GROUP BY cs.id, cs.supervisor_id, cs.category_id,
         s.name, s.mobile, s.upi_id, cs.approved_rate;
