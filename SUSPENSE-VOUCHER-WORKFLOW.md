# Suspense Voucher — Workflow Guide

## What Is a Suspense Voucher?

A **Suspense Voucher** is an advance payment given to a staff member to cover expenses on behalf of the organisation. The staff member spends from the advance, submits receipts as they go, and the accounts team reviews each entry. The voucher stays **open and rolling** — it can be topped up and used again — until the entire balance is settled and the voucher is closed.

---

## Roles Involved

| Role | What They Do |
|---|---|
| **Accounts** | Creates the voucher, adds top-ups, adds entries on behalf of staff, reviews and approves all entries |
| **Admin / Super Admin** | Approves or rejects the voucher before it is activated |
| **Staff / Payee** | Receives an SMS/WhatsApp (Manual) link, submits expense entries and attaches bills — no system login required |
| **Auditor** | Read-only access to view all records; can propose corrections to Head of Account and Sub-Heading on vouchers (subject to Admin batch approval) |

---

## Voucher Status Lifecycle

```
Created by Accounts
        ↓
  pending_approval  ──── Admin Rejects ──→  rejected  (terminal)
        ↓
   Admin Approves
        ↓
  awaiting_payee_otp  (OTP sent to staff — advance receipt must be confirmed)
        ↓
   Accounts/Admin verifies OTP collected from staff
        ↓
      open  ←──────────────────── Top-Up approved by Admin on a closed voucher
        ↓                         (reopens if was closed)
  (Staff/Accounts add entries, entries get approved)
        ↓
     partial   (some entries approved, balance > 0)
        ↓
  (Accounts manually closes the voucher)
        ↓
      closed   (SMS links stop working)
```

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

1. Open the voucher → click **Top Up**.
2. Enter the additional amount and a description.
3. Click **Add Top-Up**.

The top-up is **submitted for Admin approval** — all Admins receive an in-app notification and the top-up appears in their pending queue. Once an Admin approves it, the balance increases and an SMS is sent to the staff member with the new balance. If the voucher was closed, it **reopens automatically** on approval. Admins can also reject a top-up (with a reason), in which case the balance is unaffected.

> ℹ️ Accounts users and Super Admins can submit top-ups; only Admin / Super Admin can approve or reject them.

---

### 6. Accounts — Adding an Entry Directly

Accounts can also add a settlement entry themselves (e.g. if the staff member hands over a physical receipt):

1. Open the voucher → click **+ Add Settlement**.
2. Fill in the Entry Type, Amount, Description, Head of Account, and Reference Number.
3. Click **Add Entry**.

The entry goes into the same review queue as staff-submitted entries.

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
| Resend SMS link | ✅ | ✅ | — | — |
| Close voucher (manual) | ✅ | — | — | — |
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
3. **Top-ups reopen a closed voucher** — if a voucher was closed and a top-up is added and approved by Admin, it becomes active again.
4. **The SMS link is permanent** until explicitly revoked — staff can use it any time the voucher is open.
5. **All entries go through review** — no expense is finalised until an Accounts user approves it.
6. **Payment vouchers follow the normal approval flow** — vouchers created from settlement entries enter Pending status and require Admin approval. After Admin approval they are immediately completed (no new OTP) because the advance was already OTP-verified at disbursement.
   Each final voucher automatically carries: (a) the expense bills uploaded by staff for that entry, and (b) copies of the suspense-level **Transfer Receipts** uploaded by Accounts — so every voucher is independently auditable.
7. **Classify every suspense-level upload** — when Accounts uploads an attachment directly to a suspense voucher, they must declare whether it is a 🏦 Transfer Receipt or a 🧾 Expense Bill. Only Transfer Receipts are propagated to final payment vouchers; Expense Bills remain on the suspense voucher. This prevents disbursement proofs and staff invoices from being mixed up across vouchers.
8. **Combine saves work** — multiple small expenses under the same Head of Account can be combined into one voucher. All bills from every combined entry are preserved.
9. **Balance is always auto-calculated** — Expenses reduce the balance; Refunds increase it; Top-ups increase it only after Admin approval.
10. **Vouchers never close automatically** — even when the balance reaches zero. Accounts must manually close the voucher. This allows for overspend correction, final entry additions, and top-up workflows without unintended lock-out.
