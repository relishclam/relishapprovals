-- Migration 027: Add payment receipt URL column
-- Stores the uploaded screenshot / PDF of the payment confirmation

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;

COMMENT ON COLUMN vouchers.payment_receipt_url IS 'URL of the uploaded payment receipt / screenshot stored in Supabase Storage';
