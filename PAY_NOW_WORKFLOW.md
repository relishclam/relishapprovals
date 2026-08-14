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

---

## Receipt Storage Naming Convention

> Updated by migrations 029/030 implementation (Jul 2026).

All payment receipts are now stored with **human-readable names** regardless of the opaque filename assigned by the bank/UPI app (e.g. `HDFC_TXN_20260709.pdf`). The bank's filename is discarded on upload; our convention is applied server-side.

| Payment type | Storage path |
|---|---|
| Regular voucher | `voucher-bills/{companyId}/payment-receipts/{voucherId}/{serial}-PMT-{DD}-{Mon}-{YYYY}.{ext}` |
| Suspense advance | `voucher-bills/{companyId}/advance-receipts/{svId}/{serial}-ADV-{DD}-{Mon}-{YYYY}.{ext}` |
| Top-up | `voucher-bills/{companyId}/topup-receipts/{settlementId}/{serial}-TOPUP-{DD}-{Mon}-{YYYY}.{ext}` |
| Payment batch | `voucher-bills/{companyId}/batch-receipts/{batchId}/receipt_{timestamp}.{ext}` |
| Additional batch receipt | `voucher-bills/{companyId}/batch-receipts/{batchId}/receipt_{timestamp}.{ext}` |
| Unassigned receipt | `voucher-bills/{companyId}/unassigned-receipts/{timestamp}-{random}.{ext}` |

Example: `SV-2026-27-001-TOPUP-09-Jul-2026.pdf`

The extension (`pdf`, `jpeg`, `png`, `webp`) matches the actual uploaded file type.

> **Note:** Batch receipt paths use a timestamp suffix rather than the human-readable `{serial}-PMT-{DD}-{Mon}` convention — batches cover multiple vouchers so a single serial cannot be used.

---

## Receipt Share-to-App: Cross-Device Routing (Migration 033)

### Problem

RBI/NPCI intent-based payment limits (₹2,000) mean Admin **must** scan the QR from a second device. This is the standard real-world flow:

```
Device A (desktop / Accounts phone)   →   Pay Now modal open, QR displayed
Device B (Admin's phone)              →   Scans QR, pays via UPI/Bank app,
                                           downloads receipt, taps Share
```

`localStorage` is per-device, so the routing context set on Device A is invisible to Device B. `migrations/033_pending_share_context.sql` fixes this with a server-side consume-once context stored on the `users` table.

### Routing Logic

When `window.onReceiptShared` fires (from either the service worker or the `_pendingSharedReceipt` fallback):

```
1. localStorage (same-device fast path, ~0 ms, sync)
   └─ context found + not expired → route to modal immediately; done.
   └─ expired → discard and fall through.

   No valid localStorage context:

2. OCR scan starts IMMEDIATELY — no waiting for a server round-trip.
   └─ _runReconcile() called → "Identifying voucher…" shown right away
   └─ api.autoCompleteReceipt() begins (OCR + match + mark-paid if successful)

3. Server DB context check fires IN PARALLEL with step 2 (~200 ms)
   └─ api.consumePendingShareContext() — consume-once GET, clears DB row
   └─ If context found → _contextFound = true, scan UI cancelled,
      route to modal (cross-device Pay Now path)
   └─ If no context → scan result applies as normal
```

**`_contextFound` guard:** if the server context returns before `autoCompleteReceipt`
completes (~200 ms vs ~10–30 s), the client ignores the scan result. The server
still finishes writing the payment; `refreshVouchers()` is called immediately so
the UI reflects the paid status before any confirmation modal tries to act on it.

**Defensive paid-guard:** if the server context routes to a voucher that was
already marked paid by `autoCompleteReceipt` (rare timing edge case), the
confirmation modal is skipped silently — the receipt is already on the voucher.

All paths end in either `_routeCtx()` (context modal) or `_runReconcile()` (scan UI).

### Pay Now Context Lifecycle

When a Pay Now modal opens (voucher, advance, or topup), two copies of the context are written:

