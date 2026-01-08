# Multi-Company Voucher System

## Overview
Added company selection functionality to the voucher creation process, allowing users to create vouchers for either of the two Relish companies while maintaining complete separation of data and workflows.

## Companies Configured

### 1. Relish Foods Pvt Ltd
- **Address**: 17/9B, Madhavapuram, Kanyakumari 629704. TN. India
- **GST**: 33AAACR7749E2ZD
- **Database ID**: `relish-foods`

### 2. Relish Hao Hao Chi Foods
- **Address**: 26/599, M.O.Ward, Alappuzha 688001. KL. India
- **GST**: 32AAUFR0742E1ZB
- **Database ID**: `relish-hhc`

## Features Implemented

### 1. Database Schema Updates

#### Companies Table Enhancement
- **Added Field**: `gst` (TEXT NOT NULL)
- **Purpose**: Store GST numbers for each company
- **Update Strategy**: Uses `ON CONFLICT DO UPDATE` to update existing records

```sql
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    gst TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Updated Seed Data
```sql
INSERT INTO companies (id, name, address, gst) VALUES 
('relish-foods', 'Relish Foods Pvt Ltd', '17/9B, Madhavapuram, Kanyakumari 629704. TN. India', '33AAACR7749E2ZD'),
('relish-hhc', 'Relish Hao Hao Chi Foods', '26/599, M.O.Ward, Alappuzha 688001. KL. India', '32AAUFR0742E1ZB')
ON CONFLICT (id) DO UPDATE SET address = EXCLUDED.address, gst = EXCLUDED.gst;
```

### 2. Voucher Creation Form Updates

#### Company Selector (Prominent Position)
- **Location**: Top of form, before all other fields
- **Style**: Highlighted with orange border and cream background
- **Display**: Shows company name + GST number in dropdown
- **Sub-display**: Shows full address when company is selected

#### Form Field Dependencies
All form fields are disabled until a company is selected:
- ✅ Head of Account
- ✅ Payment Mode
- ✅ Payee (with dynamic filtering)
- ✅ Amount
- ✅ Narration

#### Dynamic Payee Loading
- Payees are loaded based on selected company
- Payee list automatically resets when company changes
- "Add Payee" button disabled until company selected
- New payees are created for the selected company

### 3. Frontend Components

#### CreateVoucher Component State
```javascript
const [form, setForm] = useState({ 
  voucherCompanyId: '',  // NEW: Selected company for this voucher
  headOfAccount: '', 
  narration: '', 
  payeeId: '', 
  paymentMode: 'UPI', 
  amount: '' 
});

const [companies, setCompanies] = useState([]);  // NEW: List of companies
```

#### useEffect Hooks
```javascript
// Load companies and heads on mount
useEffect(() => { 
  api.getCompanies().then(setCompanies);
  api.getHeadsOfAccount().then(setHeads); 
}, []);

// Load payees when company changes
useEffect(() => {
  if (form.voucherCompanyId) {
    api.getPayees(form.voucherCompanyId).then(setPayees);
    setForm(prev => ({ ...prev, payeeId: '' })); // Reset payee selection
  } else {
    setPayees([]);
  }
}, [form.voucherCompanyId]);
```

#### Validation
```javascript
if (!form.voucherCompanyId || !form.headOfAccount || !form.payeeId || !form.amount) {
  addToast('Fill all required fields including company selection', 'error');
  return;
}
```

#### Success Message
Shows which company the voucher was created for:
```javascript
addToast(`Voucher ${result.serialNumber} created for ${companies.find(c => c.id === form.voucherCompanyId)?.name}`, 'success');
```

### 4. Backend API Updates

#### Voucher Queries Enhanced
Both endpoints now include GST field:

**Get All Vouchers** (`GET /api/companies/:companyId/vouchers`)
```javascript
company:companies(name, address, gst)
```

**Get Single Voucher** (`GET /api/vouchers/:voucherId`)
```javascript
company:companies(name, address, gst)
```

#### Response Formatting
```javascript
const formattedVouchers = vouchers.map(v => ({
  ...v,
  company_name: v.company?.name,
  company_address: v.company?.address,
  company_gst: v.company?.gst  // NEW
}));
```

### 5. Print Functionality Updates

#### Voucher Header
Now displays all company information:
```html
<div class="voucher-header">
  <div class="company-name">Relish Foods Pvt Ltd</div>
  <div class="company-address">17/9B, Madhavapuram, Kanyakumari 629704. TN. India</div>
  <div class="company-address">GST: 33AAACR7749E2ZD</div>
  <div class="voucher-title">PAYMENT VOUCHER</div>
