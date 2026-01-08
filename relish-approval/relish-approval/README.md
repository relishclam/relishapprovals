# Relish Payment Approval System

A secure Payment Voucher Approval Workflow system with Mobile OTP verification using Twilio.

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
- **Database**: SQLite (better-sqlite3)
- **OTP Service**: Twilio Verify
- **Frontend**: React 18 (via CDN)

## Installation

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/relishclam/relishapprovals.git
cd relishapprovals

# Install dependencies
npm install

# Start the server
npm start
```

The server will start at `http://localhost:3001`

## Configuration

Update the Twilio credentials in `server.js`:

```javascript
const TWILIO_ACCOUNT_SID = 'your_account_sid';
const TWILIO_AUTH_TOKEN = 'your_auth_token';
const TWILIO_VERIFY_SID = 'your_verify_service_sid';
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
- `POST /api/notifications/:notificationId/read` - Mark as read
- `POST /api/users/:userId/notifications/read-all` - Mark all as read

## Workflow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Accounts   │────▶│    Admin    │────▶│   Payee     │────▶│  Complete   │
│  Creates    │     │  Approves   │     │  OTP Verify │     │  Payment    │
│  Voucher    │     │  (Notify)   │     │  (SMS)      │     │  Ready      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

## License

MIT

## Author

Motty @ Relish Foods
