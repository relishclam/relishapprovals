# Relish Payment Approval System

A secure Payment Voucher Approval Workflow system with Mobile OTP verification using Twilio and Supabase.

![Relish Logo](public/logo.png)

## Features

### User Management
- **Onboarding**: Register Accounts Staff and Admin users with Name, Mobile, and Aadhaar
- **Mobile Verification**: OTP verification via Twilio during registration
- **Role-Based Access**: 
  - `Accounts-[FirstName]` for voucher preparers
  - `Approve-[FirstName]` for admin approvers
- **First Sign-In OTP**: First login requires OTP verification

### Voucher Workflow
1. **Accounts Staff** creates payment voucher
2. **Admin** receives notification and reviews
3. **Admin** approves → OTP sent to Payee
4. **Accounts Staff** collects OTP from Payee and enters it
5. **Voucher Complete** → Payment can be initiated

### Voucher Features
- Serial numbered (VCH-2024-25-00001)
- Timestamped
- Multiple payment modes: UPI, Account Transfer, Cash
- Head of Account categorization
- Digital signature via OTP verification

### Companies Supported
1. **Relish Foods Pvt Ltd** - Kanyakumari, TN
2. **Relish Hao Hao Chi Foods** - Alappuzha, KL

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL) or SQLite (local)
- **OTP Service**: Twilio Verify
- **Frontend**: React 18 (via CDN)

## Quick Start

### Option 1: With Supabase (Production)

1. **Set up Supabase Database**
   - Go to your Supabase project SQL Editor
   - Run the contents of `supabase-schema.sql`

2. **Install & Run**
   ```bash
   npm install
   npm run start:supabase
   ```

3. Open `http://localhost:3001`

### Option 2: With SQLite (Local Development)

```bash
npm install
npm start
```

## Configuration

### Environment Variables (Optional)

Create a `.env` file (see `.env.example`):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SID=your_verify_sid
PORT=3001
```

## API Endpoints

### Authentication
- `POST /api/otp/send` - Send OTP to mobile
- `POST /api/otp/verify` - Verify OTP
- `POST /api/users/register` - Register new user
- `POST /api/users/:userId/verify-mobile` - Mark mobile as verified
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
- `POST /api/vouchers/:voucherId/resend-otp` - Resend Payee OTP

### Notifications
- `GET /api/users/:userId/notifications` - Get user notifications
- `POST /api/users/:userId/notifications/read-all` - Mark all as read

## Workflow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Accounts   │────▶│    Admin    │────▶│   Payee     │────▶│  Complete   │
│  Creates    │     │  Approves   │     │  OTP Verify │     │  Payment    │
│  Voucher    │     │  (Notify)   │     │  (SMS)      │     │  Ready      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

## Deployment

### Deploy to Railway/Render/Heroku

1. Push to GitHub
2. Connect your repo to the platform
3. Set environment variables
4. Deploy!

## License

MIT

## Author

Motty @ Relish Foods
