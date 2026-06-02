# Fix batch: Rent Review, Applications, Reconciliation, Add Tenant, Agreements, Templates, Engine Room

Seven independent fixes. Each item lists root cause + fix.

---

## 3. Rent Review — `column "asking_rent" of relation "units" does not exist`

**Cause:** `public.approve_rent_increase_request` (migration `20260513105316`) writes `SET monthly_rent = ..., asking_rent = ...` on `units`. Confirmed via DB introspection — `units` has `monthly_rent`, `rent_locked_at`, `rent_locked_amount` but **no `asking_rent`** column.

**Fix:** New migration to `CREATE OR REPLACE` the function dropping the `asking_rent` assignment. Keep all other behavior identical (locks, tenancy sync, property event log).

---

## 4. Applications — landlord rent-increase images return `bucket not found` 404

**Cause:** `RentIncreaseRequest.tsx` uploads to bucket `application-evidence` (which exists, private) and then calls `getPublicUrl()`. Because the bucket is **private**, public URLs return 404 in `RegulatorApplications.tsx`.

**Fix:** Two changes:
1. In `RentIncreaseRequest.tsx`, store the storage **path** (not the public URL) into `evidence_urls`.
2. In `RegulatorApplications.tsx`, when rendering attachments, generate a `createSignedUrl(path, 3600)` on demand and open/preview that signed URL. Backward-compat: if the stored value already looks like a full http(s) URL, fall back to using it directly.

No bucket privacy change (evidence must stay private).

---

## 5. Processor Reconciliation — custom date range ignored

**Cause to verify and fix:** `ProcessorReconciliation.tsx` likely loads data once with a default 30-day window and the date inputs don't re-trigger the fetch (missing `useEffect` dep / no "Apply" handler). Will read the file, wire the `from`/`to` state into the query keys / fetch trigger, and add an Apply button that refetches.

---

## 6. Add Tenant workflow — multiple GRA-tax-off fixes

a. **Hide "Pay All Advance Tax" card** in `tenant/MyAgreements.tsx` when `gra_tax_enabled === false` (the flag is already read at line 85). The "Pay 0 GHS Online → Invalid amount" error disappears because the entry point is gone.

b. **Rewrite the "How rent payment works" card** so it has two variants: tax-on (current copy) and tax-off (talk only about advance rent + landlord settlement, no tax wording).

c. **Pay landlord on the platform — default & read-only MoMo/bank number:**
   - In `landlord/AddTenant.tsx` and `landlord/DeclareExistingTenancy.tsx`, after the landlord selects the offline-collect option, fetch the landlord's `payment_settings` (MoMo or bank account) and pre-fill the payee number field.
   - Render it `readOnly` with helper text: "To change this, update Payment Settings in your dashboard."
   - Mark "Pay landlord on the platform" as the **Recommended** option in the UI for both add-tenant and existing-tenancy flows.

d. **Rent amount is read-only** in Add Tenant and Declare Existing Tenancy. The rent field is bound to the declared/approved rent on the unit/property. Disable the input and show a tooltip: "Locked. Submit a Rent Increase Application to change." (DB triggers already enforce this; this just stops users typing into a field they can't change.)

---

## 7. Agreements — draft PDF must match Templates; hide GRA tax when off

**Fix:** `src/lib/generateAgreementPdf.ts` should read the active template config (the same `tplConfig` Templates writes) and:
- Use the **current clauses/sections** from Templates instead of any hard-coded copy.
- Omit the GRA-tax clause/line entirely when `gra_tax_enabled === false`.

---

## 8. Templates — inline split editor under each fee

**Fix:** In `RegulatorAgreementTemplates.tsx` (and/or `RegulatorTaxAndFees.tsx` where GRA Tax + Service Fees live), render the recipient split editor directly under each fee row. Reuse the split editor already used for "Existing Tenancy" splits. Validation: sum of split percentages == 100. Persist to the same config blob the fee belongs to.

---

## 9. Engine Room → Add Tenant Fee — independent splits, sum == band total

**Fix:** In the Add Tenant Fee section of `EngineRoom.tsx`, mirror the Existing Tenancy splits behavior:
- Each rent band has its own independent split rows (recipient + amount).
- Validation: per-band, `sum(split.amount) === band.total`. Block save with an inline error otherwise.
- Show a live "remaining: X" helper while editing.

---

## Technical notes

- Only one DB migration needed (item 3). Items 4–9 are app-code only.
- Item 6c relies on the existing `payment_settings` table — will confirm field name on implementation.
- Backward-compat for stored `evidence_urls`: signed-URL helper accepts both paths and full URLs.

## Out of scope

- No changes to RLS, no bucket privacy changes, no escrow/payment-processor logic changes.
