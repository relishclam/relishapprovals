-- Migration 018: Allow 'pending_approval' status on suspense_settlements
-- Top-up entries are inserted as 'pending_approval' and require Admin/Super Admin
-- sign-off before funds are credited to the staff member's balance.

ALTER TABLE suspense_settlements
  DROP CONSTRAINT IF EXISTS suspense_settlements_status_check;

ALTER TABLE suspense_settlements
  ADD CONSTRAINT suspense_settlements_status_check
    CHECK (status IN ('pending_review', 'pending_approval', 'approved', 'rejected'));
