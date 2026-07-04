# Pay Now Workflow — RelishApprovals

## Overview

The **Pay Now** feature lets authorised users execute payment directly from the voucher list after a voucher has been completed. It provides a quick-action modal with mode-specific payment assistance — a UPI deep-link / QR code for UPI payments, and a copy-to-clipboard bank details card for Account Transfers.

A companion **Paid From Account** field on every voucher records which company or director account the payment was sent from.

---

## Database Schema

### `vouchers` (added by `migrations/023_add_pay_now_fields.sql`)

| Column | Type | Notes |
|---|---|---|
| `paid_from_account` | `TEXT` | Optional. Records which account the payment was sent from (e.g., "HDFC Current A/C") |

### `payees` (added by `migrations/023_add_pay_now_fields.sql`)

| Column | Type | Notes |
|---|---|---|
| `bank_name` | `TEXT` | Bank name — used in the Account Transfer details card |

### `company_payment_accounts` (created by `migrations/024_company_payment_accounts.sql`)

Managed list of "Pay From" accounts per company. Used to provide autocomplete suggestions in the voucher form.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key |
| `company_id` | `TEXT` | FK → `companies(id)` |
| `label` | `TEXT` | Display name, e.g., "HDFC Current A/C", "Director Ramesh Personal A/C" |
| `created_at` | `TIMESTAMPTZ` | |

RLS is enabled; a `FOR ALL` service-role policy grants full access.

---

## API Routes

All routes are in `server-supabase.js`.

### Company Payment Accounts

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/companies/:companyId/payment-accounts` | List all payment accounts for a company, ordered by `created_at ASC` |
| `POST` | `/api/payment-accounts` | Add a new account — body: `{ companyId, label }` |
| `DELETE` | `/api/payment-accounts/:id` | Remove a payment account |

**Validation** on `POST`: both `companyId` and `label` are required; returns `400` otherwise.

---

## Frontend (public/app.js)

### API Client Methods

```js
api.getPaymentAccounts(companyId)    // GET /api/companies/:companyId/payment-accounts
api.addPaymentAccount({ companyId, label })  // POST /api/payment-accounts
api.deletePaymentAccount(id)         // DELETE /api/payment-accounts/:id
```

---

## Voucher Creation & Edit — "Paid From Account" Field

Both the **Create Voucher** form and the **Edit Voucher** modal include an optional **Paid From Account** field.

- Free-text `<input>` backed by a `<datalist>` populated from `paymentAccounts` state.
- Saved to `vouchers.paid_from_account` on create and on edit.
- Displayed in the voucher detail view if set.
- `paymentAccounts` is fetched once on component mount via `api.getPaymentAccounts(user.company.id)`.

---

## Pay Now Button — Visibility Rules

The **💳 Pay Now** button appears in the voucher list table only when **all** of the following are true:

1. `voucher.status === 'completed'`
2. `voucher.payment_mode !== 'Cash'` (Cash vouchers have no electronic payment action)
3. The current user satisfies **one** of:
   - `user.role === 'admin'`
   - `user.isSuperAdmin === true`
   - `user.role === 'accounts'` **AND** `voucher.payment_mode === 'Account Transfer'`

> Accounts-role users can only Pay Now for Account Transfer vouchers, not UPI.

---

## Pay Now Modal

Triggered by `setPayNowVoucher(v)`. Modal title: **💳 Pay Now — {serial_number}**.

### Summary Card (always shown)

| Field | Source |
|---|---|
| Payee | `v.payee_name` |
| Amount | `v.amount` (formatted ₹) |
| Mode | `v.payment_mode` |
| Paid From | `v.paid_from_account` (only shown if set) |

### UPI Payment — No UPI ID

If `v.payment_mode === 'UPI'` and `v.payee_upi_id` is empty:

> ⚠️ *No UPI ID recorded for this payee. Edit the payee to add their UPI ID.*

### UPI Payment — Mobile Device

Deep-link button using `upi://pay?` URL:

```
upi://pay?pa=<upi_id>&pn=<payee_name>&am=<amount>&cu=INR&tn=Voucher <serial_number>
```

