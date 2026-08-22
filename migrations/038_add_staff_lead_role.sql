-- Add staff_lead to the users.role check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('accounts', 'admin', 'approver', 'auditor', 'staff', 'staff_lead', 'super_admin'));
