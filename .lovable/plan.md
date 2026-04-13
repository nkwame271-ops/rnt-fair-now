

# Fix: Rent Field Always Read-Only & Agreement PDF Consistency

## Issues

### 1. Rent field not always read-only
In `EditProperty.tsx`, the rent `Input` field (line 353-359) is only `readOnly` when the unit has an active tenancy (`occupiedUnitIds.has(unit.id)`). It should be **always read-only** regardless of tenancy status — landlords must use the Rent Increase Application for any changes.

Additionally, in the `handleSave` function (line 163-166), `monthly_rent` is still sent in the unit update payload, which could allow overwriting the rent. This must be excluded.

### 2. Rent Increase approval — marketplace update
In `RegulatorRentReviews.tsx`, when admin approves, it updates `units.monthly_rent`, `tenancies.agreed_rent`, and `properties.approved_rent` (lines 67-86). However, it does **not** update the `asking_rent` on units (used by marketplace). Need to also update `units` with `asking_rent = proposed_rent` so the marketplace listing reflects the new price.

### 3. Landlord Agreements page — missing draft/unsigned agreement download
The Landlord Agreements page (`Agreements.tsx`) only shows a download button for `final_agreement_pdf_url` (the signed copy). It does NOT show the initial `agreement_pdf_url` (the draft/unsigned version generated when landlord declares existing tenancy with "Buy Agreement"). Need to add a "Draft Agreement" download button visible before tenant confirms.

### 4. Admin Agreements page — same issue
`RegulatorAgreements.tsx` needs to also show both `agreement_pdf_url` (draft) and `final_agreement_pdf_url` (signed) for download.

## Files to Modify

1. **`src/pages/landlord/EditProperty.tsx`**
   - Make rent field always `readOnly` with locked styling and hint text
   - Remove `monthly_rent` from the unit update payload in `handleSave`

2. **`src/pages/regulator/RegulatorRentReviews.tsx`**
   - On approval, also update `units.asking_rent` to the proposed rent so marketplace reflects the change

3. **`src/pages/landlord/Agreements.tsx`**
   - Add `agreement_pdf_url` to the TenancyView interface and data fetch
   - Show "Draft Agreement" download button when `agreement_pdf_url` exists (before final signed copy)
   - Show "Signed Copy" button when `final_agreement_pdf_url` exists (after tenant confirms)

4. **`src/pages/regulator/RegulatorAgreements.tsx`**
   - Add download buttons for both draft (`agreement_pdf_url`) and signed (`final_agreement_pdf_url`) versions

## Technical Details

**Rent field always locked** (EditProperty.tsx):
```typescript
// Line 353-363: Make readOnly unconditional
<Input
  type="number"
  value={unit.monthly_rent}
  readOnly
  className="bg-muted cursor-not-allowed"
/>
<p className="text-[10px] text-muted-foreground">
  Rent is managed by Rent Control. Use Rent Increase Application to request a change.
</p>
```

**Remove monthly_rent from save** (EditProperty.tsx line 163):
```typescript
// Remove monthly_rent from the update payload
const { error: unitErr } = await supabase.from("units").update({
  unit_name: unit.unit_name,
  unit_type: unit.unit_type,
  // monthly_rent removed — read only
  ...
}).eq("id", unit.id);
```

**Marketplace update on approval** (RegulatorRentReviews.tsx):
```typescript
if (req.unit_id) {
  await supabase.from("units").update({
    monthly_rent: req.proposed_rent,
    asking_rent: req.proposed_rent,  // NEW: update marketplace price
  }).eq("id", req.unit_id);
}
```

**Landlord Agreements — draft download** (Agreements.tsx):
```typescript
// Add agreement_pdf_url to TenancyView interface
agreement_pdf_url: string | null;

// In render, before the signed copy button:
{t.agreement_pdf_url && (
  <a href={t.agreement_pdf_url} target="_blank">
    <Button size="sm" variant="outline" className="text-xs">
      <FileText className="h-3 w-3 mr-1" /> Draft Agreement
    </Button>
  </a>
)}
```

