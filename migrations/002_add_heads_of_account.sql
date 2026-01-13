-- Migration: Add heads_of_account table
-- Run this in Supabase SQL Editor

-- Create heads_of_account table
CREATE TABLE IF NOT EXISTS public.heads_of_account (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT heads_of_account_pkey PRIMARY KEY (id),
  CONSTRAINT heads_of_account_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT heads_of_account_unique UNIQUE (company_id, name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_heads_of_account_company_id ON public.heads_of_account(company_id);

-- Enable RLS
ALTER TABLE public.heads_of_account ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view heads of account for their company"
  ON public.heads_of_account FOR SELECT
  USING (true);

CREATE POLICY "Users can insert heads of account for their company"
  ON public.heads_of_account FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete heads of account for their company"
  ON public.heads_of_account FOR DELETE
  USING (true);

-- Insert default heads of account for existing companies
INSERT INTO public.heads_of_account (company_id, name)
SELECT c.id, unnest(ARRAY[
  'Salaries & Wages',
  'Rent',
  'Utilities - Electricity',
  'Utilities - Water',
  'Raw Materials',
  'Packaging Materials',
  'Transportation & Freight',
  'Maintenance & Repairs',
  'Professional Fees',
  'Marketing & Advertising',
  'Office Supplies',
  'Insurance',
  'Taxes & Duties',
  'Bank Charges',
  'Interest Expenses',
  'Miscellaneous Expenses',
  'Capital Expenditure',
  'Petty Cash'
])
FROM public.companies c
ON CONFLICT (company_id, name) DO NOTHING;
