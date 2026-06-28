-- Migration: Add hoa_correction_proposals table
-- Allows Auditors to propose Head of Account / Sub-Heading corrections
-- on vouchers; changes are only written to the vouchers table after
-- Admin batch-approves them.

CREATE TABLE IF NOT EXISTS public.hoa_correction_proposals (
  id               UUID NOT NULL DEFAULT uuid_generate_v4(),
  company_id       TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  voucher_id       UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  proposed_by      UUID NOT NULL REFERENCES public.users(id),

  -- Snapshot of current values at the time the proposal was made (immutable audit trail)
  current_hoa      TEXT NOT NULL,
  current_sub_hoa  TEXT,

  -- Proposed new values (NULL = "leave unchanged")
  proposed_hoa     TEXT,
  proposed_sub_hoa TEXT,

  -- Reason is mandatory
  reason           TEXT NOT NULL,

  -- Workflow state
  status           TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by      UUID REFERENCES public.users(id),
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT hoa_correction_proposals_pkey PRIMARY KEY (id),
  -- At most one pending proposal per voucher at a time
  CONSTRAINT hoa_correction_proposals_one_pending
    EXCLUDE USING btree (voucher_id WITH =) WHERE (status = 'pending')
);

CREATE INDEX IF NOT EXISTS idx_hoa_corrections_company_status
  ON public.hoa_correction_proposals (company_id, status);

CREATE INDEX IF NOT EXISTS idx_hoa_corrections_voucher
  ON public.hoa_correction_proposals (voucher_id);

-- RLS
ALTER TABLE public.hoa_correction_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view HOA corrections for their company"
  ON public.hoa_correction_proposals FOR SELECT
  USING (true);

CREATE POLICY "All authenticated users can insert HOA corrections"
  ON public.hoa_correction_proposals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update HOA corrections"
  ON public.hoa_correction_proposals FOR UPDATE
  USING (true);
