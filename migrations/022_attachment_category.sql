-- Migration 022: Attachment category for suspense-level uploads
-- When Accounts uploads a file directly to a suspense voucher (not to a specific
-- settlement entry), they must declare whether it is a Transfer Receipt (bank/UPI
-- proof that funds were sent to the staff member) or an Expense Bill (an invoice
-- uploaded on behalf of the staff member).
--
-- Only Transfer Receipts are automatically copied to final payment vouchers.
-- Expense Bills uploaded on behalf of staff stay on the suspense voucher and are
-- referenced during the individual entry review.

-- 1. voucher_attachments: track what type of document was uploaded
ALTER TABLE voucher_attachments
  ADD COLUMN IF NOT EXISTS attachment_category TEXT
    CHECK (attachment_category IN ('transfer_receipt', 'expense_bill'));

-- 2. capture_sessions: carry the category through QR-relay uploads
ALTER TABLE capture_sessions
  ADD COLUMN IF NOT EXISTS attachment_category TEXT
    CHECK (attachment_category IN ('transfer_receipt', 'expense_bill'));
