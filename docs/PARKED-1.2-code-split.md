# PARKED — Task 1.2: Code-Split the Monolith

**Status:** Parked 2026-08-07. Analysis complete; implementation deferred.
**Revive when:** post-Phase 2/3 hardening, or if cold-start on mobile is still the complaint after 1.1/1.3/1.4.

---

## Why parked

Task 1.1 (Babel removal) eliminated the dominant startup bottleneck (~1–3 s Babel parse on mobile). The remaining gain from splitting is real (~47% shell reduction) but requires either a source reorder (aggressive) or a modest 9% win (conservative). Given the forward-reference tangle documented below, the reorder carries non-trivial risk. Deferring until the codebase is otherwise stable.

---

## Dependency map — the key constraint

`VoucherList` (defined line 2,743) has four dependencies defined much later in the file:

| Component | Defined at | Used inside |
|---|---|---|
| `BillAttachmentPanel` | 7,106 | `VoucherList` (3858, 4321), `CreateVoucher` (2293) |
| `HoaCorrectionPanel` | 7,748 | `VoucherList` (3668) |
| `ProposeHoaCorrectionSection` | 7,876 | `VoucherList` (3856) |
| `RetrospectiveScanModal` | 10,647 | `VoucherList` (4343) |

A naïve line-cut before 10,648 produces a broken shell. These four components must either stay in the shell (preventing deferral of PayeesManagement etc.) or be physically moved earlier in the file before the split.

---

## Deferrable components (only-referenced-from-App-switch)

| Component | Lines | Approx size |
|---|---|---|
| `UsersManagement` | 4,738–5,689 | ~951 lines |
| `PayeesManagement` | 5,690–6,330 | ~641 lines |
| `PaymentAccountsManagement` | 6,331–6,411 | ~81 lines |
| `AccountsManagement` | 6,412–7,105 | ~693 lines |
| `SuspenseVoucherForm` | 7,488–7,628 | ~141 lines |
| `PendingNew/Close/TopUpPanels` | 7,629–8,202 | ~573 lines |
| `SuspenseVoucherList` | 8,203–8,367 | ~165 lines |
| `SuspenseVoucherDetail` | 8,368–9,797 | ~1,430 lines |
| `SettlementSessionPage` | 9,900–10,364 | ~465 lines |
| `CaptureSessionPage` | 10,365–10,460 | ~96 lines |
| `ReceiptShareModal` | 10,461–10,646 | ~186 lines |
| `UnassignedReceiptsPage` | 10,804–10,944 | ~141 lines |
| `ReconcileReceipts` | 10,945–11,121 | ~177 lines |
| **Total** | | **~5,740 lines (~48% of file)** |

---

## Two options

### Option A — Conservative (no reorder, ~9% shell reduction)
Defer only SettlementSessionPage, CaptureSessionPage, ReceiptShareModal, UnassignedReceiptsPage, ReconcileReceipts (~1,065 lines). Shell bundle: ~475 KB vs 522 KB current. Zero reordering risk.

### Option B — Aggressive (reorder + split, ~47% shell reduction) ← recommended when revived
**Phase 1 (reorder only):** Move the four VoucherList dependencies (BillAttachmentPanel, HoaCorrectionPanel, ProposeHoaCorrectionSection, RetrospectiveScanModal — ~766 lines total) to just after `VoucherList` ends (~line 5,689). Pure relocation, no logic changes. Confirm working in one deploy.

**Phase 2 (split):** Cut at the post-VoucherList/pre-UsersManagement boundary. Shell = everything up to that boundary + the `App` component (with heavy-page guards). Heavy = everything else.

Estimated shell bundle: ~275 KB (47% reduction from 522 KB).

---

## Mechanism: manual two-bundle global bridge

`app.js` has no `import`/`export`. Use a global window bridge — no ES module migration required:

```js
// app-heavy.js — last lines
window.AppHeavy = {
  UsersManagement, PayeesManagement, AccountsManagement,
  SuspenseVoucherForm, SuspenseVoucherList, SuspenseVoucherDetail,
  SettlementSessionPage, CaptureSessionPage, ReceiptShareModal,
  ReconcileReceipts, UnassignedReceiptsPage
};
```

```js
// app-shell.js — loadHeavy helper (called on first heavy navigation)
let _heavyLoaded = false;
function loadHeavy(onLoad) {
  if (_heavyLoaded) { onLoad(); return; }
  const s = document.createElement('script');
  s.src = '/app-heavy.bundle.js?v=32';
  s.onload = () => { _heavyLoaded = true; onLoad(); };
  document.head.appendChild(s);
}
```

```js
// App switch — heavy page cases
case 'payees': {
  if (!window.AppHeavy) { loadHeavy(() => setCurrentPage('payees')); return <PageLoading />; }
  return <window.AppHeavy.PayeesManagement />;
}
```

---

## SW precache decision (when revived)

| Bundle | Precache? | Rationale |
|---|---|---|
| `app-shell.bundle.js?vN` | Yes | Must render on offline cold start |
| `app-heavy.bundle.js?vN` | No — runtime-cached only | Precaching defeats lazy-load; goes to dynamic cache after first visit |

Version strings (`?vN`), not content hashes. Both bump together on any source change.

---

## Build script (when revived)

```json
"build": "esbuild public/app-shell.js --loader:.js=jsx --outfile=public/app-shell.bundle.js --minify --sourcemap --target=es2018 && esbuild public/app-heavy.js --loader:.js=jsx --outfile=public/app-heavy.bundle.js --minify --sourcemap --target=es2018"
```

## Gitignore additions (when revived)

```
public/app-shell.bundle.js
public/app-shell.bundle.js.map
public/app-heavy.bundle.js
public/app-heavy.bundle.js.map
```
