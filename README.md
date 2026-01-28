# Relish Payment Approval System

A secure Payment Voucher Approval Workflow system with Mobile OTP verification using 2Factor.in and Supabase.

## Features

### Multi-Company Support
- **Relish Foods Pvt Ltd** - Kanyakumari, TN (GST: 33AAACR7749E2ZD)
- **Relish Hao Hao Chi Foods** - Alappuzha, KL (GST: 32AAUFR0742E1ZB)

### User Management
- **Role-Based Access**: Accounts staff (`Accounts-[Name]`) and Admin approvers (`Approve-[Name]`)
- **Mobile Verification**: OTP verification via 2Factor.in during registration
- **Admin Dashboard**: User onboarding with OTP verification

### Voucher Workflow
1. **Accounts Staff** creates payment voucher (selects company)
2. **Admin** receives notification and reviews
3. **Admin** approves → OTP sent to Payee
4. **Accounts Staff** collects OTP from Payee and enters it
5. **Voucher Complete** → Payment can be initiated

### Voucher Features
- Serial numbered (VCH-2024-25-00001)
- Multiple payment modes: UPI, Account Transfer, Cash
- Head of Account categorization
- Company branding on printed vouchers (name, address, GST)

### Progressive Web App (PWA)
- **Installable** on mobile & desktop devices
- **Offline Support** - Works without internet (cached resources)
- **Native App Experience** - Fullscreen, no browser UI
- **Push Notifications Ready** - Infrastructure in place

### Print & Download Features
- **Individual Voucher Print** - Professional layout with company branding
- **Period Report Print** - Consolidated reports with date range filter and totals
- **PDF Download** - Download vouchers as PDF files for record-keeping
- **Batch Export** - Export multiple vouchers for accounting/audit purposes

### Mobile Responsive
- **Hamburger Menu** - Full navigation on mobile devices
- **Touch-Friendly** - Optimized for mobile interactions

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **OTP Service**: 2Factor.in
- **Frontend**: React 18 (via CDN)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
TWOFACTOR_API_KEY=your_2factor_api_key
TWOFACTOR_TEMPLATE_NAME=your_template_name
PORT=3001
```

### 3. Set Up Database

Run `supabase-schema.sql` in your Supabase SQL Editor.

### 4. Start Server
```bash
npm start
```

Open `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/otp/send` - Send OTP to mobile
- `POST /api/otp/verify` - Verify OTP
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login

### Companies & Users
- `GET /api/companies` - List all companies
- `GET /api/companies/:companyId/users` - List company users

### Payees
- `POST /api/payees` - Add new payee
- `GET /api/companies/:companyId/payees` - List company payees

### Vouchers
- `POST /api/vouchers` - Create voucher
- `GET /api/companies/:companyId/vouchers` - List company vouchers
- `GET /api/vouchers/:voucherId` - Get voucher details
- `POST /api/vouchers/:voucherId/approve` - Approve voucher (Admin)
- `POST /api/vouchers/:voucherId/reject` - Reject voucher (Admin)
- `POST /api/vouchers/:voucherId/complete` - Complete with Payee OTP

### Heads of Account
- `GET /api/heads-of-account` - List all heads of account
- `POST /api/heads-of-account` - Create new head of account

## Workflow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Accounts   │────▶│    Admin    │────▶│   Payee     │────▶│  Complete   │
│  Creates    │     │  Approves   │     │  OTP Verify │     │  Payment    │
│  Voucher    │     │  (Notify)   │     │  (SMS)      │     │  Ready      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

## Deployment

### Vercel Deployment

1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

### Environment Variables (Vercel)
```
SUPABASE_URL
SUPABASE_SERVICE_KEY
TWOFACTOR_API_KEY
TWOFACTOR_TEMPLATE_NAME
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

## License

FoodStream Ltd. Hong Kong.

App is Developed, Maintained and is the Sole Property of FoodStream Ltd. Hong Kong.

App was developed for M/s. Relish Foods Pvt. Ltd. & M/s. Relish Hao Hao Chi Foods.

