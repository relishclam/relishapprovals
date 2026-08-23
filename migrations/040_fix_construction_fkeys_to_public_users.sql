-- Fix construction tables: all audit columns were referencing auth.users(id)
-- but this app uses public.users(id). Drop and re-add each FK.

-- construction_supervisors.created_by
ALTER TABLE construction_supervisors
  DROP CONSTRAINT IF EXISTS construction_supervisors_created_by_fkey;
ALTER TABLE construction_supervisors
  ADD CONSTRAINT construction_supervisors_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id);

-- construction_category_supervisors.created_by
ALTER TABLE construction_category_supervisors
  DROP CONSTRAINT IF EXISTS construction_category_supervisors_created_by_fkey;
ALTER TABLE construction_category_supervisors
  ADD CONSTRAINT construction_category_supervisors_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id);

-- construction_category_supervisors.rate_approved_by
ALTER TABLE construction_category_supervisors
  DROP CONSTRAINT IF EXISTS construction_category_supervisors_rate_approved_by_fkey;
ALTER TABLE construction_category_supervisors
  ADD CONSTRAINT construction_category_supervisors_rate_approved_by_fkey
  FOREIGN KEY (rate_approved_by) REFERENCES public.users(id);

-- construction_workers.created_by
ALTER TABLE construction_workers
  DROP CONSTRAINT IF EXISTS construction_workers_created_by_fkey;
ALTER TABLE construction_workers
  ADD CONSTRAINT construction_workers_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id);

-- construction_attendance.marked_by
ALTER TABLE construction_attendance
  DROP CONSTRAINT IF EXISTS construction_attendance_marked_by_fkey;
ALTER TABLE construction_attendance
  ADD CONSTRAINT construction_attendance_marked_by_fkey
  FOREIGN KEY (marked_by) REFERENCES public.users(id);

-- construction_attendance.last_edited_by
ALTER TABLE construction_attendance
  DROP CONSTRAINT IF EXISTS construction_attendance_last_edited_by_fkey;
ALTER TABLE construction_attendance
  ADD CONSTRAINT construction_attendance_last_edited_by_fkey
  FOREIGN KEY (last_edited_by) REFERENCES public.users(id);

-- construction_vouchers.created_by
ALTER TABLE construction_vouchers
  DROP CONSTRAINT IF EXISTS construction_vouchers_created_by_fkey;
ALTER TABLE construction_vouchers
  ADD CONSTRAINT construction_vouchers_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id);

-- construction_rate_proposals.proposed_by
ALTER TABLE construction_rate_proposals
  DROP CONSTRAINT IF EXISTS construction_rate_proposals_proposed_by_fkey;
ALTER TABLE construction_rate_proposals
  ADD CONSTRAINT construction_rate_proposals_proposed_by_fkey
  FOREIGN KEY (proposed_by) REFERENCES public.users(id);

-- construction_rate_proposals.reviewed_by
ALTER TABLE construction_rate_proposals
  DROP CONSTRAINT IF EXISTS construction_rate_proposals_reviewed_by_fkey;
ALTER TABLE construction_rate_proposals
  ADD CONSTRAINT construction_rate_proposals_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.users(id);
