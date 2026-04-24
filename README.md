# Relish Payment Approval System

A production-grade, secure Payment Voucher Approval Workflow system with dual verification (Mobile OTP + Document Attestation), multi-company support, hierarchical accounting, and Progressive Web App capabilities. Built with Node.js, Supabase (PostgreSQL), and React 18.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Deployment](#deployment)
- [User Roles & Access Control](#user-roles--access-control)
- [Authentication Flow](#authentication-flow)
- [Voucher Workflow](#voucher-workflow)
- [API Reference](#api-reference)
- [Migrations](#migrations)

---

## Features

### Multi-Company Support
| Company | Location | GST |
|---------|----------|-----|
| Relish Foods Pvt Ltd | 17/9B, Madhavapuram, Kanyakumari 629704, TN | 33AAACR7749E2ZD |
| Relish Hao Hao Chi Foods | 26/599, M.O.Ward, Alappuzha 688001, KL | 32AAUFR0742E1ZB |

- Users can be assigned to one or both companies with independent roles per company
- Global payees, Heads of Account, and Sub-Heads shared across all companies
- Company-scoped data isolation with Row-Level Security (RLS)

### User Management
- **Role-Based Access Control (RBAC)**: `accounts`, `admin`, and `super_admin` roles
- **Auto-Generated Usernames**: Format `Accounts-[FirstName]` or `Approve-[FirstName]`
- **Mobile OTP Verification** via 2Factor.in during onboarding and first login
- **Aadhar Registration** stored for each user
- **Super Admin** can onboard, edit, and delete users across companies

### Voucher Features
- Serial numbered per company (`VCH-2025-26-00001`)
- **Payment Modes**: UPI, Account Transfer, Cash
- **Hierarchical Accounting**: Head of Account → Sub-Head of Account
- **Invoice Reference** tracking
- **Narration Modes**: Multiple line items (description + amount with auto-totals) or simple text
- **Draft Support**: Save incomplete vouchers and submit later
- **Amount in Indian Words** (Rupees, Lakh, Crore format)

### Dual Verification Flows
| Payee Type | Verification | Flow |
|------------|-------------|------|
| **Registered** (has mobile) | OTP | Admin approves → OTP sent to payee → Accounts staff enters OTP → Complete |
| **Ad-hoc** (no mobile/OTP) | Document | Preparer uploads invoice/receipt → Admin reviews & attests → Complete |

### Progressive Web App (PWA)
- **Installable** on mobile & desktop (standalone mode, portrait-primary)
- **Offline Support**: Cache-first for assets, network-first for API with offline fallback
- **Push Notifications**: Native device alerts with vibration, action buttons (View/Dismiss)
- **App Shortcuts**: "Create Voucher" and "Pending Approvals" from home screen
- **Background Sync**: Pending actions sync when connectivity is restored
- **Cache Version**: v12 with automatic stale-cache cleanup

### Print & Export
- **Voucher Print**: Professional layout with company branding, GST, signature blocks
- **Consolidated Report**: Date-range filtered report with totals
- **Excel Export (XLSX)**: Full voucher data (S.No, Voucher No, Date, Head, Sub Head, Payee, Narration, Invoice Ref, Mode, Amount, Status)

### Notifications
- **In-App Notifications**: Real-time alerts for approvals, rejections, OTP requests, document uploads
- **Push Notifications**: Native device push via Web Push API + VAPID
- **Unread Count Badge** on dashboard

### Mobile Responsive
- Hamburger menu navigation
- Touch-friendly controls and OTP input (6-field auto-focus)
- Responsive voucher tables and modals

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express.js |
| **Database** | Supabase (PostgreSQL) with Row-Level Security |
| **OTP Service** | 2Factor.in (Transactional SMS) |
| **Push Notifications** | Web Push API with VAPID (via `web-push`) |
| **Frontend** | React 18 + Babel Standalone (CDN) |
| **Styling** | Custom CSS (Relish brand: #f5841f orange, #1a1a2e dark) |
| **Excel Export** | SheetJS (XLSX) |
| **Deployment** | Vercel (serverless) |

---

## Architecture

```
┌──────────────────────────────┐
│        React 18 SPA          │  ← public/app.js (Babel in-browser)
│   (PWA + Service Worker)     │  ← public/service-worker.js
├──────────────────────────────┤
│      Express.js REST API     │  ← server-supabase.js
├──────────────────────────────┤
│    Supabase (PostgreSQL)     │  ← supabase-schema.sql + migrations/
│    + Supabase Storage        │  ← voucher-documents bucket
├──────────────────────────────┤
│   2Factor.in   │  Web Push   │  ← OTP SMS    │  VAPID Notifications
└──────────────────────────────┘
```

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file (see [Environment Variables](#environment-variables) below).

### 3. Set Up Database

1. Run `supabase-schema.sql` in your Supabase SQL Editor.
2. Run each migration in `migrations/` in order (001 → 010).

### 4. Start Server
```bash
npm start
```

Open `http://localhost:3001`

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# 2Factor.in OTP Service (Required)
TWOFACTOR_API_KEY=your_2factor_api_key
TWOFACTOR_TEMPLATE_NAME=Relish-Approvals    # SMS template name (default: Relish-Approvals)

# Web Push Notifications (Optional - push disabled if not set)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
# Generate keys: npx web-push generate-vapid-keys

# Server (Optional)
PORT=3001                                    # Default: 3001
NODE_ENV=development                         # Set to "production" for Vercel
```

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (full access, server-side only) |
| `TWOFACTOR_API_KEY` | Yes | 2Factor.in API key for sending OTPs |
| `TWOFACTOR_TEMPLATE_NAME` | No | SMS template name registered on 2Factor.in (default: `Relish-Approvals`) |
| `VAPID_PUBLIC_KEY` | No | VAPID public key for Web Push (push disabled if not set) |
| `VAPID_PRIVATE_KEY` | No | VAPID private key for Web Push |
| `PORT` | No | Server port (default: 3001) |

---

## Database Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the base schema** — paste `supabase-schema.sql` into the Supabase SQL Editor. This creates:
   - `companies`, `users`, `payees`, `vouchers`, `voucher_series`, `notifications`, `user_companies`, `otp_sessions`, `narration_items`
   - Default company data for Relish Foods and Relish Hao Hao Chi
   - Performance indexes and Row-Level Security (RLS)
3. **Run migrations** in order (`001` through `010`) to add all features.
4. **Create a Supabase Storage bucket** named `voucher-documents` (for document-based verification uploads).

---

## Deployment

### Vercel (Production)

The project is pre-configured for Vercel via `vercel.json`:

- `/api/*` routes → serverless function (`server-supabase.js`)
- Static assets → `public/` directory
- SPA fallback → `public/index.html`

Set all environment variables in **Vercel → Project Settings → Environment Variables**.

### Local Development

```bash
npm start
# → http://localhost:3001
```

---

## User Roles & Access Control

| Role | Username Format | Capabilities |
|------|----------------|--------------|
| **Accounts** | `Accounts-[FirstName]` | Create vouchers, save drafts, submit for approval, enter payee OTP, upload documents |
| **Admin** | `Approve-[FirstName]` | Approve/reject vouchers, send payee OTP, attest documents, delete vouchers |
| **Super Admin** | `Approve-[FirstName]` + `is_super_admin` flag | All admin privileges + onboard/edit/delete users, manage multi-company access |

- Users can belong to multiple companies with **different roles per company**
- Company-specific data is isolated; users only see data for their selected company
- **Self-registration is disabled** — only Super Admins can onboard new users

---

## Authentication Flow

### Login
```
1. User enters username (e.g., "Approve-Motty")
2. Server returns list of accessible companies → User selects company
3. First-time login: OTP sent to registered mobile → User enters 6-digit OTP
4. Subsequent logins: Direct access (no OTP)
5. Session: Server returns user object { id, name, role, isSuperAdmin, company, companies }
```

### User Onboarding (Super Admin Only)
```
1. Super Admin fills: Name, Mobile, Aadhar, Role, Company Access
2. System generates username (Accounts-[First] or Approve-[First])
3. OTP sent to new user's mobile for verification
4. User verified → can login
```

### OTP Details
- **Provider**: 2Factor.in (Transactional SMS)
- **Template**: Configurable via `TWOFACTOR_TEMPLATE_NAME` (default: `Relish-Approvals`)
- **Format**: 6-digit auto-generated OTP
- **Session Expiry**: 15 minutes
- **Mobile Format**: Indian numbers (`91XXXXXXXXXX`)

---

## Voucher Workflow

### Standard Flow (Registered Payees — OTP Verification)
```
┌─────────────┐     ┌─────────┐     ┌──────────────────┐     ┌───────────┐
│   Draft      │────▶│ Pending │────▶│ Awaiting Payee   │────▶│ Completed │
│ (optional)   │     │         │     │ OTP              │     │           │
└─────────────┘     └─────────┘     └──────────────────┘     └───────────┘
  Accounts            Admin            Accounts enters          Payment
  creates/saves       approves →       OTP from payee           ready
                      OTP sent
                      to payee
                            │
                            ▼
                      ┌───────────┐
                      │ Rejected  │  (with reason)
                      └───────────┘
```

### Ad-Hoc Flow (Unregistered Payees — Document Verification)
```
┌─────────────┐     ┌─────────┐     ┌──────────────────┐     ┌───────────┐
│   Draft      │────▶│ Pending │────▶│ Awaiting Document│────▶│ Completed │
│ (optional)   │     │         │     │                  │     │           │
└─────────────┘     └─────────┘     └──────────────────┘     └───────────┘
  Accounts            Admin            Preparer uploads         Admin
  creates/saves       approves →       invoice/receipt          attests
                      doc required                              document
```

### Voucher Statuses
| Status | Description |
|--------|-------------|
| `draft` | Saved but not submitted |
| `pending` | Submitted, awaiting admin approval |
| `awaiting_payee_otp` | Approved, OTP sent to payee for verification |
| `awaiting_document` | Approved, requires document upload (ad-hoc payees) |
| `completed` | Fully verified, payment can be initiated |
| `rejected` | Rejected by admin (with reason) |

---

## API Reference

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check — returns `{ status: 'ok' }` |

### Authentication & OTP

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/otp/send` | Send OTP to a mobile number. Body: `{ mobile, purpose }` |
| POST | `/api/otp/verify` | Verify OTP code. Body: `{ mobile, code }` |
| POST | `/api/users/login` | Login with username. Body: `{ username, otp?, companyId? }` — returns user + companies or `{ requiresOtp }` / `{ requiresCompanySelection }` |

### User Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/admin/onboard-user` | Onboard new user. Body: `{ adminId, adminMobile, companyId, name, mobile, aadhar, role, companyAccess[] }` | Super Admin |
| PUT | `/api/users/:userId` | Update user details. Body: `{ name, mobile, aadhar, role, requesterId }` | Super Admin |
| DELETE | `/api/users/:userId` | Delete user (only if no vouchers). Body: `{ requesterId }` | Super Admin |
| POST | `/api/users/:userId/verify-mobile` | Mark user mobile as verified | — |
| GET | `/api/users/:userId/companies` | Get user's company access list | — |
| PUT | `/api/users/:userId/companies` | Update multi-company access. Body: `{ companyAccess[], requesterId }` | Super Admin |
| POST | `/api/users/:userId/switch-company` | Switch active company. Body: `{ companyId }` | — |

### Companies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies` | List all companies |
| GET | `/api/companies/:companyId/users` | List users for a company (via junction table) |

### Payees

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payees` | Add payee. Body: `{ companyId, name, alias?, mobile, bankAccount?, ifsc?, upiId?, isGlobal?, payeeType?, requiresOtp? }` |
| GET | `/api/companies/:companyId/payees` | List payees (includes global payees) |
| PUT | `/api/payees/:payeeId` | Update payee |
| DELETE | `/api/payees/:payeeId` | Delete payee |

### Vouchers

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/vouchers` | Create voucher or draft. Body: `{ companyId, headOfAccount, subHeadOfAccount?, narration?, narrationItems?, amount, paymentMode, payeeId, preparedBy, saveAsDraft?, invoiceReference? }` | Accounts / Super Admin |
| GET | `/api/companies/:companyId/vouchers` | List all vouchers for a company | — |
| GET | `/api/vouchers/:voucherId` | Get single voucher with full details | — |
| PUT | `/api/vouchers/:voucherId` | Update a draft voucher | — |
| POST | `/api/vouchers/:voucherId/submit` | Submit draft for approval | — |
| POST | `/api/vouchers/:voucherId/approve` | Approve voucher → sends OTP or requests document | Admin / Super Admin |
| POST | `/api/vouchers/:voucherId/reject` | Reject voucher. Body: `{ rejectedBy, reason }` | Admin / Super Admin |
| POST | `/api/vouchers/:voucherId/complete` | Complete with payee OTP. Body: `{ otp }` | — |
| POST | `/api/vouchers/:voucherId/resend-otp` | Resend payee OTP | — |
| DELETE | `/api/vouchers/:voucherId` | Delete voucher. Body: `{ deletedBy }` | Admin / Super Admin |

### Document Verification (Ad-Hoc Payees)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/vouchers/:voucherId/upload-document` | Upload invoice/receipt (base64). Body: `{ documentData, mimeType, uploadedBy }` | — |
| POST | `/api/vouchers/:voucherId/approve-with-attestation` | Approve with document attestation. Body: `{ approvedBy, attestationNotes? }` | Admin / Super Admin |
| GET | `/api/vouchers/:voucherId/document` | Get document URL and metadata | — |

### Heads of Account

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/heads-of-account?companyId=` | List heads (includes global). Auto-seeds defaults if empty. |
| POST | `/api/heads-of-account` | Add head. Body: `{ companyId, name, isGlobal? }` |
| PUT | `/api/heads-of-account/:id` | Update head (cascades global flag to sub-heads). Body: `{ name, isGlobal? }` |
| DELETE | `/api/heads-of-account/:id` | Delete head |
| POST | `/api/heads-of-account/import` | Bulk import. Body: `{ companyId, names[] }` |

### Sub-Heads of Account

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sub-heads-of-account?headId=` | List sub-heads for a head |
| GET | `/api/sub-heads-of-account?companyId=` | List all sub-heads for a company (incl. global) |
| GET | `/api/sub-heads-of-account/grouped?companyId=` | Grouped by head (for dropdowns) |
| POST | `/api/sub-heads-of-account` | Add sub-head. Body: `{ headId, companyId, name }` |
| PUT | `/api/sub-heads-of-account/:id` | Update sub-head. Body: `{ name }` |
| DELETE | `/api/sub-heads-of-account/:id` | Delete sub-head |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:userId/notifications` | Get user notifications (last 50) |
| POST | `/api/notifications/:notificationId/read` | Mark notification as read |
| POST | `/api/users/:userId/notifications/read-all` | Mark all notifications as read |

### Push Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/push/vapid-public-key` | Get VAPID public key for client subscription |
| POST | `/api/users/:userId/push-subscription` | Save push subscription. Body: `{ endpoint, keys: { p256dh, auth } }` |
| DELETE | `/api/users/:userId/push-subscription` | Remove push subscription. Body: `{ endpoint }` |
| POST | `/api/users/:userId/test-push` | Send test push notification |

### Debug Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/debug/otp-sessions` | View active OTP sessions (masked) |
| GET | `/api/debug/voucher/:voucherId` | Inspect voucher + payee data |
| GET | `/api/debug/test-2factor` | Test 2Factor.in API connectivity and balance |

---

## Migrations

Run these in order after the base schema:

| # | File | Description |
|---|------|-------------|
| 001 | `001_add_user_companies.sql` | Multi-company user access junction table |
| 002 | `002_add_heads_of_account.sql` | Chart of Accounts with 18 default heads |
| 003 | `003_add_push_subscriptions.sql` | Web Push notification subscriptions |
| 004 | `004_add_draft_status_and_narration_items.sql` | Draft vouchers + line-item narrations |
| 005 | `005_add_sub_heads_of_account.sql` | Hierarchical sub-categories under heads |
| 006 | `006_add_invoice_reference.sql` | Invoice/reference number field on vouchers |
| 007 | `007_add_global_flag.sql` | Global flag for shared payees, heads, sub-heads |
| 008 | `008_add_document_verification.sql` | Ad-hoc payees, document upload + attestation flow |
| 009 | `009_copy_hoa_and_fix_global_subheads.sql` | Data migration: copy HoA across companies |
| 010 | `010_add_super_admin_flag.sql` | Super Admin role with elevated privileges |

---

## License

Private — Relish Foods Pvt Ltd
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