Renders as: **Open UPI App →** (green button). UPI ID shown below for reference.

Device detection: `navigator.userAgent` checked for `Mobi|Android`.

### UPI Payment — Desktop

QR code rendered via `api.qrserver.com`:

```
https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=<encoded_upi_url>&bgcolor=ffffff&color=1a1a1a&margin=10
```

220×220 px image. UPI ID shown below the QR code.

### Account Transfer

Displays a bank details card:

| Field | Source |
|---|---|
| Payee | `v.payee_name` |
| Account No | `v.payee_bank_account` |
| IFSC | `v.payee_ifsc` |
| Bank | `v.payee_bank_name` |
| Amount | `v.amount` (formatted ₹) |
| Reference | `v.serial_number` |

**📋 Copy All Details** button copies all fields as plain text to the clipboard using `navigator.clipboard.writeText()`. Toast: *"Bank details copied"*.

---

## Settings — Pay From Accounts Management

Component: `PaymentAccountsManagement` (accessible from the Settings section).

- **Add**: enter a label, press Enter or click Add. Duplicate labels (case-insensitive) are rejected with a toast.
- **Delete**: confirmation dialog before removal.
- The list populates the `<datalist>` autocomplete in the voucher create and edit forms.

---

## Data Flow Summary

```
Settings → Add "HDFC Current A/C" → company_payment_accounts
                                           ↓
Create/Edit Voucher → "Paid From Account" autocomplete
                    → vouchers.paid_from_account = "HDFC Current A/C"

Voucher list (status=completed, mode≠Cash, authorised role)
  → 💳 Pay Now button
  → Pay Now Modal
      ├── UPI + mobile  → upi:// deep link
      ├── UPI + desktop → QR code (api.qrserver.com)
      └── Account Transfer → bank details card + clipboard copy
```

---

## Payee Fields Required for Pay Now

| Payment Mode | Required Payee Fields |
|---|---|
| UPI | `upi_id` |
| Account Transfer | `bank_account`, `ifsc`, `bank_name` |

These are set when creating or editing a payee. The `bank_name` column was added in `migrations/023_add_pay_now_fields.sql`.

---

## Payment Tracking — Awaiting Payment & Paid

> Added by `migrations/026_add_payment_tracking.sql` and `migrations/027_add_payment_receipt_url.sql`.

**Pay Now** (above) is a modal that *assists* execution of a payment — it does not record that the payment actually happened. The **Payment Tracking** feature closes that loop by moving a voucher through two final statuses after it is `completed`.

### Status Flow

```
completed
    ↓
awaiting_payment   (Accounts queues the voucher — optional holding step)
    ↓
paid               (Accounts confirms payment with UTR / receipt)
```

Accounts can also skip the queue and go directly from `completed` → `paid`.

---

### New Voucher Statuses

| Status | Description |
|---|---|
| `awaiting_payment` | Voucher is `completed` and queued for payment by Accounts |
| `paid` | Payment has been confirmed — UTR reference and/or receipt uploaded |

---

### API Endpoints

