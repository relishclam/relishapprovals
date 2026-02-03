-- Migration: Add is_global flag to payees and heads_of_account
-- This allows payees and heads of account to be shared across all companies

-- Add is_global column to payees table
ALTER TABLE payees ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;

-- Add is_global column to heads_of_account table
ALTER TABLE heads_of_account ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;

-- Add is_global column to sub_heads_of_account table (if it exists)
ALTER TABLE sub_heads_of_account ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;

-- Create indexes for faster lookups on global items
CREATE INDEX IF NOT EXISTS idx_payees_is_global ON payees(is_global) WHERE is_global = TRUE;
CREATE INDEX IF NOT EXISTS idx_heads_of_account_is_global ON heads_of_account(is_global) WHERE is_global = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN payees.is_global IS 'If TRUE, this payee is available to all companies';
COMMENT ON COLUMN heads_of_account.is_global IS 'If TRUE, this head of account is available to all companies';
