

# Plan: Marketplace Viewing Fix, Rent Checker Data, Tax Payment Fix, Google Maps

## 1. Marketplace Viewing Request — Hide Payment After Paying

**Problem**: After paying the viewing fee, the "Pay GH₵ 2 & Send Viewing Request" button still shows. The tenant can be prompted to pay again.

**Root cause**: `Marketplace.tsx` line 145 only fetches viewing requests with status `["accepted", "confirmed"]` into `confirmedViewings`. It does not track requests with status `"pending"` (paid, awaiting landlord response) or `"awaiting_payment"` (created but not yet paid). The viewing form always renders regardless of whether a request already exists for that unit.

**Fix in `Marketplace.tsx`**:
- Add a new state `existingRequests` (Set of unit_ids) for ALL viewing requests by this tenant (any status except declined/cancelled)
- In the modal, if the unit already has a viewing request:
  - If status is `awaiting_payment` → show "Payment Pending" message
  - If status is `pending` → show "Viewing Requested — Awaiting Landlord Response"
  - If status is `accepted`/`confirmed` → show current "Apply to Rent" flow
  - Hide the viewing request form entirely when any active request exists
- Update the `useEffect` that fetches user data to query all viewing request statuses per unit

**Files**: `src/pages/tenant/Marketplace.tsx`

---

## 2. Rent Checker — Expand Data for All Regions

**Problem**: `rentPrices` in `dummyData.ts` only covers a handful of areas in Greater Accra, Ashanti, Western, Central, and Northern. Most regions/areas return no results.

**Fix in `src/data/dummyData.ts`**:
- Add rent price entries for every region, covering at least 3-5 major areas per region and all 6 property types per area (or at minimum Single Room, Chamber & Hall, 1-Bedroom, 2-Bedroom)
- This is a data expansion — no logic changes needed in `RentChecker.tsx`

**Files**: `src/data/dummyData.ts`

---

## 3. Tax Payment "Doubling" Fix

**Problem**: User reports selecting "Pay 288" but being charged 576.

**Analysis**: The `Payments.tsx` button shows `unpaidAdvanceTax` which is the SUM of all unpaid months' `tax_amount`. If a tenant has 2 unpaid months at 144 each, the total is 288. The checkout function sums all unpaid payments' `tax_amount` — these should match.

**Likely cause**: The display in Payments.tsx shows per-month "Total Charges" as `tax_amount + amount_to_landlord` (line 234), but the Pay All button charges only `tax_amount`. The user may be seeing the wrong number on the button vs what gets charged. OR the rent_payments table has duplicate rows.

**Fix approach**:
- In `Payments.tsx`, make the "Pay All" button amount clearer — show exactly what will be charged with a breakdown: "{X} months × GH₵ {per_month_tax} = GH₵ {total}"
- In `paystack-checkout/index.ts`, add a deduplication check to prevent double-counting if duplicate payment rows exist
- Add logging of the exact computed amount for debugging

**Files**: `src/pages/tenant/Payments.tsx`, `supabase/functions/paystack-checkout/index.ts`

---

## 4. Google Maps Integration

**Problem**: Current location picker uses OpenStreetMap/Leaflet and Nominatim for geocoding. User wants Google Maps for better accuracy.

**Approach**: Replace Leaflet with Google Maps JavaScript API using `@react-google-maps/api`. Replace Nominatim geocoding with Google Places Autocomplete.

**Requirements**: A Google Maps API key with Maps JavaScript API + Places API enabled.

**Files**:
- `src/components/PropertyLocationPicker.tsx` — Replace Leaflet map with Google Maps, replace Nominatim search with Places Autocomplete
- `src/components/PropertyMap.tsx` — Update any map displays to use Google Maps
- Need to request the Google Maps API key from user via `add_secret`

---

## 5. Payment Before Access (General)

**Current state**: Most paid features already gate on payment (viewing requests create with `awaiting_payment` status, complaints use `pending_payment`). The fix in item 1 above handles the marketplace viewing case. No additional changes needed for other flows — they already follow the pay-first pattern.

---

## Implementation Order

1. **Marketplace viewing fix** — `Marketplace.tsx` (fetch all request statuses, hide form when request exists)
2. **Tax payment clarity** — `Payments.tsx` + `paystack-checkout/index.ts`
3. **Rent Checker data** — `dummyData.ts` (expand rent prices)
4. **Google Maps** — Requires API key; will ask user before proceeding

