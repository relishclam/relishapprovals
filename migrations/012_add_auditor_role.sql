-- Migration 012: Add 'auditor' to role check constraint
-- Run this in Supabase SQL Editor

-- Drop the existing inline check constraint (named by Postgres as users_role_check)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Recreate with 'auditor' included
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('accounts', 'admin', 'auditor'));
