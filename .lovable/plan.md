

## Fix: Complaints rent-band lookup + Password recovery final step

### Issue 1 — "This complaint type requires a linked property to determine the rent band"

**Root cause.** The "Set Type & Request Payment" dialog computes the rent band from a single source: `linkedPropertyId → units.monthly_rent`. But complaints store the rent in different places depending on who filed:

| Filer | Where the rent lives |
|---|---|
| Tenant (Rent Control file complaint) | `complaint_properties.monthly_rent` (linked via `complaints.complaint_property_id`) — captured from the tenant's input |
| Tenant with active registered tenancy | `tenancies.agreed_rent` (only this case is currently passed in) |
| Landlord (files vs tenant) | The landlord picks one of their properties → `units.monthly_rent` for that property |

`RegulatorComplaints.tsx` only passes `linked_property_id` + (sometimes) `_activeTenancy.agreed_rent`. For most tenant complaints `linked_property_id` is `null` and there's no active tenancy, so the dialog has no rent → band lookup fails with the message above. The landlord side passes `linked_property_id` but never the agreed_rent it could derive from `units`, and silently gets `null` if the units fetch returns nothing.

**Fix.** Make the dialog accept and prefer an explicit rent, and fall back through every available source.

1. **In `RegulatorComplaints.tsx`** — when opening the dialog:
   - For tenant rows: pass `propertyId: c.linked_property_id ?? c.complaint_property_id ?? null` and `rent: c._activeTenancy?.agreed_rent ?? c.complaint_property?.monthly_rent ?? null`. (The complaint_property is already available — extend `fetchComplaints` to join it via `complaint_property:complaint_properties(id, monthly_rent)`.)
   - For landlord rows: pass `rent: c.linked_property?.monthly_rent ?? null` (extend `fetchLandlordComplaints` to join the cheapest active unit's rent), keep `propertyId: c.linked_property_id`.

2. **In `RequestComplaintPaymentDialog.tsx`** — extend the rent-resolution effect:
   - If `monthlyRentProp` is provided, use it.
   - Else if `linkedPropertyId` is provided, fetch `units.monthly_rent` (existing).
   - Else if a `complaint_property_id` exists on the complaint row, fetch `complaint_properties.monthly_rent`.
   - Show a small helper line under the rent_band picker: "Rent used: GH₵ X (from registered tenancy / linked property / complaint snapshot)".
   - When `rent_band` is selected and rent is still unknown, render an inline numeric input "Monthly rent for band lookup (GHS)" so the admin can enter it manually instead of hitting a dead end. The entered value flows into `computeBand` and is captured in `computation_meta.rentUsed` for audit.

3. **Improve the error itself** — `computeBand` already returns a clear message; leave it as the *last-resort* state, only after the manual input is empty.

No schema change. No RLS change.

### Issue 2 — "Failed to create new password. Try again later"

**Root causes in `supabase/functions/reset-password-otp/index.ts`.**

a. **Phone normalisation mismatch.** `verify-otp` stores OTP rows under `233XXXXXXXXX` (digits-only). `reset-password-otp` normalises with `phone.replace(/\s/g, "").replace(/^0/, "233")`, which leaves a leading `+` (e.g. `+233244...`). The OTP row lookup misses → 403 "No verified OTP found" → frontend shows the generic "Failed to create new password" because the function returned a non-2xx status.

b. **Non-2xx responses for business errors.** Every error path returns `400/403/404/500`. `supabase.functions.invoke` then surfaces only `error.message = "Edge function returned a non-2xx status code"` and `data` is null, so the toast never displays the real reason (`data?.error`).

c. **`expires_at` window logic is misleading.** It works in practice because OTPs default to `now() + 5 min`, but it's fragile — should be based on `created_at` instead.

**Fix in `reset-password-otp/index.ts`.**
- Replace the normaliser with the same `normalizePhone()` used by `verify-otp` (digits-only → ensure `233` prefix).
- Always return HTTP `200` with `{ ok: boolean, error?: string }`. Frontend reads `data.ok`.
- Change OTP lookup to: `verified = true` AND `created_at >= now() - INTERVAL '15 minutes'`. Drop the `expires_at` filter.
- Look up the user by querying both `profiles.phone = normalized` and as a fallback `auth.admin.listUsers` filtered by phone, in case the profile row has a legacy format.

**Fix in `src/pages/ForgotPassword.tsx` (`handleResetPassword`).**
- Read `data.ok`; if false, surface `data.error`.
- Catch block: surface `error.message` instead of the bland "Something went wrong".

### Files touched
- `supabase/functions/reset-password-otp/index.ts` — phone normaliser, 200-only responses, `created_at` window.
- `src/pages/ForgotPassword.tsx` — read structured response.
- `src/components/RequestComplaintPaymentDialog.tsx` — multi-source rent resolution + manual rent override input for `rent_band`.
- `src/pages/regulator/RegulatorComplaints.tsx` — pass `complaint_property_id` and snapshot rent for tenant complaints; pass linked property's cheapest unit rent for landlord complaints (extend the two `fetch…` queries).

### Out of scope
- `verify-otp`, `send-otp`, OTP table schema, RLS.
- Complaint fee rule data, fee structures, basket persistence.
- Audio/media, assignment, reports — unchanged from the prior wiring.

