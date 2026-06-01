## Goal

Two new admin-controlled engines inside Templates:

1. **GRA Tax toggle** — one switch that turns the entire tax workflow off (PDFs, payment rows, checkout, receipts, agreement clauses).
2. **Service Fee engine** — per-payment-type percentage fee with configurable revenue splits, shown only at checkout, never on receipts, separate from rent.

## Where this lives

`Regulator → Templates` (`src/pages/regulator/RegulatorAgreementTemplates.tsx`) gets a top-level **Tabs** wrapper with two tabs:
- **Agreement** (current screen, unchanged)
- **GRA Tax & Service Fees** (new)

No new top-level route needed.

---

## 1) GRA Tax toggle

### Schema (new migration)
```
ALTER TABLE public.agreement_template_config
  ADD COLUMN gra_tax_enabled boolean NOT NULL DEFAULT true;
```
(Settlement row `rent_tax → gra (100%)` in `split_configurations` stays; gating happens upstream.)

### Server (single source of truth — never trust client)
- **`supabase/functions/paystack-checkout/index.ts`**
  - Read `gra_tax_enabled` once at the top of the handler.
  - When `false`:
    - `rent_tax` and `rent_tax_bulk` → return `{ ok: false, error: "GRA tax is currently disabled" }` (UI hides the button so this is just a safety net).
    - `rent_combined` → behave exactly like `rent_payment` (`totalAmount = rent`, single landlord split, no `getTaxSplitPlan`).
- **`supabase/functions/_shared/finalize-payment.ts`** (renewal cascade ~line 1140) — replace hardcoded `rent * 0.08` with `gra_tax_enabled ? rent * taxRate : 0`. Read `tax_rate` + flag from `agreement_template_config` once before the loop.
- **`AddTenant.tsx` / `DeclareExistingTenancy.tsx` / `MyAgreements.tsx` renewal path** — when generating `rent_payments`, set `tax_amount = 0` and `amount_to_landlord = rent` if flag is off. The flag comes from the same `agreement_template_config` row already loaded as `templateConfig`.

### Agreement PDF — `src/lib/generateAgreementPdf.ts`
- Accept `templateConfig.gra_tax_enabled`. When false:
  - Drop the "Govt. Tax" / "To Landlord (X%)" rows from the monthly breakdown; show "Monthly Rent" + "Advance" only.
  - Skip auto-emitting the two boilerplate clauses that mention 8% tax (filter `terms` for the substrings "8% government tax" / "8% tax has been paid").

### UI surfaces that today show `tax_amount`
`src/pages/tenant/Payments.tsx`, `src/pages/tenant/MyAgreements.tsx`, `src/pages/landlord/Agreements.tsx`, `src/pages/regulator/RegulatorAnalytics.tsx` — guard each tax line/sum with `tax_amount > 0`. New tenancies created with flag off will already have `0`, so existing UI degrades cleanly. No conditional fetches needed.

### Templates UI
A single switch + helper text:
```
[●] GRA Tax Enabled
When disabled: no tax is requested on rent payments, no tax line appears
on tenancy agreements, no tax clauses are inserted, and rent_combined
checkout charges only the rent. Existing tax owed on past tenancies is
unaffected.
```

---

## 2) Service Fee engine

### Schema (same migration)
```
CREATE TABLE public.service_fee_configurations (
  payment_type        text PRIMARY KEY,
  enabled             boolean NOT NULL DEFAULT false,
  percentage          numeric NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid
);

CREATE TABLE public.service_fee_splits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type    text NOT NULL REFERENCES public.service_fee_configurations(payment_type) ON DELETE CASCADE,
  payer_segment   text NOT NULL CHECK (payer_segment IN ('standard','student')),
  recipient       text NOT NULL,   -- 'platform' | 'nugs' | 'admin' | 'igf'
  percentage      numeric NOT NULL,
  sort_order      int NOT NULL DEFAULT 0,
  UNIQUE(payment_type, payer_segment, recipient)
);

ALTER TABLE public.escrow_splits ADD COLUMN is_service_fee boolean NOT NULL DEFAULT false;
```
Plus GRANTs (auth read, super-admin write via RLS using `is_super_admin(auth.uid())`) and a validation trigger that ensures the percentages for each `(payment_type, payer_segment)` sum to ≤ 100.

Seed rows for the eight live payment types (`rent_payment`, `rent_combined`, `complaint_fee`, `agreement_sale`, `landlord_registration`, `tenant_registration`, `student_registration`, `student_complaint_fee`) with `enabled=false`, `percentage=0`, and a single `(standard, platform, 100)` row so the engine is wired but inert.

