-- Migration 009: Copy Heads of Account + Sub-Heads from Relish Hao Hao Chi Foods to Relish Foods Pvt Ltd
-- AND fix the global system so Sub-Heads accompany global Heads of Account
--
-- Problem: When a Head of Account was made global, only the head was visible in other companies.
--          The Sub-Heads under it did NOT appear, making the global head unusable for voucher creation.
--
-- Steps:
-- 1. Delete ALL Heads of Account (and cascading Sub-Heads) from Relish Foods Pvt Ltd
-- 2. Copy ALL Heads of Account from Relish Hao Hao Chi Foods → Relish Foods Pvt Ltd
-- 3. Copy ALL Sub-Heads from Relish Hao Hao Chi Foods → Relish Foods Pvt Ltd (linked to the new heads)

-- ===========================================================
-- STEP 1: Remove all Heads of Account from Relish Foods Pvt Ltd
-- (Sub-heads will be deleted automatically via ON DELETE CASCADE)
-- ===========================================================
DELETE FROM heads_of_account
WHERE company_id = (
  SELECT id FROM companies WHERE name ILIKE '%Relish Foods Pvt%' LIMIT 1
);

-- ===========================================================
-- STEP 2: Copy Heads of Account from Relish Hao Hao Chi Foods
--         to Relish Foods Pvt Ltd
-- ===========================================================
INSERT INTO heads_of_account (company_id, name, is_global)
SELECT 
  (SELECT id FROM companies WHERE name ILIKE '%Relish Foods Pvt%' LIMIT 1) AS company_id,
  h.name,
  h.is_global
FROM heads_of_account h
WHERE h.company_id = (
  SELECT id FROM companies WHERE name ILIKE '%Hao Hao Chi%' LIMIT 1
)
ON CONFLICT (company_id, name) DO NOTHING;

-- ===========================================================
-- STEP 3: Copy Sub-Heads from Relish Hao Hao Chi Foods
--         to Relish Foods Pvt Ltd, linking to the newly created heads
-- ===========================================================
INSERT INTO sub_heads_of_account (head_id, company_id, name)
SELECT 
  new_head.id AS head_id,
  new_head.company_id,
  old_sub.name
FROM sub_heads_of_account old_sub
JOIN heads_of_account old_head ON old_sub.head_id = old_head.id
JOIN heads_of_account new_head ON new_head.name = old_head.name
WHERE old_head.company_id = (
  SELECT id FROM companies WHERE name ILIKE '%Hao Hao Chi%' LIMIT 1
)
AND new_head.company_id = (
  SELECT id FROM companies WHERE name ILIKE '%Relish Foods Pvt%' LIMIT 1
)
ON CONFLICT (head_id, name) DO NOTHING;

-- ===========================================================
-- VERIFICATION: Check the results
-- ===========================================================
-- Run these after the migration to verify:
-- SELECT h.name, h.is_global, c.name as company 
-- FROM heads_of_account h JOIN companies c ON h.company_id = c.id 
-- ORDER BY c.name, h.name;
--
-- SELECT h.name as head, sh.name as sub_head, c.name as company
-- FROM sub_heads_of_account sh 
-- JOIN heads_of_account h ON sh.head_id = h.id
-- JOIN companies c ON sh.company_id = c.id
-- ORDER BY c.name, h.name, sh.name;
