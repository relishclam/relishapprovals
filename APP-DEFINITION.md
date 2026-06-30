# Relish Approvals — Complete Application Definition

> **Developed & maintained by FoodStream Ltd. Hong Kong**
> **Client:** M/s. Relish Foods Pvt. Ltd. & M/s. Relish Hao Hao Chi Foods
> **Deployment:** [https://relishvoucher.vercel.app](https://relishvoucher.vercel.app)

---

## Reference Documents

This master definition is compiled from the following source documents, each verified against the actual source code (`server-supabase.js`, `public/app.js`, all migrations):

| Document | Covers |
|---|---|
| [README.md](README.md) | Tech stack, architecture, API reference, user roles, authentication, deployment |
| [PAY_NOW_WORKFLOW.md](PAY_NOW_WORKFLOW.md) | Pay Now feature (UPI/transfer assist) + Payment Tracking (awaiting\_payment → paid) |
| [SUSPENSE-VOUCHER-WORKFLOW.md](SUSPENSE-VOUCHER-WORKFLOW.md) | Suspense advance system, settlement entries, staff SMS workflow, Auditor corrections |
| [TALLY-EXPORT-SETUP.md](TALLY-EXPORT-SETUP.md) | Tally XML export — configuration requirements and structure (pending implementation) |
| [SAMPLE-VOUCHER.html](SAMPLE-VOUCHER.html) | Printed voucher layout and branding reference |

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Companies Served](#2-companies-served)
3. [Tech Stack & Architecture](#3-tech-stack--architecture)
4. [User Roles & Access Control](#4-user-roles--access-control)
5. [Authentication & Onboarding](#5-authentication--onboarding)
6. [Standard Payment Vouchers](#6-standard-payment-vouchers)
7. [Payment Tracking (Post-Completion)](#7-payment-tracking-post-completion)
8. [Pay Now Feature](#8-pay-now-feature)
9. [Suspense Advance Vouchers](#9-suspense-advance-vouchers)
10. [Attachments & Camera Capture](#10-attachments--camera-capture)
11. [Tally Export Feature](#11-tally-export-feature)
12. [Reporting, Print & Excel Export](#12-reporting-print--excel-export)
13. [Notifications](#13-notifications)
14. [Progressive Web App (PWA)](#14-progressive-web-app-pwa)
15. [Database & Migrations](#15-database--migrations)
16. [API Overview](#16-api-overview)
17. [Deployment & Environment](#17-deployment--environment)

---

## 1. Purpose & Scope

Relish Approvals is a **production-grade, secure Payment Voucher Approval Workflow system** built for the Relish group of companies. It digitalises the full lifecycle of payment authorisation — from voucher creation through multi-level approval, payee identity verification, expense settlement, payment confirmation, and accounting export.

**Core Problems Solved:**

- Eliminates paper-based payment vouchers and manual approval chains
- Enforces dual-verification (OTP + Document attestation) before any payment is marked complete
- Manages petty cash / staff advances through an auditable suspense voucher system
- Records actual payment execution (UTR reference + receipt) against each voucher
- Provides direct payment-execution assist (Pay Now) for UPI and Account Transfer vouchers
- Exports approved voucher data to Tally accounting software via XML

---

## 2. Companies Served

The system supports two companies in a multi-tenant architecture. Each company has isolated data, independent voucher numbering, and company-specific user assignments.

| Company | Registered Address | GST Number |
|---|---|---|
| Relish Foods Pvt Ltd | 17/9B, Madhavapuram, Kanyakumari 629704, Tamil Nadu | 33AAACR7749E2ZD |
| Relish Hao Hao Chi Foods | 26/599, M.O.Ward, Alappuzha 688001, Kerala | 32AAUFR0742E1ZB |

- Users can belong to **one or both** companies, with independent roles per company
- Payees, Heads of Account, and Sub-Heads can be **global** (shared) or company-specific
- Row-Level Security (RLS) in PostgreSQL enforces company-scoped data isolation

---

## 3. Tech Stack & Architecture

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express.js (`server-supabase.js`) |
| **Database** | Supabase (PostgreSQL) with Row-Level Security |
| **File Storage** | Supabase Storage — `voucher-bills` bucket (primary), `voucher-documents` bucket (legacy) |
| **OTP / SMS** | 2Factor.in (Transactional SMS — Indian mobile numbers) |
| **Push Notifications** | Web Push API with VAPID keys (`web-push` npm package) |
| **Frontend** | React 18 + Babel Standalone (in-browser, CDN) — `public/app.js` |
| **Styling** | Custom CSS — Relish brand (`#f5841f` orange, `#1a1a2e` dark navy) |
| **Excel Export** | SheetJS (XLSX) |
| **QR Codes** | `api.qrserver.com` (UPI Pay Now QR, settlement form QR for camera capture) |
| **Deployment** | Vercel (serverless functions + static hosting) |

### Architecture Diagram

```
┌────────────────────────────────────┐
│  React 18 SPA + PWA Service Worker   │  ← public/app.js + service-worker.js
├────────────────────────────────────┤
│       Express.js REST API            │  ← server-supabase.js (Vercel serverless)
├────────────────────────────────────┤
│   Supabase (PostgreSQL + Storage)    │  ← supabase-schema.sql + migrations/
├────────────────────────────────────┤
│   2Factor.in SMS  │  Web Push VAPID  │
└────────────────────────────────────┘
```

---

## 4. User Roles & Access Control

The system uses **Role-Based Access Control (RBAC)** with five distinct roles. Self-registration is disabled — only Super Admins can create new users.

| Role | Username Format | Key Capabilities |
|---|---|---|
| **Accounts** | `Accounts-[FirstName]` | Create vouchers & drafts, submit for approval, enter payee OTP, upload documents, manage suspense vouchers, review settlement entries, queue & confirm payments |
| **Admin** | `Approve-[FirstName]` | Approve/reject vouchers & top-ups, send payee OTP, attest documents, approve HOA correction proposals |
| **Super Admin** | `Approve-[FirstName]` + `is_super_admin` flag | All Admin capabilities + onboard/edit/delete users, manage multi-company access, access all companies |
| **Auditor** | `Audit-[FirstName]` | Read-only access to all vouchers & records; can propose Head of Account / Sub-Heading corrections (subject to Admin batch-approval); cannot modify amounts, payees, narration, or attachments |
| **Staff** | `Staff-[FirstName]` | Can log in to the app — auto-directed to their active settlement form; can also submit expenses without logging in via personal SMS link |

### Access Rules Summary

- **Accounts** can only see and act on their own company’s data
- **Admins** approve/reject but cannot create vouchers
- **Super Admins** can switch between companies and manage users globally
- **Auditors** propose HOA corrections only — no write access to any other field
- **Staff** users do not select a company on login; they are auto-assigned and receive their active settlement token
- Aadhar number is required for Accounts and Admin roles but optional for Auditor and Staff

---

## 5. Authentication & Onboarding

### Login Flow

```
1. User enters username (e.g., “Approve-Motty”)
2. Server returns list of accessible companies → user selects company
   (Staff users skip this step — auto-assigned to their single company)
3. First-time login: OTP sent to registered mobile via 2Factor.in
4. User enters 6-digit OTP → verified → session established
5. Subsequent logins: Direct access (no repeated OTP)
6. Staff login: additionally returns active settlementToken if a live suspense voucher exists
```

### OTP Details

| Property | Value |
|---|---|
| Provider | 2Factor.in (Transactional SMS) |
| Format | 6-digit numeric |
| Expiry | 15 minutes |
| Mobile Format | Indian numbers (`91XXXXXXXXXX`) |
| Template | Configurable via `TWOFACTOR_TEMPLATE_NAME` env var |

### Session Refresh

`GET /api/users/:userId/session` — used on app load to hydrate a stored session without re-login.

### User Onboarding (Super Admin Only)

1. Super Admin fills: Name, Mobile, Aadhar (optional for Auditor/Staff), Role, Company Access
2. System auto-generates username based on role prefix
3. OTP sent to new user’s mobile for verification
4. User is active and can log in

---

## 6. Standard Payment Vouchers

Standard payment vouchers are the core document — they record an approved payment request and carry it through a multi-step verification and payment lifecycle.

### Voucher Numbering

Serial numbers are assigned per company and per financial year:
`VCH-2025-26-00001`

### Voucher Fields

| Field | Notes |
|---|---|
| Payee | Registered or ad-hoc payee |
| Head of Account | Top-level accounting category |
| Sub-Head of Account | Sub-category under the Head |
| Payment Mode | UPI, Account Transfer, or Cash |
| Amount | Numeric + displayed in Indian Words (Rupees, Lakh, Crore) |
| Deductions | Optional deductions from the gross amount |
| Narration | Multiple line items (description + amount, auto-totalled) or simple text |
| Invoice Reference | Invoice or bill reference number |
| Paid From Account | Which company / director account was used to pay (optional, free-text with autocomplete) |
| Draft | Can be saved as a draft and submitted later |

### Verification Flows

| Payee Type | Has Mobile? | Verification Method |
|---|---|---|
| **Registered Payee** | Yes | Mobile OTP — OTP sent to payee, Accounts staff enters it in the app |
| **Ad-Hoc Payee** | No | Document — Accounts uploads invoice/receipt; Admin reviews and attests |

### Complete Voucher Status Lifecycle

```
[Draft] ─▶ [Pending] ─▶ [Awaiting Payee OTP] ─▶ [Completed] ─▶ [Awaiting Payment] ─▶ [Paid]
  ↑              │                                       ↑                   ↑
  └─ (edit)       ├─▶ [Awaiting Document] ─▶ [Completed] ─┘       (dequeue)─┘
                  │
                  └─▶ [Rejected]
```

| Status | Description |
|---|---|
| `draft` | Saved but not yet submitted |
| `pending` | Submitted; awaiting Admin approval |
| `awaiting_payee_otp` | Admin approved; OTP sent to payee’s mobile |
| `awaiting_document` | Admin approved; document upload required (ad-hoc payees) |
| `completed` | Fully verified; payment can be initiated |
| `awaiting_payment` | Queued for payment by Accounts |
| `paid` | Payment confirmed with UTR reference and/or receipt |
| `rejected` | Rejected by Admin with stated reason |

> **Suspense-settlement fast path:** Vouchers created from suspense settlement entries (`is_suspense_settlement = true`) skip the OTP step on Admin approval and go directly to `completed` — the cash was already disbursed as the suspense advance.

### Voucher Attachments

Multiple files can be attached to any standard voucher (invoices, receipts, transfer proofs). Files are stored in the `voucher-bills` Supabase Storage bucket and tracked in the `voucher_attachments` table. Deletion is permitted to the uploader within 24 hours or by Admin at any time.

---

## 7. Payment Tracking (Post-Completion)

After a voucher reaches `completed`, Accounts records the actual payment execution.

### Flow

```
completed
    ↓
awaiting_payment   (optional queue step)
    ↓
paid               (UTR reference and/or receipt required)
```

Accounts can also go directly `completed → paid` without the queue step.

### Mark as Paid

When confirming payment, Accounts must provide at least one of:
- **UTR / Transaction Reference** — stored in `vouchers.payment_reference`
- **Receipt Upload** (base64 image or PDF) — stored in `voucher-bills` bucket; URL in `vouchers.payment_receipt_url`

### Dequeue

Admin or Accounts can move a voucher back from `awaiting_payment → completed` to defer payment.

---

## 8. Pay Now Feature

The **Pay Now** feature provides payment *execution assistance* for completed vouchers — it does not itself record that a payment was made (that is Payment Tracking’s job).

### Visibility Rules

The **💳 Pay Now** button appears only when **all** of the following are true:

- `voucher.status === 'completed'`
- `voucher.payment_mode !== 'Cash'`
- User is Admin, Super Admin, **or** (Accounts role AND payment mode is Account Transfer)

### UPI Payment Assist

| Device | Behaviour |
|---|---|
| Mobile / Android | Deep-link: `upi://pay?pa=<id>&pn=<name>&am=<amount>&cu=INR&tn=<ref>` — opens UPI app directly |
| Desktop | QR code (220×220 px via api.qrserver.com) for scanning |

### Account Transfer Assist

Displays a bank details card (payee name, account number, IFSC, bank name, amount, voucher ref) with a **📋 Copy All Details** button.

### Paid From Account

Every voucher carries an optional **Paid From Account** field — a free-text input with `<datalist>` autocomplete from the company’s managed list of payment accounts (`company_payment_accounts` table, managed in Settings).

---

## 9. Suspense Advance Vouchers

The Suspense Voucher system manages **petty cash / staff advance disbursements**. A staff member is given an advance; they submit their expenses through a personal SMS link (no app login required); Accounts reviews and generates linked payment vouchers per expense.

### Voucher Numbering

`SUS-2025-26-00001` (separate series from standard vouchers)

### Suspense Voucher Status Lifecycle

```
Created by Accounts
    ↓
pending_approval ──── Admin Rejects ──▶ rejected (terminal)
    ↓
Admin Approves → OTP sent to staff
    ↓
awaiting_payee_otp  (staff must confirm advance receipt by sharing OTP)
    ↓
Accounts/Admin collects OTP from staff, enters it in app
    ↓
open  ◄──────────────────────── Top-Up approved (reopens if was closed)
    ↓
(Staff submits expenses via SMS link; Accounts reviews)
    ↓
partial  (some entries approved, balance remains)
    ↓
Accounts manually closes voucher
    ↓
closed  (SMS link deactivated)
```

### Balance Behaviour

- Balance = Advance + approved top-ups − approved expenses + approved refunds
- Balance **can go negative** (overspend) — the system does not block further entries
- Accounts can use **Recalculate Balance** at any time to correct the stored figure from live data
- Balance is recalculated after every entry approval and every top-up approval

### SMS Settlement Link

- Activated only after the advance OTP is verified (not immediately on Admin approval)
- Does **not expire** after 24 hours — set to a far-future sentinel date (`2099-12-31`)
- Deactivated when Accounts manually closes the voucher, or when a new link is sent (old link is explicitly expired)
- Staff can bookmark it and return at any time while the voucher is open

### Role Summary

| Action | Accounts | Admin | Auditor | Staff (SMS) |
|---|:---:|:---:|:---:|:---:|
| Create suspense voucher | ✅ | — | — | — |
| Approve / reject voucher | — | ✅ | — | — |
| Share advance receipt OTP with Accounts | — | — | — | ✅ |
| Verify advance OTP (activate SMS link) | ✅ | ✅ | — | — |
| Submit expense entry | ✅ | — | — | ✅ |
| Attach bill photo | ✅ | — | — | ✅ |
| Upload & classify suspense-level attachment | ✅ | — | — | — |
| Review & approve settlement entries | ✅ | — | — | — |
| Combine entries into one voucher | ✅ | — | — | — |
| Approve resulting payment voucher | — | ✅ | — | — |
| Add top-up (submit for Admin approval) | ✅ | — | — | — |
| Approve / reject top-up | — | ✅ | — | — |
| Resend SMS link | ✅ | ✅ | — | — |
| Close voucher | ✅ | — | — | — |
| Recalculate balance | ✅ | — | — | — |
| Propose HOA / Sub-Heading correction | — | — | ✅ | — |
| Batch-approve HOA corrections | — | ✅ | — | — |

### Attachment Classification

When Accounts uploads directly to a suspense voucher (not to a specific settlement entry), they must classify the file:

| Category | Badge | Copied to Payment Vouchers? |
|---|---|---|
| 🏦 Transfer Receipt | Blue | Yes — proves how funds reached the staff member |
| 🧻 Expense Bill | Green | No — stays on the suspense voucher only |

### Entry Review & Payment Voucher Generation

When Accounts approves a settlement entry:
- **Approve only** — balance recalculated; no voucher created
- **Approve + Create Voucher** — generates a linked `pending` standard voucher carrying all entry attachments + all suspense-level Transfer Receipts
- **Combine multiple entries** — combines selected `Pending Review` expense entries into one voucher (sum of amounts, all attachments carried over)

Vouchers created from suspense entries carry `is_suspense_settlement = true` and are fast-tracked to `completed` by Admin approval (no OTP required).

### Auditor HOA Correction Proposals

- Auditor proposes a new Head of Account and/or Sub-Heading on any voucher, with a reason
- One pending proposal per voucher at a time
- Admin batch-approves or rejects via the HOA Corrections dashboard
- On approval, `head_of_account` and/or `sub_head_of_account` on the voucher is updated atomically
- Before/after snapshot stored permanently in `hoa_correction_proposals` table

---

## 10. Attachments & Camera Capture

### Attachment System

All files (bills, receipts, transfer proofs) are stored in the `voucher-bills` Supabase Storage bucket and tracked in the `voucher_attachments` table. Each attachment is linked to one or more of: `voucher_id`, `suspense_id`, `settlement_id`.

**Upload sources:**
- Direct upload from desktop browser (base64)
- Camera capture from mobile browser
- QR code relay (scan QR on desktop, photograph bill on phone)

### Capture Sessions (QR Camera Relay)

For staff or Accounts users who need to photograph a physical bill using a different device:

1. App generates a QR code linking to a 15-minute capture session
2. User scans QR with their phone’s camera
3. Phone browser opens the capture page and uploads the photo directly
4. Desktop app detects the upload (polling) and attaches it automatically

Capture sessions inherit the `attachment_category` from the originating context (so a QR launched from a Transfer Receipt upload correctly classifies the photo as a Transfer Receipt).

### Storage Buckets

| Bucket | Purpose |
|---|---|
| `voucher-bills` | Primary — all new multi-file attachments (regular vouchers, suspense, settlements, QR captures) |
| `voucher-documents` | Legacy — single document upload for ad-hoc payee document verification flow |

---

## 11. Tally Export Feature

> **Status: Designed, ready to build — awaiting client configuration data**

The app will generate a **Tally-compatible XML file** for import into Tally via:
> Gateway of Tally → Import Data → Vouchers → select `.xml` file

### One-Time Configuration Required

| Config Item | Description |
|---|---|
| Tally Company Name | Exact name as registered in Tally |
| Payment Mode → Tally Ledger | e.g., `UPI` → `Canara Bank - UPI`, `Cash` → `Cash` |
| Head of Account → Tally Ledger | App HOA names mapped to Tally ledger/group names |

### Features to Build

| Feature | Ready |
|---|---|
| “Download for Tally (XML)” button with date range | ✅ |
| Folder / Save-As picker (browser File System API) | ✅ |
| One-time Tally config screen | ✅ |
| Single `.xml` with all vouchers in range | ✅ |
| Deductions handled correctly (net amount) | ✅ |

See [TALLY-EXPORT-SETUP.md](TALLY-EXPORT-SETUP.md) for XML sample and full config checklist.

---

## 12. Reporting, Print & Excel Export

### Voucher Print

Professional printable A4 layout (see [SAMPLE-VOUCHER.html](SAMPLE-VOUCHER.html)) with:
- Company header (name, address, GST)
- Voucher number and date
- Payee details and payment mode
- Narration / line-item breakdown
- Amount in figures and Indian words
- Signature blocks (Prepared By, Approved By, Payee Confirmation)

### Consolidated Report

Date-range filtered report for all vouchers in a company, with summary totals.

### Excel Export (XLSX)

Full voucher data via SheetJS. Columns:
`S.No | Voucher No | Date | Head | Sub Head | Payee | Narration | Invoice Ref | Mode | Amount | Status`

---

## 13. Notifications

### In-App Notifications

Real-time alerts for:
- New voucher submitted for approval
- Voucher approved or rejected
- OTP sent / verified
- Document uploaded / attested
- Settlement entry submitted / reviewed
- Top-up requested / approved / rejected
- Voucher queued for payment / paid
- HOA correction proposed / approved / rejected
- Suspense voucher approved / activated

Unread count badge displayed on the dashboard. Last 50 notifications returned per user.

### Push Notifications

Native device push via the **Web Push API** with VAPID keys:
- Delivered when the app is not open
- Includes vibration and action buttons (View / Dismiss)
- Per-device subscription stored in `push_subscriptions` table
- Requires `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` env vars
- Invalid subscriptions (410/404) are auto-removed

---

## 14. Progressive Web App (PWA)

| Feature | Detail |
|---|---|
| Installable | Add to Home Screen on mobile and desktop (standalone, portrait-primary) |
| Offline Support | Cache-first for static assets; network-first for API with offline fallback |
| Cache Version | v12 — automatic stale-cache cleanup on activation |
| Background Sync | Pending actions queue and sync when connectivity is restored |
| Push Notifications | Native push via Web Push API |
| App Shortcuts | “Create Voucher” and “Pending Approvals” from home screen icon |
| Mobile UX | Hamburger menu, touch-friendly 6-field OTP input with auto-focus, responsive tables and modals |

---

## 15. Database & Migrations

### Base Schema Tables (`supabase-schema.sql`)

`companies` · `users` · `payees` · `vouchers` · `voucher_series` · `notifications` · `user_companies` · `otp_sessions` · `narration_items`

### Migration History

| # | File | Description |
|---|---|---|
| 001 | `001_add_user_companies.sql` | Multi-company user access junction table |
| 002 | `002_add_heads_of_account.sql` | Chart of Accounts with 18 default heads |
| 003 | `003_add_push_subscriptions.sql` | Web Push notification subscriptions |
| 004 | `004_add_draft_status_and_narration_items.sql` | Draft vouchers + line-item narrations |
| 005 | `005_add_sub_heads_of_account.sql` | Hierarchical sub-categories under heads |
| 006 | `006_add_invoice_reference.sql` | Invoice/reference number on vouchers |
| 007 | `007_add_global_flag.sql` | Global flag for shared payees, heads, sub-heads |
| 008 | `008_add_document_verification.sql` | Ad-hoc payees, document upload + attestation |
| 009 | `009_copy_hoa_and_fix_global_subheads.sql` | Data migration: copy HoA across companies |
| 010 | `010_add_super_admin_flag.sql` | Super Admin role |
| 011 | `011_add_deductions.sql` | Deductions field on vouchers |
| 012a | `012_add_auditor_role.sql` | Auditor role |
| 012b | `012_suspense_bills_system.sql` | Suspense voucher system base tables: `suspense_vouchers`, `suspense_settlements`, `settlement_sessions`, `voucher_attachments`, `capture_sessions` |
| 013 | `013_fix_capture_sessions_attachment_fk.sql` | FK fix for capture sessions |
| 014 | `014_add_staff_payees_and_settlement_sessions.sql` | Staff payees + settlement sessions |
| 015 | `015_decouple_staff_payee_from_users.sql` | Decouple staff payee record from user account |
| 016 | `016_add_staff_role.sql` | Staff role for system login |
| 017 | `017_fix_financial_year_2026_27.sql` | Financial year 2026-27 support |
| 018 | `018_add_pending_approval_to_settlements_status.sql` | Top-up pending approval status |
| 019 | `019_add_voucher_link_to_settlements.sql` | Back-link: settlement entry → payment voucher |
| 020 | `020_add_suspense_settlement_flag_to_vouchers.sql` | `is_suspense_settlement` flag on vouchers |
| 021 | `021_suspense_advance_otp.sql` | OTP verification for advance disbursement |
| 022 | `022_attachment_category.sql` | Transfer Receipt vs Expense Bill classification |
| 023 | `023_add_pay_now_fields.sql` | `paid_from_account` on vouchers, `bank_name` on payees |
| 024 | `024_company_payment_accounts.sql` | `company_payment_accounts` table |
| 025 | `025_add_hoa_correction_proposals.sql` | `hoa_correction_proposals` table |
| 026 | `026_add_payment_tracking.sql` | `awaiting_payment` status + `payment_reference`, `paid_by`, `paid_at`, `queued_at` fields |
| 027 | `027_add_payment_receipt_url.sql` | `payment_receipt_url` field on vouchers |
| 028 | `028_add_password_auth.sql` | `password_hash` + `password_set_at` on users; `webauthn_credentials` table (per-device passkeys); `webauthn_challenges` table (challenge + company-select token storage) |

---

## 16. API Overview

All REST endpoints are served by `server-supabase.js`. Full details in [README.md — API Reference](README.md#api-reference).

| Group | Base Path | Key Operations |
|---|---|---|
| Health | `/api/health` | Service health check |
| OTP | `/api/otp/*` | Send and verify OTP |
| Authentication | `/api/users/login`, `/api/users/:id/session` | Login (auth-first, then company selection), session refresh |
| Password Management | `/api/users/:id/set-password`, `/api/auth/forgot-password`, `DELETE /api/users/:id/password` | Set / change password, OTP-based forgot-password, Super Admin credential wipe |
| Device Lock (WebAuthn) | `/api/auth/webauthn/register/options`, `/register/verify`, `/login/options`, `/login/verify` | Register passkeys, authenticate via biometric |
| Registered Devices | `GET /api/users/:id/webauthn-credentials`, `DELETE /api/users/:id/webauthn-credentials/:credId` | List and remove registered devices |
| User Management | `/api/admin/onboard-user`, `/api/users/:id` | Onboard, edit, delete, verify mobile |
| Companies | `/api/companies/*` | List companies, list company users |
| Payees | `/api/payees`, `/api/companies/:id/payees` | CRUD payees, create staff login |
| Vouchers | `/api/vouchers`, `/api/companies/:id/vouchers` | Full voucher lifecycle |
| Payment Tracking | `/api/vouchers/:id/mark-awaiting-payment`, `/mark-paid`, `/dequeue-payment` | Queue and confirm payments |
| Document Verification | `/api/vouchers/:id/upload-document`, `/approve-with-attestation` | Ad-hoc payee documents |
| Heads of Account | `/api/heads-of-account` | CRUD + bulk import |
| Sub-Heads | `/api/sub-heads-of-account` | CRUD + grouped listing |
| Suspense Vouchers | `/api/suspense-vouchers/*` | Full suspense lifecycle |
| Settlement Sessions | `/api/settlement-sessions/:token/*` | Staff SMS link — no login required |
| Suspense Settlements | `/api/suspense-settlements/:id/*` | Approve entries, top-ups |
| Attachments | `/api/attachments` | Multi-file upload, list, delete |
| Capture Sessions | `/api/capture-sessions` | QR camera relay (15-min sessions) |
| HOA Corrections | `/api/vouchers/:id/hoa-corrections`, `/api/companies/:id/hoa-corrections/*` | Auditor proposals, Admin approval |
| Notifications | `/api/users/:id/notifications` | Read and mark notifications |
| Push Subscriptions | `/api/users/:id/push-subscription` | Register/remove device subscriptions |
| Payment Accounts | `/api/companies/:id/payment-accounts`, `/api/payment-accounts` | Manage Pay From accounts |
| Debug | `/api/debug/*` | OTP sessions, voucher inspection, 2Factor test |

---

## 17. Deployment & Environment

### Vercel (Production)

`vercel.json` routes:
- `/api/*` → serverless function (`server-supabase.js`)
- Static assets → `public/`
- SPA fallback → `public/index.html`

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (server-side only) |
| `TWOFACTOR_API_KEY` | Yes | 2Factor.in API key for OTP SMS |
| `TWOFACTOR_TEMPLATE_NAME` | No | SMS template name on 2Factor.in (default: `Relish-Approvals`) |
| `VAPID_PUBLIC_KEY` | No | VAPID public key — push notifications disabled if not set |
| `VAPID_PRIVATE_KEY` | No | VAPID private key |
| `APP_BASE_URL` | No | Base URL for settlement SMS links (defaults to request host) |
| `WEBAUTHN_RP_ID` | No | WebAuthn Relying Party ID (default: `relishvoucher.vercel.app`) |
| `WEBAUTHN_ORIGIN` | No | WebAuthn expected origin (default: `https://relishvoucher.vercel.app`) |
| `PORT` | No | Local server port (default: `3001`) |

### Database Initialisation

1. Run `supabase-schema.sql` in Supabase SQL Editor
2. Run migrations `001` → `028` in order
3. Create Supabase Storage buckets: `voucher-bills` and `voucher-documents`
4. Set all environment variables

### Local Development

```bash
npm install
npm start
# → http://localhost:3001
```

---

## License

**Private — Developed, maintained, and sole property of FoodStream Ltd. Hong Kong.**
Developed for M/s. Relish Foods Pvt. Ltd. & M/s. Relish Hao Hao Chi Foods.


---

## Reference Documents

This master definition is compiled from the following source documents in the repository:

| Document | Covers |
|---|---|
| [README.md](README.md) | Tech stack, architecture, API reference, user roles, authentication, deployment |
| [PAY_NOW_WORKFLOW.md](PAY_NOW_WORKFLOW.md) | Pay Now feature, UPI/Account Transfer payment assistance, Paid From Account |
| [SUSPENSE-VOUCHER-WORKFLOW.md](SUSPENSE-VOUCHER-WORKFLOW.md) | Suspense advance system, settlement entries, staff SMS workflow, Auditor corrections |
| [TALLY-EXPORT-SETUP.md](TALLY-EXPORT-SETUP.md) | Tally XML export — configuration requirements and structure |
| [SAMPLE-VOUCHER.html](SAMPLE-VOUCHER.html) | Printed voucher layout and branding |

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Companies Served](#2-companies-served)
3. [Tech Stack & Architecture](#3-tech-stack--architecture)
4. [User Roles & Access Control](#4-user-roles--access-control)
5. [Authentication & Onboarding](#5-authentication--onboarding)
6. [Standard Payment Vouchers](#6-standard-payment-vouchers)
7. [Suspense Advance Vouchers](#7-suspense-advance-vouchers)
8. [Pay Now Feature](#8-pay-now-feature)
9. [Tally Export Feature](#9-tally-export-feature)
10. [Reporting, Print & Excel Export](#10-reporting-print--excel-export)
11. [Notifications](#11-notifications)
12. [Progressive Web App (PWA)](#12-progressive-web-app-pwa)
13. [Database & Migrations](#13-database--migrations)
14. [API Overview](#14-api-overview)
15. [Deployment & Environment](#15-deployment--environment)

---

## 1. Purpose & Scope

Relish Approvals is a **production-grade, secure Payment Voucher Approval Workflow system** built for the Relish group of companies. It digitalises the full lifecycle of payment authorisation — from voucher creation through multi-level approval, payee identity verification, expense settlement, and accounting export.

**Core Problems Solved:**

- Eliminates paper-based payment vouchers and manual approval chains
- Enforces dual-verification (OTP + Document attestation) before any payment is marked complete
- Manages petty cash / staff advances through an auditable suspense voucher system
- Provides a direct payment-execution assist (Pay Now) for completed vouchers
- Exports approved voucher data to Tally accounting software via XML

---

## 2. Companies Served

The system supports two companies in a multi-tenant architecture. Each company has isolated data, independent voucher numbering, and company-specific user assignments.

| Company | Registered Address | GST Number |
|---|---|---|
| Relish Foods Pvt Ltd | 17/9B, Madhavapuram, Kanyakumari 629704, Tamil Nadu | 33AAACR7749E2ZD |
| Relish Hao Hao Chi Foods | 26/599, M.O.Ward, Alappuzha 688001, Kerala | 32AAUFR0742E1ZB |

- Users can belong to **one or both** companies, with independent roles per company.
- Payees, Heads of Account, and Sub-Heads can be **global** (shared across companies) or company-specific.
- Row-Level Security (RLS) in PostgreSQL enforces company-scoped data isolation.

---

## 3. Tech Stack & Architecture

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express.js (`server-supabase.js`) |
| **Database** | Supabase (PostgreSQL) with Row-Level Security |
| **File Storage** | Supabase Storage (`voucher-documents` bucket) |
| **Password Auth** | bcryptjs — pure-JS bcrypt, no native compilation (Vercel-safe) |
| **Device Lock / Biometrics** | WebAuthn / Passkeys — `@simplewebauthn/server` v13 (server) + `@simplewebauthn/browser` v13 (CDN, client) |
| **OTP / SMS** | 2Factor.in (Transactional SMS — Indian mobile numbers) |
| **Push Notifications** | Web Push API with VAPID keys (`web-push` npm package) |
| **Frontend** | React 18 + Babel Standalone (in-browser, CDN) — `public/app.js` |
| **Styling** | Custom CSS — Relish brand (`#f5841f` orange, `#1a1a2e` dark navy) |
| **Excel Export** | SheetJS (XLSX) |
| **QR Codes** | `api.qrserver.com` (UPI QR, settlement form QR) |
| **Deployment** | Vercel (serverless functions + static hosting) |

### Architecture Diagram

```
┌──────────────────────────────────────┐
│  React 18 SPA + PWA Service Worker   │  ← public/app.js + service-worker.js
├──────────────────────────────────────┤
│       Express.js REST API            │  ← server-supabase.js (Vercel serverless)
├──────────────────────────────────────┤
│   Supabase (PostgreSQL + Storage)    │  ← supabase-schema.sql + migrations/
├──────────────────────────────────────┤
│   2Factor.in SMS  │  Web Push VAPID  │
└──────────────────────────────────────┘
```

---

## 4. User Roles & Access Control

The system uses **Role-Based Access Control (RBAC)** with four distinct roles. Self-registration is disabled — only Super Admins can create new users.

| Role | Username Format | Key Capabilities |
|---|---|---|
| **Accounts** | `Accounts-[FirstName]` | Create vouchers & drafts, submit for approval, enter payee OTP, upload documents, manage suspense vouchers, review settlement entries |
| **Admin** | `Approve-[FirstName]` | Approve/reject vouchers & top-ups, send payee OTP, attest documents, approve HOA correction proposals |
| **Super Admin** | `Approve-[FirstName]` + `is_super_admin` flag | All Admin capabilities + onboard/edit/delete users, manage multi-company access, access all companies |
| **Auditor** | (Read-only role) | View all vouchers & records across the company; propose Head of Account / Sub-Heading corrections on vouchers |

### Access Rules Summary

- **Accounts** can only see and act on their own company's data.
- **Admins** approve/reject but cannot create vouchers.
- **Super Admins** can switch between companies and manage users globally.
- **Auditors** cannot modify amounts, payees, payment mode, narration, or attachments — correction proposals only.
- Users with access to multiple companies select their active company at login.

---

## 5. Authentication & Onboarding

### Login Flow — First Time

```
1. Enter username (e.g., "Approve-Motty")
2. Server sends OTP to registered mobile via 2Factor.in
3. Enter 6-digit OTP → verified → one-time setup token issued
4. Create a password (minimum 6 characters)
5. Device Lock prompt — register fingerprint / Face ID on this device
6. Company selection (if RBAC grants access to multiple companies)
7. Logged in → Dashboard
```

### Login Flow — Returning User

```
1. Enter username
2. Password screen shown
   → Biometric auto-fires silently if this device is registered
   → Or type password / tap "Use Device Lock" manually
3. Identity verified → company determined by RBAC
   Single-company or Staff → auto-selected
   Multi-company → company selection screen (no re-authentication needed)
4. Logged in → Dashboard
```

### Password & Device Lock

- Passwords hashed with bcryptjs; changeable from Security Settings
- **Forgot Password:** Username → OTP → Set new password
- Device Lock uses WebAuthn / Passkeys — credential stored server-side, survives cache clears
- Multiple devices per user; managed from Security Settings

### OTP Details

| Property | Value |
|---|---|
| Provider | 2Factor.in (Transactional SMS) |
| Format | 6-digit numeric |
| Expiry | 15 minutes |
| Mobile Format | Indian numbers (`91XXXXXXXXXX`) |
| Template | Configurable via `TWOFACTOR_TEMPLATE_NAME` env var |

### User Onboarding (Super Admin Only)

1. Super Admin fills: Name, Mobile, Aadhar, Role, Company Access
2. System auto-generates username (`Accounts-[First]` or `Approve-[First]`)
3. OTP sent to new user's mobile for verification
4. User is active; on first login they complete the full first-time flow (OTP → Set Password → Device Lock)

---

## 6. Standard Payment Vouchers

Standard payment vouchers are the core document of the system — they record an approved payment request and carry it through a multi-step verification lifecycle.

### Voucher Numbering

Serial numbers are assigned per company and per financial year:
`VCH-2025-26-00001`

### Voucher Fields

| Field | Notes |
|---|---|
| Payee | Registered or ad-hoc payee |
| Head of Account | Top-level accounting category |
| Sub-Head of Account | Sub-category under the Head |
| Payment Mode | UPI, Account Transfer, or Cash |
| Amount | Numeric + displayed in Indian Words (Rupees, Lakh, Crore) |
| Narration | Multiple line items (description + amount, auto-totalled) or simple text |
| Invoice Reference | Invoice or bill reference number |
| Paid From Account | Which company / director account was used to pay (optional) |
| Deductions | Optional deductions from the gross amount |
| Draft | Can be saved as a draft and submitted later |

### Verification Flows

The verification path depends on the **payee type**:

| Payee Type | Has Mobile? | Verification Method |
|---|---|---|
| **Registered Payee** | Yes | Mobile OTP — OTP sent to payee, Accounts staff enters it in the app |
| **Ad-Hoc Payee** | No | Document — Accounts uploads invoice/receipt; Admin reviews and attests |

### Standard Voucher Status Lifecycle

```
[Draft] ──▶ [Pending] ──▶ [Awaiting Payee OTP] ──▶ [Completed]
  ↑               │
  └── (edit)      └──▶ [Awaiting Document] ──▶ [Completed]
                  │
                  └──▶ [Rejected]
```

| Status | Description |
|---|---|
| `draft` | Saved but not yet submitted |
| `pending` | Submitted; awaiting Admin approval |
| `awaiting_payee_otp` | Admin approved; OTP sent to payee's mobile |
| `awaiting_document` | Admin approved; document upload required (ad-hoc payees) |
| `completed` | Fully verified; payment can be initiated |
| `rejected` | Rejected by Admin with a stated reason |

### OTP Flow (Registered Payees)

```
Accounts creates voucher
    ↓
Admin approves → OTP sent to payee mobile
    ↓
Accounts contacts payee, collects OTP, enters it in app
    ↓
System verifies → status: Completed
```

### Document Flow (Ad-Hoc Payees)

```
Accounts creates voucher
    ↓
Admin approves → "document required" flag set
    ↓
Accounts uploads invoice / receipt (base64, stored in Supabase Storage)
    ↓
Admin reviews document and attests
    ↓
status: Completed
```

---

## 7. Suspense Advance Vouchers

The Suspense Voucher system manages **petty cash / staff advance disbursements**. A staff member is given an advance; they submit their expenses through a dedicated SMS link (no app login required); Accounts reviews and generates linked payment vouchers per expense.

### Voucher Numbering

`SUS-2025-26-00001` (separate series from standard vouchers)

### Suspense Voucher Status Lifecycle

```
Created by Accounts
    ↓
pending_approval ──── Admin Rejects ──▶ rejected (terminal)
    ↓
Admin Approves
    ↓
awaiting_payee_otp  (OTP sent to staff — advance receipt confirmation)
    ↓
Accounts/Admin collects OTP from staff, enters it in app
    ↓
open  ◀──────────────────────── Top-Up approved (reopens if was closed)
    ↓
Staff submits expenses via SMS link / Accounts adds entries directly
    ↓
partial  (some entries approved, balance > 0)
    ↓
Accounts manually closes voucher
    ↓
closed  (SMS link deactivated)
```

### Role-by-Role Summary

| Action | Accounts | Admin | Auditor | Staff (SMS) |
|---|:---:|:---:|:---:|:---:|
| Create suspense voucher | ✅ | — | — | — |
| Approve / reject voucher | — | ✅ | — | — |
| Share advance receipt OTP with Accounts | — | — | — | ✅ |
| Verify advance OTP (activate SMS link) | ✅ | ✅ | — | — |
| Submit expense entry | ✅ | — | — | ✅ |
| Attach bill photo | ✅ | — | — | ✅ |
| Upload & classify suspense-level attachment | ✅ | — | — | — |
| Review & approve entries | ✅ | — | — | — |
| Combine entries into one voucher | ✅ | — | — | — |
| Approve resulting payment voucher | — | ✅ | — | — |
| Add top-up | ✅ | — | — | — |
| Approve / reject top-up | — | ✅ | — | — |
| Resend SMS link | ✅ | ✅ | — | — |
| Close voucher | ✅ | — | — | — |
| Propose HOA / Sub-Heading correction | — | — | ✅ | — |
| Batch-approve HOA corrections | — | ✅ | — | — |

### Staff Expense Submission (SMS Link — No Login Required)

Staff members receive an SMS with a personal settlement form URL after their advance OTP is verified.

The form allows the staff member to:

1. View their available balance
2. Submit expense entries (type, amount, description, head of account, receipt number)
3. Declare invoice availability (Yes / No with reason)
4. Attach bill photos via camera (direct capture), gallery, PDF upload, or QR-code-to-another-device transfer
5. Submit multiple entries sequentially
6. Request a top-up (via their Accounts contact)

The SMS link remains **active until the voucher is manually closed** by Accounts. A new top-up reopens a closed voucher and the same link continues to work.

### Attachment Classification on Suspense Vouchers

When Accounts uploads directly to a suspense voucher (not to a specific entry), they must classify the file:

| Category | Badge Colour | Copied to Payment Vouchers? |
|---|---|---|
| 🏦 Transfer Receipt | Blue | Yes — proves how funds reached the staff member |
| 🧾 Expense Bill | Green | No — stays on the suspense voucher only |

### Entry Review & Payment Voucher Generation

When reviewing a settlement entry, Accounts can:

- **Approve entry only** — balance is recalculated; no payment voucher created.
- **Approve & create Payment Voucher** — generates a linked standard payment voucher in `pending` status, carrying over all entry attachments and all suspense-level Transfer Receipt attachments.

### Combining Multiple Entries (Optional)

Accounts can select multiple `Pending Review` entries of the same head of account and combine them into a single payment voucher:

- Combined amount = sum of all selected entries
- Combined narration = each entry's description joined by ` | `
- All per-entry attachments + suspense-level Transfer Receipts are carried over
- Each entry records a back-link to the combined voucher

### Top-Up Flow

1. Accounts opens voucher → **Top Up** → enters amount and description
2. Admin receives notification → approves or rejects
3. On approval: balance increases; staff receives SMS with new balance; closed vouchers reopen automatically

### Auditor — Head of Account Correction Proposals

Auditors can propose corrections to `head_of_account` and `sub_head_of_account` on any voucher:

1. Auditor opens voucher → **✏️ Propose Correction** → selects new HOA/Sub-Heading and enters a reason
2. Proposal saved with status `pending`; Admin is notified
3. Admin opens **HOA Corrections** dashboard → batch-selects proposals → **✅ Approve Selected** or **✗ Reject**
4. On approval, the voucher is updated atomically; both Auditor and Accounts are notified
5. Full before/after snapshot is stored in `hoa_correction_proposals` for permanent audit trail

> Only one pending proposal is allowed per voucher at a time.

---

## 8. Pay Now Feature

The **Pay Now** feature lets authorised users execute payment directly from the voucher list, after a voucher reaches `completed` status.

### Visibility Rules

The **💳 Pay Now** button appears only when **all** of the following are true:

- `voucher.status === 'completed'`
- `voucher.payment_mode !== 'Cash'` (no electronic action for cash)
- User is Admin, Super Admin, **or** (Accounts role AND payment mode is Account Transfer)

### Pay Now Modal — UPI

| Device | Behaviour |
|---|---|
| Mobile / Android | Deep-link button: `upi://pay?pa=<id>&pn=<name>&am=<amount>&cu=INR&tn=Voucher <ref>` — opens UPI app directly |
| Desktop | QR code (220×220 px via api.qrserver.com) for scanning with any UPI app |

If no UPI ID is stored on the payee, a warning is shown prompting the user to edit the payee.

### Pay Now Modal — Account Transfer

Displays a bank details card with:
- Payee name, Account Number, IFSC, Bank Name, Amount, Voucher Reference

**📋 Copy All Details** button copies the full card as plain text to the clipboard.

### Paid From Account Field

Every voucher (standard and suspense) carries an optional **Paid From Account** field — a free-text field (with `<datalist>` autocomplete) recording which company or director account was used to make the payment (e.g., "HDFC Current A/C", "Director Ramesh Personal A/C").

The list of autocomplete options is managed per-company in **Settings → Pay From Accounts** (`company_payment_accounts` table).

---

## 9. Tally Export Feature

> Status: Designed and ready to build — awaiting client-side configuration data.

The app will generate a **Tally-compatible XML file** for import into Tally accounting software via:
> Gateway of Tally → Import Data → Vouchers → select `.xml` file

### One-Time Configuration Required (Client Action)

| Config Item | Description |
|---|---|
| Tally Company Name | Exact name as registered in Tally (must match exactly) |
| Payment Mode → Tally Ledger Mapping | e.g., `UPI` → `Canara Bank - UPI`, `Cash` → `Cash` |
| Head of Account → Tally Ledger Mapping | App HOA names mapped to Tally ledger/group names |

### Features to Be Built

| Feature | Ready to Build |
|---|---|
| "Download for Tally (XML)" button with date range selector | ✅ |
| Folder / Save-As location picker (browser File System API) | ✅ |
| One-time Tally config screen (company name + ledger mappings) | ✅ |
| Single `.xml` file — all vouchers in selected range | ✅ |
| Deductions handled correctly (net amount to Tally) | ✅ |

### XML Structure

Each approved payment voucher becomes a `<VOUCHER VCHTYPE="Payment">` entry with:
- **Credit side**: the bank/cash ledger (payment mode → Tally ledger)
- **Debit side**: the expense ledger (Head of Account → Tally ledger)
- Fields: `<DATE>`, `<VOUCHERNUMBER>`, `<NARRATION>`, `<AMOUNT>`

See [TALLY-EXPORT-SETUP.md](TALLY-EXPORT-SETUP.md) for the full XML sample and configuration checklist.

---

## 10. Reporting, Print & Excel Export

### Voucher Print

Professional printable layout (see [SAMPLE-VOUCHER.html](SAMPLE-VOUCHER.html)) with:
- Company header (name, address, GST)
- Voucher number and date
- Payee details and payment mode
- Narration / line-item breakdown
- Amount in figures and Indian words
- Signature blocks

### Consolidated Report

Date-range filtered report showing all vouchers for a company, with:
- Summary totals
- Filterable by date range and status

### Excel Export (XLSX)

Full voucher data exported via SheetJS. Columns:
`S.No | Voucher No | Date | Head | Sub Head | Payee | Narration | Invoice Ref | Mode | Amount | Status`

---

## 11. Notifications

### In-App Notifications

Real-time alerts delivered within the app for events including:
- New voucher submitted for approval
- Voucher approved or rejected
- OTP sent / verified
- Document uploaded / attested
- Settlement entry submitted
- Top-up requested / approved / rejected
- HOA correction proposed / approved / rejected

Unread count badge displayed on the dashboard.

### Push Notifications

Native device push notifications via the **Web Push API** with VAPID keys:
- Delivered even when the app is not open
- Includes vibration and action buttons (View / Dismiss)
- Managed per-device subscription stored in `push_subscriptions` table
- Requires `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` environment variables

---

## 12. Progressive Web App (PWA)

The app ships as a fully installable PWA:

| Feature | Detail |
|---|---|
| Installable | Add to Home Screen on mobile and desktop (standalone, portrait-primary) |
| Offline Support | Cache-first for static assets; network-first for API with offline fallback page |
| Cache Version | v12 — automatic stale-cache cleanup on activation |
| Background Sync | Pending actions queue and sync when connectivity is restored |
| Push Notifications | Native push via Web Push API |
| App Shortcuts | "Create Voucher" and "Pending Approvals" directly from home screen icon |
| Mobile UX | Hamburger menu, touch-friendly OTP input (6-field auto-focus), responsive tables and modals |

---

## 13. Database & Migrations

### Base Schema Tables (`supabase-schema.sql`)

`companies` · `users` · `payees` · `vouchers` · `voucher_series` · `notifications` · `user_companies` · `otp_sessions` · `narration_items`

### Migration History

| # | File | Description |
|---|---|---|
| 001 | `001_add_user_companies.sql` | Multi-company user access junction table |
| 002 | `002_add_heads_of_account.sql` | Chart of Accounts with 18 default heads |
| 003 | `003_add_push_subscriptions.sql` | Web Push notification subscriptions |
| 004 | `004_add_draft_status_and_narration_items.sql` | Draft vouchers + line-item narrations |
| 005 | `005_add_sub_heads_of_account.sql` | Hierarchical sub-categories under heads |
| 006 | `006_add_invoice_reference.sql` | Invoice/reference number on vouchers |
| 007 | `007_add_global_flag.sql` | Global flag for shared payees, heads, sub-heads |
| 008 | `008_add_document_verification.sql` | Ad-hoc payees, document upload + attestation |
| 009 | `009_copy_hoa_and_fix_global_subheads.sql` | Data migration: copy HoA across companies |
| 010 | `010_add_super_admin_flag.sql` | Super Admin role |
| 011 | `011_add_deductions.sql` | Deductions field on vouchers |
| 012 | `012_add_auditor_role.sql` | Auditor role |
| 012b | `012_suspense_bills_system.sql` | Suspense voucher system base tables |
| 013 | `013_fix_capture_sessions_attachment_fk.sql` | FK fix for capture sessions |
| 014 | `014_add_staff_payees_and_settlement_sessions.sql` | Staff payees + settlement sessions |
| 015 | `015_decouple_staff_payee_from_users.sql` | Decouple staff payee from user records |
| 016 | `016_add_staff_role.sql` | Staff role |
| 017 | `017_fix_financial_year_2026_27.sql` | Financial year 2026-27 support |
| 018 | `018_add_pending_approval_to_settlements_status.sql` | Top-up approval status for settlements |
| 019 | `019_add_voucher_link_to_settlements.sql` | Back-link: settlement entry → payment voucher |
| 020 | `020_add_suspense_settlement_flag_to_vouchers.sql` | Flag: voucher created from suspense entry |
| 021 | `021_suspense_advance_otp.sql` | OTP verification for advance disbursement |
| 022 | `022_attachment_category.sql` | Transfer Receipt vs Expense Bill classification |
| 023 | `023_add_pay_now_fields.sql` | Paid From Account + payee bank_name field |
| 024 | `024_company_payment_accounts.sql` | Company-managed "Pay From" account list |
| 025 | `025_add_hoa_correction_proposals.sql` | Auditor HOA correction proposals |
| 026 | `026_add_payment_tracking.sql` | Payment tracking fields |
| 027 | `027_add_payment_receipt_url.sql` | Payment receipt URL on vouchers |
| 028 | `028_add_password_auth.sql` | `password_hash` + `password_set_at` on users; `webauthn_credentials` table (per-device passkeys); `webauthn_challenges` table (challenge + company-select token storage) |

---

## 14. API Overview

All REST endpoints are served by `server-supabase.js`. Full details: [README.md — API Reference](README.md#api-reference).

### Endpoint Groups

| Group | Base Path | Key Operations |
|---|---|---|
| Health | `/api/health` | Service health check |
| OTP | `/api/otp/*` | Send and verify OTP |
| Authentication | `/api/users/login`, `/api/users/:id/session` | Login (auth-first, then company selection), session refresh |
| Password Management | `/api/users/:id/set-password`, `/api/auth/forgot-password`, `DELETE /api/users/:id/password` | Set / change password, OTP-based reset, Admin credential wipe |
| Device Lock (WebAuthn) | `/api/auth/webauthn/register/options`, `/register/verify`, `/login/options`, `/login/verify` | Register passkeys, authenticate via biometric |
| Registered Devices | `GET /api/users/:id/webauthn-credentials`, `DELETE /api/users/:id/webauthn-credentials/:credId` | List and remove registered devices |
| User Management | `/api/admin/onboard-user`, `/api/users/:id` | Onboard, edit, delete users |
| Companies | `/api/companies/*` | List companies, list company users |
| Payees | `/api/payees`, `/api/companies/:id/payees` | CRUD payees |
| Vouchers | `/api/vouchers`, `/api/companies/:id/vouchers` | Full voucher lifecycle |
| Voucher Actions | `/api/vouchers/:id/approve`, `/reject`, `/complete`, `/resend-otp` | Status transitions |
| Document Verification | `/api/vouchers/:id/upload-document`, `/approve-with-attestation` | Ad-hoc payee documents |
| Heads of Account | `/api/heads-of-account` | CRUD + bulk import |
| Sub-Heads | `/api/sub-heads-of-account` | CRUD + grouped listing |
| Notifications | `/api/users/:id/notifications` | Read and mark notifications |
| Push Subscriptions | `/api/users/:id/push-subscription` | Register/remove device subscriptions |
| Payment Accounts | `/api/companies/:id/payment-accounts`, `/api/payment-accounts` | Manage Pay From accounts |
| Debug | `/api/debug/*` | OTP sessions, voucher inspection, 2Factor test |

---

## 15. Deployment & Environment

### Vercel (Production)

`vercel.json` routes:
- `/api/*` → serverless function (`server-supabase.js`)
- Static assets → `public/`
- SPA fallback → `public/index.html`

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (server-side only) |
| `TWOFACTOR_API_KEY` | Yes | 2Factor.in API key for OTP SMS |
| `TWOFACTOR_TEMPLATE_NAME` | No | SMS template name on 2Factor.in (default: `Relish-Approvals`) |
| `VAPID_PUBLIC_KEY` | No | VAPID public key — push notifications disabled if not set |
| `VAPID_PRIVATE_KEY` | No | VAPID private key |
| `WEBAUTHN_RP_ID` | No | WebAuthn Relying Party ID (default: `relishvoucher.vercel.app`) |
| `WEBAUTHN_ORIGIN` | No | WebAuthn expected origin (default: `https://relishvoucher.vercel.app`) |
| `PORT` | No | Local server port (default: `3001`) |

### Local Development

```bash
npm install
npm start
# → http://localhost:3001
```

### Database Initialisation

1. Run `supabase-schema.sql` in Supabase SQL Editor
2. Run migrations `001` → `028` in order
3. Create Supabase Storage bucket named `voucher-documents`
4. Set environment variables

---

## License

**Private — Developed, maintained, and sole property of FoodStream Ltd. Hong Kong.**
Developed for M/s. Relish Foods Pvt. Ltd. & M/s. Relish Hao Hao Chi Foods.
