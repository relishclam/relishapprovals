# Suspense Voucher — Workflow Guide

## What Is a Suspense Voucher?

A **Suspense Voucher** is an advance payment given to a staff member to cover expenses on behalf of the organisation. The staff member spends from the advance, submits receipts as they go, and the accounts team reviews each entry. The voucher stays **open and rolling** — it can be topped up and used again — until the entire balance is settled and the voucher is closed.

---

## Roles Involved

| Role | What They Do |
|---|---|
| **Accounts** | Creates the voucher, adds top-ups, adds entries on behalf of staff, reviews and approves all entries |
| **Admin / Super Admin** | Approves or rejects the voucher; confirms all outward payments (advance and top-ups) via Pay Now with UTR / receipt |
| **Staff / Payee** | Receives an SMS/WhatsApp (Manual) link, submits expense entries and attaches bills — no system login required |
| **Auditor** | Read-only access to view all records; can propose corrections to Head of Account and Sub-Heading on vouchers (subject to Admin batch approval) |

> ⚠️ **Every outward payment** from the company to the staff member — whether the initial advance or a subsequent top-up — **must be confirmed by Admin** with a UTR reference or receipt upload before it is considered reconciled.

---

## Voucher Status Lifecycle

```
Created by Accounts
        ↓
  pending_approval  ──── Admin Rejects ──→  rejected  (terminal)
        ↓
   Admin Approves
        ↓
  awaiting_payee_otp  ← Admin executes advance payment (💳 Pay Advance → UTR/receipt)
        ↓
   Accounts/Admin verifies OTP collected from staff
        ↓
      open  ←──────────────────── Top-Up approved by Admin on a closed voucher
        ↓                         (reopens; Admin must Pay Now for that top-up too)
  (Staff/Accounts add entries, entries get approved)
        ↓
     partial   (some entries approved, balance > 0)
        ↓
  Accounts clicks Close Voucher
        ↓
  ┌─────────────────────────────────────────────────────┐
  │  Balance = 0   → closes immediately                 │
  │  Balance < 0   → closes immediately (overspend      │
  │                  acknowledged; pay reimbursement)   │
  │  Balance > 0   → pending_close_approval             │
  │                  (Admin must approve + recovery      │
  │                  voucher auto-created)               │
  └─────────────────────────────────────────────────────┘
        ↓
  pending_close_approval  ── Admin Rejects ──→  open/partial  (reverted)
        ↓
   Admin Approves Closure
        ↓
      closed   (SMS links stop working; Top-Up button hidden)
```

### Payment Reconciliation Status (separate from voucher status)

Every outward payment has its own payment tracking, independent of the voucher status:

| Payment | Where Stored | Status Values |
|---|---|---|
| Initial advance | `suspense_vouchers.advance_payment_status` | `NULL` (pending) → `'paid'` |
| Each top-up | `suspense_settlements.payment_status` | `NULL` (pending) → `'paid'` |

---

## Role-by-Role Workflow

---

### 1. Accounts — Creating a Suspense Voucher

1. Go to **Suspense Vouchers → New Suspense**.
2. Select the **Staff Payee** (the person who will receive the advance).
3. Enter the **Advance Amount**, **Purpose**, and **Payment Mode**.
4. Click **Create**. The voucher is created with status **Pending Approval** and all Admins are notified.

> ⚠️ A staff member can only have **one active** suspense voucher at a time (open, partial, or pending approval).

---

### 2. Admin — Approving the Voucher

1. Receive an in-app notification for the pending voucher.
2. Open the voucher, review the details.
3. Click **Approve** or **Reject** (with a reason).

**On Approval:**
- Voucher status changes to **Awaiting Payee OTP** (not yet open).
- An **OTP is sent to the staff member's mobile** to confirm they have received the advance.
- The Accounts creator is notified that OTP verification is pending.

> ⚠️ The settlement form link is **not sent yet**. It is only activated after OTP is verified in Step 2a below.

---

### 2b. Admin — Confirming the Advance Payment (Pay Now)

After approving the voucher, Admin must execute and record the actual payment to the staff member.

