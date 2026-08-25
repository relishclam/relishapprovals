-- Per-attendance-day worker_type so each day the supervisor can work as a different role.
-- Also accepts an attendanceDate override so past-date marking is possible.

ALTER TABLE construction_attendance
  ADD COLUMN IF NOT EXISTS worker_type TEXT;

-- Rebuild view: use per-day worker_type override first, then worker's default, then NULL.
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
  SUM(a.attendance_value)                                                                    AS total_days,
  SUM(a.attendance_value * COALESCE(wr.approved_rate, cs.approved_rate))                    AS total_dues,
  MIN(a.attendance_date)                                                                     AS earliest_date,
  MAX(a.attendance_date)                                                                     AS latest_date
FROM construction_attendance a
JOIN construction_category_supervisors cs
  ON cs.category_id = a.category_id AND cs.supervisor_id = a.supervisor_id
JOIN construction_supervisors s ON s.id = a.supervisor_id
LEFT JOIN construction_workers w ON w.id = a.worker_id
LEFT JOIN construction_worker_rates wr
  ON wr.category_id  = a.category_id
 AND wr.worker_type  = COALESCE(a.worker_type, w.worker_type)
 AND wr.approved_rate IS NOT NULL
WHERE a.voucher_id IS NULL
GROUP BY cs.id, cs.supervisor_id, cs.category_id,
         s.name, s.mobile, s.upi_id, cs.approved_rate;
