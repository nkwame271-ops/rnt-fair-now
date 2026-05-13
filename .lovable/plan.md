## Plan

1. Fix contact-message reply delivery
   - Update the contact reply flow to use the project’s current queued email pipeline instead of the legacy direct `RESEND_API_KEY` send path.
   - Keep reply logging in place, but treat delivery and logging separately so admins can see whether a reply was sent, queued, or only recorded.
   - Verify the reply path from the feedback screen so email replies to contact submissions actually reach recipients.

2. Upgrade NUGS rent cards from read-only to assignment-capable
   - Replace the current NUGS rent-card page, which only lists cards, with the assignment workflow NUGS sub-admins need.
   - Reuse the existing rent-card stock and pending-purchase patterns where possible, but scope them to NUGS staff assignments instead of regulator office staff.
   - Add the missing backend access rules so NUGS sub-admins can read available serial stock, pending card purchases, and assignment history for their NUGS scope, not just view `rent_cards` rows.

3. Repair approved rent increase propagation
   - Move approval side effects out of the fragile page-only flow and into a reliable backend/database path so approved rent reviews consistently update property rent, unit rent, tenancy agreed rent, and audit history together.
   - Add a repair step for already-approved requests where the request status says approved but the linked property/unit rent did not update correctly.
   - Ensure landlord-facing pages read the latest approved values after approval without stale mismatches.

4. Add visible rent history trail for admins
   - Use the existing property event history to show previous rent values and the effective dates inside admin property details.
   - Record rent-change events consistently whenever an approval changes rent, so the admin “Properties” area shows a usable rent timeline.
   - Backfill missing rent-change history for recent approved reviews where practical.

5. Improve Rent Reviews property context for admins
   - Expand the rent-review details so admins can see full linked property information clearly and navigate into the property record directly.
   - Include landlord identity, property location, unit details, and other relevant property fields consistently in the review modal/table so decisions are based on the full property context.

6. Correct tenant tax payment state after successful payment
   - Audit the tax-payment finalization path for completed `rent_tax` / `rent_tax_bulk` transactions and fix the cases where completed escrow records are not updating `rent_payments` and tenancy tax compliance.
   - Add a reconciliation step for already-completed tax payments that still show as unpaid/pending in the tenant portal.
   - Keep the tenant UI driven by payment truth so once tax is paid the action changes automatically to the paid state, hides the active online-payment button, and shows Paid / Tax Confirmed / Receipt Available.

7. Validate end-to-end
   - Test contact reply delivery from the feedback portal.
   - Test NUGS sub-admin rent-card assignment with scoped stock and pending purchases.
   - Test approving a rent increase and confirm the updated rent appears in admin properties and landlord views.
   - Test a tenant tax payment and confirm the action button no longer remains active and the paid state renders correctly.

## Technical details

- Likely frontend files
  - `src/pages/regulator/RegulatorFeedback.tsx`
  - `src/pages/nugs/NugsRentCards.tsx`
  - `src/pages/regulator/RegulatorRentReviews.tsx`
  - `src/pages/regulator/RegulatorProperties.tsx`
  - `src/pages/tenant/Payments.tsx`
  - `src/pages/landlord/MyProperties.tsx`
  - `src/pages/landlord/LandlordDashboard.tsx`

- Likely backend/database files
  - `supabase/functions/contact-reply/index.ts`
  - `supabase/functions/_shared/finalize-payment.ts`
  - one or more database migrations for:
    - NUGS rent-card access policies / helper functions
    - reliable rent-review approval side effects and repair/backfill queries
    - optional rent-history support/backfill if existing `property_events` data is incomplete

- Key root causes found during exploration
  - Contact replies still use a legacy direct email sender that depends on `RESEND_API_KEY`, while the rest of the project already uses the queued built-in email flow.
  - The NUGS rent-card page is currently a standalone read-only list and does not connect to the assignment workflow used elsewhere.
  - Current NUGS policies allow reading `rent_cards`, but not the broader serial-stock / assignment data needed for real management.
  - Rent-review approval logic currently runs from the page itself, which is why approvals can mark the request approved without guaranteeing all linked rent records and history stay in sync.
  - Completed tax escrow records exist, but the tenant payment table still contains unpaid/pending rows, so the portal keeps showing an active payment action.

## Expected outcome

- Contact replies arrive by email.
- NUGS sub-admins can assign rent cards, not just view them.
- Approved rent increases reflect across property, unit, and landlord-facing views with an admin-visible rent trail.
- Rent review screens show complete property context.
- After successful tax payment, tenants see the paid/confirmed/receipt state instead of an active pay button.