1. A **💳 Pay Advance** button appears in the voucher action bar (visible to Admin / Super Admin when status is `awaiting_payee_otp`, `open`, or `partial` and advance is not yet confirmed).
2. The **Advance Payment** tile in the info card shows **⏳ Pending** until confirmed.
3. Click **💳 Pay Advance** to open the Pay Now modal:
   - **UPI**: Deep-link button on mobile (*Open UPI App →*) or QR code on desktop, pre-filled with payee's UPI ID and amount.
   - **Account Transfer**: Bank details card (Account No, IFSC, Bank, Amount, Reference) with **📋 Copy All Details** button.
   - **Cash**: Plain instruction to hand over cash.
4. Execute the payment externally, then click **✅ Confirm Payment →**.
5. In the Confirm Payment modal:
   - Enter the **UTR / Transaction ID** (or upload a receipt — at least one is required).
   - Optionally add **Notes**.
   - Click **✅ Confirm Payment**.

**On confirmation:**
- `advance_payment_status` is set to `'paid'`.
- The Advance Payment tile shows **✅ Paid** with the UTR, who confirmed it, date, and a receipt link (if uploaded).
- The voucher creator is notified.

> ℹ️ Confirming the advance payment is **independent of the OTP step** — both can happen in any order. The OTP proves the staff *received* the funds; the Pay Now record proves the company *sent* them.

---

### 2a. Accounts / Admin — Verifying the Advance OTP

This step proves the staff member has physically received the advance payment.

1. Contact the staff member and ask them to share the OTP they just received by SMS.
2. Open the voucher in the app — a **🔐 Verify Advance OTP** button will appear.
3. Enter the 6-digit OTP in the prompt and click **Verify & Activate**.
   - If the OTP has expired, click **🔄 Resend OTP** to send a new one.

**On successful verification:**
- Voucher status changes to **Open**.
- The settlement form SMS link is sent to the staff member.
- The verification timestamp is recorded for audit.

> ℹ️ This OTP step is why expense vouchers created from settlement entries skip the payee OTP step — the advance disbursement was already OTP-confirmed here.

---

### 3. Staff / Payee — Submitting Expenses (via SMS Link)

> This is the **primary workflow for the Suspense Payee**. See the dedicated section below.

---

### 3a. Accounts — Classifying Attachments Uploaded to the Suspense Voucher

When Accounts uploads a file directly to the **suspense voucher** (not to a specific settlement entry), the system asks:

> *"What are you uploading?"*

| Choice | When to select it |
|---|---|
| 🏦 **Transfer Receipt** | Bank/UPI transfer confirmation, NEFT screenshot, or any proof that the advance was disbursed to the staff member |
| 🧾 **Expense Bill** | An invoice or receipt uploaded on behalf of the staff member (e.g. they handed over a physical bill) |

The upload buttons are disabled until a category is chosen. After each upload the choice resets so every file is explicitly classified. Each attachment in the list shows a colour-coded badge (blue for Transfer Receipt, green for Expense Bill).

> ⚠️ **Only Transfer Receipts are copied to final payment vouchers.** Expense Bills uploaded at the suspense level remain on the suspense voucher. To link an expense bill to a specific entry, upload it against that entry (during staff submission or during Accounts review).

---

### 4. Accounts — Reviewing Settlement Entries

1. Receive an in-app notification each time a staff member submits an entry.
2. Open the voucher → **Settlement Entries** table → click **Review** on a pending entry.
3. Verify the description, amount, and any attached bills.
4. Choose one of two actions:
   - **Approve entry only** — the entry is approved and the balance is recalculated.
   - **Approve and create a Payment Voucher** — generates a linked payment voucher (for Head of Account tracking) in **Pending** status, which enters the standard Admin approval flow.
5. Select the **Head of Account** (required) and any other voucher details, then click **Approve**.

**After every approval:**
- The voucher balance is recalculated automatically.
- The voucher does **not** close automatically — Accounts must manually close it when all funds are accounted for.

**What the created Payment Voucher contains:**
- The expense bill(s) uploaded by staff for that specific entry.
- Copies of all attachments classified as **🏦 Transfer Receipt** at the suspense voucher level (NEFT/UPI payment confirmation, etc.) — so the voucher independently proves both *what* was spent and *how* the funds reached the staff member.

> ℹ️ Attachments classified as 🧾 **Expense Bill** at the suspense level are **not** copied — they are not proof of disbursement and would incorrectly appear on every voucher created from the same suspense advance.

