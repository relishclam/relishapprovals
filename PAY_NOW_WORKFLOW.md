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

Example: `SV-2026-27-001-TOPUP-09-Jul-2026.pdf`

The extension (`pdf`, `jpeg`, `png`, `webp`) matches the actual uploaded file type.

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

### Three-Level Routing

When the Android wrapper fires `window.onReceiptShared` on the Admin's phone:

```
1. localStorage (same-device fast path, ~0 ms)
   └─ context found → route to modal immediately

2. Server DB (cross-device, ~100 ms round-trip)
   └─ PUT /api/users/:userId/pending-share-context was written by
      whichever device had Pay Now open (desktop, tablet, another phone)
   └─ context found & not expired → route to modal

3. Reconcile flow (fallback — no Pay Now modal was open anywhere)
   └─ receipt matched by voucher reference text extraction
```

All three paths end in `window.onReceiptShared` → `_routeCtx()` or `_runReconcile()`.

---

## ⚠️ ANDROID WRAPPER — REQUIRED CHANGES

> **When the `relish-approvals-android` project is opened**, make the following changes
> precisely. The wrapper project is at:
> `C:\Users\user\Desktop\SOFTWARE DEV\APP Folders\relish-approvals-android`

### Why this is critical

**"Relish Approvals" will NOT appear in the Android share sheet from PhonePe / Google Pay / HDFC / any bank app unless the native wrapper declares the correct `intent-filter`.** The PWA manifest `share_target` only works for TWA; a WebView wrapper must declare intents natively.

---

### Change 1 — `AndroidManifest.xml`

Find the `<activity android:name=".MainActivity">` element and add the following `<intent-filter>` blocks **inside** it, after any existing intent-filters:

```xml
<!-- ── Share Target: bank/UPI receipt images and PDFs ──────────────────────
     These filters cause "Relish Approvals" to appear in the Android share
     sheet when Admin shares a payment receipt from Google Pay, PhonePe,
     HDFC, ICICI, or any bank app that shares image or PDF receipts.
     CRITICAL: without these, the app is invisible in the share sheet.    -->

<intent-filter android:label="Share to Relish Approvals">
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/jpeg" />
</intent-filter>

<intent-filter android:label="Share to Relish Approvals">
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/png" />
</intent-filter>

<intent-filter android:label="Share to Relish Approvals">
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/webp" />
</intent-filter>

<intent-filter android:label="Share to Relish Approvals">
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/pdf" />
</intent-filter>
```

Also confirm the `<activity>` has `android:launchMode="singleTask"` (so the existing app instance is reused rather than creating a second one when the share arrives):

```xml
<activity
    android:name=".MainActivity"
    android:launchMode="singleTask"
    ... >
```

---

### Change 2 — `MainActivity.kt` (or `.java`)

#### 2a. Add `onNewIntent` override

When the app is **already running** (in foreground or background), Android calls `onNewIntent` instead of `onCreate` for a `singleTask` activity. Add:

```kotlin
override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleShareIntent(intent)
}
```

#### 2b. Call `handleShareIntent` from `onCreate`

In the existing `onCreate`, **after** the WebView is fully initialised and the page has loaded, add:

```kotlin
// Handle share intent if app was launched cold by a share action
handleShareIntent(intent)
```

> **Important**: call this only after `webView.setWebViewClient` / `onPageFinished` fires,
> or the JS call will target a blank page. If you have a `WebViewClient.onPageFinished`
> callback already, put the call there. If not, a simple `webView.postDelayed({ handleShareIntent(intent) }, 800)` is acceptable as a fallback.

#### 2c. Add the `handleShareIntent` function

