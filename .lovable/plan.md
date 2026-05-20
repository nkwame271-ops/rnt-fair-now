## Goal

When an officer chooses **Complainant = Landlord** in Admin Portal → File Complaint, the resulting case must land in **Complaint Management → Landlord Complaints**, not Tenant Complaints. Tenant-complainant filings continue to land in the Tenant tab as today.

## Root cause

`AdminFileComplaint.tsx` always inserts the draft into the `complaints` table (the tenant table), regardless of `complainantRole`. `RegulatorComplaints.tsx` splits its UI by querying two different tables (`complaints` for the Tenant tab, `landlord_complaints` for the Landlord tab), so landlord-complainant filings end up on the wrong tab.

A secondary issue: `landlord_complaints.landlord_user_id` is `NOT NULL`, but admin filings may name a landlord who isn't yet a registered user. Per your answer we'll allow placeholder landlords.

## Changes

### 1. Schema migration — `landlord_complaints`

Make the table able to hold an admin-filed draft for an unregistered landlord, mirroring the placeholder pattern already used on `complaints`:

- `ALTER COLUMN landlord_user_id DROP NOT NULL`
- Add columns: `placeholder_landlord_name text`, `placeholder_landlord_phone text`, `placeholder_respondent_name text`, `placeholder_respondent_phone text`, `complainant_role text`, `respondent_role text`, `filed_by_admin boolean default false`, `admin_filer_user_id uuid`, `filing_fee_paid boolean default false`, `physical_docket_ref text`, `rent_amount numeric`, `deposit_amount numeric`, `agreement_expiry_date date`, `occupied_months int`, `tenants_intent text`, `relief_sought text`, `complainants jsonb`, `respondents jsonb`, `premises_house_no text`, `premises_town text`, `complainant_address text`, `complainant_gps_lat numeric`, `complainant_gps_lng numeric`, `gps_confirmed boolean default false`.
- RLS: add a policy `Admin staff can insert landlord complaints` allowing inserts where `is_main_admin(auth.uid())` or `has_role(auth.uid(),'regulator')`, plus a corresponding update policy for the draft → submitted promotion.
- No data backfill needed.

### 2. `src/pages/regulator/AdminFileComplaint.tsx`

- Derive `targetTable = complainantRole === "landlord" ? "landlord_complaints" : "complaints"`.
- When `complainantRole === "landlord"`:
  - Look up the landlord by normalized phone in `profiles` (same helper as today) and store as `landlord_user_id` if found; otherwise leave null and rely on the new placeholder columns.
  - Build an insert payload mapped to `landlord_complaints` columns: `complaint_code`, `complaint_type`, `complaint_type_id`, `tenant_name` (= respondent name), `property_address`, `region`, `description`, `evidence_urls`, `office_id`, `status: 'draft_awaiting_filing_payment'`, `payment_status: 'awaiting'`, `current_stage: 'draft_awaiting_filing_payment'`, plus the new admin/placeholder/snapshot columns.
- Use `targetTable` everywhere the draft is read/updated/subscribed:
  - `createDraft` insert
  - The realtime subscription channel and polling `select` in the draft-poll `useEffect`
  - `finalizeSubmission` read + the optional `status: 'submitted'` flip
  - The post-payment refresh inside `onRequested`
- Pass `complaintTable={targetTable}` (instead of hard-coded `"complaints"`) into `<RequestComplaintPaymentDialog>`.
- Form 7 auto-generation: skip the `autoGenerateForm7` call for landlord complaints for now (or pass the row as-is if the helper tolerates it); we'll keep the existing tenant behavior unchanged. We will not expand Form 7 scope in this task.

### 3. `src/pages/regulator/RegulatorComplaints.tsx`

- In `fetchLandlordComplaints`, add `.neq("status", "draft_awaiting_filing_payment")` so unpaid admin drafts stay hidden until the filing fee clears, matching the tenant tab.
- No other UI changes; the Landlord tab will pick up the new rows automatically via the existing realtime subscription on `landlord_complaints`.

### 4. Payment finalization — `supabase/functions/_shared/finalize-payment.ts` & `paystack-checkout/index.ts`

- These already branch on `complaint_table` (`"complaints"` vs `"landlord_complaints"`) when looking up basket items and flipping the case to `ready_for_scheduling`. Verify the basket items, payer routing, and "filing_fee_paid" flip work when `complaint_table = 'landlord_complaints'`. No edge function change is expected beyond confirming the existing branches handle the new draft status; if a branch is missing for `filing_fee_paid` on landlord_complaints, add it symmetrically.

## Out of scope

- No changes to tenant-complainant filings.
- No changes to Form 7 templates or the landlord/tenant portal "Pay Now" flow (already handled in earlier work).
- No changes to Complaint Management's "Set Fee Type / Request Payment" behavior.

## Verification

1. File a complaint as admin with **Complainant = Landlord**, pay the filing fee → row appears under **Complaint Management → Landlord Complaints** with the correct ticket and landlord/respondent details.
2. Cancel payment → row stays hidden from both tabs.
3. File a complaint as admin with **Complainant = Tenant** → still appears under **Tenant Complaints** exactly as today.
