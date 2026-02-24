-- Migration 010: Add is_super_admin flag to users table
-- Super Admin (Approve-Motty) can manage users; regular Approvers cannot.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Set Approve-Motty as the Super Admin
UPDATE public.users
  SET is_super_admin = TRUE
  WHERE username = 'Approve-Motty';
