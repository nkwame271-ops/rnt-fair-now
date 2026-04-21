

## Multi-Unit Tenant Registration

Convert **Add Tenant** and **Declare Existing Tenancy** from single-unit flows into multi-unit flows, so a landlord can register many tenancies at once under one property in a single pass.

---

### New flow (both pages)

```text
Step 1  Select Property
Step 2  Select Units              ← multi-select checkboxes (vacant only)
Step 3  Per-Unit Tenant Details   ← one card per unit
Step 4  Per-Unit Terms            ← rent / advance / dates per unit
Step 5  Per-Unit Rent Cards       ← 2 cards per unit (landlord + tenant copy)
Step 6  Review (table of all)
Step 7  Pay combined fee → Submit (transactional, all-or-nothing)
```

### UI per selected unit (Step 3 onward)

Each selected unit gets its own collapsible card showing:

- Unit name + type + suggested rent (prefilled from unit)
- **Tenant Details**
  - Full name (text)
  - Phone (text, with “Find existing tenant” lookup button — same logic that exists today: matches profile by phone, otherwise creates a `pending_tenants` invite)
- **Terms** (Add Tenant only — Declare Existing keeps its own fields: existing start date, advance paid, etc.)
  - Monthly rent
  - Advance months
  - Lease duration
  - Start date (end date auto-computed)
- **Rent Cards**
  - Landlord copy (Card 1) — dropdown of available cards
  - Tenant copy (Card 2) — dropdown, excludes cards picked anywhere else in the form
- Per-unit validation badge (✓ complete / ⚠ missing fields)

A global "Apply same rent / dates to all units" helper sits above the cards to speed up bulk entry.

### Rent card pool

- One shared pool of `availableRentCards` is fetched once.
- A computed `usedCardIds` set excludes cards already chosen by any other unit row, so the same card cannot be picked twice across the whole form.
- Validation blocks submit if `selectedUnits.length × 2 > availableRentCards.length`, with a link to buy more cards.

### Fee calculation

- Per-unit fee is computed using the existing rent-band logic (`add_tenant_fee` for Add Tenant, `existing_tenancy` band for Declare Existing).
- Total fee = sum of per-unit fees.
- Single Paystack checkout with `quantity = selectedUnits.length` and a metadata array of unit IDs so `verify-payment` / `finalize-office-attribution` can attribute correctly.

### Submission (atomic batch)

For each selected unit, the existing single-unit submit logic runs in sequence inside one try/catch:

1. Insert tenancy (with retry on registration_code collision — already implemented)
2. Insert tenancy_signatures row
3. Activate the 2 rent cards (landlord_copy + tenant_copy)
4. Generate rent_payments schedule
5. Mark unit `occupied`
6. Insert property_event
7. Send notifications to tenant + landlord

If any unit fails midway, completed units stay (each is independently valid) and the user sees a clear summary: "5 of 7 tenancies created. 2 failed: …" with a Retry button for the failed rows. This is safer than a full rollback because each tenancy is self-contained and partial success is still useful.

The property’s `property_status` is set to `occupied` once at the end (only if all its units are now occupied).

### Session storage / payment redirect

The current `addTenantFormData` / `declare_existing_tenancy_form` payloads grow to:

```ts
{
  selectedPropertyId: string,
  units: Array<{
    unitId, tenantName, tenantPhone, matchedTenantUserId?,
    rent, advanceMonths, leaseDurationMonths, startDate,
    rentCardId1, rentCardId2,
    customFieldValues
  }>
}
```

Auto-resume after Paystack callback iterates the array and submits each.

### Files to edit

- `src/pages/landlord/AddTenant.tsx` — refactor state from flat fields to `units: UnitDraft[]`; rebuild Steps 1, 2 & 3 UI; loop submit; loop fee calc.
- `src/pages/landlord/DeclareExistingTenancy.tsx` — same refactor, keeping its agreement-upload / agreement-buy choice (the choice applies per unit so each tenancy gets its own PDF).
- `supabase/functions/paystack-checkout/index.ts` — accept `quantity` and `unit_ids[]` metadata so a single transaction covers N units.
- `supabase/functions/finalize-office-attribution/index.ts` — already keyed by escrow_transaction_id; no schema change, just confirm it can attribute one transaction covering N tenancies (one office, all units belong to one property).

### Out of scope (unchanged)

- Rent card schema, RLS, tenancy schema, notification templates, agreement PDF generator.
- Single-unit flows from other entry points (Rental Applications → accept) keep working — they just call a single-unit slice of the new logic.
- No database migrations required.

### Validation rules

- ≥1 unit must be selected.
- Each unit row must have: tenant name, valid Ghana phone (10 digits starting with 0), rent > 0, advance ≤ 6 months (Act 220), 2 distinct rent cards, dates valid.
- No rent card may appear in more than one row.
- Submit button disabled until every row passes validation.

