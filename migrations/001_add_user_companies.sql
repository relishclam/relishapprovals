-- Migration: Add user_companies table for multi-company access
-- Run this in Supabase SQL Editor

-- Create the user_companies junction table
CREATE TABLE IF NOT EXISTS user_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(id),
    role TEXT NOT NULL CHECK(role IN ('accounts', 'admin')),
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);

-- Enable RLS
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations for service role" ON user_companies FOR ALL USING (true);

-- Migrate existing users to user_companies table
-- This copies each user's current company_id and role to the new junction table
INSERT INTO user_companies (user_id, company_id, role, is_primary)
SELECT id, company_id, role, TRUE
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_companies uc WHERE uc.user_id = users.id AND uc.company_id = users.company_id
);

-- Verify migration
SELECT u.name, u.username, uc.company_id, uc.role, uc.is_primary 
FROM users u 
JOIN user_companies uc ON u.id = uc.user_id;