- **localStorage** — same-device fast path (15-minute expiry)
- **Server DB** (`users.pending_share_ctx`) — cross-device path (15-minute expiry)

When the Pay Now modal **closes** (for any reason, including a page reload triggered
by the share redirect), both copies are cleared:

- localStorage: removed by the effect cleanup
- Server DB: `api.clearPendingShareContext(userId)` is called from the effect cleanup

This ensures a stale context from a previous Pay Now session can never hijack a
later unrelated share and open the confirmation modal unexpectedly.

---

## PWA Web Share Target — Receipt Share Implementation

> No custom Android wrapper is required. The app registers itself as a share target natively via the PWA manifest and a service worker.

### How It Works

The app is installed as a PWA (or via TWA) — no custom Android wrapper app is needed.

`public/manifest.json` declares `share_target`:

```json
"share_target": {
  "action": "/share-target",
  "method": "POST",
  "enctype": "multipart/form-data",
  "params": {
    "files": [{ "name": "receipt", "accept": ["application/pdf", "image/jpeg", "image/png", "image/webp"] }]
  }
}
```

This makes **Relish Approvals** appear in the Android share sheet whenever a user shares an image or PDF from any app (PhonePe, Google Pay, HDFC, ICICI, etc.).

### Service Worker — Share Handler (`public/service-worker.js`)

When Android delivers the share, it POSTs `multipart/form-data` to `/share-target`. The service worker intercepts this (it is the only place where POST form-data is accessible in a PWA):

1. Reads the `receipt` file field from the form data
2. Converts to base64 using chunked `btoa` (avoids stack overflow on large PDFs)
3. Stashes the payload as JSON in the `relish-share-pending` named cache at `/_share_pending`
4. **If the app is already running (backgrounded):** posts a `SHARE_AVAILABLE` message to all active window clients so OCR starts immediately — no page reload needed. The running app fetches `/_share_pending` (consume-once) and fires `window.onReceiptShared`.
5. Redirects the app to `/?incoming-share=1` (303). If step 4 already consumed `/_share_pending`, the reloaded app finds the cache empty and skips processing — preventing duplication.

A debug breadcrumb log is maintained in `relish-share-debug` cache at `/_share_debug` (newest-first, max 10 entries) for diagnosing timing issues.

### App Layer — Consuming the Share

**App already running (backgrounded — fastest path):**
- Receives `SHARE_AVAILABLE` postMessage from the service worker
- Fetches `/_share_pending` immediately (consume-once — prevents duplicate processing by the subsequent redirect)
- Fires `window.onReceiptShared` → routing + OCR scan starts without any page reload

**App launched cold (redirect path):**
- Detects `?incoming-share=1` URL param on mount
- Removes the param from the URL via `history.replaceState` to prevent re-trigger on refresh
- Fetches `/_share_pending` (consume-once)
- Fires `window.onReceiptShared` → OCR scan starts

**Compatibility fallback (`_pendingSharedReceipt`):**
If a native WebView bridge (or any other mechanism) fires a share before `window.onReceiptShared` is registered, it can write `window._pendingSharedReceipt = { mimeType, base64Data, fileName }`. The `useEffect` consumes it once the handler is registered — no share is silently dropped.

### End-to-end flow

```
Admin's Phone (Relish Approvals installed as PWA)
─────────────────────────────────────────────────
1. UPI/Bank app shows "Share" button after transaction
2. Admin taps Share → Android share sheet opens
3. "Relish Approvals" appears ← manifest.json share_target
4. Admin taps "Relish Approvals"
5. Android POSTs multipart/form-data to /share-target
6. Service worker reads file → base64 → stashes in cache
7. SW posts SHARE_AVAILABLE (if app running) OR redirects to /?incoming-share=1
8. App fetches /_share_pending (consume-once)
9. window.onReceiptShared() fires in React
10. Routing logic (localStorage → scan + server context in parallel)
11. Receipt processed (auto-complete / manual confirm / queued)
```

---

### Testing checklist

