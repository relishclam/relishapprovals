-- Migration 016: Add 'staff' role to users table
-- Staff users are internal employees (payees) who log in to submit settlement expenses
-- Username format: Staff-{FirstName}  e.g. Staff-Manu

-- Drop old check constraint and add new one that includes 'staff'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('accounts', 'admin', 'auditor', 'staff'));