</div>
```

#### Print Outputs
- **Individual Voucher**: Shows selected company details
- **Period Report**: Each voucher shows its respective company
- **Consolidated Report**: Can contain vouchers from both companies

## User Workflow

### Creating a Voucher

1. **Navigate to Create Voucher**
   - User clicks "Create Voucher" in sidebar

2. **Select Company** (FIRST STEP - REQUIRED)
   - Dropdown shows both companies with GST numbers
   - User selects: "Relish Foods Pvt Ltd - GST: 33AAACR7749E2ZD"
   - Address displays below dropdown
   - All other form fields become enabled

3. **Select Head of Account**
   - Now enabled, user can select from dropdown

4. **Select Payment Mode**
   - UPI / Account Transfer / Cash

5. **Select or Add Payee**
   - Payee dropdown shows only payees for selected company
   - "Add Payee" button creates payee for selected company
   - If user changes company, payee list refreshes automatically

6. **Enter Amount & Narration**
   - Amount field enabled after company selection
   - Narration optional

7. **Submit**
   - Validation ensures company is selected
   - Success message shows: "Voucher VCH001 created for Relish Foods Pvt Ltd"
   - Voucher stored with `company_id` = 'relish-foods'

### Viewing & Filtering

- **Dashboard**: Shows vouchers from user's primary company
- **All Vouchers**: Shows vouchers from user's primary company
- **Filters**: Apply to vouchers within the user's company
- **Admin Users**: May see vouchers from multiple companies (based on user's company association)

### Printing

- **Single Voucher Print**: Shows the voucher's company name, address, and GST
- **Period Report**: Each voucher displays its own company information
- **Multi-Company Reports**: Possible if user has access to multiple companies

## Data Separation

### Company-Specific Data

1. **Vouchers**
   - Each voucher has `company_id` field
   - Voucher serial numbers are company-specific
   - Voucher series table maintains separate counters per company

2. **Payees**
   - Each payee belongs to one company
   - Cannot be shared across companies
   - Same person can be added as payee for both companies (separate records)

3. **Users**
   - Each user belongs to one company (primary)
   - User role (admin/accounts) applies to their company
   - Cannot create vouchers for companies they don't have access to

4. **Notifications**
   - Admins receive notifications for their company only
   - Notifications linked to company via voucher relationship

### Access Control

- **User Company**: User's primary company (`user.company.id`)
- **Voucher Company**: Selected company for voucher (`form.voucherCompanyId`)
- **Business Rule**: Users can create vouchers for any company, but must explicitly select it

## API Endpoints

### Existing Endpoints (No Changes Required)
- `GET /api/companies` - Returns all companies (now includes GST)
- `POST /api/vouchers` - Creates voucher (uses `companyId` from request)
- `GET /api/companies/:companyId/vouchers` - Gets company vouchers
- `GET /api/companies/:companyId/payees` - Gets company payees

### Response Format Updates
All voucher responses now include:
```javascript
{
  company_name: "Relish Foods Pvt Ltd",
  company_address: "17/9B, Madhavapuram, Kanyakumari 629704. TN. India",
  company_gst: "33AAACR7749E2ZD"
}
```

## Database Migration

### Required Steps

1. **Add GST Column** (if not exists)
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gst TEXT;
```

2. **Update Existing Records**
```sql
UPDATE companies SET 
  address = '17/9B, Madhavapuram, Kanyakumari 629704. TN. India',
  gst = '33AAACR7749E2ZD'
WHERE id = 'relish-foods';

UPDATE companies SET 
  address = '26/599, M.O.Ward, Alappuzha 688001. KL. India',
  gst = '32AAUFR0742E1ZB'
WHERE id = 'relish-hhc';
```

3. **Set NOT NULL Constraint** (after data populated)
```sql
ALTER TABLE companies ALTER COLUMN gst SET NOT NULL;
```

## Testing Checklist

