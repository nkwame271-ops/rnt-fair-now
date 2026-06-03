## What I’ll fix

1. **Rent Cards → Pending & Assign**
   - Change the serial picker so the dropdown does **not open until staff actually types or explicitly opens it**, keeping the top search box clickable first on desktop.
   - Tighten the picker’s desktop positioning and stacking so the dropdown never sits over the page search field.
   - Keep outside-click handling working without the portal blocking focus.
   - Fix landlord name lookup for sub-admin/staff by reading names from the safe counterparty profile source instead of the restricted full-profile table.

2. **Staff feature visibility**
   - Add **Property Management** to the shared feature map so it appears in **Invite Staff → Allowed Features** and can be granted to sub-admins.
   - Add **Management Support** to the feature map / Engine Room feature lists so it appears under landlord features where admins expect it.
   - If the underlying feature-flag rows are missing, add a migration to create those missing records instead of only changing the frontend.

3. **Applications evidence images**
   - Fix evidence rendering so regulator/staff screens can open both:
     - newer private-bucket storage paths, and
     - older legacy public URLs already saved in the database.
   - Update the evidence component to detect legacy `.../object/public/application-evidence/...` URLs and convert them to signed private access instead of treating them as direct public files.

4. **Add Tenant / tax-off payment flow**
   - Update the tenant-side agreement/payment flow so when GRA tax is turned off in Templates, the tenant can proceed with signing by choosing the non-tax payment route instead of being blocked behind tax verification.
   - Surface the intended options for payment-to-landlord flow in the relevant tenant agreement/payment screens.

5. **Agreement PDFs**
   - Make sure draft/final agreement downloads always use the latest template configuration when generated.
   - Remove all Govt. Tax rows from generated PDFs whenever the tax toggle is off.
   - Fix places still saving private agreement files as public URLs so downloads open through signed access consistently.

6. **Engine Room → Add Tenant Fee splits**
   - Adjust the Add Tenant rent-band editor so its split structure behaves like Existing Tenancy: each band has its own allocation set, validation is clear, and totals must match the band fee exactly.
   - Remove the current cross-type confusion where unrelated payment types can appear under Add Tenant band allocations.

## What I found

- The **desktop overlap** issue is likely still happening because the serial picker opens on focus immediately and is portaled at a very high z-index, so it can still compete with the page search area.
- **Sub-admin landlord names showing “Unknown”** is real: that screen currently queries `profiles`, while staff access was later restricted and other staff-safe screens now use `profiles_counterparty`.
- **Property Management** and **Management Support** are not present in the current feature map, and the database currently has **no matching feature_flag rows** for either one.
- **Application evidence** is still failing for older rows because the DB contains legacy public URLs, but the bucket is now private. The current component only signs raw paths, not those legacy URLs.
- Some agreement flows were updated, but there are still places where private files are stored/opened as if they were public URLs.
- Add Tenant rent bands already have allocations in the database, but the current Engine Room UI still shows mixed payment-type structure instead of the cleaner per-band setup you want.

## Technical changes

- **Frontend files likely to update**
  - `src/pages/regulator/rent-cards/PendingPurchases.tsx`
  - `src/hooks/useAdminProfile.ts`
  - `src/pages/regulator/InviteStaff.tsx`
  - `src/pages/regulator/EngineRoom.tsx`
  - `src/components/EvidenceImage.tsx`
  - `src/pages/tenant/MyAgreements.tsx`
  - `src/pages/tenant/Payments.tsx`
  - `src/components/DigitalSignatureDialog.tsx`
  - possibly `src/pages/landlord/Agreements.tsx` / landlord draft-generation paths if they still bypass signed-access handling

- **Database migration likely needed**
  - Insert missing `feature_flags` records for:
    - `property_management`
    - `management_support`
  - Only if they truly do not exist already (confirmed missing now).

- **Data compatibility**
  - I’ll preserve support for both legacy stored evidence URLs and new storage-path values so old application records start working without data loss.

## Validation after implementation

- Verify desktop Pending & Assign search box can be clicked before any dropdown appears.
- Verify sub-admin/staff can search pending purchases by landlord name and names no longer show as Unknown.
- Verify Invite Staff shows Property Management, and Engine Room shows Management Support.
- Verify a real older landlord application with legacy evidence URLs displays images again.
- Verify tax-off tenant agreement flow allows completion/signing without Govt. Tax steps.
- Verify generated agreement PDFs omit Govt. Tax when tax is off.
- Verify Add Tenant band split totals are enforced per band and displayed in the intended structure.