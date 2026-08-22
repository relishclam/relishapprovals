-- Full Construction Labour Attendance schema
-- Safe to re-run: uses IF NOT EXISTS throughout

-- Drop view first so we can freely alter its dependent tables
DROP VIEW IF EXISTS v_unpaid_attendance;

-- Categories (Civil, Electrical, etc.)
CREATE TABLE IF NOT EXISTS construction_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pre-seed standard categories
INSERT INTO construction_categories (name) VALUES
  ('Civil'), ('Electrical'), ('Plumbing'), ('Mechanical'), ('IT / Security')
ON CONFLICT (name) DO NOTHING;

-- Supervisors / gang leaders (payees)
CREATE TABLE IF NOT EXISTS construction_supervisors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  mobile      TEXT NOT NULL,
  upi_id      TEXT NOT NULL,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Category ↔ Supervisor assignments (with approved rate)
CREATE TABLE IF NOT EXISTS construction_category_supervisors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID NOT NULL REFERENCES construction_categories(id),
  supervisor_id    UUID NOT NULL REFERENCES construction_supervisors(id),
  approved_rate    NUMERIC(10,2),
  rate_approved_at TIMESTAMPTZ,
  rate_approved_by UUID REFERENCES auth.users(id),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, supervisor_id)
);

-- Workers: individual labourers under a supervisor+category
CREATE TABLE IF NOT EXISTS construction_workers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  mobile                  TEXT,
  category_supervisor_id  UUID NOT NULL REFERENCES construction_category_supervisors(id) ON DELETE CASCADE,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  notes                   TEXT,
  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily attendance (per worker)
CREATE TABLE IF NOT EXISTS construction_attendance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id      UUID NOT NULL REFERENCES construction_categories(id),
  supervisor_id    UUID NOT NULL REFERENCES construction_supervisors(id),
  worker_id        UUID NOT NULL REFERENCES construction_workers(id),
  attendance_value NUMERIC(3,2) NOT NULL CHECK (attendance_value IN (0.25, 0.50, 0.75, 1.00)),
  marked_by        UUID REFERENCES auth.users(id),
  last_edited_by   UUID REFERENCES auth.users(id),
  last_edited_at   TIMESTAMPTZ,
  marked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes            TEXT,
  voucher_id       UUID,
  UNIQUE (attendance_date, category_id, supervisor_id, worker_id)
);

-- Payment vouchers
CREATE SEQUENCE IF NOT EXISTS construction_voucher_seq;

CREATE TABLE IF NOT EXISTS construction_vouchers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number TEXT UNIQUE,
  category_id    UUID NOT NULL REFERENCES construction_categories(id),
  period_from    DATE NOT NULL,
  period_to      DATE NOT NULL,
  total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','approved','paid','rejected')),
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-number vouchers: CLABV-YYYYMM-NNNN
CREATE OR REPLACE FUNCTION set_construction_voucher_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.voucher_number IS NULL THEN
    NEW.voucher_number :=
      'CLABV-' || TO_CHAR(now(), 'YYYYMM') || '-' ||
      LPAD(nextval('construction_voucher_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS construction_voucher_number_trigger ON construction_vouchers;
CREATE TRIGGER construction_voucher_number_trigger
  BEFORE INSERT ON construction_vouchers
  FOR EACH ROW EXECUTE FUNCTION set_construction_voucher_number();

-- FK from attendance to voucher (added after vouchers table exists)
ALTER TABLE construction_attendance
  DROP CONSTRAINT IF EXISTS construction_attendance_voucher_fk;
ALTER TABLE construction_attendance
  ADD CONSTRAINT construction_attendance_voucher_fk
  FOREIGN KEY (voucher_id) REFERENCES construction_vouchers(id);

-- Voucher lines (one per supervisor: sum of all their workers' days × rate)
CREATE TABLE IF NOT EXISTS construction_voucher_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id      UUID NOT NULL REFERENCES construction_vouchers(id) ON DELETE CASCADE,
  supervisor_id   UUID NOT NULL REFERENCES construction_supervisors(id),
  days_count      NUMERIC(8,2) NOT NULL,
  rate_applied    NUMERIC(10,2) NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  upi_id_snapshot TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate change proposals
CREATE TABLE IF NOT EXISTS construction_rate_proposals (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_supervisor_id  UUID NOT NULL REFERENCES construction_category_supervisors(id),
  proposed_rate           NUMERIC(10,2) NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected')),
  proposed_by             UUID REFERENCES auth.users(id),
  proposed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by             UUID REFERENCES auth.users(id),
  reviewed_at             TIMESTAMPTZ,
  effective_from          TIMESTAMPTZ
);

-- View: unpaid dues per supervisor (sums all worker-days)
CREATE OR REPLACE VIEW v_unpaid_attendance AS
SELECT
  cs.id               AS category_supervisor_id,
  cs.supervisor_id,
  cs.category_id,
  s.name              AS supervisor_name,
  s.mobile,
  s.upi_id,
  cs.approved_rate,
  SUM(a.attendance_value)                         AS total_days,
  SUM(a.attendance_value) * cs.approved_rate      AS total_dues,
  MIN(a.attendance_date)                          AS earliest_date,
  MAX(a.attendance_date)                          AS latest_date
FROM construction_attendance a
JOIN construction_category_supervisors cs
  ON cs.category_id = a.category_id AND cs.supervisor_id = a.supervisor_id
JOIN construction_supervisors s ON s.id = a.supervisor_id
WHERE a.voucher_id IS NULL
GROUP BY cs.id, cs.supervisor_id, cs.category_id,
         s.name, s.mobile, s.upi_id, cs.approved_rate;
