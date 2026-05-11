## What I will fix

1. **App emails (contact + beta feedback) will actually send**
   - Fix the app-email queue payload so queued messages include the required idempotency key.
   - Redeploy the app-email sender and queue processor.
   - Verify new contact and beta feedback submissions move from pending to sent instead of failing.

2. **NUGS sub-admin Rent Cards will appear and load correctly**
   - Correct the feature-flag path so the Rent Cards menu is not hidden when the feature is meant to be on.
   - Add the missing backend access rule for NUGS admins to read the rent cards they are allowed to see.
   - Update the NUGS rent-card page query so it shows only the correct office/school-scoped records.

3. **Deleted existing tenancies will fully release linked rent cards**
   - Review the admin agreement deletion flow and make sure it releases both attached rent cards and resets them to reusable status every time.
   - Add a repair step for already-affected records so old broken links are cleaned up, not just future ones.
   - Verify the landlord-side available-card list updates correctly after deletion.

4. **Approved rent increases will propagate to landlord-facing property data**
   - Fix the approval flow so accepted rent-review decisions update the unit rent and related landlord views consistently.
   - Keep landlord rent inputs read-only and ensure rejected requests do not change stored rent.
   - Refresh the landlord property/agreement screens so approved values appear without stale data.

5. **Rent Reviews will show full clickable property details**
   - Expand the admin review list and detail panel to include property name, location, landlord, and direct drill-in access to the full property record.
   - Make the property entry reliably clickable from the review table and modal.

6. **Tenant tax payment status will reflect successful payment immediately**
   - Fix the payment-finalization path so successful tax payments mark the related payment rows as paid.
   - Update the tenant payment page logic so the online payment CTA disappears once tax is settled.
   - Ensure the statuses shown after success are: **Paid**, **Tax Confirmed**, and **Receipt Available**.

## Why these keep failing today

- **App emails:** the queue processor is rejecting messages because the queued payload is missing a required idempotency key, so contact/beta emails are being logged but not delivered.
- **NUGS Rent Cards:** the feature flag is currently off in the database, and the NUGS page is also reading a table that does not yet grant NUGS admins direct visibility.
- **Rent increase sync:** there are approved rent-review records whose unit rent still does not match the approved amount, so the admin action is not fully propagating to landlord-facing data.
- **Tenant tax UI:** there are tenancies marked tax-verified while the related payment rows are still not marked paid, so the page logic can drift into the wrong state.
- **Existing tenancy unlinking:** the future-delete trigger exists, but I will also repair any historical inconsistencies and verify the admin deletion path end-to-end.

## Technical details

- **Files likely affected**
  - `supabase/functions/send-notification/index.ts`
  - `supabase/functions/process-email-queue/index.ts` (verification/redeploy)
  - `src/components/NugsLayout.tsx`
  - `src/pages/nugs/NugsRentCards.tsx`
  - `src/pages/regulator/RegulatorRentReviews.tsx`
  - `src/pages/tenant/Payments.tsx`
  - `src/pages/landlord/MyProperties.tsx` and/or other landlord property/agreement screens
  - `supabase/functions/admin-action/index.ts`
  - one or more new database migrations for RLS / repair helpers if needed

- **Backend work I expect**
  - Add or adjust RLS for NUGS rent-card visibility.
  - Add a safe cleanup path for previously broken tenancy↔rent-card links if the current delete trigger did not cover older records.
  - Backfill mismatched approved rent values and any payment-state inconsistencies where the verified tenancy status and payment rows disagree.

- **Validation I will run after implementation**
  - Submit a contact message and beta feedback, then confirm email log status changes correctly.
  - Log in as a NUGS admin and confirm the Rent Cards nav item and data both appear.
  - Delete a declared tenancy from admin and confirm both rent cards return to reusable state.
  - Approve and reject rent reviews and confirm landlord-facing rent stays correct.
  - Complete a tax-payment verification flow and confirm the payment button disappears and receipt state is shown.

## Expected outcome

After this pass, these flows will be corrected as one connected fix set: app emails deliver, NUGS sub-admin rent cards show correctly, deleted existing tenancies release rent cards, approved rent increases sync into landlord views, rent reviews expose full property details, and tenant tax payments stop showing an active pay button after success.