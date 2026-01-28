-- Migration: Add sub_heads_of_account table
-- Run this in Supabase SQL Editor

-- Create sub_heads_of_account table
CREATE TABLE IF NOT EXISTS public.sub_heads_of_account (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  head_id uuid NOT NULL,
  company_id text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sub_heads_of_account_pkey PRIMARY KEY (id),
  CONSTRAINT sub_heads_of_account_head_id_fkey FOREIGN KEY (head_id) REFERENCES public.heads_of_account(id) ON DELETE CASCADE,
  CONSTRAINT sub_heads_of_account_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT sub_heads_of_account_unique UNIQUE (head_id, name)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sub_heads_head_id ON public.sub_heads_of_account(head_id);
CREATE INDEX IF NOT EXISTS idx_sub_heads_company_id ON public.sub_heads_of_account(company_id);

-- Enable RLS
ALTER TABLE public.sub_heads_of_account ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sub heads of account for their company"
  ON public.sub_heads_of_account FOR SELECT
  USING (true);

CREATE POLICY "Users can insert sub heads of account for their company"
  ON public.sub_heads_of_account FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update sub heads of account for their company"
  ON public.sub_heads_of_account FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete sub heads of account for their company"
  ON public.sub_heads_of_account FOR DELETE
  USING (true);

-- Add sub_head_of_account column to vouchers table
ALTER TABLE public.vouchers 
ADD COLUMN IF NOT EXISTS sub_head_of_account text;

-- Optional: Insert some sample sub-heads for common categories
-- You can uncomment and modify these as needed
/*
INSERT INTO public.sub_heads_of_account (head_id, company_id, name)
SELECT h.id, h.company_id, unnest(ARRAY[
  'Labour Charges - Civil Work',
  'Labour Charges - Electrical',
  'Labour Charges - Plumbing'
])
FROM public.heads_of_account h
WHERE h.name = 'Salaries & Wages'
ON CONFLICT DO NOTHING;
*/
