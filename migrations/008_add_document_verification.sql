-- Migration: Add document-based verification for payments without OTP
-- For payments to random/unregistered establishments where OTP verification isn't possible

-- Add verification_type to track how voucher was verified
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS verification_type TEXT DEFAULT 'otp' 
    CHECK(verification_type IN ('otp', 'document'));

-- Add document storage fields
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS document_uploaded_at TIMESTAMPTZ;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS document_uploaded_by UUID REFERENCES users(id);

-- Add approver attestation fields
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS attested_by UUID REFERENCES users(id);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS attested_at TIMESTAMPTZ;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS attestation_notes TEXT;

-- Add payee type to distinguish registered vs ad-hoc payees
ALTER TABLE payees ADD COLUMN IF NOT EXISTS payee_type TEXT DEFAULT 'registered' 
    CHECK(payee_type IN ('registered', 'adhoc'));

-- Add a flag to indicate if payee requires OTP verification
ALTER TABLE payees ADD COLUMN IF NOT EXISTS requires_otp BOOLEAN DEFAULT TRUE;

-- Update status check constraint to include awaiting_document
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_status_check;
ALTER TABLE vouchers ADD CONSTRAINT vouchers_status_check 
    CHECK(status IN ('draft', 'pending', 'approved', 'awaiting_payee_otp', 'awaiting_document', 'completed', 'rejected'));

-- Comments for documentation
COMMENT ON COLUMN vouchers.verification_type IS 'Type of verification: otp (mobile OTP) or document (invoice/receipt upload)';
COMMENT ON COLUMN vouchers.document_url IS 'URL to uploaded invoice/receipt in Supabase Storage';
COMMENT ON COLUMN vouchers.attested_by IS 'User ID of approver who attested the document';
COMMENT ON COLUMN vouchers.attestation_notes IS 'Notes from approver regarding document verification';
COMMENT ON COLUMN payees.payee_type IS 'registered = known vendor with verified mobile, adhoc = one-time/random establishment';
COMMENT ON COLUMN payees.requires_otp IS 'Whether this payee requires OTP verification (false for adhoc payees)';

-- Create storage bucket for voucher documents (run this in Supabase Dashboard > Storage)
-- Bucket name: voucher-documents
-- Public: false (private bucket)
-- Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf
