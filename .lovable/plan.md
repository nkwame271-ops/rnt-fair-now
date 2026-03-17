

# Phase 2: Renewal Workflow

## Overview

Implement the tenant-initiated renewal workflow: 90-day expiry notifications, tenant renewal request/exit UI, landlord response (accept/propose rent/decline), mandatory property assessment gate, and renewal completion with payment and new tenancy card issuance.

---

## 1. Scheduled Edge Function: Expiry Notification Cron

**New file**: `supabase/functions/tenancy-expiry-check/index.ts`

- Query all tenancies where `end_date` is between now and now+90 days, status is `active`, and no `renewal_requested_at` set
- Update status to `renewal_window` for those within 90 days
- Insert a notification for each tenant: "Your tenancy expires in X days. Request a renewal or plan your exit."
- Insert a notification for each landlord: "Tenancy for [tenant] at [property] expires in X days."

**Cron job**: Schedule via `pg_cron` + `pg_net` to run daily (using the insert tool, not migration).

## 2. Tenant Renewal Request Page

**New file**: `src/pages/tenant/RequestRenewal.tsx`

- Shows current tenancy details (property, rent, expiry, days remaining)
- Two options: **Request Renewal** or **Notify Exit**
- On "Request Renewal": updates tenancy `renewal_requested_at = now()`, `renewal_requested_by = user.id`, status to `renewal_pending`; creates notification for landlord
- On "Notify Exit": updates status to `terminated`, `termination_reason = 'tenant_exit'`, `terminated_at = now()`; creates notification for landlord
- Only visible when tenancy status is `active` or `renewal_window`

**Route**: `/tenant/renewal` added to `App.tsx` under tenant routes  
**Nav**: Add "Renewal" item to `TenantLayout.tsx`  
**Dashboard**: Replace the disabled "Request Renewal" button with a working link to `/tenant/renewal`

## 3. Landlord Renewal Response Page

**New file**: `src/pages/landlord/RenewalRequests.tsx`

- Lists tenancies where `status = 'renewal_pending'` for the landlord
- For each, landlord can:
  - **Accept** at current rent → checks property assessment status
  - **Propose new rent** (input field) → checks property assessment status
  - **Decline renewal** → sets status to `terminated`, notifies tenant
- Assessment gate: If the property's `assessment_status !== 'assessed'`, the accept/propose buttons show "Pending Rent Control Assessment" and are disabled. Status becomes `renewal_pending_assessment`.
- If assessment is done, status moves to `renewal_pending_confirmation`; tenant is notified with the confirmed/proposed rent.

**Route**: `/landlord/renewal-requests` added to `App.tsx`  
**Nav**: Add "Renewal Requests" to `LandlordLayout.tsx`

## 4. Tenant Renewal Confirmation Page

**Update**: `src/pages/tenant/RequestRenewal.tsx`

- When tenancy status is `renewal_pending_confirmation`, show the landlord's proposed rent and duration
- Tenant options: **Confirm & Pay** or **Decline**
- On confirm: status → `renewal_pending_payment`, redirect to payment flow
- On decline: status → `terminated`

## 5. Renewal Payment & Completion

**Update**: `supabase/functions/paystack-checkout/index.ts`

- Add a `renewal_payment` type handler
- Takes `tenancy_id`, calculates advance based on agreed rent and duration
- On successful payment (webhook), create a new tenancy record with `tenancy_type = 'renewal'`, `previous_tenancy_id` set, status `active`
- Old tenancy status → `expired`
- Generate new rent payment schedule
- Issue notification: "Your tenancy has been renewed!"

## 6. Regulator Renewal Oversight

**Update**: `src/pages/regulator/RegulatorAgreements.tsx` or dashboard

- Add a section/filter showing tenancies in renewal states (`renewal_pending`, `renewal_pending_assessment`, `renewal_pending_confirmation`, `renewal_pending_payment`)
- Regulators can see the full renewal pipeline

## 7. Database Changes

**Migration**: Add `proposed_rent` and `renewal_duration_months` columns to `tenancies`:

```sql
ALTER TABLE public.tenancies
  ADD COLUMN IF NOT EXISTS proposed_rent numeric,
  ADD COLUMN IF NOT EXISTS renewal_duration_months integer;
```

No new tables needed — all renewal state is tracked via the existing `tenancies` table status field and the new columns.

---

## Files Summary

| File | Action |
|------|--------|
| DB migration | Add `proposed_rent`, `renewal_duration_months` to tenancies |
| `supabase/functions/tenancy-expiry-check/index.ts` | Create — daily cron to flag 90-day window tenancies + send notifications |
| `src/pages/tenant/RequestRenewal.tsx` | Create — tenant renewal request / exit UI |
| `src/pages/landlord/RenewalRequests.tsx` | Create — landlord accept/propose/decline renewal |
| `src/pages/tenant/TenantDashboard.tsx` | Edit — enable renewal button link |
| `src/components/TenantLayout.tsx` | Edit — add Renewal nav item |
| `src/components/LandlordLayout.tsx` | Edit — add Renewal Requests nav item |
| `src/App.tsx` | Edit — add renewal routes for tenant and landlord |
| `supabase/functions/paystack-checkout/index.ts` | Edit — add renewal_payment handler |
| Cron job (insert tool) | Schedule daily `tenancy-expiry-check` invocation |

