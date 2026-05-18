# Complaint Management Module — Upgrade Plan

This is a large, multi-phase upgrade. Existing complaint tables, fees, and workflows stay intact. New capabilities are layered on top: new admin roles, a Command Center dashboard, a tabbed Case File, a Hearing Workspace, versioned documents, and an audit log. Built in 5 phases so each is testable before the next.

## Scope guardrails

- Tenant / landlord / NUGS complaint filing pages stay as-is.
- Existing `complaints` and `landlord_complaints` tables stay — we extend, never rename.
- Existing Form Engine (templates + submissions) keeps working; we add versioning + WYSIWYG on top of it.
- Existing assignment, scheduling, payment, and receipt flows keep working; new UIs read the same data.

---

## Phase 1 — Roles, schema, and audit foundation

New `admin_role` enum stored on `admin_staff`:
`stenographer | case_admin | adjudicating_officer | main_admin | super_admin`.

Each role gets a `has_admin_role(uid, role)` security-definer function used by RLS.

New tables (all RLS-protected, scoped to office where applicable):

- `complaint_status_history` — every status change with `changed_by, previous_status, new_status, reason, changed_at`.
- `complaint_audit_log` — `actor_id/name/role, case_id, action, old_value, new_value, ip, user_agent, created_at`.
- `complaint_documents` — versioned generated documents:
  `case_id, form_type, version_number, status (draft|under_review|finalized|voided|replaced), generated_by, edited_by, finalized_by, file_url, change_reason, generated_at, finalized_at`. Unique on `(case_id, form_type, version_number)`.
- `complaint_witnesses` — name, phone, email, address, side (complainant|respondent), expected_testimony.
- `complaint_notes` — author, role, note_type (`internal|official_proceedings`), body, edit_history jsonb.
- `complaint_hearings` — scheduled_date, scheduled_time, room_id, officer_user_id, status (`scheduled|ongoing|completed|adjourned|cancelled`), attendance jsonb, outcome.
- `hearing_rooms` — office_id, name, capacity, active.
- `complaint_decisions` — case_id, outcome (`settled|adjourned|dismissed|withdrawn|decided|...`), decision_summary, orders, payment_orders, compliance_deadline, document_id, officer_user_id, recorded_at.

Light extensions to `complaints` / `landlord_complaints`:
`complaint_title, claim_amount_internal, internal_notes, current_stage, last_activity_at, created_by_user_id` (back-fillable).

Triggers:

- `complaint_status_history` populated automatically on `status` change.
- `last_activity_at` bumped on insert/update of related child rows.

---

## Phase 2 — Complaints Command Center + upgraded list

New page `/regulator/complaints/command-center` becomes the default complaints landing.

- Summary cards: New / Draft / Submitted / Assigned / Hearings Today / Adjourned / Settled / Decided / Overdue / Awaiting Documents / Awaiting Assignment.
- Filters: region, district, office, complaint type, status, officer, hearing room, date range, created_by, assigned_officer.
- Quick actions: New Complaint, Search Case, Generate Report, View Hearing Schedule, Open Form Templates, Open Pending Assignments.

Upgraded list table (replaces current list contents but lives on the same route to avoid breakage):

- Columns: Case Ref, Date Received, Type, Complainant, Respondent, Office, Assigned Officer, Hearing Date, Status, Created By, Last Activity, Actions.
- Color-coded status badges driven by `current_stage`.
- Row actions: View Case, Continue Draft, Assign, Schedule, Generate Documents, Evaluate, Print Case File.
- Global search by case ref, party name, phone, address, officer, form number, payment ref.

---

## Phase 3 — Complaint Creation Wizard (Stenographer)

New `/regulator/complaints/new` 8-step wizard wrapping the existing Admin-Assisted intake plus the missing fields.

Steps: Type → Parties → Property → Details → Evidence → Witnesses → Forms → Review.

- Each step persists to a draft (`status='draft'`) so stenographers can resume.
- Narrative box gets helper buttons (Improve grammar / Formalize / Insert clause) backed by `lovable-ai` (`legal-assistant` style call with role=stenographer).
- File uploads tagged with visibility (`internal | party_visible | document_only`) using existing `application-evidence` bucket plus `visibility` metadata column.
- Step 7 lists active `form_templates` matched to the chosen complaint type and lets the stenographer generate any.
- "Submit for Review" flips status to `submitted` and notifies office's Case Admins.