- [ ] Install the PWA on Android (Add to Home Screen) → open Google Pay → make a small test payment → tap "Share receipt" → "Relish Approvals" appears in the share sheet
- [ ] Share a receipt while the app is **backgrounded** → app comes to foreground and OCR starts immediately (SHARE_AVAILABLE message path)
- [ ] Share a receipt while the app is **closed** → app launches cold via `/?incoming-share=1`, receipt is not dropped
- [ ] Share a screenshot from gallery → Relish opens on Reconcile screen
- [ ] With Pay Now modal open on desktop for a specific voucher → Admin shares receipt on phone → server-side context routes to the correct Mark Paid modal (cross-device path)

---

## Combine & Pay — Payment Batches

> Added by `migrations/032_payment_batches.sql` and `migrations/035_batch_multiple_receipts.sql`.

When the same payee must be paid for multiple vouchers in the same payment run, Accounts can combine them into a single bank transfer. This avoids multiple NEFT/IMPS charges and gives Accounts one UTR to record instead of many.

### Eligibility Rules

A voucher can be added to a batch only if:
1. Its status is `awaiting_payment` **or** `completed`
2. Its `payment_mode` is `UPI` or `Account Transfer` — Cash vouchers cannot be batched
3. All vouchers in the batch share the **same `payee_id`** and the **same `payment_mode`**
4. The batch must contain **at least 2 vouchers**

These rules are enforced both at the API layer and by a hard Postgres trigger (`check_batch_voucher_compatibility`) that raises an exception on violation.

### Batch Reference Format

```
CPAY-{FY}-{00001}       e.g. CPAY-2026-27-00001
```

The CPAY sequence counter (`payment_batch_series`) is per-company and resets each financial year. A **CPAY Key** is derived for use in bank transfer remarks fields (banks reject dashes):

```
CPAY-2026-27-00001  →  CPAY1
```

### Status Lifecycle

```
pending
    ├── mark-paid  →  paid       (all member vouchers set to status='paid')
    └── cancel     →  cancelled  (all member vouchers released back to queue)
```

> `partially_reversed` is reserved in the CHECK constraint for a future reversal phase. No code currently transitions into that state.

### Individual Mark-Paid Guard

`POST /api/vouchers/:id/mark-paid` returns `400` if the voucher is locked in a **pending** batch:

> *"This voucher is part of pending payment batch CPAY-2026-27-00001. Pay or cancel the batch instead of marking this voucher individually."*

### Database Schema

#### `payment_batches`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `company_id` | `TEXT` | FK → `companies(id)` |
| `batch_reference` | `TEXT` | `CPAY-{FY}-{00001}` — unique per company |
| `payee_id` | `UUID` | FK → `payees(id)` — all members must share this |
| `payment_mode` | `TEXT` | `UPI` or `Account Transfer` |
| `total_amount` | `DECIMAL(15,2)` | Sum of all member voucher amounts |
| `status` | `TEXT` | `pending`, `paid`, `cancelled`, `partially_reversed` |
| `payment_reference` | `TEXT` | UTR / transaction ID (set on mark-paid) |
| `payment_notes` | `TEXT` | Optional free-text |
| `payment_receipt_url` | `TEXT` | Primary receipt URL (first/only receipt) |
| `paid_by` | `UUID` | FK → `users(id)` |
| `paid_at` | `TIMESTAMPTZ` | |
| `cancelled_by` | `UUID` | FK → `users(id)` |
| `cancelled_at` | `TIMESTAMPTZ` | |
| `cancellation_reason` | `TEXT` | |
| `created_by` | `UUID` | FK → `users(id)` |
| `created_at` | `TIMESTAMPTZ` | |

#### `payment_batch_vouchers`

Join table. A voucher can belong to at most **one** active batch (enforced by `UNIQUE(voucher_id)`).

| Column | Type | Notes |
|---|---|---|
| `batch_id` | `UUID` | FK → `payment_batches(id)` ON DELETE CASCADE |
| `voucher_id` | `UUID` | FK → `vouchers(id)` |

