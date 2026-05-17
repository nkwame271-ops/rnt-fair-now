# Safety & Emergency Reporting System

A separate system from Complaints — fast, free, never blocked by payment.

## 1. Database (migration)

### New tables

**`safety_reports`** — non-emergency safety issues + emergency panic alerts
- `id`, `ticket_number` (SR-YYYYMMDD-NNNNN via `generate_safety_ticket()`)
- `report_kind` enum: `safety_report` | `panic_emergency`
- `category` text (sexual_harassment, physical_assault, digital_abuse, threats, domestic_violence, suspicious_activity, property_invasion, health_security, other)
- `emergency_type` text (police, medical, fire, security, other) — panic only
- `user_id`, `user_role` (student/tenant/landlord), `user_name_snapshot`, `user_phone_snapshot`
- `property_id`, `unit_id`, `hostel_or_hall`, `school` (nullable)
- `description` (nullable for panic)
- `evidence_urls` text[]
- `latitude`, `longitude`, `location_accuracy`, `location_address`
- `is_silent` boolean (silent alert)
- `severity` (low/medium/high/critical) — default critical for panic
- `status` (submitted, acknowledged, under_review, escalated, resolved, closed, false_alert)
- `assigned_to_user_id`, `assigned_office_id`
- `acknowledged_at`, `acknowledged_by`, `response_time_seconds`
- `escalated_to` text[] (nugs, police, cid, campus_security, rent_control_leadership)
- `escalated_at`, `escalation_notes`
- `user_marked_safe_at`
- `closure_reason`, `closed_at`, `closed_by`
- `false_alert_count_at_time` int
- timestamps

**`safety_location_pings`** — live location updates
- `id`, `report_id`, `latitude`, `longitude`, `accuracy`, `recorded_at`

**`safety_audit_log`** — every action
- `id`, `report_id`, `actor_user_id`, `action` (acknowledged, called_user, messaged_user, assigned, escalated, note_added, status_changed, location_ping, marked_safe, closed)
- `details` jsonb, `created_at`

**`safety_notes`** — admin notes
- `id`, `report_id`, `author_user_id`, `note`, `created_at`

**`safety_contacts`** — configured alert recipients (super admin manages)
- `id`, `contact_type` (super_admin, safety_admin, nugs_desk, campus_security, user_emergency_contact), `name`, `phone`, `email`, `scope` (global/region/school), `scope_value`, `active`

### Functions
- `generate_safety_ticket()` — SR-YYYYMMDD-NNNNN
- `auto_escalate_unacknowledged()` — cron candidate, escalates after timeout
- `log_safety_action()` trigger helper

### RLS
- Users: insert own reports, view own reports, update own (mark safe, add ping)
- Admins (`is_main_admin`): full select/update
- Service role: full

### Storage
- `safety-evidence` bucket (private), admin + owner read

## 2. Edge Functions

- **`submit-safety-report`** — validates payload, inserts report, logs audit, fans out SMS to configured `safety_contacts` (via `send-sms`), notifies super admins. Returns ticket number. Never requires payment.
- **`safety-location-ping`** — accepts lat/lng from authenticated user for own active report
- **`safety-acknowledge`** — admin marks acknowledged, records response time
- **`safety-escalate`** — admin escalates, triggers SMS to escalation contacts

## 3. Shared UI (all user portals)

**`src/components/SafetyPanicButton.tsx`** — floating red button (bottom-right, sibling of FAB) on every authenticated layout
- Always visible to tenant/landlord/student
- Two-step modal: pick emergency type → "Send Emergency Alert" + "Silent Alert" toggle + "Call Police Now" (tel:191)
- Auto-captures geolocation
- Shows ticket number toast + "I am safe" persistent banner

**`src/pages/shared/ReportSafetyIssue.tsx`** — full form for non-immediate safety reports
- Category dropdown, description, location autodetect/manual, property picker (auto-loaded for tenants/landlords), evidence upload, severity hint, silent toggle

**`src/pages/shared/MySafetyReports.tsx`** — user views their reports, status, "I am safe" button while active

### Layout integration
- `TenantLayout`, `LandlordLayout`, `NugsLayout` — mount `<SafetyPanicButton />`
- Sidebar links: "Report Safety Issue" + "My Safety Reports"
- Routes in `App.tsx` under `/tenant`, `/landlord`, `/nugs`

## 4. Admin Portal

**`src/pages/regulator/SafetyEmergencyReports.tsx`** — dashboard
- Tabs: Active Emergencies | Unacknowledged | Reports | Closed
- Filters: role, region/location, school, property, severity, status, kind
- Table: ticket, user, role, category, severity, location, status, response time, assigned
- Live map (existing `PropertyMap`/Google Maps) plotting active emergencies + location pings
- Row actions: Acknowledge, Call (tel:), Message (SMS), Assign Officer, Escalate (multi-select to NUGS/Police/CID/Security/Leadership), Add Note, Mark Resolved, Close, Download Summary PDF

**`src/pages/regulator/SafetyReportDetail.tsx`** — single report
- Header: ticket, status, severity, response timer
- User info + tel/SMS quick actions
- Live location map with ping history
- Description, evidence (signed URLs)
- Notes timeline + add-note
- Audit log
- Escalation panel
- Status controls + closure reason

**`src/pages/regulator/SafetyContacts.tsx`** — manage `safety_contacts` (super admin only)

### Sidebar (`RegulatorLayout`)
- New "Safety & Emergency" section with the three pages
- Badge with count of unacknowledged active emergencies (realtime)

### Routes (`App.tsx`)
- `/regulator/safety` → SafetyEmergencyReports
- `/regulator/safety/:id` → SafetyReportDetail
- `/regulator/safety/contacts` → SafetyContacts

## 5. Realtime
- Enable realtime publication on `safety_reports` + `safety_location_pings`
- Admin dashboard subscribes for instant new-emergency toast/sound

## 6. Helpers / libs
- `src/lib/safetyCategories.ts` — category + emergency-type metadata + icons
- `src/lib/generateSafetyCasePdf.ts` — case summary PDF (jsPDF, reuses styling from `generateComplaintReports`)
- `src/lib/useGeolocation.ts` — hook with permission + accuracy

## 7. Abuse control
- Count prior `false_alert` closures per user — show admin badge if ≥3
- Never block submission

## 8. Out of scope (deferred)
- Real Police/CID API dispatch (manual call button only)
- Background location tracking when app closed (PWA limitation)

## Technical notes
- All emergency-related code never references payment/escrow tables.
- Geolocation uses `navigator.geolocation.watchPosition` while a panic report is `submitted|acknowledged|under_review`.
- SMS fan-out via existing `send-sms` edge function.
- Silent mode suppresses sonner toasts + post-submit modal; returns to current page silently.
