-- Relish Payment Approval System - Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    gst TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id TEXT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    aadhar TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('accounts', 'admin')),
    mobile_verified BOOLEAN DEFAULT FALSE,
    username TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Payees Table
CREATE TABLE IF NOT EXISTS payees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id TEXT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    alias TEXT,
    mobile TEXT NOT NULL,
    bank_account TEXT,
    ifsc TEXT,
    upi_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voucher Series Table
CREATE TABLE IF NOT EXISTS voucher_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id TEXT UNIQUE NOT NULL REFERENCES companies(id),
    current_number INTEGER DEFAULT 0,
    prefix TEXT DEFAULT 'VCH',
    financial_year TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vouchers Table
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id TEXT NOT NULL REFERENCES companies(id),
    serial_number TEXT NOT NULL,
    head_of_account TEXT NOT NULL,
    narration TEXT,
    amount DECIMAL(15,2) NOT NULL,
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('UPI', 'Account Transfer', 'Cash')),
    payee_id UUID NOT NULL REFERENCES payees(id),
    prepared_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'awaiting_payee_otp', 'completed', 'rejected')),
    payee_otp_verified BOOLEAN DEFAULT FALSE,
    payee_signature TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT FALSE,
    voucher_id UUID REFERENCES vouchers(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Companies
INSERT INTO companies (id, name, address, gst) VALUES 
('relish-foods', 'Relish Foods Pvt Ltd', '17/9B, Madhavapuram, Kanyakumari 629704. TN. India', '33AAACR7749E2ZD'),
('relish-hhc', 'Relish Hao Hao Chi Foods', '26/599, M.O.Ward, Alappuzha 688001. KL. India', '32AAUFR0742E1ZB')
ON CONFLICT (id) DO UPDATE SET address = EXCLUDED.address, gst = EXCLUDED.gst;

-- Initialize Voucher Series for Companies
INSERT INTO voucher_series (company_id, current_number, prefix, financial_year) VALUES 
('relish-foods', 0, 'VCH', '2024-25'),
('relish-hhc', 0, 'VCH', '2024-25')
ON CONFLICT (company_id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_vouchers_company ON vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_prepared_by ON vouchers(prepared_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Enable Row Level Security (RLS)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (since we're using service role key on server)
-- For a production app, you'd want more restrictive policies

CREATE POLICY "Allow all operations for service role" ON companies FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON payees FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON voucher_series FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON vouchers FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON notifications FOR ALL USING (true);

-- Function to get next voucher number
CREATE OR REPLACE FUNCTION get_next_voucher_number(p_company_id TEXT)
RETURNS TEXT AS $$
DECLARE
    v_series RECORD;
    v_next_number INTEGER;
    v_serial TEXT;
BEGIN
    -- Get and lock the series row
    SELECT * INTO v_series FROM voucher_series WHERE company_id = p_company_id FOR UPDATE;
    
    -- Increment the number
    v_next_number := v_series.current_number + 1;
    
    -- Update the series
    UPDATE voucher_series SET current_number = v_next_number WHERE company_id = p_company_id;
    
    -- Format the serial number
    v_serial := v_series.prefix || '-' || v_series.financial_year || '-' || LPAD(v_next_number::TEXT, 5, '0');
    
    RETURN v_serial;
END;
$$ LANGUAGE plpgsql;