#### `payment_batch_receipts` (Migration 035)

Allows multiple receipts per batch (e.g. Accounts makes the batch in bulk but then pays individually and needs to attach each sub-receipt).

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `batch_id` | `UUID` | FK → `payment_batches(id)` ON DELETE CASCADE |
| `receipt_url` | `TEXT` | Public URL |
| `payment_reference` | `TEXT` | UTR for this individual sub-payment (optional) |
| `notes` | `TEXT` | |
| `uploaded_by` | `UUID` | FK → `users(id)` |
| `uploaded_at` | `TIMESTAMPTZ` | |

#### `vouchers.batch_id` (Migration 035)

Back-link added to `vouchers` so the frontend can identify which batch paid a voucher without a join query.

| Column | Type | Notes |
|---|---|---|
| `batch_id` | `UUID` | FK → `payment_batches(id)` — set by `batch_mark_paid` RPC |

#### `payment_batch_series`

Sequence counter per company used by the `get_next_batch_reference` Postgres RPC.

### Postgres RPCs

| RPC | Description |
|---|---|
| `get_next_batch_reference(p_company_id)` | Returns next `CPAY-{FY}-{seq}` reference (row-locked, same idiom as voucher number) |
| `cancel_payment_batch(p_batch_id, p_cancelled_by, p_reason)` | Sets batch to `cancelled`, removes all `payment_batch_vouchers` rows, returns `{ batch_reference, vouchers_released }` |
| `batch_mark_paid(p_batch_id, p_paid_by, p_payment_reference, p_payment_notes, p_receipt_url)` | Atomic transaction: sets batch to `paid`, sets all member vouchers to `status='paid'`, writes `paid_by/paid_at/payment_reference/batch_id` on each voucher. Returns `{ vouchers_paid }` |

