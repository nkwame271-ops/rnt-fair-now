## Continue RentCare Assistance — Remaining Work

Foundation is in place (DB, payment wiring, student dashboard, admin console skeleton). This plan finishes the feature.

### 1. Route + navigation wiring
- `src/App.tsx`: register `/student/rentcare`, `/student/rentcare/apply`, `/student/rentcare/:id`, `/regulator/rentcare`, `/admin/rentcare` (same component, role-gated).
- Add sidebar entries:
  - Regulator sidebar (`RegulatorLayout`) — gated by `rentcare_assistance` flag + regulator role.
  - Engine Room sidebar — RentCare admin tile.
  - Super Admin dashboard — RentCare summary tile.
  - NUGS layout student nav — already added; verify visibility gating.
- Hide entries entirely when feature flag disabled OR role lacks access (reuse `useModuleVisibility`).

### 2. Student UI completion
- `RentCareApply.tsx`: add document upload section (Ghana Card, student ID, admission letter, fee statement) → `rentcare-docs` bucket at `{user_id}/{application_id}/{doc_type}.{ext}`; insert into `rentcare_documents`.
- `RentCareDetail.tsx`: 
  - File list with signed-URL download.
  - Inbox: list `rentcare_messages` + reply form.
  - UMB editing gated by `rentcare_allow_umb_edit` flag.
  - Receipt download once `payment_status = paid`.
- Legal notice modal on checkout with required "I accept" checkbox before Paystack redirect.

### 3. Admin console completion (`RentCareManagement.tsx`)
- Detail drawer: timeline (status_history), documents (signed URLs), messages, audit log tab.
- Actions: Mark Under Review → Sent to UMB → Approved → Declined (reason required) → Disbursed (ref required). All via `rentcare_admin_update` RPC (optimistic-lock).
- Admin → Student messaging composer.
- Exports gated by `rentcare_admin_export_enabled`:
  - CSV (already stubbed)
  - XLSX via `xlsx` lib (client-side)
  - PDF via existing `jspdf` setup — one summary per application or batch.
- Filters: status, date range, region, search by reference / student name / phone.

### 4. Engine Room controls
- Add RentCare card to `EngineRoom.tsx`:
  - Toggle `rentcare_assistance` (master on/off).
  - Edit `fee_amount` (number input, GHS).
  - Edit UMB referral link (stored in `feature_flags.description` for `rentcare_umb_link`).
  - Toggle `rentcare_allow_umb_edit`.
  - Toggle `rentcare_admin_export_enabled`.
- All changes write through existing feature_flags update path and log to `rentcare_audit_log` via helper.

### 5. Audit logging helper
- `src/lib/rentcare/audit.ts`: `logRentCareAudit({ application_id, event_type, old_value, new_value })` — captures user_id, role, IP via `navigator`, device via UA, timestamp.
- Call from: status change RPC (server-side trigger), payment finalize, UMB save, document upload, message send, admin export, engine-room setting change.

### 6. Notifications
- On payment success → SMS + email to student ("Application submitted, reference RC-…").
- On status change → SMS + email ("Your RentCare application is now {status}").
- On admin message → email to student.
- Reuse existing `send-sms` (Arkesel) + email infra.

### 7. Smoke test checklist
- Student: apply → upload docs → pay → UMB submit → see timeline.
- Admin: view list → open detail → change status → export CSV/XLSX/PDF → message student.
- Engine Room: toggle off → entries disappear for all roles.
- Audit log row present for every event.

### Technical notes
- Fee read live from `feature_flags.fee_amount` server-side in `paystack-checkout` (already done) and client-side for display.
- Status guard: server-side check in `rentcare_admin_update` already rejects advancing past `awaiting_application_fee_payment` without `payment_status = paid`.
- Optimistic concurrency: every admin write increments `version`; mismatched version → 409.
- Tenant/Landlord sidebars: add entry behind module visibility, **default off** (per spec "optional for later").

### Order
Routes → Engine Room controls → Student doc upload + messages → Admin detail drawer + actions → Exports (XLSX/PDF) → Audit helper wiring → Notifications → Smoke test.
