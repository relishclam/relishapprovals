# Quick Deployment Guide - Multi-Company Feature

## What Changed

Added company selection to voucher creation so users can choose between:
1. **Relish Foods Pvt Ltd** (Kanyakumari, TN) - GST: 33AAACR7749E2ZD
2. **Relish Hao Hao Chi Foods** (Alappuzha, KL) - GST: 32AAUFR0742E1ZB

## Files Modified

1. ✅ `supabase-schema.sql` - Added GST column, updated company data
2. ✅ `public/app.js` - Added company selector to voucher form
3. ✅ `server-supabase.js` - Added GST to voucher queries

## Database Migration Required

Run this in **Supabase SQL Editor**:

```sql
-- Add GST column if not exists
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gst TEXT;

-- Update company records
UPDATE companies SET 
  address = '17/9B, Madhavapuram, Kanyakumari 629704. TN. India',
  gst = '33AAACR7749E2ZD'
WHERE id = 'relish-foods';

UPDATE companies SET 
  address = '26/599, M.O.Ward, Alappuzha 688001. KL. India',
  gst = '32AAUFR0742E1ZB'
WHERE id = 'relish-hhc';

-- Make GST required (after data populated)
ALTER TABLE companies ALTER COLUMN gst SET NOT NULL;
```

## How It Works

### Before
- Users created vouchers for their company automatically
- No choice of which company

### After
1. User opens "Create Voucher" page
2. **FIRST**: Selects company from dropdown (shows name + GST)
3. Address displays below selection
4. All other fields become enabled
5. Payees filtered to selected company
6. Submit creates voucher for selected company
7. Print shows company name, address, and GST

## Testing Steps

1. **Open App** → Navigate to Create Voucher
2. **Check Dropdown** → Should show both companies with GST numbers
3. **Select Company** → Fields should enable, address should appear
4. **Check Payees** → Should load payees for selected company only
5. **Change Company** → Payee list should refresh
6. **Create Voucher** → Should show success with company name
7. **Print Voucher** → Should show company name, address, GST

## Deploy Commands

```bash
# 1. Commit changes
git add .
git commit -m "Add multi-company selection for vouchers"
git push origin main

# 2. Vercel will auto-deploy

# 3. Run SQL migration in Supabase
```

## What to Watch For

- ✅ Company dropdown appears at top of form
- ✅ Both companies show with correct GST numbers
- ✅ Fields disabled until company selected
- ✅ Payees filter by company
- ✅ Success message shows company name
- ✅ Print shows all company details
- ⚠️ If dropdown empty, check `/api/companies` endpoint
- ⚠️ If payees don't load, verify company_id in database

## User Impact

**Accounts Users:**
- Must now select company BEFORE creating voucher
- Extra step but adds clarity
- Prevents wrong company assignment

**Admin Users:**
- Can approve vouchers from both companies
- Each voucher clearly shows which company
- Print output includes all company details

## Rollback Plan

If issues occur:
```bash
git revert HEAD
git push origin main
```

Database rollback:
```sql
-- Remove GST column if needed
ALTER TABLE companies DROP COLUMN IF EXISTS gst;
```

---

**Ready to Deploy!** 🚀

All changes tested with no errors. Run the SQL migration first, then push to deploy.
