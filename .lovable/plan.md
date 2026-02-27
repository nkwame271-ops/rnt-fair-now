

## Plan: 8 Feature Requests Implementation

This is a significant scope covering bug fixes, UI improvements, and major new features. I recommend implementing in phases, prioritizing bug fixes first, then new features.

---

### Phase 1: Bug Fixes (Items 1-3)

**1. CFLED Branding in All Layouts**
- Already done on landing page footer. Add the same "Powered by CFLED" footer to `TenantLayout.tsx`, `LandlordLayout.tsx`, and `RegulatorLayout.tsx` as a small footer bar below the main content area.

**2. Fix FloatingActionHub Icon Disappearing**
- Root cause: When a panel is active (`chat` or `feedback`), the component returns ONLY the widget — the FAB button is completely removed from the DOM via early `return` statements.
- Fix: Always render the FAB button. Show the active widget alongside it instead of replacing it. When a panel is open, the FAB becomes a close button.

**3. Fix File Complaint Form Not Proceeding to Checkout**
- Root cause: The "Next" button on steps 0-3 has zero validation — it always advances. But `handleSubmit` on step 4 requires `type`, `landlordName`, `address`, `region`, and `description`. Users can skip fields and only see the generic error at submission.
- Fix: Add per-step validation before advancing. Show specific error messages for each missing field. Prevent advancing if required fields for that step are empty.

---

### Phase 2: New Features (Items 4-8)

**4. Tenant Property Recommendation Preferences**
- Create new `tenant_preferences` table: `id`, `tenant_user_id`, `current_location`, `preferred_location`, `property_type`, `min_budget`, `max_budget`, `preferred_move_in_date`, `created_at`, `updated_at`
- Add a "Preferences" page/section in tenant dashboard with the form
- Add a trigger or check in property listing flow: when a new unit is listed, query matching tenant preferences and insert notifications
- RLS: tenants manage own preferences

**5. Exact Property Location After Viewing Confirmation**
- Currently the marketplace modal shows `property.address` and `property.area/region` to all users, including GPS.
- Change: Hide exact address and GPS from the marketplace listing. Show only area/region before viewing is confirmed.
- After viewing is paid and accepted (`viewing_requests.status = 'confirmed'`), show full address + embedded map with GPS pin.
- Query `viewing_requests` for the current user/unit to determine access level.

**6. Post-Viewing Rental Application Flow**
- Create new `rental_applications` table: `id`, `tenant_user_id`, `landlord_user_id`, `property_id`, `unit_id`, `viewing_request_id`, `status` (pending/approved/rejected), `created_at`, `updated_at`
- After a confirmed viewing, show "Apply to Rent" button on the property detail
- On submit, insert application. Landlord sees applications on dashboard with tenant profile details (name, contact, ID, profile info)
- Landlord can approve → triggers the existing "Add Tenant" flow
- RLS: tenants manage own applications, landlords view/update applications for their properties

**7. Tenant-Landlord Messaging Enhancement**
- `marketplace_messages` table already exists with `sender_user_id`, `receiver_user_id`, `unit_id`, `message`, `read`
- Add a messages/inbox page to both Tenant and Landlord dashboards
- Group messages by conversation (unit_id + pair of users)
- Add notification on new message receipt
- Hide phone/email in messages until approval stage

**8. Mutual Rating System**
- Create `ratings` table: `id`, `rater_user_id`, `rated_user_id`, `tenancy_id`, `rating` (1-5), `review` (text, optional), `created_at`
- Unique constraint on `(rater_user_id, tenancy_id)` to prevent duplicates
- Only enabled for active/completed tenancies
- Show ratings on profile page
- Add "Rate" button on agreement/tenancy detail after tenancy is active
- RLS: users insert own ratings, read all ratings for their tenancies

---

### Database Migrations Required

New tables:
1. `tenant_preferences` — for recommendation notifications
2. `rental_applications` — for post-viewing applications
3. `ratings` — for mutual rating system

Realtime enablement:
- `marketplace_messages` for live messaging

---

### Recommended Implementation Order

1. Fix FloatingActionHub icon bug (quick win)
2. Fix FileComplaint validation (quick win)
3. Add CFLED branding to all layouts (quick win)
4. Tenant preferences + recommendation notifications
5. Location visibility gating on viewing confirmation
6. Rental application flow
7. Messaging inbox pages
8. Mutual rating system

Items 1-3 can be done immediately. Items 4-8 each require database migrations and significant UI work — I recommend tackling them one at a time for quality.

