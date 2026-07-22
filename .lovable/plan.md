## Revert Landlord Registration to Yearly

Earlier we switched landlord registration to a 30-day monthly cycle (GHS 20/month). You now want it back to a yearly plan. This plan reverses that change everywhere it was applied.

### Changes

1. **`src/pages/RegisterLandlord.tsx`**
   - Change the pricing card copy back to "Annual Registration", "Per year · 365-day validity", and "12-month platform access, renewable yearly".
   - Restore the yearly amount (confirm below).

2. **`src/pages/landlord/LandlordDashboard.tsx`**
   - Update the renewal banner wording from monthly to yearly (e.g. "Renew your annual registration").

3. **`supabase/functions/paystack-checkout/index.ts`** (and any renewal function that sets `expiry_date`)
   - Set `expiry_date` to `now + 365 days` instead of `now + 30 days` for the `landlord_registration_fee` flow.

4. **Engine Room / `feature_flags` migration**
   - Update `landlord_registration_fee` row: `billing_frequency = 'yearly'`, `expiry_days = 365`, `renewal_days = 365`, and set `amount` to the correct yearly fee.

### Questions before I build

- What should the **yearly fee** be? (Screenshot shows GHS 20/month = GHS 240/yr equivalent, but original was different — please confirm the exact GHS amount.)
- Any grandfathering needed for landlords already charged the GHS 20 monthly rate, or just apply yearly going forward?