| Method | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/api/vouchers/:id/mark-awaiting-payment` | Move `completed → awaiting_payment`. Body: `{ markedBy }` | Accounts / Super Admin |
| `POST` | `/api/vouchers/:id/mark-paid` | Confirm payment (`awaiting_payment\|completed → paid`). Body: `{ paidBy, paymentReference?, paymentNotes?, receiptData?, receiptMimeType? }` | Accounts / Super Admin |
| `POST` | `/api/vouchers/:id/dequeue-payment` | Defer payment back to `completed`. Body: `{ dequeuedBy }` | Accounts / Admin / Super Admin |

**Validation on `mark-paid`:** At least one of `paymentReference` (UTR/transaction ID) or `receiptData` (base64 receipt image/PDF) must be provided. Returns `400` otherwise.

---

### New Database Fields (on `vouchers` table)

| Column | Type | Notes |
|---|---|---|
| `status` | `TEXT` | Extended to include `awaiting_payment` and `paid` |
| `queued_for_payment_by` | `UUID` | FK → `users(id)` — who queued the voucher |
| `queued_at` | `TIMESTAMPTZ` | When the voucher was queued |
| `payment_reference` | `TEXT` | UTR number / transaction reference |
| `payment_notes` | `TEXT` | Optional free-text payment notes |
| `payment_receipt_url` | `TEXT` | Public URL of the uploaded payment receipt (stored in `voucher-bills` bucket) |
| `paid_by` | `UUID` | FK → `users(id)` — who confirmed payment |
| `paid_at` | `TIMESTAMPTZ` | When payment was confirmed |

---

### Mark-Paid Receipt Upload

When `receiptData` is provided (base64-encoded image or PDF), the receipt is:

1. Decoded and uploaded to Supabase Storage: `voucher-bills/{companyId}/payment-receipts/{voucherId}/receipt_{timestamp}.{ext}`
2. The public URL is stored in `vouchers.payment_receipt_url`
3. If storage upload fails, the payment is still confirmed (with a console warning) — the process does not abort

---

### Notifications

| Event | Who is Notified |
|---|---|
| Voucher queued (`awaiting_payment`) | Voucher preparer — in-app notification |
| Payment confirmed (`paid`) | Voucher preparer — in-app + push notification |

---

### Roles

| Action | Accounts | Admin | Super Admin |
|---|:---:|:---:|:---:|
| Queue for payment (`awaiting_payment`) | ✅ | — | ✅ |
| Confirm payment (`paid`) | ✅ | — | ✅ |
| Dequeue (defer back to `completed`) | ✅ | ✅ | ✅ |

---

## Pay Now for Suspense Voucher Top-Ups

> Added by `migrations/029_add_topup_payment_tracking.sql`.

Every **approved top-up** on a suspense voucher is an outward payment to the staff payee and must be reconciled in full — the same way a regular voucher payment is.

### Why This Matters

A suspense top-up is money leaving the company's account and going to the staff member. Without payment tracking it was invisible: the balance increased but there was no proof that the funds were actually transferred. This feature closes that gap.

This also covers the **negative-balance (out-of-pocket) scenario**: when a staff member's approved expenses exceed the advance, the balance goes negative. A top-up to cover the deficit is a reimbursement of out-of-pocket spending. The Pay Now flow ensures that reimbursement is executed and documented.

---

### Status Lifecycle for Top-Ups

Top-ups are stored as rows in `suspense_settlements` with `entry_type = 'topup'`.

```
pending_approval  ──── Admin Rejects ──→  rejected
      ↓
   approved  (balance credited, SMS sent to staff)
      ↓
  💳 Pay Now button visible to Admin / Super Admin
      ↓
     paid  (payment_status = 'paid', UTR and/or receipt stored)
```

> There is no separate `awaiting_payment` step for top-ups. Because Admin already approved the top-up, they are automatically in the loop and can proceed directly to Pay Now → Confirm Payment.

---

### Pay Now Button — Visibility Rules (Top-Ups)

The **💳 Pay Now** button appears on a top-up row in the Settlement Entries table when **all** of the following are true:

1. `s.entry_type === 'topup'`
2. `s.status === 'approved'`
3. `s.payment_status` is `null` (not yet paid)
4. `user.role === 'admin'` or `user.isSuperAdmin === true`

---

### Pay Now Modal (Top-Up)

Triggered by `setPayNowTopup(buildTopupPayNow(s))`. Modal title: **💳 Pay Top-Up — {serial_number}**.

The modal is self-contained inside `SuspenseVoucherDetail`. It uses the staff payee's bank / UPI details from the parent suspense voucher.

#### Summary Card

| Field | Source |
|---|---|
| Payee (Staff) | `sv.staff_payee.name` |
| Top-Up Amount | `s.amount` |
| Mode | `sv.payment_mode` |
| Reason | `s.description` (the reason Accounts gave when requesting the top-up) |

#### Mode-Specific Content

Identical to regular Pay Now:

| Mode | Content |
|---|---|
| UPI + mobile | `upi://pay?` deep-link → **Open UPI App →** |
| UPI + desktop | QR code via `api.qrserver.com` (220×220 px) |
| Account Transfer | Bank details card + **📋 Copy All Details** button. Reference shown as `{serial_number} (Top-Up)` |
| Cash | Plain instruction to hand cash to the staff member |