### API Endpoints

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/api/companies/:companyId/batches` | List all batches (all statuses, most recent first), with member vouchers | Authenticated |
| `POST` | `/api/batches` | Create a batch. Body: `{ createdBy, companyId, voucherIds[] }` (≥2 IDs) | Accounts / Admin / Super Admin |
| `POST` | `/api/batches/:id/cancel` | Cancel a batch and release member vouchers. Body: `{ cancelledBy, reason? }` | Accounts / Admin / Super Admin |
| `POST` | `/api/batches/:id/mark-paid` | Confirm payment. Body: `{ paidBy, paymentReference?, paymentNotes?, receiptData?, receiptMimeType? }` | Accounts / Admin / Super Admin |
| `GET` | `/api/batches/:id` | Get batch details + member vouchers | Authenticated |
| `POST` | `/api/batches/:id/generate-receipt` | Regenerate the CPAY HTML acknowledgment receipt. Body: `{ requestedBy }` | Accounts / Admin / Super Admin |
| `GET` | `/api/companies/:companyId/batch-register` | All batches for a company with members and amounts | Authenticated |
| `GET` | `/api/batches/:id/receipts` | List all receipts for a batch (ordered by upload time) | Authenticated |
| `POST` | `/api/batches/:id/receipts` | Upload an additional receipt to a batch (pending or paid). Body: `{ uploadedBy, receiptData, receiptMimeType, paymentReference?, notes? }` | Accounts / Admin / Super Admin |

**Validation on `POST /api/batches/:id/mark-paid`:** At least one of `paymentReference` or `receiptData` is required. Returns `400` otherwise.

**Auto-cancel orphaned batches:** `POST /api/batches` automatically cancels any pending batch that already contains the requested vouchers (handles UI crashes that left an orphaned `pending` batch holding the `UNIQUE(voucher_id)` constraint).

### CPAY HTML Acknowledgment Receipt

After `batch_mark_paid` succeeds, the server asynchronously calls `_generateAndStoreCpayReceipt(batchId)`. This generates a styled HTML page listing the batch reference, payee, UTR, total amount, and all member vouchers, and stores it in Supabase Storage. The URL is written back to `payment_batches.payment_receipt_url`. The receipt can also be regenerated on demand via `POST /api/batches/:id/generate-receipt`.

### Frontend — API Client Methods

```js
api.getPendingBatches(companyId)          // GET /api/companies/:companyId/batches
api.createBatch({ createdBy, companyId, voucherIds })
api.cancelBatch(batchId, { cancelledBy, reason })
api.markBatchPaid(batchId, { paidBy, paymentReference, paymentNotes, receiptData, receiptMimeType })
api.getBatch(batchId)
api.getBatchRegister(companyId)
api.getBatchReceipts(batchId)
api.addBatchReceipt(batchId, { uploadedBy, receiptData, receiptMimeType, paymentReference, notes })
```

### Frontend — Combine & Pay UX

- Checkboxes appear in the `awaiting_payment` filter view only.
- Selecting the first voucher sets `batchConstraint = { payeeId, paymentMode }`. Vouchers with a different payee or mode are greyed out with a tooltip.
- A floating action bar appears when ≥2 compatible vouchers are checked, showing the running total and a **"💳 Combine & Pay (N)"** button.
- Clicking **Combine & Pay** calls `api.createBatch(...)` and, on success, opens the **Batch Pay Now modal**.
- The Batch Pay Now modal shows the payee's bank/UPI details, the CPAY Key (for bank remarks), the total amount, a UTR input, and a receipt upload field.
- After confirming, calls `api.markBatchPaid(...)` → notifications sent to all voucher preparers.
- **Cancel batch** sends a notification to the batch creator (if different from the canceller).
- Paid vouchers display a **"Paid via Batch: CPAY-..."** badge. The voucher detail panel shows all other vouchers covered by the same batch under "Batch Covers".

### Batch Receipts Modal

Accessible from the voucher list and voucher detail panel (📎 **View / Add Batch Receipts** button, visible to Accounts / Admin / Super Admin when `voucher.batch_id` is set). Displays all receipts uploaded against the batch and allows uploading additional receipts.

### Notifications

| Event | Who is Notified |
|---|---|
| Batch marked paid | All voucher preparers whose vouchers are in the batch (in-app) |
| Batch cancelled | Batch creator (in-app, if different from canceller) |

### Roles

| Action | Accounts | Admin | Super Admin |
|---|:---:|:---:|:---:|
| Create batch | ✅ | ✅ | ✅ |
| Cancel batch | ✅ | ✅ | ✅ |
| Mark batch paid | ✅ | ✅ | ✅ |
| Upload additional receipt | ✅ | ✅ | ✅ |

### Data Flow Summary

```
awaiting_payment filter → select ≥2 vouchers (same payee + mode)
    ↓
💳 Combine & Pay (N) — floating action bar
    ↓
POST /api/batches → CPAY-2026-27-00001 created
    ↓
Batch Pay Now modal
    ├── UPI       → QR code / deep-link + CPAY Key for bank remarks
    └── ACCT      → bank details card + CPAY Key for remarks
    ↓
✅ Confirm → POST /api/batches/:id/mark-paid (atomic RPC)
    ├── All member vouchers → status='paid', batch_id set
    ├── Notifications sent to preparers
    └── CPAY HTML receipt generated async
```

---

## Share-Target Auto-Complete (Migration 036)

> Backend implementation of the "Reconcile" path in the [Cross-Device Routing](#receipt-share-to-app-cross-device-routing-migration-033) flow.

When a receipt arrives via `window.onReceiptShared` and there is **no routing context** (neither `localStorage` nor the server DB has a pending Pay Now context), the app calls `POST /api/receipts/auto-complete`. This single endpoint does OCR extraction, batch/voucher matching, upload, and mark-paid — or parks the receipt in the Unassigned Receipts queue if matching fails.

### Endpoint

| Method | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/api/receipts/auto-complete` | OCR → match → complete. Body: `{ requestedBy, companyId, receiptData, receiptMimeType }` | Accounts / Admin / Super Admin |

Always returns HTTP 200. The `outcome` field in the response body describes what happened.

### Auto-Complete Outcomes

