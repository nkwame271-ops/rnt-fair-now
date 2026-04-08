

# Fix Plan: Landlord Registration Not Completing

## Root Cause Analysis

**User**: OWUSU DORIS (user_id: `df2a213c-985f-40a4-8d7f-930e328674f1`, phone: 0244539484)

**What happened**: The user's `auth.users` record and `profiles` row were created successfully, and `user_roles` has `role = landlord`. However, **no row exists in the `landlords` table**. The `landlords.insert` during registration (line 192 of `RegisterLandlord.tsx`) likely failed due to an RLS policy or network issue, but the user was already signed in by that point.

**Why she's stuck**: 
- The dashboard shows "Unpaid" and "N/A" because there's no landlord record to read
- The "Pay Registration Fee" button calls `paystack-checkout` with `type: landlord_registration`, which queries `landlords` table first — since no record exists, it throws "Landlord record not found"
- She was still able to buy rent cards because that flow only checks authentication, not the landlord record
- The webhook's `handleSideEffects` for `landlord_registration` does an UPDATE, not an INSERT — so even if payment succeeded, it couldn't create the missing record

## Fixes

### Fix 1 — Immediate data fix for OWUSU DORIS
Insert the missing landlord record for this specific user via a migration, with `registration_fee_paid: false` so the normal payment flow can proceed.

### Fix 2 — Defensive landlord record creation in checkout
In `paystack-checkout/index.ts` (line 544-551), instead of throwing "Landlord record not found", auto-create the missing landlord record when the user has role=landlord but no landlord row. This prevents future occurrences.

### Fix 3 — Defensive upsert in webhook side effects
In `finalize-payment.ts` `handleSideEffects` for `landlord_registration` (line 382-389), if no landlord record exists, INSERT one instead of only doing an UPDATE. This ensures payment completion always results in a valid landlord record.

### Fix 4 — Defensive check on the dashboard
In `LandlordDashboard.tsx`, if the landlord record query returns null, show a recovery UI that creates the missing record and then allows the user to proceed with payment.

## Files to Change

| File | Change |
|------|--------|
| Database migration | Insert landlord record for user `df2a213c-...` |
| `supabase/functions/paystack-checkout/index.ts` | Auto-create landlord record if missing when `type=landlord_registration` |
| `supabase/functions/_shared/finalize-payment.ts` | Upsert landlord record in `handleSideEffects` instead of update-only |
| `src/pages/landlord/LandlordDashboard.tsx` | Add recovery path when landlord record is missing |