#### Payee Fields (from `payees` via `suspense_vouchers.staff_payee_id`)

| Payment Mode | Required Fields |
|---|---|
| UPI | `payees.upi_id` |
| Account Transfer | `payees.bank_account`, `payees.ifsc`, `payees.bank_name` |

> The GET `/api/suspense-vouchers/:id` query was extended to fetch `upi_id, bank_account, ifsc, bank_name` from the `payees` join.

#### Footer

**✅ Confirm Payment →** — always visible for Admin / Super Admin regardless of payment mode. Closes the Pay Now modal and opens the Mark Paid modal.

---

### Mark Paid Modal (Top-Up)

Triggered after clicking **✅ Confirm Payment →** in the Pay Now modal.

- **UTR / Transaction ID** — free-text input (optional if receipt is uploaded)
- **Payment Receipt** — image or PDF upload, max 5 MB (optional if UTR is entered)
- **Notes** — optional free-text
- **Validation**: at least one of UTR or receipt is required — returns an error toast otherwise
- On confirm: calls `api.markTopupPaid(...)` → `POST /api/suspense-settlements/:id/mark-topup-paid`

After success: the settlement row immediately shows a **✅ Paid** badge with the UTR (if set) and a **📎 Receipt** link (if uploaded).

---

### API Endpoint

| Method | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/api/suspense-settlements/:id/mark-topup-paid` | Confirm top-up payment. Body: `{ paidBy, paymentReference?, paymentNotes?, receiptData?, receiptMimeType? }` | Admin / Super Admin only |

**Validation:** entry must be `entry_type = 'topup'`, `status = 'approved'`, and `payment_status` must be `null`. Returns `400` otherwise.

---

### New Database Fields (on `suspense_settlements` table)

| Column | Type | Notes |
|---|---|---|
| `payment_status` | `TEXT` | `NULL` = not yet paid; `'paid'` = confirmed |
| `payment_reference` | `TEXT` | UTR number / transaction reference |
| `payment_receipt_url` | `TEXT` | Public URL of the uploaded receipt (stored in `voucher-bills` bucket under `{companyId}/topup-receipts/{settlementId}/`) |
| `payment_notes` | `TEXT` | Optional free-text notes |
| `paid_by` | `UUID` | FK → `users(id)` — Admin who confirmed payment |
| `paid_at` | `TIMESTAMPTZ` | When payment was confirmed |

---

### Receipt Storage Path

```
voucher-bills/{companyId}/topup-receipts/{settlementId}/receipt_{timestamp}.{ext}
```

Same bucket (`voucher-bills`) as regular voucher receipts, different path prefix.

---

### Notifications

| Event | Who is Notified |
|---|---|
| Top-up payment confirmed | Suspense voucher creator (in-app) |
| Top-up payment confirmed | Accounts user who submitted the top-up request (in-app) |

---

### Roles

| Action | Accounts | Admin | Super Admin |
|---|:---:|:---:|:---:|
| Submit top-up request | ✅ | — | ✅ |
| Approve / Reject top-up | — | ✅ | ✅ |
| Pay Now (execute payment) | — | ✅ | ✅ |
| Confirm payment (`paid`) | — | ✅ | ✅ |

---

### Data Flow Summary

```
Accounts submits top-up → pending_approval
       ↓
Admin approves → approved (balance increases, SMS to staff)
       ↓
💳 Pay Now button appears on top-up row (Admin / Super Admin)
       ↓
Pay Now Modal
    ├── UPI + mobile  → upi:// deep link
    ├── UPI + desktop → QR code
    ├── Account Transfer → bank details card + clipboard copy
    └── Cash → plain instruction
       ↓
✅ Confirm Payment → Mark Paid Modal
    ├── UTR reference (text)
    └── Receipt upload (image / PDF → Supabase Storage)
       ↓
payment_status = 'paid'
Settlement row shows: ✅ Paid · UTR: xxx · 📎 Receipt
```
