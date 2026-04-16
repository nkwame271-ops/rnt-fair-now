

## Status Audit — Everything is Already Implemented

I've audited the codebase against all four feature streams from the previous turns. **They are all in place.** Here is what exists and where:

### 1. Admin Charge Allocation (Engine Room driven) ✅

**No hardcoded 100%-to-office routing remains.**

- `supabase/functions/_shared/finalize-payment.ts` → `expandAdminSplit()` reads `secondary_split_configurations` (Engine Room) and splits the admin bucket into `office %` and `headquarters %` strictly per config.
- `supabase/functions/finalize-office-attribution/index.ts` → uses the same secondary split when attributing deferred rent-card admin to an office.
- `supabase/functions/reconcile-internal-ledger/index.ts` → applies the same percentages.
- `supabase/functions/paystack-checkout/index.ts` → all rent-card flows (`rent_card`, `rent_card_bulk`) build `splitPlan` via `loadAllocation()` which reads the Engine Room — never hardcodes office.
- Office payout uses `office_payout_accounts.paystack_recipient_code` (auto-created/cached via `createPaystackRecipient()`) so payouts always use the latest recipient code.

### 2. Complaint scheduling SMS + downloadable profile ✅

- `src/components/ScheduleComplainantDialog.tsx` sends SMS with all slots, complaint code, and office name.
- `src/components/AppointmentSlotPicker.tsx` sends a confirmation SMS to complainant and notifies the admin who created the schedule when a slot is picked.
- `src/pages/regulator/RegulatorComplaints.tsx` has `downloadComplainantProfile()` → calls `generateProfilePdf` with profile + KYC + tenancies + complaints + properties.

### 3. Student & NUGS dashboards ✅

- **Student registration** (`src/pages/RegisterTenant.tsx`, lines 446-468): toggle on Step 0 ("Account") below the Region field, capturing `school`, `hostel_or_hall`, `room_or_bed_space` into the `tenants` table.
- **Marketplace filter** (`src/pages/tenant/Marketplace.tsx`, lines 79-118): students see only `property_category = hostel`, others see everything except hostel.
- **NUGS portal** at `/nugs/*` (`NugsLayout`, `NugsDashboard`, `NugsStudents`, `NugsComplaints`, `NugsInstitutions`) — hidden role, login via `RegulatorLogin` routes them to `/nugs/dashboard`.
- **NUGS invite flow** in `InviteStaff.tsx` and `invite-staff` edge function.

### Why the user might say "I don't see it"

Looking at the current viewport (744 × 665, route `/register/tenant`): the toggle is on Step 0, **after** Full Name → Citizenship → Phone → OTP block → Email → Password → Confirm Password → Region of Stay. On a 665px-tall viewport you have to scroll well past the password fields to reach the "I am a student" card. The toggle is there — it's just below the fold.

## Recommended Tiny Polish (Optional)

Promote the student toggle higher in Step 0 so it doesn't get lost under the password section:

**`src/pages/RegisterTenant.tsx`** — Move the "I am a student" card from after the Region field (line 446-468) to **immediately after Full Name** (right under line 346). This puts it above the fold on small viewports. Region/citizenship/phone/etc. follow.

That is the only change required; everything else is already shipped. **Do you want me to apply that re-ordering?**

