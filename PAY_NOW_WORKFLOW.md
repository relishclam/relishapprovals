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
