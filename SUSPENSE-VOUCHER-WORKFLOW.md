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
| **Auditor** | Read-only access to view all records |

---

## Voucher Status Lifecycle

```
Created by Accounts
        ↓
  pending_approval  ──── Admin Rejects ──→  rejected  (terminal)
        ↓
   Admin Approves
        ↓
      open  ←──────────────────── Top-Up added to a closed voucher
        ↓
  (Staff/Accounts add entries, entries get approved)
        ↓
     partial   (some entries approved, balance > 0)
        ↓
  (all funds accounted for, balance = 0)
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
- Voucher status changes to **Open**.
- An SMS is automatically sent to the staff member's registered mobile number with a unique settlement link.
- Accounts users and the creator are notified.

---

### 3. Staff / Payee — Submitting Expenses (via SMS Link)

> This is the **primary workflow for the Suspense Payee**. See the dedicated section below.

---

### 4. Accounts — Reviewing Settlement Entries

1. Receive an in-app notification each time a staff member submits an entry.
2. Open the voucher → **Settlement Entries** table → click **Review** on a pending entry.
3. Verify the description, amount, and any attached bills.
4. Choose one of two actions:
   - **Approve entry only** — the entry is approved and the balance is recalculated.
   - **Approve and create a Payment Voucher** — additionally generates a linked payment voucher (for Head of Account tracking) which enters the regular approval flow.
5. Click **Approve**.

**After every approval:**
- The voucher balance is recalculated automatically.
- If balance reaches zero → voucher status changes to **Closed** and the SMS link is deactivated.

---

### 5. Accounts — Topping Up

When the staff member needs more funds:

1. Open the voucher → click **Top Up**.
2. Enter the additional amount and a description.
3. Click **Add Top-Up**.

**Top-ups are automatically approved** — no review needed. The balance increases immediately and an SMS is sent to the staff member with the new balance. If the voucher was closed, it **reopens automatically**.

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

### Step 1 — Receive Your Settlement Link

Once your advance is approved, you will receive an **SMS** on your registered mobile number. It will look like:

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
- The accounts team **closes the voucher** (balance reaches zero), OR
- The accounts team **sends you a new link** (the old one is deactivated).

---

### Step 9 — Getting a Top-Up

If you have spent all your advance and need more funds, ask your accounts team to **Top Up** the voucher. You will receive an SMS confirming the new balance and you can continue submitting expenses using the same link.

---

## Summary Table — Who Does What

| Action | Accounts | Admin | Staff (SMS) |
|---|:---:|:---:|:---:|
| Create suspense voucher | ✅ | — | — |
| Approve / reject voucher | — | ✅ | — |
| Submit expense entry | ✅ | — | ✅ |
| Attach bill photo | ✅ | — | ✅ |
| Review & approve entries | ✅ | ✅ | — |
| Add top-up | ✅ | — | — |
| Resend SMS link | ✅ | — | — |
| Create linked payment voucher | ✅ | — | — |
| View / audit all records | ✅ | ✅ | — |

---

## Key Rules to Remember

1. **One active voucher per staff member** — a new one cannot be created until the current one is closed or rejected.
2. **Top-ups reopen a closed voucher** — if a voucher was closed and a top-up is added, it becomes active again.
3. **The SMS link is permanent** until explicitly revoked — staff can use it any time the voucher is open.
4. **All entries go through review** — no expense is finalised until an accounts user approves it.
5. **Balance is always auto-calculated** — Expenses reduce the balance; Refunds and Top-ups increase it.
