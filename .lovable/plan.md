# Platform-Hidden Revenue + Processor Reconciliation

Goal: For every non-Super-Admin view of escrow, receipts, tickets, and reconciliation, the `platform` recipient must be **invisible AND excluded from every total, breakdown, export, and chart**. Add a new generalised Processor/Bank Reconciliation report that follows the same rule.

## Guiding principle (single source of truth)

Introduce one helper that decides, per-viewer, which recipients are "visible". All revenue/total/export code must filter splits through it before summing.

```ts
// src/lib/revenue/visibleRecipients.ts
export const ALL_RECIPIENTS = ["rent_control","rent_control_hq","admin","admin_hq","platform","gra","landlord"] as const;
export const SUPER_ADMIN_ONLY = new Set(["platform"]);

export function getVisibleRecipients(opts: {
  isSuperAdmin: boolean;
  isVisible: (mod: string, sec: string) => boolean; // useModuleVisibility
}) { /* returns Set<string> of recipients the viewer is allowed to count */ }

export function sumVisibleSplits(splits: {recipient:string; amount:number}[], visible: Set<string>) { /* number */ }
```

Muted-revenue rule: if Super Admin mutes an allocation card (via `module_visibility_rules`), the same key is removed from `visible`, so totals shrink to match the visible cards.

## Part A — Hide Platform everywhere (non-Super)

1. **EscrowDashboard** (`src/pages/regulator/EscrowDashboard.tsx`)
   - Replace `SUB_ADMIN_VISIBLE_RECIPIENTS` with `getVisibleRecipients(...)`.
   - Rebuild `revenueByType` totals by summing each tx's splits restricted to the visible set — currently it uses `total_amount` which includes the platform cut. Sub-admin total = Σ(visible splits).
   - "Total Revenue" card binds to that recomputed total → matches Allocation Summary exactly.
   - Office Revenue breakdown table: hide the `Platform` column for non-Super and subtract `platform` from row `total`.
   - CSV + PDF exports: drop the Platform column / row when not Super; recompute `Total Revenue` row from visible recipients only.

2. **OfficeReconciliationReport** (`src/components/OfficeReconciliationReport.tsx`)
   - Gate Platform row in the summary card, Platform column in the per-office table, and Platform entries in the CSV export behind `isSuperAdmin`.
   - Reduce `total` shown to sub-admins to exclude `platform`.

3. **RegulatorReceipts** (`src/pages/regulator/RegulatorReceipts.tsx`) + **PaymentReceipt**
   - `PaymentReceipt` already strips platform splits for non-Super — keep.
   - Receipts table's row-level "split breakdown" tooltip and any CSV/PDF export must also filter the platform line and exclude its amount from per-receipt totals shown to sub-admins.

4. **StudentRevenue** (`src/pages/regulator/StudentRevenue.tsx`)
   - Same treatment: hide the `platform` card and exclude it from the visible total for non-Super.

5. **Tickets** — `RegulatorComplaints` / `ComplaintCaseFile` / `RequestComplaintPaymentDialog`: any "where did the fee go" allocation summary must filter to visible recipients.

6. **EscrowDashboard "Revenue by Destination"** chart/section already iterates `allocationCards`; ensure platform card is filtered out for non-Super (it currently is via `SUB_ADMIN_VISIBLE_RECIPIENTS`, but also tie it to the muted-rule helper so a Super Admin mute on `allocation_platform` for everyone else propagates).

## Part B — Processor / Bank Reconciliation Layer

New screen + abstraction.

### Abstraction
```
src/lib/processors/
  types.ts                // ProcessorAdapter interface
  paystack.ts             // implements ProcessorAdapter via existing paystack edge fns
  registry.ts             // { paystack: PaystackAdapter, /* future */ }
```

`ProcessorAdapter` shape:
```ts
interface ProcessorAdapter {
  id: string;                 // "paystack"
  label: string;              // "Paystack"
  getBalance(): Promise<{ available: number; pending: number; currency: string }>;
  listSettlements(range): Promise<Array<{ id, amount, settled_at, status, payout_account? }>>;
  listCollections(range): Promise<Array<{ reference, amount, fees, paid_at, status }>>;
  getNextPayoutEta?(): Promise<{ expected_at: string; amount: number } | null>;
}
```

New edge function `processor-reconciliation` (single endpoint, `?processor=paystack`) that calls the appropriate adapter server-side using existing Paystack secret, and joins against `escrow_transactions`/`escrow_splits` to compute partitions.

### UI: `src/pages/regulator/ProcessorReconciliation.tsx`
Sidebar entry under Receipts; route `/regulator/processor-reconciliation`; gated by `processor_reconciliation` feature key (default off; auto-on for Super Admin).

Cards (computed server-side, filtered client-side by visible recipients):
- Total processor / bank balance
- Total confirmed collections (period)
- Due to IGF (Office + HQ)
- Due to Admin / Office (Office + HQ)
- **Due to Platform — Super-Admin only**
- Already settled
- Next expected payout
- Balance remaining for settlement (= balance − Σ visible dues that haven't been paid out)

For non-Super: the API response strips `platform` partition before the page receives it (server-side enforcement, not just client hiding) and the "balance remaining" is recomputed without the platform leg so it never leaks.

Discrepancy panel: side-by-side `Processor settled vs Platform-recorded splits` per destination; flags any mismatch.

Exports (CSV + PDF) reuse the same filtered partitions — Platform column omitted for sub-admins.

### Wiring
- Add `ProcessorReconciliation` lazy route + sidebar item in `RegulatorLayout`.
- Add `processor_reconciliation` to `FEATURE_ROUTE_MAP`.
- Add `allocation_platform`, `processor_platform_breakdown` to `module_visibility_rules` seed as `super_admin_only` so they're hidden from sub-admins by default.

## Part C — Audit sweep + tests

- Grep `recipient === "platform"` / `byRecipient.platform` / `partitions.platform` and route every read through `getVisibleRecipients`.
- Manual QA matrix: Super Admin / Main Admin / Sub Admin × {EscrowDashboard, OfficeReconciliationReport, RegulatorReceipts, StudentRevenue, ProcessorReconciliation, CSV export, PDF export} — verify Platform line absent AND totals shrink accordingly.

## Files touched

Create: `src/lib/revenue/visibleRecipients.ts`, `src/lib/processors/{types,paystack,registry}.ts`, `src/pages/regulator/ProcessorReconciliation.tsx`, `supabase/functions/processor-reconciliation/index.ts`, migration seeding `processor_reconciliation` flag + `module_visibility_rules`.

Edit: `EscrowDashboard.tsx`, `OfficeReconciliationReport.tsx`, `RegulatorReceipts.tsx`, `PaymentReceipt.tsx` (totals only — splits already filtered), `StudentRevenue.tsx`, `ComplaintCaseFile.tsx`, `RequestComplaintPaymentDialog.tsx`, `RegulatorLayout.tsx`, `useAdminProfile.ts` (FEATURE_ROUTE_MAP), `App.tsx` (route).