### Company Selection
- [ ] Company dropdown appears at top of Create Voucher form
- [ ] Dropdown shows both companies with GST numbers
- [ ] Address displays when company selected
- [ ] All form fields disabled until company selected
- [ ] Form fields enable after company selection

### Payee Management
- [ ] Payee list loads for selected company
- [ ] Payee list resets when company changes
- [ ] Add Payee button disabled until company selected
- [ ] New payee created for correct company
- [ ] Payees from Company A don't appear for Company B

### Voucher Creation
- [ ] Cannot submit without selecting company
- [ ] Validation error shows if company not selected
- [ ] Success message shows correct company name
- [ ] Voucher saved with correct `company_id`
- [ ] Serial number increments per company

### Printing
- [ ] Single voucher shows correct company details
- [ ] Company name displays correctly
- [ ] Company address displays correctly
- [ ] GST number displays correctly
- [ ] Period report shows each voucher's company

### Data Integrity
- [ ] Vouchers belong to correct company
- [ ] Payees scoped to correct company
- [ ] Serial numbers separate per company
- [ ] No cross-company data leakage

## Files Modified

### Database Schema
- ✅ `supabase-schema.sql`
  - Added `gst` column to companies table
  - Updated company seed data with correct addresses and GST

### Frontend
- ✅ `public/app.js`
  - Added `companies` state to CreateVoucher
  - Added `voucherCompanyId` to form state
  - Added company selector UI
  - Updated useEffect hooks for dynamic payee loading
  - Updated form validation
  - Updated success message
  - Updated print HTML to include GST

### Backend
- ✅ `server-supabase.js`
  - Updated voucher queries to include GST
  - Updated response formatting to include `company_gst`

### Documentation
- ✅ `MULTI-COMPANY-FEATURE.md` (this file)

## UI/UX Improvements

### Visual Hierarchy
1. **Company Selector**: Prominently styled at top
   - Orange border (brand color)
   - Cream background
   - Larger font size
   - Building icon
   - "Required" indicator

2. **Disabled State**: Clear indication when fields unavailable
   - Grayed out fields
   - "Select Company First" placeholder text
   - Disabled "Add Payee" button

3. **Dynamic Feedback**
   - Address appears immediately on selection
   - Payee list updates automatically
   - Success toast shows company name

## Business Logic

### Workflow Separation
- ✅ Each company has its own voucher series
- ✅ Serial numbers independent (both can have VCH001)
- ✅ Payees scoped to company
- ✅ Users can create vouchers for any company (if authorized)

### Reporting
- Single vouchers: Show their company
- Period reports: Can span multiple companies
- Company-specific reports: Filter by company_id

### Future Enhancements
- [ ] Company filter in voucher list
- [ ] Dashboard stats per company
- [ ] Switch between companies in header
- [ ] User permissions per company
- [ ] Company-wise analytics
- [ ] Export reports by company

## Security Considerations

### Access Control
- Users must explicitly select company (no assumptions)
- Company ID validated on server side
- Cannot create vouchers for non-existent companies
- Payees validated against selected company

### Data Validation
- Company selection required (form validation)
- Payee must belong to selected company (server validation)
- Serial number generation company-specific (database function)

## Deployment Steps

1. **Update Database Schema**
   ```bash
   # Run in Supabase SQL Editor
   # supabase-schema.sql (lines with company table and inserts)
   ```

2. **Deploy Frontend**
   ```bash
   git add public/app.js
   git commit -m "Add multi-company voucher selection"
   git push origin main
   ```

3. **Deploy Backend**
   ```bash
   git add server-supabase.js
   git commit -m "Add company GST to voucher queries"
   git push origin main
   ```

4. **Verify Deployment**
   - Check companies endpoint returns GST
   - Test voucher creation with both companies
   - Verify print output shows correct company details

## Support & Troubleshooting

### Common Issues

**Issue**: Company dropdown empty
**Solution**: Check `/api/companies` endpoint returns data

**Issue**: Payees not loading for company
**Solution**: Verify payees exist for that company in database

**Issue**: GST not showing in print
**Solution**: Check server response includes `company_gst` field

**Issue**: Wrong company on voucher
**Solution**: Verify `companyId` sent correctly in create voucher request

---

**Implementation Status**: ✅ Complete
**Last Updated**: January 8, 2026
**Tested**: Pending deployment testing
