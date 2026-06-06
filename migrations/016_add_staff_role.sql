-- Migration 016: Add 'staff' role to users and user_companies tables
-- Staff users are internal employees (payees) who log in to submit settlement expenses
-- Username format: Staff-{FirstName}  e.g. Staff-Manu

-- 1. Drop old check constraint on users and add new one that includes 'staff'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('accounts', 'admin', 'auditor', 'staff'));

-- 2. Drop old check constraint on user_companies and add new one that includes 'staff' and 'auditor'
ALTER TABLE user_companies DROP CONSTRAINT IF EXISTS user_companies_role_check;
ALTER TABLE user_companies ADD CONSTRAINT user_companies_role_check
  CHECK (role IN ('accounts', 'admin', 'auditor', 'staff'));
