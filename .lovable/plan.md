

## Make per-unit fee compounding strict (Add Tenant)

The multi-unit refactor already creates a separate tenancy, signatures, rent‑payment schedule, rent card pair, and (for Declare Existing Tenancy) a separate agreement PDF per selected unit — that part of your requirement is already met.

The remaining gap is in the **fee math for Add Tenant**: the client currently sends one averaged `monthlyRent` plus a `quantity`, and the server multiplies one band's per-unit fee by quantity. When two units in the same property fall in different rent bands (e.g. one studio at GHS 500 and one 3-bed at GHS 5,000), the total fee is wrong — it doesn't compound truly per unit.

Declare Existing Tenancy already does this correctly via `items[]`. We will bring Add Tenant to the same model, and harden a few related details.

### Changes

1. **`supabase/functions/paystack-checkout/index.ts`** — extend the `add_tenant_fee` branch
   - Accept an `items: [{ monthlyRent }]` array (same shape as `existing_tenancy_bundle`).
   - For each item, look up its own `add_tenant` rent band and sum `register_fee + filing_fee + agreement_fee` per unit. Total = sum across items. Each component (`register_tenant_fee`, `filing_fee`, `agreement_sale`) is summed across items, then split via existing allocation logic.
   - Keep backward compatibility: if `items` is missing, fall back to the current `monthlyRent + quantity` path so other entry points (e.g. accept-application single-unit flow) keep working.
   - Update `metadata` to include the per-unit `itemBreakdown` (same as existing_tenancy_bundle) so verify-payment / finalize-office-attribution can attribute per tenancy.

2. **`src/pages/landlord/AddTenant.tsx`** — switch to per-unit items
   - Replace the averaged-rent payload with `items: drafts.map(d => ({ monthlyRent: parseFloat(d.rent) || 0, unitId: d.unitId }))`.
   - Drop the `avgRent` workaround. Keep `unitIds` for office attribution.
   - The on-screen fee summary already uses `bandFeeFor(d.rent)` per draft via `totalFee` — confirm it matches the server total (it will).

3. **`src/pages/landlord/DeclareExistingTenancy.tsx`** — no fee logic change
   - Already sends per-unit `items[]` with each unit's own `agreementChoice`, so a unit set to "buy" adds the agreement fee and a unit set to "upload" does not. This already satisfies "agreement fee × N only when purchase applies."
   - Minor: confirm the per-unit agreement PDF generation loop (line 274) runs once per draft where `agreementChoice === "buy"` — it does.

4. **No database changes, no RLS changes, no new edge functions.**

### Invariants preserved (your requirement, restated)

- Each selected unit → one row in `tenancies` (separate registration code, separate signatures, separate rent_payments schedule).
- Each tenancy → its own pair of rent cards (already enforced by the shared `usedCardIds` pool).
- Each tenancy with `agreementChoice = "buy"` → its own generated agreement PDF stored under that tenancy.
- Fees compound strictly per unit: `total = Σ per-unit fee`. No averaging, no flat multiplier when bands differ.

### Out of scope

- UI of the multi-unit wizard, validation rules, rent card pool logic, session-storage resume — all already correct.
- Single-unit entry points (Rental Application accept) — keep working via the legacy `monthlyRent + quantity` fallback.