---

## Phase 4 — Case File + Hearing Workspace + Decisions

New `/regulator/complaints/:id` tabbed Case File:

`Overview | Parties | Property | Complaint | Evidence | Witnesses | Forms | Hearings | Notes | Payments | Ledger | Activity Log | Decision`.

Each tab reads from existing tables plus the Phase-1 additions; no destructive migration of legacy rows.

Quick actions sidebar: Edit Draft, Assign Case, Schedule Hearing, Generate Form, Add Hearing Note, Record Attendance, Record Settlement, Record Decision, Close Case — gated by role.

Hearing Workspace `/regulator/complaints/:id/hearing/:hearingId` — three-pane:

- Left: case summary, parties, property, key amount, documents.
- Center: live hearing notes (autosaved), attendance toggles, directions, next steps.
- Right: forms, evidence, witnesses, previous hearing notes, payment/ledger.

Decision flow writes to `complaint_decisions`, auto-generates a Decision PDF from a `decision` template, attaches as a finalized `complaint_documents` row, and flips `current_stage` to `decided | settled | dismissed | withdrawn | closed`.

Assignment screen shows officer workload (cases today / week / pending / next slot) computed from `complaint_hearings`.

---

## Phase 5 — Form Engine v2 (versioning + Word-style editor) + Schedule + Notifications

Form Engine update (no breaking changes to existing templates):

- WYSIWYG editor (TipTap) replacing the current JSON schema editor for body content; existing schema still supported for autofilled fields.
- Insertable blocks: text, table, placeholder, logo, watermark image, header, footer, signature block, stamp area, page number, case ref, date, officer name, office name, party names, complaint type, hearing date/time, QR/verification URL.
- Finalize action: creates a `complaint_documents` row at the next `version_number`, marks status `finalized`, locks. Subsequent edits create v2/v3 with `change_reason`.
- Preview / Edit / Save Draft / Generate PDF / Download / Print / Attach to Case.

Hearing Schedule `/regulator/complaints/schedule`:

- Day / Week / Month views (reuse existing calendar component).
- Officer view, Room view, Office view.
- Color codes: green completed, blue scheduled, orange pending reschedule, red cancelled, grey adjourned, purple ongoing.
- Filters: region, district, office, officer, room, date, status.

Notifications:

- Extend existing `notifications` table writes + `send-sms` calls for: complaint submitted, case assigned, hearing scheduled/rescheduled, summons generated, document ready, adjourned, settlement recorded, decision issued, case closed.
- Internal notes never sent over SMS.

---

## Technical notes

```text
Routes added
/regulator/complaints/command-center
/regulator/complaints/new                  (8-step wizard)
/regulator/complaints/:id                  (tabbed Case File)
/regulator/complaints/:id/hearing/:hid     (Hearing Workspace)
/regulator/complaints/schedule
/regulator/form-engine/:id/edit-wysiwyg
```

```text
RLS pattern (example)
- stenographer:    INSERT/UPDATE on complaints WHERE created_by_user_id = auth.uid() AND status IN (draft, submitted)
- case_admin:      ALL on complaints WHERE office_id IN (admin_staff.office_ids)
- adjudicating:    SELECT on complaints assigned to them; INSERT on hearings/notes/decisions
- super_admin:     ALL
```

- All existing edge functions (`send-sms`, `paystack-*`, complaint payment basket, etc.) untouched.
- New audit-log writes happen via a single shared helper `logComplaintAction()` called from each mutator.
- Document versioning is enforced in DB (unique constraint) and surfaced in UI as a Versions drawer per form.

---

## What ships in this loop

If you approve, I'll start with **Phase 1 (schema + roles + audit)** and **Phase 2 (Command Center + upgraded list)** in the next message — that alone is a meaningful, shippable improvement. Phases 3–5 follow in subsequent messages so each can be reviewed.

Reply "approve" to proceed, or tell me which phases to reorder, drop, or expand.
