## Plan — Student portal alignment, FAB, complaint toast, rent reviews lock, tax button hide

### 1. FAB on Student Dashboard
- Add `<FloatingActionHub />` inside `src/components/NugsLayout.tsx` (render for both admin and student views, or at minimum the student branch).
- This brings **Chat Support, Beta Feedback, and Report an Issue** to NUGS routes.

### 2. Complaint submission confirmation message
- In `src/pages/tenant/FileComplaint.tsx`, change the post-submit toast from "An officer will review and contact you regarding any required fee" to:
  > "Your complaint has been received. Please keep checking your dashboard for updates."
- Also insert an in-app `notifications` row for the user with the same wording, linking to `/tenant/my-cases` (or `/nugs/my-complaints` when student) so they see it on the Dashboard's notification bell.

### 3. Student Portal feature alignment (inherit Tenant capabilities)
Goal: students can access Receipts, Agreements, Invite Landlord, Payments, Marketplace, Rent Checker, Legal Assistant, Messages, Preferences, Renewal, Termination, Report Side Payment, My Profile — same as the Tenant Portal — subject to per-feature toggles in Engine Room.

Changes:
- **Routing (`src/App.tsx`)** — under the existing `/nugs` route block, add student-accessible routes that reuse the tenant page components: `payments`, `receipts`, `my-agreements`, `legal-assistant`, `renewal`, `termination`, `report-side-payment`, `preferences`, `messages`, `invite-landlord`, `rent-checker` (Marketplace, File Complaint, Profile already there).
- **Sidebar (`src/components/NugsLayout.tsx`)** — extend `studentNav` to include the new items (icons matching `TenantLayout`). Filter by feature flags using `useAllFeatureFlags` exactly like `TenantLayout` does, but using a new `student_*` feature-key namespace OR by reading the same feature keys as tenant nav + a master `student_features_enabled` umbrella. We will use **per-feature student keys** prefixed `student_` (e.g. `student_receipts`, `student_agreements`, `student_invite_landlord`, `student_payments`, `student_marketplace`, `student_rent_checker`, `student_legal_assistant`, `student_renewal`, `student_termination`, `student_report_side_payment`, `student_preferences`, `student_messages`) so Admin can toggle independently of tenant toggles.
- **Header / context badges** — keep the existing school/hostel chip; no other change.

### 4. Engine Room: Student Portal Feature Control section
- **Migration**: insert new rows into `feature_flags` with `category = 'student'` for each `student_*` key above (label + `is_enabled = true`, `fee_enabled = false`). Keep existing student fee flags (`student_registration`, `student_complaint_fee`) unchanged — those remain in the Student Revenue section.
- **`src/pages/regulator/EngineRoom.tsx`** — add a new collapsible section "Student Portal Feature Control" that renders `visibleFlags.filter(f => f.category === 'student' && !STUDENT_FEATURE_KEYS.has(f.feature_key))` via `renderFeatureRow`. Place it near the Tenant/Landlord feature blocks.

### 5. Rent Increase — lock rent after approval
Already on approval (in `RegulatorRentReviews.handleDecision`): `units.monthly_rent`, `units.asking_rent`, `properties.approved_rent`, and active `tenancies.agreed_rent` are updated. Add:
- **Migration**: add `rent_locked_at timestamptz` and `rent_locked_amount numeric` columns to `units` and `properties` (or reuse existing `approved_rent` + a flag). On approval, also set `units.rent_locked_at = now()` and `properties.rent_locked_at = now()`.
- **Update `handleDecision`** to set these.
- **`src/pages/landlord/EditProperty.tsx`** and the unit edit forms: when `rent_locked_at` is non-null, render the rent input as **read-only** with a small "Locked by approved Rent Review" helper. Block any landlord-side rent edits client-side, and add a DB trigger (defensive) that rejects updates to `monthly_rent`/`asking_rent`/`approved_rent` when `rent_locked_at IS NOT NULL` except when the update comes from `RegulatorRentReviews` flow (service role, or session flag) — practically we'll enforce via RLS/policy that landlords cannot UPDATE these columns once locked.

### 6. Rent Reviews — show full property details to admin
In `src/pages/regulator/RegulatorRentReviews.tsx`, augment the fetch and the Review dialog:
- Fetch joined property + landlord profile: `properties(name, address, area, region, property_type, photos, landlord_user_id, profiles!landlord_user_id(full_name, phone, email))` and the unit details.
- In the dialog, render a "Property" block: name, full address (area, region), property type, landlord name + phone + email, current unit, monthly_rent, photos thumbnail, link to `/regulator/properties/<id>`.

### 7. Tenant Tax payment status — hide button after success
In `src/pages/tenant/Payments.tsx`:
- The current `isPaid` predicate already drives `allAdvancePaid`; the issue is the Paystack return flow doesn't always mark `payments.status = 'confirmed'`. Audit:
  - Ensure `supabase/functions/_shared/finalize-payment.ts` for `payment_type IN ('rent_tax', 'rent_tax_bulk')` sets `payments.status = 'confirmed'` and `tenant_marked_paid = true` for all matching advance rows, and updates `tenancies.tax_compliance_status = 'verified'`.
- Frontend: keep current "Pay" → "Advance Tax Paid ✓" toggle, plus add explicit status pills under the header:
  - **Paid** (when `allAdvancePaid`)
  - **Tax Confirmed** (when `tenancy.tax_compliance_status === 'verified'`)
  - **Receipt Available** with a button linking to `/tenant/receipts?ref=<latest receipt>` once a receipt row exists for the latest tax escrow.
- The "Pay GH₵ … Online" button only renders inside `!allAdvancePaid` branch, so once confirmed it disappears. Also guard against the user-cancelled query-param path re-enabling stale state.

### Files to modify
- `src/components/NugsLayout.tsx` — FAB import, extended studentNav, feature-flag filtering.
- `src/App.tsx` — new student routes reusing tenant pages.
- `src/pages/tenant/FileComplaint.tsx` — confirmation toast + notification insert.
- `src/pages/regulator/EngineRoom.tsx` — new Student Portal Feature Control block.
- `src/pages/regulator/RegulatorRentReviews.tsx` — property/landlord detail enrichment + lock columns on approve.
- `src/pages/landlord/EditProperty.tsx` (and any unit-edit form) — read-only rent when locked.
- `src/pages/tenant/Payments.tsx` — status pills (Paid / Tax Confirmed / Receipt Available).
- `supabase/functions/_shared/finalize-payment.ts` — ensure tax finalize flips `status` and `tax_compliance_status`.

### Database migrations
- Add `student_*` rows to `feature_flags` (category `student`).
- Add `rent_locked_at`, `rent_locked_amount` to `units` and `properties`; backfill where `approved_rent` is set.
- RLS / trigger preventing landlord updates to rent columns when locked.

### Acceptance checks
1. Logging in as a student shows the FAB (Chat, Feedback, Report an Issue) on the dashboard.
2. Filing a complaint shows the new "complaint has been received…" toast and creates a matching notification.
3. Student sidebar now shows Receipts, Agreements, Invite Landlord, Payments, etc., gated by `student_*` flags toggled from Engine Room → Student Portal Feature Control.
4. After Admin approves a rent increase, landlord's property/unit rent reflects the approved amount and the rent field is read-only with a "Locked" hint.
5. Rent Reviews dialog shows full property + landlord details.
6. Tenant pays tax → Paystack success → button disappears, "Paid / Tax Confirmed / Receipt Available" pills appear, and Receipt link works.