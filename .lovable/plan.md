

## Plan: 7 Feature Fixes and Enhancements

### 1. Fix Registration Fee Bypass (Landlord & Tenant)
**Problem**: Users complete registration (account + landlord/tenant record created) and see a success screen with "Go to Dashboard" — they can skip payment entirely.

**Fix**: After creating the account and landlord/tenant record, immediately invoke `paystack-checkout` for `landlord_registration` or `tenant_registration` and redirect to Paystack. The success screen should only show after payment confirmation (on the dashboard callback). Remove the "Go to Dashboard" button from the final step and replace it with a "Pay GH₵ 2 Registration Fee" button that triggers payment.

**Files**: `src/pages/RegisterLandlord.tsx`, `src/pages/RegisterTenant.tsx`

---

### 2. Landlord Property Edit/Delete/Re-list
**Problem**: `MyProperties.tsx` is read-only with no edit, delete, or re-list actions.

**Changes**:
- Add Edit button per property → navigates to a new `/landlord/edit-property/:id` route (or reuses `RegisterProperty` in edit mode)
- Add Delete button (with confirmation dialog) → deletes property + units from database
- Add "List on Marketplace" / "Delist" toggle button per property → invokes `paystack-checkout` for listing fee if not yet listed, or sets `listed_on_marketplace = false` for delisting
- Register new route in `App.tsx`

**Files**: `src/pages/landlord/MyProperties.tsx`, `src/pages/landlord/EditProperty.tsx` (new), `src/App.tsx`

---

### 3. Fix Complaint Payment (Paystack Redirect)
**Problem**: The complaint insert and Paystack invoke look correct in code. The issue is likely that `supabase.functions.invoke` returns an error that isn't surfaced, or the response body is not parsed correctly.

**Root cause investigation**: The `supabase.functions.invoke` with Lovable Cloud may return the response body as a string rather than parsed JSON when the content-type header isn't detected properly. The fix is to explicitly handle the response:

**Changes**:
- In `FileComplaint.tsx`, add explicit JSON parsing if `data` comes back as a string
- Add a fallback: if `data` is null but no error, log and show a clearer message
- Ensure the edge function is deployed and reachable by testing it

**Files**: `src/pages/tenant/FileComplaint.tsx`, `supabase/functions/paystack-checkout/index.ts` (verify deployment)

---

### 4. Marketplace Enhancements: Like, Watchlist, Message Landlord
**Problem**: Marketplace only shows listings and viewing requests. No social/engagement features.

**Database changes** (migration):
- Create `watchlist` table: `id`, `tenant_user_id`, `unit_id`, `created_at` with RLS for tenant CRUD
- Create `marketplace_messages` table: `id`, `sender_user_id`, `receiver_user_id`, `unit_id`, `message`, `created_at`, `read` with RLS for participants

**UI changes**:
- Add heart/like icon (watchlist toggle) on each listing card
- Add "My Watchlist" filter/tab at the top
- Add "Message Landlord" button in the unit detail/viewing modal (opens inline chat or message form)

**Files**: `src/pages/tenant/Marketplace.tsx`, migration SQL, `src/App.tsx` (if new page needed)

---

### 5. Admin Portal: Downloadable Full Profile PDF
**Problem**: Regulators need to download a complete tenant/landlord profile as a document.

**Changes**:
- Add a "Download Profile" button in the expanded view of each tenant/landlord in `RegulatorTenants.tsx` and `RegulatorLandlords.tsx`
- Use `jspdf` (already installed) to generate a PDF containing: personal info, ID details, KYC status, tenancy history, complaints, properties, registration dates
- Fetch KYC verification data for the user when generating the PDF

**Files**: `src/pages/regulator/RegulatorTenants.tsx`, `src/pages/regulator/RegulatorLandlords.tsx`, `src/lib/generateProfilePdf.ts` (new utility)

---

### 6. Non-Citizen KYC: Passport + Selfie (no Ghana Card)
**Problem**: `KycVerificationCard.tsx` requires Ghana Card number and Ghana Card front/back images for all users, but non-citizens don't have a Ghana Card.

**Changes**:
- Fetch the user's `is_citizen` flag from `profiles` table
- If non-citizen: show "Passport" upload (front only) instead of Ghana Card front/back, keep selfie requirement, make residence permit number field optional
- Update the KYC insert/update to store passport URL in `ghana_card_front_url` field (reuse column) and set `ghana_card_back_url` to null
- Update label text: "Ghana Card Number" → "Passport Number" for non-citizens
- In `RegisterLandlord.tsx` and `RegisterTenant.tsx`, make residence permit number optional (change validation from `residencePermitNo.length > 3` to always true or optional)

**Files**: `src/components/KycVerificationCard.tsx`, `src/pages/RegisterLandlord.tsx`, `src/pages/RegisterTenant.tsx`

---

### 7. Replace Stats with About Us Section on Home Page
**Problem**: Home page shows fake statistics (150+ Properties, 320+ Tenants, etc.)

**Changes**:
- Remove the stats grid from `RoleSelect.tsx` (lines 84-97)
- Replace with an "About the Rent Control Department" section containing:
  - Brief overview paragraph about the department's mandate under Act 220
  - Key functions: rent regulation, dispute resolution, tenancy registration
  - Mission/vision statement
  - Styled consistently with the existing page design

**Files**: `src/pages/RoleSelect.tsx`

---

### Implementation Order
1. Item 7 (quick text replacement)
2. Item 6 (non-citizen KYC)
3. Item 1 (registration fee enforcement)
4. Item 3 (complaint payment fix)
5. Item 2 (property edit/delete)
6. Item 5 (profile PDF download)
7. Item 4 (marketplace enhancements — largest scope, needs migration)

