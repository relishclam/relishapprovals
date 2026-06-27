-- Company Payment Accounts: managed list of accounts payment can be sent from
-- (company bank accounts, director/partner personal accounts, etc.)
CREATE TABLE IF NOT EXISTS company_payment_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL REFERENCES companies(id),
  label TEXT NOT NULL,        -- e.g. "HDFC Current A/C", "Director Ramesh Personal A/C"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_payment_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for service role" ON company_payment_accounts FOR ALL USING (true);