```kotlin
private fun handleShareIntent(intent: Intent) {
    if (intent.action != Intent.ACTION_SEND) return
    val mimeType = intent.type ?: return
    if (!mimeType.startsWith("image/") && mimeType != "application/pdf") return

    val uri: Uri = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(Intent.EXTRA_STREAM)
    } ?: return

    // Read on a background thread — never on main thread
    Thread {
        try {
            // Resolve display name (bank apps use content:// URIs)
            var fileName = "receipt"
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val col = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (cursor.moveToFirst() && col >= 0) fileName = cursor.getString(col) ?: "receipt"
            }

            val inputStream = contentResolver.openInputStream(uri) ?: return@Thread
            val bytes = inputStream.readBytes()
            inputStream.close()

            // Base64 chars are [A-Za-z0-9+/=] — safe to embed in a JS string.
            // Only the fileName needs sanitisation.
            val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
            val safeMime = mimeType.replace("'", "")
            val safeName = fileName.replace("\\", "").replace("'", "").replace("\"", "")

            // Build the JS call
            val js = """
                (function() {
                    if (typeof window.onReceiptShared === 'function') {
                        // App is ready — dispatch immediately
                        window.onReceiptShared({
                            mimeType: '$safeMime',
                            base64Data: '$base64',
                            fileName: '$safeName'
                        });
                    } else {
                        // App still loading (cold start) — stash for when it registers
                        window._pendingSharedReceipt = {
                            mimeType: '$safeMime',
                            base64Data: '$base64',
                            fileName: '$safeName'
                        };
                    }
                })();
            """.trimIndent()

            runOnUiThread { webView.evaluateJavascript(js, null) }
        } catch (e: Exception) {
            android.util.Log.e("RelishApprovals", "Share intent handling failed: ${e.message}")
        }
    }.start()
}
```

---

### Change 3 — No changes needed to `AndroidManifest.xml` permissions

Android 10+ (API 29+) uses scoped storage. Accessing a file via a content:// URI shared by another app does **not** require `READ_EXTERNAL_STORAGE`. `contentResolver.openInputStream(uri)` is the correct API and works without extra permissions.

If the project targets API 28 or lower, add:
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="28" />
```

---

### PWA-side change (already done in `app.js`)

The PWA already handles the `window._pendingSharedReceipt` fallback. After `window.onReceiptShared` is registered, the `useEffect` now checks:

```javascript
if (window._pendingSharedReceipt) {
  const _p = window._pendingSharedReceipt;
  window._pendingSharedReceipt = null;
  window.onReceiptShared({ mimeType: _p.mimeType, base64Data: _p.base64Data, fileName: _p.fileName || '' });
}
```

This ensures receipts shared during a cold start are never silently dropped.

---

### End-to-end flow after wrapper changes

```
Admin's Phone (Relish Approvals wrapper installed)
──────────────────────────────────────────────────
1. UPI/Bank app shows "Share" button after transaction
2. Admin taps Share → Android share sheet opens
3. "Relish Approvals" appears ← REQUIRES Change 1 (intent-filter)
4. Admin taps "Relish Approvals"
5. Android delivers ACTION_SEND intent to MainActivity
6. handleShareIntent() reads file via contentResolver ← REQUIRES Change 2
7. base64 data injected into WebView via evaluateJavascript
8. window.onReceiptShared() fires in PWA
9. Three-level routing:
   a. localStorage context?    → open correct modal (same-device only)
   b. Server DB context?       → open correct modal (cross-device ✓)
   c. No context?              → Reconcile Receipts flow
10. Admin enters UTR and confirms payment
```

---

### Testing checklist (after wrapper changes are deployed)

- [ ] Open Google Pay → make a small test payment → tap "Share receipt" → "Relish Approvals" appears in share sheet
- [ ] Share a screenshot from gallery → Relish opens on Reconcile screen
- [ ] With Pay Now modal open on desktop for a specific topup → Admin shares receipt on phone → Relish opens on the suspense detail page with Mark Paid modal pre-filled
- [ ] Kill the Relish app → share a receipt → app launches from cold start → receipt is processed (not dropped)