### Server — shared helper `supabase/functions/_shared/service-fee.ts`
```
export async function resolveServiceFee(supabase, paymentType, baseAmount, payerSegment): {
  enabled, percentage, fee, splits: [{recipient, amount, description}]
}
```
- Loads the config row + matching `service_fee_splits` for the segment.
- Returns `fee = round(base * percentage/100, 2)` and per-recipient split amounts (last row absorbs rounding).
- `payerSegment` is `"student"` when the user is on `nugs_staff`, when the user has the `student` role, or when the payment_type starts with `student_`; otherwise `"standard"`.

### Checkout integration — `paystack-checkout/index.ts`
For every supported `type` branch, after computing `splitPlan`:
```
const seg = await detectPayerSegment(supabaseAdmin, userId, type);
const sf = await resolveServiceFee(supabaseAdmin, type, baseAmount, seg);
if (sf.enabled && sf.fee > 0) {
  totalAmount += sf.fee;
  splitPlan.push(...sf.splits.map(s => ({ ...s, is_service_fee: true })));
  metadata.service_fee = { amount: sf.fee, percentage: sf.percentage, segment: seg };
}
```
The fee is wrapped into the Paystack `amount` so the payer sees one charge. `metadata.service_fee` is returned to the client in the init response (`{ authorization_url, breakdown: { base, service_fee, total } }`).

### Checkout preview UI
Every initiator that calls `paystack-checkout.invoke(...)` (Payments.tsx, ManageRentCards, FileComplaint, RentalApplications, etc.) wraps the click in a tiny confirmation dialog (new `src/components/CheckoutBreakdownDialog.tsx`) that:
1. Calls a new lightweight `quote-service-fee` edge function (or piggybacks on a `?quote=1` flag) to fetch `{ base, service_fee, total, percentage }`.
2. Shows the breakdown and a "Proceed to pay" button that fires the real `paystack-checkout` call.

This is the only place the fee is visible.

### Escrow → receipts (fee absent from receipts)
- `escrow_splits` rows tagged `is_service_fee=true` flow into the ledger normally for revenue reporting.
- `finalize-payment.ts` already creates `payment_receipts.amount` from the customer-paid `escrow.total_amount`. We override:
  - `receiptPayload.amount = escrow.total_amount - sum(service_fee splits)`
  - `receiptPayload.metadata.service_fee_excluded = <fee>` (auditable but not rendered).
- `PaymentReceipt.tsx` / receipt PDF — no template change needed; they read `amount` and never see fee lines.
- Rent splits stay `{recipient: landlord, amount: rent}` — fee is additive, never subtracted from rent.

### Reconciliation safety
`processor-reconciliation` and `reconcile-internal-ledger` already sum on `escrow_splits.amount`. They keep working because fee splits are real escrow rows. Add a single filter clause in receipt-side comparisons to exclude `is_service_fee=true` when matching against `payment_receipts.amount`.

### Templates UI (new tab)

Table-style editor:

```
Payment type           Enabled   Fee %    Splits (Standard)            Splits (Student)
rent_payment           [●]       2.50     platform 100                 platform 25 / nugs 25 / admin 25 / igf 25
complaint_fee          [ ]       0.00     platform 100                 —
agreement_sale         [ ]       0.00     ...                          ...
...
```

Each row expands into two grids (Standard / Student) where the admin types four percentages; row turns red until the total = 100. Super-admin only edits Student splits (enforced both UI-side via `profile.isSuperAdmin` and DB-side via RLS).

---

## Out of scope
- Existing past `rent_payments` rows keep their stored `tax_amount` — flag only affects rows created after toggle.
- Payment-provider switch (UMB) is unrelated and tracked separately.
- No receipt template redesign — fee is filtered out, not styled away.

## Technical notes
- `gra_tax_enabled` is read server-side on every checkout; client toggle is purely informational.
- `service_fee_splits` trigger rejects writes whose percentage sum > 100 per segment; sum < 100 is allowed (admin can leave room) and surplus stays with the platform as fallback.
- `is_service_fee` column is the single discriminator the receipt code uses — no payment_type sniffing, no string matching.
- Renewal auto-cascade in `finalize-payment.ts` is the only other place rent payments are generated; updated to honor the toggle.
- Tabs in Templates use existing shadcn `Tabs` — no new shell.
