-- Add bank_name to payees (needed for Account Transfer Pay Now copy card)
ALTER TABLE payees
  ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- Add paid_from_account to vouchers (records which company/director account payment is sent from)
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS paid_from_account TEXT;
