# Feature Access Control + Emergency Alert Upgrade

Two related workstreams. Both reuse the existing `feature_flags` table, `useFeatureFlag` hook, Engine Room UI, and `safety_reports` table.

---

## Part A — Granular Feature Access Control

### A1. Database (new tables)
- `feature_flag_overrides` — per-target enable/disable overrides
  - `feature_key` (FK), `target_type` (`role` | `user` | `dashboard` | `admin_category` | `institution`), `target_value` (text), `is_enabled` (bool), `created_by`, timestamps
  - Unique index on `(feature_key, target_type, target_value)`
- `staff_feature_overrides` — Super Admin per-staff sub-feature mutes
  - `staff_user_id`, `feature_key`, `sub_key` (nullable for whole feature), `is_enabled`
  - Covers menus / cards / dashboards inside a feature
- RLS: Super Admin full CRUD; everyone else read-own only.
- Server-side resolver function `resolve_feature_access(user_id, feature_key, sub_key)` that returns boolean by layering: default flag → role override → admin_category → institution → dashboard → user → staff sub-override (most specific wins, **default = off** when flag is off and no override turns it on).

### A2. Client hook upgrade
- Extend `useFeatureFlag` to accept context (`{ role, dashboard, institution, subKey }`) and call the resolver, with the same 30s cache + realtime invalidation already in place.
- Add `useFeatureGate(key, ctx)` returning `{ visible, loading }`. **All menus, sidebar entries, cards, buttons, and route guards must use this** — when `visible === false`, render nothing.

### A3. Engine Room — Access Control tab
- New tab "Access Control" in `EngineRoom.tsx` listing every feature flag with:
  - Default toggle (existing)
  - "Manage Access" drawer → tabs: **Roles / Users / Dashboards / Institutions / Admin Categories**, each lets Super Admin add/remove overrides
- New category badges so every feature now lives under one of: Engine Room / Super Admin / Landlord / Tenant / Student (extend `category` enum filter buttons; current code already filters by category — add the missing buckets).

### A4. Super Admin Staff Mutes
- New page `/regulator/staff-feature-mutes` (Super Admin only): pick staff member → tree of features + sub-features (menus/cards/dashboards) with on/off switches writing to `staff_feature_overrides`.
- Admin/staff dashboards read these via `useFeatureGate`.

### A5. Default-off rule
- Every new feature flag inserted from now on is created with `is_enabled = false` for non-explicitly-granted roles. Add a DB CHECK / seed convention note in `feature_flags`.

---

## Part B — Emergency Alert Rebuild

### B1. Schema additions to `safety_reports`
Migration adds columns:
- `emergency_type` already exists — extend CHECK to include `health` alias and keep `police|fire|medical|other`
- `action_taken` (`call` | `alert` | `call_and_alert`)
- `live_tracking_enabled` (bool), `tracking_stopped_at` (timestamptz)
- `acknowledged_by`, `acknowledged_at`
- `linked_property_id`, `linked_tenancy_id`, `linked_complaint_id`, `linked_student_id` (nullable FKs)
- Status enum extended: `new | acknowledged | in_review | escalated | resolved | false_alarm`

New table `safety_location_pings`:
- `report_id`, `lat`, `lng`, `accuracy`, `captured_at`
- Append-only; RLS: owner insert, admins + owner select

### B2. Emergency numbers + label fix
Update `src/lib/safetyCategories.ts` `EMERGENCY_TYPES`:
- General Emergency → `112`
- Police → `191`
- Fire → `192`
- Health / Ambulance → `193`
- Other → no tel

In `SafetyPanicButton.tsx`:
- Replace the hard-coded "Call Police" button with a **Call** button that dials the number bound to the selected type.
- Add three action buttons: **Call**, **Send Alert**, **Call + Send Alert** (replaces the current Send Alert + Silent toggle layout; keep silent as a checkbox option).
- After type selection, the Call button uses `tel:` for that type's number.

### B3. Live Location Tracking
- New component/hook `useLiveLocationTracker(reportId)`:
  - On consent prompt → `navigator.geolocation.watchPosition`
  - Throttled to one ping per 15s → insert into `safety_location_pings`
  - Stop conditions: user toggles off, admin sets status to `resolved` / `false_alarm`, or `tracking_stopped_at` set
- Edge function `safety-location-ping` (optional batch endpoint) or direct insert with RLS.
- Capture on submission: name, role, phone, type, current GPS, time, optional note, plus any linked property/tenancy/complaint/student inferred from the user's active context.

### B4. Admin Emergency Dashboard
- Under existing `SafetyEmergencyReports.tsx`, add a left sub-nav with: **All / Police / Fire / Health / Other** (filter by `emergency_type`).
- Each row shows: category, user, location pin, time, status.
- Detail drawer: map (Google Maps already loaded) showing live trail from `safety_location_pings`, acknowledge / escalate / resolve / false-alarm buttons, audit fields.
- "Acknowledge" stops the ring and records `acknowledged_by` + `acknowledged_at`.

### B5. Ring Notification
- Persistent audio loop + flashing banner component `<EmergencyAlertRinger />` mounted in `RegulatorLayout`.
- Subscribes to realtime `safety_reports` inserts where `report_kind = 'panic_emergency' AND status = 'new'`.
- Plays a sound (looped `<audio>` from `src/assets`), shows top banner with category/user/location/time, stays until an authorized admin clicks **Acknowledge**.
- Respects `useFeatureGate('emergency_acknowledge')`.

### B6. Role-Based Emergency Access toggles
Seed these feature flags (default off except where noted):
- `emergency_view_all`, `emergency_view_police`, `emergency_view_fire`, `emergency_view_health`, `emergency_view_other`
- `emergency_acknowledge`, `emergency_escalate`, `emergency_resolve`
- `emergency_view_live_location`, `emergency_export_records`

Every menu item, button, and drawer field in the Admin Emergency Dashboard is wrapped in `useFeatureGate`. Disabled users see no menu entry and no detail data.

---

## Technical notes
- No new packages required (Google Maps + Supabase realtime already wired).
- Audio asset: small `emergency-ring.mp3` placed in `src/assets/`.
- All new flags inserted via `supabase--insert` after the migration.
- `useFeatureFlag` cache TTL stays at 30s; realtime already invalidates on `feature_flags` change — extend channel to also listen to `feature_flag_overrides` and `staff_feature_overrides`.
- `tel:` links work natively in mobile browsers and trigger the dialer.

## Build order
1. Migration: overrides tables, safety_reports columns, location_pings, status enum, seed new flags
2. Resolver function + `useFeatureGate` hook
3. Engine Room Access Control tab + Staff Mutes page
4. Wire `useFeatureGate` across sidebars and dashboards
5. Panic Button rewrite (numbers + Call/Alert/Both)
6. Live Location Tracker
7. Admin Emergency Dashboard sub-nav + map trail + ring banner
8. Smoke test: toggle off → user loses menu; emergency → ring → ack → trail