| `outcome` | Description |
|---|---|
| `batch_completed` | A pending CPAY batch was identified (by CPAY ref or amount match) and marked paid |
| `batch_backfilled` | An already-paid batch was missing its UTR or receipt — backfilled from the OCR data |
| `completed` | A single open voucher was matched (by serial or amount) and marked paid |
| `backfilled` | An already-paid voucher was missing its UTR or receipt — backfilled |
| `queued` | No deterministic match found — receipt saved to `unassigned_receipts` for manual review |
| `error` | Unexpected server error — frontend falls back to the manual file-picker flow |

### Matching Logic

The OCR extracts:
- **UTR** — looked up directly against `payment_reference` on batches and vouchers
- **CPAY reference** — `CPAY-{FY}-{seq}` token identifies the batch by `batch_reference`
- **Amount** — used as a tiebreaker when no reference is present (must be unambiguous)

Priority order: CPAY batch reference > UTR (batch) > UTR (voucher) > amount match (batch) > amount match (voucher) > backfill candidates.

### Additional Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/receipts/match-voucher` | Match a receipt against a known voucher (used by the manual Reconcile UI) |
| `POST` | `/api/receipts/deposit-unassigned` | Safety-net: park a file in `unassigned_receipts` without running OCR (used when auto-complete throws) |

---

## Unassigned Receipts — Review Queue (Migration 036)

When `auto-complete` cannot match a receipt, it is saved to the `unassigned_receipts` table with full OCR output preserved. Accounts reviews the queue and either assigns each receipt to a voucher (which marks the voucher paid) or dismisses it.

### Database Schema

#### `unassigned_receipts`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `company_id` | `TEXT` | FK → `companies(id)` |
| `storage_path` | `TEXT` | Path in `voucher-bills` bucket |
| `file_url` | `TEXT` | Public URL for preview |
| `mime_type` | `TEXT` | |
| `extracted_data` | `JSONB` | Full OCR output — used to pre-fill the assign form |
| `match_reason` | `TEXT` | Why auto-match failed (e.g. "Amount ambiguous", "No reference") |
| `status` | `TEXT` | `pending_review`, `assigned`, `dismissed` |
| `assigned_to` | `UUID` | FK → `vouchers(id)` — set on assign |
| `assigned_by` | `UUID` | FK → `users(id)` |
| `assigned_at` | `TIMESTAMPTZ` | |
| `created_at` | `TIMESTAMPTZ` | |

### API Endpoints

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/api/companies/:companyId/unassigned-receipts` | List all `pending_review` receipts for a company | Accounts / Admin / Super Admin |
| `POST` | `/api/unassigned-receipts/:id/assign` | Assign receipt to a voucher: re-uploads to `payment-receipts/` path, marks voucher paid. Body: `{ assignedBy, voucherId, paymentReference?, paymentNotes? }` | Accounts |
| `POST` | `/api/unassigned-receipts/:id/dismiss` | Mark receipt as dismissed. Body: `{ dismissedBy }` | Accounts / Admin / Super Admin |

**Assign behaviour:** The file is moved from `unassigned-receipts/` to `payment-receipts/` using the standard human-readable naming convention (`{serial}-PMT-{DD}-{Mon}-{YYYY}.{ext}`). The voucher is then marked paid with the UTR (if provided) and the new receipt URL. The `unassigned_receipts` row is updated to `status='assigned'`.

### Data Flow Summary

```
window.onReceiptShared — no routing context
    ↓
POST /api/receipts/auto-complete
    ├── CPAY ref found → batch_completed / batch_backfill
    ├── UTR found → paid / backfill (voucher or batch)
    ├── Amount unambiguous → paid / batch_completed
    └── No match → outcome: 'queued' → unassigned_receipts row created
                                            ↓
                               Accounts opens Review Queue
                                            ↓
                               POST /api/unassigned-receipts/:id/assign
                                   → voucher marked paid, receipt moved
                               POST /api/unassigned-receipts/:id/dismiss
                                   → receipt dismissed
```

