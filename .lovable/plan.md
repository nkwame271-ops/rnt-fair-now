

## Plan — Fix Property Map race + Hostel "List on Marketplace" error

### Issue 1: Property location map fails until reload

**Root cause**: `useJsApiLoader` from `@react-google-maps/api` shares a singleton across mounts. When `PropertyLocationPicker` mounts before the API finishes loading (or when navigated to from a page that didn't preload it), `google.maps.places` can briefly be undefined. Our current guard treats this as a permanent failure and shows the amber "could not load" fallback instead of waiting.

**Fix in `src/components/PropertyLocationPicker.tsx`**:
- Replace the synchronous `mapLoadError` check with a state flag that polls `window.google?.maps?.places` for up to ~5 s after `isLoaded` becomes `true`.
- Show "Loading map…" while polling instead of jumping to the error fallback.
- Only show the amber "could not load" fallback if `loadError` is truthy OR the poll times out.
- Same pattern applied to `<Autocomplete>` so it never renders before `places` is ready.

### Issue 2: Hostel "List on Marketplace" → "Edge function returned a non-2xx status code"

**Root cause** — two compounding problems:

1. `paystack-checkout/index.ts` returns **HTTP 400** on any throw (line 970). The Supabase JS client converts non-2xx into the generic *"Edge function returned a non-2xx status code"*, hiding the real error (e.g. `Property not found`, `Unauthorized`, `Already listed`, missing rent_band, missing PAYSTACK key). The user sees no actionable info.
2. For hostels the property is created with `property_status = 'pending_assessment'`, but the listing button only checks `["approved", "off_market", "live"]` for the **label**; it does still fire the click handler via the inner compliance check, which then attempts payment and fails on the server side.

**Fixes**:

**A. `supabase/functions/paystack-checkout/index.ts`** — return errors as HTTP **200** with `{ ok: false, error }` so the client always reads the body:
```ts
} catch (error: any) {
  console.error("Checkout error:", error.message);
  return new Response(JSON.stringify({ ok: false, error: error.message }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```
Update success responses to also include `ok: true` for consistency. (Same pattern already used by `compute-rent-benchmark`, per project memory.)

**B. `src/pages/landlord/MyProperties.tsx`** — read `data.error` and stop on `ok === false`:
```ts
if (data?.ok === false) throw new Error(data.error);
```

**C. Add an explicit hostel/pending-status pre-check** in the same `handleToggleListing` block so the user gets a clear message *before* hitting the edge function:
- If `property_status === 'pending_assessment'`, push `"Property is awaiting Rent Control assessment. Listing will be available after approval."` into `complianceErrors`.
- Disable the button entirely (not just relabel it) when status is `pending_assessment` / `pending_identity_review`, so the click handler can't fire.

**D. Hostel-specific compliance** — current code requires `property.units.length === 0` to fail; for hostels this works (bed-space units exist). No change needed, but add a defensive check that at least one unit has `status === 'vacant'` for marketplace listing eligibility.

### Files to edit
- `src/components/PropertyLocationPicker.tsx` — places-ready polling
- `supabase/functions/paystack-checkout/index.ts` — return errors as 200/{ok:false,error}
- `src/pages/landlord/MyProperties.tsx` — handle `ok:false`, harden pending-status guard, disable button when not approved

### Out of scope
No DB migration. No changes to fee/split logic. No changes to `PropertyMap.tsx` (different code path — only edit if user reports the same race there).

