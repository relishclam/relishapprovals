# Construction Labour Attendance — Workflow Guide

**Module:** Panavally Construction Site · Relish Approvals  
**Roles covered:** Staff Lead (Balachandran) · Accounts · Admin

---

## Overview

```
Staff Lead marks daily attendance
        ↓
Accounts reviews unpaid dues → creates voucher
        ↓
Admin approves daily rates (one-time setup, then as needed)
        ↓
Voucher flows into normal payment pipeline
```

---

## Part 1 — One-Time Setup (Accounts)

Before Balachandran can mark attendance, Accounts must complete setup via **Labour Setup** tab.

> ### ⚠ Who Creates the Labour List?
>
> **Accounts creates and maintains the list of supervisors** (gang leaders) in the system — not Balachandran.
>
> The reasoning: supervisors are **payees tied to UPI IDs and payment rates**. Accounts controls who gets paid, so Accounts controls who is on the list. Balachandran can only mark attendance for people Accounts has already registered and assigned to a category.
>
> **Practical flow:**
> 1. Balachandran verbally tells Accounts the names, mobiles, and UPI IDs of the gang leaders working on site under each category
> 2. Accounts enters them into the system via **Labour Setup**
> 3. Only then do they appear on Balachandran's attendance screen
>
> If a new gang leader joins mid-project, Balachandran informs Accounts → Accounts adds them → they appear the next time Balachandran opens that category.

---

### Step 1 · Add Supervisors

Navigate to **Construction → Labour Setup → Add Supervisor**

Fill in for each site gang leader (as provided by Balachandran):

| Field | Notes |
|---|---|
| Full Name | As per records |
| Mobile | 10-digit Indian number |
| UPI ID | e.g. `rajan@upi` — used for payment |
| Notes | Optional (e.g. "Civil lead, North block") |

> Repeat for every supervisor across all categories.

---

### Step 2 · Assign Supervisors to Categories

Navigate to **Construction → Labour Setup → Assign to Category**

Select a supervisor and assign them to their work category (Civil, Electrical, Plumbing, Mechanical, IT / Security).

> A supervisor can be assigned to multiple categories if needed.  
> ⚠ The supervisor will appear on Balachandran's attendance screen only after this step.

---

### Step 3 · Propose Daily Rates

Navigate to **Construction → Rate Approvals → Propose Rate**

For each Supervisor · Category pairing, propose their daily wage rate (₹/day).

> This goes to Admin for approval. Payments **cannot** be generated until a rate is approved.

---

### Step 4 · Admin Approves Rates

Navigate to **Construction → Rate Approvals → Pending Approval**

Admin reviews each proposal and clicks **Approve** or **Reject**.  
On approval, the rate is immediately active for due calculations.

> Rate changes follow the same propose → approve flow.

---

## Part 2 — Daily Routine (Staff Lead · Balachandran)

Balachandran logs in to **relishvoucher.vercel.app** with his `Lead-Balachandran` credentials.  
He lands directly on the **Mark Attendance** screen — no other navigation is visible.

### Daily Attendance Marking

1. The screen shows all active **work categories** (Civil, Electrical, etc.)
2. Tap a category to open its supervisor list
3. For each supervisor, tap one of the four attendance buttons:

| Button | Value | Meaning |
|---|---|---|
| Full Day | 1.00 | Complete day present |
| Three-Quarter | 0.75 | ~6 hours |
| Half Day | 0.50 | ~4 hours |
| Quarter Day | 0.25 | ~2 hours |

4. Tap **Save Attendance** — the count shows `X of Y` supervisors marked
5. A green **Saved** badge confirms the record is stored
6. Go back and repeat for the next category

> **Re-editing:** Attendance can be re-marked for the same day until a payment voucher is created.  
> Once vouchered, the row is greyed out with an "Already included in a payment voucher" label.

---

## Part 3 — Payment Processing (Accounts)

### View Unpaid Dues

Navigate to **Construction → Labour Dues**

1. Select a work category from the dropdown
2. The list shows every supervisor with unpaid attendance, including:
   - Total unpaid days
   - Approved daily rate
   - Computed amount due
   - Date range of unpaid attendance

> Supervisors with no approved rate are shown with a red **No rate!** warning and cannot be selected.

---

### Create a Payment Voucher

1. Check the supervisors to include (or **Select All**)
2. Review the total at the bottom of the list
3. Click **Create Voucher →**

The system will:
- Create a `construction_voucher` record with a sequential voucher number
- Insert line items (one per supervisor: days × rate = amount)
- Mark all included attendance records as vouchered (they grey out for Balachandran)

> A success toast shows the voucher number and total amount.

---

### View Past Vouchers

Below the dues list, click **▸ Past Vouchers for this Category** to expand a list of all vouchers created for that category, with their status and line-item breakdown.

| Status | Meaning |
|---|---|
| `DRAFT` | Created, not yet submitted |
| `SUBMITTED` | Sent for approval |
| `APPROVED` | Approved for payment |
| `PAID` | Payment completed |
| `REJECTED` | Returned for correction |

---

## Part 4 — Attendance Log (Accounts / Admin)

Navigate to **Construction → Labour Log**

Provides a filterable read-only view of all attendance records.

| Filter | Options |
|---|---|
| Date | Defaults to today; change to any date |
| Category | All categories or a specific one |

Each row shows: Date · Category · Supervisor name & mobile · Attendance value · Voucher status (Unpaid / Vouchered) · Who marked it.

---

## Rate Change Process

When a supervisor's rate needs to change:

1. **Accounts** goes to **Rate Approvals → Propose Rate**
2. Selects the Supervisor · Category and enters the new rate
3. **Admin** approves it under **Rate Approvals → Pending Approval**
4. New rate applies to all **future** dues calculations immediately

> Historical attendance already included in a voucher is not affected by rate changes.

---

## Key Rules Summary

- Attendance can only be marked for **today** by Staff Lead
- A supervisor must be **assigned to a category** and have an **approved rate** before dues can be vouchered
- Once attendance is included in a voucher it is **locked** — cannot be re-marked
- Vouchers follow the existing Relish Approvals payment pipeline after creation
