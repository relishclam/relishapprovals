-- Link construction supervisors to the main payees table
ALTER TABLE construction_supervisors
  ADD COLUMN IF NOT EXISTS payee_id UUID REFERENCES payees(id);
