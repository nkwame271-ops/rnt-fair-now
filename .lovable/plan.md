
## Phase 4 — Safety Reports: Drug Abuse + richer reporting form

### Scope
Add "Drug Abuse" as a first-class safety category and upgrade the shared report form used by tenant, landlord, student and NUGS entry points so every submission captures the same enriched data.

### Database (`safety_reports`)
Add nullable columns if missing:
- `written_directions` text
- `nearest_landmark` text
- `location_unknown` boolean default false
- `person_involved` text
- `incident_datetime` timestamptz
- `media_urls` text[] (already may exist as `evidence_urls` — reuse if present)
- `is_anonymous` boolean default false

Backfill category enum/whitelist to include `drug_abuse`.

### Frontend
1. `src/lib/safetyCategories.ts` — add `drug_abuse` entry with icon + label + description.
2. `src/pages/shared/ReportSafetyIssue.tsx` — extend form with:
   - Google Maps location picker (reuse `PropertyLocationPicker`) with GPS + live-location buttons.
   - "I don't know my location" toggle → hides map, keeps directions + landmark required.
   - Written directions (textarea).
   - Nearest landmark (input).
   - Person involved (input, optional).
   - Description (textarea, required).
   - Date + time (defaults to now, editable).
   - Multi-file photo/video upload to existing safety storage bucket.
   - Anonymous submission toggle → strips reporter identity from admin view but keeps user_id on record for abuse control.
3. All four wrappers (`tenant`, `landlord`, `nugs`, `student` — student uses the same shared page) inherit automatically since they render `ReportSafetyIssue`.

### Storage
Reuse existing safety evidence bucket; if none exists, create `safety-evidence` (private) with per-user RLS.

### QA
- Type-check.
- Verify drug_abuse category renders in category picker.
- Submit test report with location-unknown path and with map-picked location.

Reply "proceed" to build.
