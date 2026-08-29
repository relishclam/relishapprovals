-- Add bank_account_number to company_payment_accounts so receipts can be
-- auto-routed to the correct company's review queue based on the sender account
-- shown on the OCR-extracted receipt (initiator_account_number).
ALTER TABLE company_payment_accounts
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
