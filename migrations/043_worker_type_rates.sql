-- Differential daily rates per worker skill type within a category
-- Rate belongs to (category × worker_type), not to a supervisor

CREATE TABLE IF NOT EXISTS construction_worker_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES construction_categories(id),
  worker_type   TEXT NOT NULL,                         -- e.g. 'Mason', 'Helper', 'Lead'
  proposed_rate NUMERIC(10,2),
  approved_rate NUMERIC(10,2),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  proposed_by   UUID REFERENCES public.users(id),
  approved_by   UUID REFERENCES public.users(id),
  proposed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at   TIMESTAMPTZ,
  notes         TEXT,
  UNIQUE(category_id, worker_type)
);

-- Tag each worker with their skill type
ALTER TABLE construction_workers
  ADD COLUMN IF NOT EXISTS worker_type TEXT NOT NULL DEFAULT 'Helper';

-- Rebuild dues view: uses per-worker-type rate; falls back to supervisor rate if not set
DROP VIEW IF EXISTS v_unpaid_attendance;
CREATE OR REPLACE VIEW v_unpaid_attendance AS
SELECT
  cs.id               AS category_supervisor_id,
  cs.supervisor_id,
  cs.category_id,
  s.name              AS supervisor_name,
  s.mobile,
  s.upi_id,
  cs.approved_rate,                                    -- kept for legacy fallback only
  SUM(a.attendance_value)                                                     AS total_days,
  SUM(a.attendance_value * COALESCE(wr.approved_rate, cs.approved_rate))      AS total_dues,
  MIN(a.attendance_date)                                                       AS earliest_date,
  MAX(a.attendance_date)                                                       AS latest_date
FROM construction_attendance a
JOIN construction_category_supervisors cs
  ON cs.category_id = a.category_id AND cs.supervisor_id = a.supervisor_id
JOIN construction_supervisors s ON s.id = a.supervisor_id
LEFT JOIN construction_workers w  ON w.id = a.worker_id
LEFT JOIN construction_worker_rates wr
  ON wr.category_id = a.category_id AND wr.worker_type = w.worker_type
WHERE a.voucher_id IS NULL
GROUP BY cs.id, cs.supervisor_id, cs.category_id,
         s.name, s.mobile, s.upi_id, cs.approved_rate;