> ℹ️ Every voucher created from a settlement entry carries a **Suspense Ref** field (e.g. `SUS-2026-27-00003`). In the Voucher Details modal, clicking that reference button navigates directly to the full suspense voucher — enabling auditors to trace from any voucher back to the original advance, all top-ups, all entries, and all bills.

---

### 4a. Accounts — Combining Multiple Entries into One Voucher *(optional)*

If a staff member has submitted several small expenses that belong under the same Head of Account, Accounts can combine them into a single payment voucher instead of creating one voucher per entry.

1. In the **Settlement Entries** table, tick the **checkbox** next to each `Pending Review` expense entry to combine (minimum 2).
2. A blue action bar appears showing the number of selected entries and their combined total.
3. Click **🔗 Combine into One Voucher**.
4. In the modal:
   - Select the **Head of Account** (required — applies to all combined entries).
   - Review or edit the **Narration** (pre-filled from each entry's description, joined by ` | `).
   - Set Payment Mode and Invoice Reference as needed.
5. Click **Combine & Create Voucher**.

**What happens:**
- All selected entries are approved simultaneously.
- One payment voucher is created with **amount = sum of all selected entries**.
- Every bill / attachment uploaded against each selected entry is carried over to the new voucher — no attachment is lost.
- Copies of all suspense-level attachments classified as **🏦 Transfer Receipt** are also added to the voucher, giving it a complete standalone audit trail. Suspense-level **🧾 Expense Bills** are not copied.
- Each entry records a back-link to the combined voucher for full traceability.
- The new voucher enters **Pending** status for Admin approval.

> ℹ️ Only `Pending Review` expense entries can be combined. Top-ups and refunds are excluded.

---

### 5. Accounts — Topping Up

When the staff member needs more funds:

1. Open the voucher → click **💰 Top Up** *(only available when status is `open` or `partial`).*
2. Enter the additional amount and a description.
3. Click **Submit for Approval**.

The top-up is **submitted for Admin approval** — all Admins receive an in-app notification. Once an Admin approves it, the balance increases and an SMS is sent to the staff member with the new balance. If the voucher was closed, it **reopens automatically** on approval. Admins can also reject a top-up (with a reason), in which case the balance is unaffected.

> ⚠️ The **Top Up** button is **not available on closed vouchers**. A closed voucher must first receive a top-up approval (which reopens it) before new entries can be added.

> ℹ️ Accounts users and Super Admins can submit top-ups; only Admin / Super Admin can approve, reject, or confirm payment.

---

### 5a. Admin — Confirming Top-Up Payment (Pay Now)

After approving a top-up, Admin must execute and record the payment — the same as the initial advance.

1. In the **Settlement Entries** table, the approved top-up row shows a **💳 Pay Now** button (Admin / Super Admin only; visible when `payment_status` is `NULL`).
2. Click **💳 Pay Now** → the Pay Now modal opens with the staff payee's UPI / bank details and the top-up amount.
3. Execute the payment externally, then click **✅ Confirm Payment →**.
4. Enter UTR and/or upload a receipt → click **✅ Confirm Payment**.

**On confirmation:**
- The top-up row shows **✅ Paid** with UTR and receipt link.
- The voucher creator and the Accounts user who submitted the top-up are notified.

**For the out-of-pocket / overspend scenario:**  
If a staff member's approved expenses exceed the advance (balance goes negative), a top-up entered to cover the deficit is a **reimbursement** to the staff member. The Pay Now flow handles this identically — the modal shows the overspend context in the reason field.

---

### 6. Accounts — Adding an Entry Directly

Accounts can also add a settlement entry themselves (e.g. if the staff member hands over a physical receipt):

1. Open the voucher → click **+ Add Settlement**.
2. Fill in the Entry Type, Amount, Description, Head of Account, and Reference Number.
3. Click **Add Entry**.

The entry goes into the same review queue as staff-submitted entries.

---

### 7. Accounts — Closing the Suspense Voucher

Closing is initiated exclusively from within the suspense voucher detail page. The **🔒 Close Voucher** button is visible only to Accounts / Super Admin when the status is `open` or `partial`.

The close flow has three distinct paths depending on the remaining balance:

---

#### 7a. Balance = ₹0 (Fully Settled)

All advances and expenses match exactly.

1. Click **🔒 Close Voucher**.
2. Modal confirms: *"Balance is ₹0.00 — advance fully accounted for. Safe to close."*
3. Click **🔒 Confirm Close**.

**Result:** Voucher closes immediately. All SMS settlement links are deactivated. Each expense was already individually vouchered during the approval stage.

---

#### 7b. Balance < ₹0 (Staff Out-of-Pocket / Overspend)

Approved expenses exceed the total advance — the staff member spent from their own pocket.

1. Click **🔒 Close Voucher**.
2. Modal shows the overspend amount with a warning and an optional shortcut:
   > *"Staff is owed ₹X out-of-pocket. Ensure this reimbursement has been paid before closing."*
   - **💳 Pay Reimbursement First →** — shortcut that opens the Pay Now modal for the top-up covering the deficit (if not already paid).
3. Click **🔒 Confirm Close** (Accounts acknowledges the overspend).

**Result:** Voucher closes immediately. No Admin approval required — Accounts is responsible for ensuring the reimbursement is processed.

> ℹ️ Reimbursement of the deficit is handled as a top-up with Pay Now (see §5a). It can be confirmed before or after closure.

---

#### 7c. Balance > ₹0 (Unspent Advance — Admin Approval Required)

The staff member did not spend the full advance. The unspent amount must be formally recovered.

1. Click **🔒 Close Voucher**.
2. Modal shows the unspent balance and requires:
   - **Head of Account** *(required)* — e.g. *"Staff Advances Recovered"* or *"Advances Receivable (From Staff)"*.
   - **Sub-Head** *(optional)*.
   - **Notes** *(optional)* — remarks for Admin.
3. Click **📤 Submit for Approval**.

**Result:** Voucher status changes to **`pending_close_approval`** (shown as **Close Pending** badge). All Admins receive a notification.

---

#### 7d. Admin — Approving or Rejecting a Close Request

**In the Suspense Voucher List:** A **Pending Suspense Closure Approvals** panel (orange-bordered) appears at the top of the Admin view, listing each pending close request with: voucher serial, staff name, unspent amount, recovery Head of Account, and who submitted the request.

**In the Suspense Voucher Detail:** The action bar shows **✅ Approve Closure** and **✕ Reject** buttons when status is `pending_close_approval`.

**On Approval:**
1. A **Staff Advance Recovery** regular voucher is auto-created:
   - Amount = remaining balance
   - Head of Account = selected by Accounts at close time
   - Narration = `[Advance Recovery — SUS-XXXX] {purpose}`
   - Status = `completed` immediately (Admin approval of the close request serves as approval of the recovery entry)
2. The suspense voucher is closed.
3. All SMS settlement links are deactivated.
4. The Accounts user who requested closure is notified, including the new recovery voucher serial number.

**On Rejection:**
- The voucher reverts to its previous status (`open` or `partial`).
- Accounts is notified with the rejection reason.
- Accounts can correct the Head of Account or add missing entries and resubmit.

---

## ★ Suspense Payee — Step-by-Step Guide

> **Who this is for:** Staff members who have been given a suspense advance and need to account for their expenses.
> 
> **You do NOT need to log in to the app.** Everything is done through a link sent to your mobile phone.

---

### Step 1 — Confirm You Received the Advance (OTP)

Once your advance is approved by the Admin, you will first receive an **OTP SMS** on your registered mobile number. It will look like:

> *"Your OTP is XXXXXX. Use this to confirm receipt of your advance for [Voucher]."*

**Share this OTP with the Accounts team member** who is processing your advance. They will enter it into the system to confirm that you have received the funds. This is a one-time step — you do not need to enter it anywhere yourself.

---

### Step 1a — Receive Your Settlement Link

Once the Accounts team has verified your OTP, you will receive a **second SMS** with your settlement form link:

> *"Your settlement form for suspense voucher SUS-2025-26-00001 is ready. Open it here: https://relishvoucher.vercel.app/settlement/..."*

Tap the link to open the settlement form in your phone's browser.

---

### Step 2 — View Your Available Balance

At the top of the form you will see:
- **Voucher number** (e.g. SUS-2025-26-00001)
- **Available Balance** — the amount remaining for you to spend
- **Your name**

---

### Step 3 — Submit an Expense Entry

Fill in the form for each expense you want to submit:

| Field | What to Enter |
|---|---|
| **Settlement Type** | Choose **Expense** for a normal spend. Choose **Refund** if you are returning unused cash. |
| **Amount (₹)** | The exact amount of the expense |
| **Description / Purpose** | Briefly describe what the money was spent on (e.g. "Auto fare to post office") |
| **Head of Account** *(optional)* | Category of spend (e.g. "Travel", "Printing & Stationery") |
| **Reference / Receipt No.** *(optional)* | Bill or receipt number if available |
| **Invoice Available?** | Select **Yes** if you have a bill. Select **No** and explain why if you don't. |

---

### Step 4 — Attach the Bill / Receipt (Before You Submit)

If you have a photo of the bill or receipt, you can attach it **before clicking Submit**:

- Tap **📷 Take Photo of Invoice** — this opens your phone camera directly.
- Or tap **Upload from Gallery / PDF** — to choose an existing photo or file.

You can attach **more than one file**. Each attached file is shown with a thumbnail and a remove (✕) button in case you want to change it.

> **Tip:** Attaching the bill at this step is the easiest way. You can also add more attachments after submitting.

---

### Step 5 — Submit

Tap **Submit Settlement**.

- Your entry is sent to the accounts team for review.
- The form resets so you can immediately submit your next expense.

---

### Step 6 — Add More Attachments After Submitting *(optional)*

After submitting you will see a confirmation screen with attachment options. You can:

- **📷 Take Photo of Invoice** — camera shortcut
- **Upload from Gallery / PDF** — file picker
- **Send to Another Device (QR)** — generates a QR code so you can photograph the bill on a different phone or device and it attaches automatically

---

### Step 7 — Submit More Entries

Tap **➕ Submit Another Entry** to go back to the form and record the next expense. Repeat Steps 3–6 for each expense.

---

### Step 8 — Your Link Stays Active

Your settlement link **does not expire** after 24 hours. It remains valid as long as your suspense voucher is open. You can bookmark the link and return to it any time.

The link will stop working only when:
- The accounts team **manually closes the voucher**, OR
- The accounts team **sends you a new link** (the old one is deactivated).

---

### Step 9 — Getting a Top-Up

If you have spent all your advance and need more funds, ask your accounts team to **Top Up** the voucher. You will receive an SMS confirming the new balance and you can continue submitting expenses using the same link.

---

## Summary Table — Who Does What

| Action | Accounts | Admin | Auditor | Staff (SMS) |
|---|:---:|:---:|:---:|:---:|
| Create suspense voucher | ✅ | — | — | — |
| Approve / reject voucher | — | ✅ | — | — |
| Confirm advance payment (Pay Now + UTR/receipt) | — | ✅ | — | — |
| Share advance receipt OTP | — | — | — | ✅ |
| Verify advance OTP (activate link) | ✅ | ✅ | — | — |
| Submit expense entry | ✅ | — | — | ✅ |
| Attach bill photo | ✅ | — | — | ✅ |
| Upload & classify suspense-level attachment | ✅ | — | — | — |
| Review & approve entries | ✅ | — | — | — |
| Combine entries into one voucher | ✅ | — | — | — |
| Approve payment voucher | — | ✅ | — | — |
| Add top-up | ✅ | — | — | — |
| Approve / reject top-up | — | ✅ | — | — |
| Confirm top-up payment (Pay Now + UTR/receipt) | — | ✅ | — | — |
| Resend SMS link | ✅ | ✅ | — | — |
| Close voucher (balance = 0 or < 0) | ✅ | — | — | — |
| Submit close request (balance > 0) | ✅ | — | — | — |
| Approve / reject close request | — | ✅ | — | — |
| Navigate voucher ↔ suspense (drill-through) | ✅ | ✅ | ✅ | — |
| Propose HOA / Sub-Heading correction | — | — | ✅ | — |
| Batch-approve HOA corrections | — | ✅ | — | — |
| View / audit all records | ✅ | ✅ | ✅ | — |

---

---

## 7. Auditor — Proposing Head of Account Corrections

Auditors have read-only access to all vouchers but can **propose corrections** to the **Head of Account** and **Sub-Heading** fields when the value entered by Accounts does not match the organisation's accounting standard (e.g. the Tally or Pramaana chart of accounts).

### Why This Exists

Accounts staff may enter a Head of Account that is informal or non-standard (e.g. "Petrol" instead of the official "Conveyance Expenses"). Auditors can flag and correct these without being able to touch amounts, payees, or any other voucher data.

### How the Auditor Proposes a Correction

1. Open any voucher in the system.
2. Next to the **Head of Account** (and/or **Sub-Heading**) field, an **✏️ Propose Correction** button is visible to Auditors.
3. Click it. A modal opens showing:
   - The **current** Head of Account / Sub-Heading (read-only snapshot).
   - A **New Head of Account** dropdown (required).
   - A **New Sub-Heading** dropdown (optional — filters to sub-heads under the chosen HOA).
   - A **Reason** text field (required — e.g. *"Should be 'Conveyance Expenses' as per Tally chart"*).
4. Click **Submit Proposal**.

The proposal is saved with status `pending`. The voucher itself is **not changed yet**. Admins are notified of a new pending correction.

> ℹ️ Only one pending proposal per voucher is allowed at a time. A new proposal can be submitted once the existing one is approved or rejected.

---

### How Admin Batch-Approves Corrections

1. In the dashboard, open **HOA Corrections** (shows a badge with the pending count).
2. A table lists all pending proposals with columns: Voucher No. | Current HOA | Proposed HOA | Proposed Sub-Heading | Reason | Proposed By | Date.
3. Tick checkboxes to select one or more proposals.
4. Click **✅ Approve Selected** — a confirmation modal shows the count and the vouchers affected.
5. Click **Confirm**. All approved proposals are applied atomically: the `head_of_account_id` and/or `sub_head_of_account_id` on each voucher is updated. Each updated voucher records the change as an audit entry.
6. The Auditor who proposed each correction is notified of the outcome.

To reject a proposal, click **✗ Reject** on any individual row, enter a rejection reason, and confirm. The Auditor is notified.

### Data Model

```
hoa_correction_proposals
  id                    UUID PK
  company_id            UUID FK → companies
  voucher_id            UUID FK → vouchers
  proposed_by           UUID FK → users  (Auditor)
  current_hoa_id        UUID FK → heads_of_account      (snapshot at proposal time)
  current_sub_hoa_id    UUID FK → sub_heads_of_account  (snapshot, nullable)
  proposed_hoa_id       UUID FK → heads_of_account      (nullable — no change if NULL)
  proposed_sub_hoa_id   UUID FK → sub_heads_of_account  (nullable — no change if NULL)
  reason                TEXT NOT NULL
  status                TEXT  ('pending' | 'approved' | 'rejected')
  reviewed_by           UUID FK → users  (Admin who acted)
  reviewed_at           TIMESTAMPTZ
  rejection_reason      TEXT
  created_at            TIMESTAMPTZ
```

### Key Constraints
- Only Auditors can create proposals; only Admin / Super Admin can approve or reject.
- A proposal cannot be submitted if another `pending` proposal already exists for the same voucher.
- Approval writes directly to the `vouchers` table in a single transaction; no partial writes.
- The original HOA values are stored in the proposal row forever — providing a full before/after audit trail.
- Auditors cannot edit amounts, payees, payment mode, narration, or attachments.

---

## Key Rules to Remember

1. **One active voucher per staff member** — a new one cannot be created until the current one is closed or rejected.
2. **OTP is mandatory before activation** — the settlement link is only sent after the staff member's advance receipt is confirmed by OTP. This ensures every disbursement is verified.
3. **Every outward payment must be confirmed by Admin** — both the initial advance and each top-up require Admin to execute the payment via Pay Now and confirm with a UTR reference and/or receipt upload. The payment confirmation record (`advance_payment_status` on the voucher, `payment_status` on each top-up entry) is independent of the voucher's open/closed status.
4. **Top-ups reopen a closed voucher** — if a voucher was closed and a top-up is approved by Admin, it becomes active again. The Admin must then also confirm the top-up payment via Pay Now.
5. **Top Up button is not available on closed vouchers** — the button only appears when the voucher is `open` or `partial`. A closed voucher reopens only once a pending top-up (submitted before closure) is approved.
6. **The SMS link is permanent** until explicitly revoked — staff can use it any time the voucher is open.
7. **All entries go through review** — no expense is finalised until an Accounts user approves it.
8. **Payment vouchers follow the normal approval flow** — vouchers created from settlement entries enter Pending status and require Admin approval. After Admin approval they are immediately completed (no new OTP) because the advance was already OTP-verified at disbursement.
   Each final voucher automatically carries: (a) the expense bills uploaded by staff for that entry, and (b) copies of the suspense-level **Transfer Receipts** uploaded by Accounts — so every voucher is independently auditable.
9. **Classify every suspense-level upload** — when Accounts uploads an attachment directly to a suspense voucher, they must declare whether it is a 🏦 Transfer Receipt or a 🧾 Expense Bill. Only Transfer Receipts are propagated to final payment vouchers; Expense Bills remain on the suspense voucher. This prevents disbursement proofs and staff invoices from being mixed up across vouchers.
10. **Combine saves work** — multiple small expenses under the same Head of Account can be combined into one voucher. All bills from every combined entry are preserved.
11. **Balance is always auto-calculated** — Expenses reduce the balance; Refunds increase it; Top-ups increase it only after Admin approval.
12. **Vouchers never close automatically** — even when the balance reaches zero. Accounts must manually close the voucher. This allows for overspend correction, final entry additions, and top-up workflows without unintended lock-out.
13. **Closure is balance-aware** — balance = 0 or < 0 closes directly (Accounts); balance > 0 requires Admin approval and triggers auto-creation of a Staff Advance Recovery voucher for the unspent amount.
14. **Bidirectional audit trail** — every voucher created from a suspense settlement shows a **📋 SUS-XXXX** button that navigates to the full suspense voucher. From the suspense voucher, every approved entry that generated a voucher shows a **🧾 View Voucher** button. Auditors can drill through the entire chain in either direction.

---

## Database Schema — New Payment Tracking Columns

### `suspense_vouchers` (added by `migrations/031_controlled_suspense_closure.sql`)

| Column | Type | Notes |
|---|---|---|
| `status` | `TEXT` | Extended to include `pending_close_approval` |
| `close_requested_by` | `UUID` | FK → `users(id)` — Accounts user who submitted the close request |
| `close_requested_at` | `TIMESTAMPTZ` | When the close request was submitted |
| `close_hoa` | `TEXT` | Head of Account for the auto-created recovery voucher |
| `close_sub_hoa` | `TEXT` | Optional Sub-Head for the recovery voucher |
| `close_notes` | `TEXT` | Optional notes from Accounts for the Admin |
| `pre_close_status` | `TEXT` | Stores `open` or `partial` so rejection can revert correctly |
| `close_approved_by` | `UUID` | FK → `users(id)` — Admin who approved closure |
| `close_approved_at` | `TIMESTAMPTZ` | When closure was approved |
| `close_rejected_by` | `UUID` | FK → `users(id)` — Admin who rejected the close request |
| `close_rejected_at` | `TIMESTAMPTZ` | When the close request was rejected |
| `close_rejection_reason` | `TEXT` | Reason given by Admin for rejection |

### `suspense_vouchers` (added by `migrations/030_add_advance_payment_tracking.sql`)

| Column | Type | Notes |
|---|---|---|
| `advance_payment_status` | `TEXT` | `NULL` = not yet confirmed; `'paid'` = confirmed |
| `advance_payment_reference` | `TEXT` | UTR / transaction ID |
| `advance_payment_receipt_url` | `TEXT` | Public URL of receipt in `voucher-bills` bucket (`{companyId}/advance-receipts/{suspenseId}/`) |
| `advance_payment_notes` | `TEXT` | Optional notes |
| `advance_paid_by` | `UUID` | FK → `users(id)` — Admin who confirmed |
| `advance_paid_at` | `TIMESTAMPTZ` | When confirmed |

### `suspense_settlements` (added by `migrations/029_add_topup_payment_tracking.sql`)

| Column | Type | Notes |
|---|---|---|
| `payment_status` | `TEXT` | `NULL` = not yet confirmed; `'paid'` = confirmed (top-ups only) |
| `payment_reference` | `TEXT` | UTR / transaction ID |
| `payment_receipt_url` | `TEXT` | Public URL of receipt in `voucher-bills` bucket (`{companyId}/topup-receipts/{settlementId}/`) |
| `payment_notes` | `TEXT` | Optional notes |
| `paid_by` | `UUID` | FK → `users(id)` — Admin who confirmed |
| `paid_at` | `TIMESTAMPTZ` | When confirmed |
