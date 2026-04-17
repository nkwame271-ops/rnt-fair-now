

## Plan: 4 Deferred Items — Property Capture, Similarity Engine, NUGS Complaints, Hostel Backfill

### Blast radius

**DB schema (one migration)**:
- `complaint_properties` (new) — full row per filed complaint, captures landlord name, property name, type, unit, monthly_rent, address, lat/lng, gps_code, place_id, location_method.
- `complaints` — add `complaint_property_id UUID` FK (nullable).
- `property_similarity_scores` (new) — match results with per-signal point breakdown, dismissal fields, unique on (source_id, matched_property_id).
- `similarity_check_errors` (new) — error log.
- `properties` — add `property_category TEXT` if missing; backfill `student_housing` for existing `hostel`/`hall`/`hall_of_residence` rows.
- Enable `pg_trgm` extension for fuzzy matching.
- Indexes: `complaint_properties(complaint_id)`, `property_similarity_scores(matched_property_id, similarity_level) WHERE NOT manually_dismissed`, GIN trigram on landlord name + property name.
- RLS: same model as complaints — tenants insert/select their own complaint_properties via parent complaint; admins (regulator/super) full read; similarity scores readable by admins, dismissals updateable by admins. No changes to existing RLS, has_role, or is_main_admin.

**Edge function (new)**:
- `supabase/functions/run-similarity-check/index.ts` — accepts `{ source_type: 'complaint_property', source_id: uuid }`, idempotent upsert on (source_id, matched_property_id), null lat/lng tolerated, errors logged to `similarity_check_errors`. Uses pg_trgm via SQL (not JS). Tenant boost = 1.15x if filer name matches any tenant under matched landlord. Threshold logic: ≥75 high, 50–74 medium, 25–49 low, <25 discard.
- Invoked client-side from FileComplaint after the complaint_property insert (fire-and-forget).
- `supabase/config.toml` — add `verify_jwt = false` (admin-side context but tenant-callable; we validate via service role internally).

**Frontend**:
- `src/pages/tenant/FileComplaint.tsx` — insert new "Property Details" card between office and description. Tabs (default "Search on Map"): Live Location / GPS Code / Map Search. Leaflet for live + GPS preview, Google Places autocomplete for map search. Validation gate before submit.
- `src/pages/regulator/RegulatorProperties.tsx` — fetch counts of high/medium non-dismissed matches per property, show "High Match · N" / "Possible Match · N" badge.
- `src/pages/regulator/RegulatorProperties.tsx` (or new detail dialog within it) — Similarity Matches tab on property detail showing per-match breakdown chips, Dismiss + View Complaint buttons, "Show dismissed" toggle.
- `src/pages/regulator/RegulatorComplaints.tsx` — collapsible "Possible property matches found (N)" panel inside complaint detail when scores ≥50 exist; otherwise "No similar properties found".
- `src/pages/nugs/NugsMyComplaints.tsx` (new) — student-only complaints list (mirrors MyCases but in NUGS layout, redirects non-students).
- `src/components/NugsLayout.tsx` — replace "File a Complaint" item: keep file-complaint, add "My Complaints" linking to `/nugs/my-complaints`.
- `src/App.tsx` — register `/nugs/my-complaints`.
- Reuse existing Google Maps loader (`@react-google-maps/api`, libraries already include `places`).
- Leaflet — already a dependency (used in PropertyHeatmap); reuse pattern.

**Out of scope (do not touch)**:
- RLS on existing tables, has_role, is_main_admin, password flows, Paystack pipeline, payout_transfers, escrow correction logic, complaint status/payment flow.
- Office selection, complaint description, submit logic in FileComplaint (only the new property card is added).
- Student NUGS dashboard or other pages.

### Build sequence

**Step 1 — Migration (single tool call, await approval)** — create tables, add columns, enable pg_trgm, indexes, RLS, backfill hostels.

**Step 2 — Edge function + code (parallel batch)**:
1. `supabase/functions/run-similarity-check/index.ts`
2. `src/pages/tenant/FileComplaint.tsx` (additive Property Details card)
3. `src/pages/nugs/NugsMyComplaints.tsx`
4. `src/components/NugsLayout.tsx`
5. `src/App.tsx`
6. `src/pages/regulator/RegulatorProperties.tsx` (badge + similarity tab)
7. `src/pages/regulator/RegulatorComplaints.tsx` (similarity panel)

**Step 3 — Verification**:
- File a complaint as tenant → row appears in `complaint_properties`, complaint links to it, similarity check runs, scores ≥25 stored.
- Regulator sees badge on matched property, opens Similarity Matches tab, dismiss works.
- Complaint detail shows similarity panel with N matches.
- Student visits `/nugs/my-complaints` — sees their complaints; non-student is redirected.
- Existing hostels query: `select count(*) from properties where property_category='student_housing'` > 0.

### Acceptance criteria
- New Property Details card renders between office and description; no existing FileComplaint behavior changed.
- One of three location methods is enforced before submit.
- `complaint_properties.location_method` matches the chosen tab.
- Similarity scores written with full per-signal breakdown; dismissed matches hidden by default.
- Idempotent re-runs produce no duplicate rows (unique constraint).
- Null lat/lng → gps_points=0, no error.
- Hostel backfill complete; no UI change there.
- Zero changes to RLS on existing tables, has_role, is_main_admin, payment pipeline.

### Open question (non-blocking)
- **Q1** — For the property detail "Similarity Matches tab": `RegulatorProperties.tsx` currently uses a row-expand model rather than a full detail page. I'll add the matches as an expandable sub-section within the existing property row (so it works inside the existing UX). If you'd rather have a dedicated dialog/page, say so and I'll switch.

Approve and I'll run the migration first, then ship the rest in one parallel batch.

