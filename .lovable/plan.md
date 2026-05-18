
## Goal

Make Form 7 (Complaint) and Form 33 (Summons) generate PDFs that match the official Rent Control layouts shown in your samples, and rebuild the complaint intake UI so capturing those fields is fast and pleasant — not a wall of inputs.

## What's wrong today

- **Form 7 / Form 33 PDFs**: rendered from a generic `form_templates` schema with loose label-matching. Fields like multiple respondents, premises house number, agreement expiry, deposit, occupancy duration, GPS for complainant address, CAR case number, hearing officer/venue are not modeled — so the PDFs don't look like the samples.
- **Intake UI**: single long page, no grouping of "additional details", no support for multiple complainants/respondents, no GPS capture for complainant address, no agreement/deposit fields. Too painful for officers doing paper-to-digital intake.

## Scope (frontend + form generators only — no workflow changes)

### 1. Data model additions (one migration)

Add nullable columns to `public.complaints` to back the official forms:

- `complainants jsonb` — array of `{name, phone, address, gps_lat, gps_lng}` (primary complainant still mirrored to existing placeholder columns for back-compat)
- `respondents jsonb` — array of `{name, phone}` (primary mirrored to existing columns)
- `premises_house_no text`, `premises_town text` (kept separate from free-form `property_address`)
- `complainant_address text`, `complainant_gps_lat numeric`, `complainant_gps_lng numeric`
- `agreement_expiry_date date`, `deposit_amount numeric`, `occupied_months int`, `tenants_intent text` (renew / vacate / other)
- `relief_sought text` (e.g. "Eject tenants immediately")
- `case_number text` — the CAR-style number ("CAR 2734/2026"). Auto-generated on first hearing schedule from a small sequence helper; editable by admin.
- `hearing_venue text`, `hearing_officer_name text`, `summons_issued_at timestamptz`

All optional; existing flows keep working.

### 2. New modern intake UI — `AdminFileComplaint.tsx` (full rewrite of the page, same route)

A **2-column, sectioned form** with progressive disclosure:

```text
┌─ Header (sticky) ─────────────────────────────────┐
│ File Complaint • [Save Draft] [File Complaint]    │
├──────────────────────┬────────────────────────────┤
│ LEFT (primary)       │ RIGHT (live Form 7 preview)│
│  • Parties           │  Mini PDF-style preview    │
│  • Premises          │  updating as you type      │
│  • Complaint summary │                            │
│  • Office & docket   │                            │
└──────────────────────┴────────────────────────────┘
```

UX rules to keep it light:
- **Single-click "Add another complainant/respondent"** chips, not nested cards
- **GPS capture** button on each complainant address (uses existing geolocation pattern)
- **"More details" collapsible** per section — agreement date, deposit, occupancy months, intent live behind a single expander so the form looks short by default
- **Smart defaults**: office auto-picked from region, case number left blank until hearing scheduled, relief sought has 4 quick chips ("Eject", "Refund deposit", "Repair", "Other")
- **Autosave draft** to `localStorage` keyed by admin user (no schema change)
- **Sticky submit bar** with inline validation summary (no toast spam)

### 3. Form 7 PDF generator — purpose-built

New module `src/lib/pdf/form7.ts` (uses existing `jspdf` already in the project) that renders the exact layout from the sample:

- Header: "FORM 7 — Complaint Against Conduct of Landlord/Tenant/Person Interested in Premises", "Under Rent Regulation 19(1)"
- Numbered fields exactly matching the sample (Complainant, Address, Respondents list, Premises, Summary bullets, Stamp box)
- Bulleted summary auto-composed from: monthly rent, agreement expiry, intent, deposit, occupancy months, free-form description, relief sought
- Footer with ticket number, filing date, and a placeholder for the office stamp

Replaces the generic `autoGenerateForm7` path for `form_7`; the `form_templates` row stays for backwards compat but isn't used.

### 4. Form 33 PDF generator — purpose-built

New module `src/lib/pdf/form33.ts`:

- Header: "FORM 33 — Summons to Persons Against Whom Complaints Have Been Made", "Under Regulation 38(2) (Rent Regulation, 1964 LI 369)"
- Case Number: `case_number` (auto-issued on first hearing schedule if blank)
- Parties: multi-line list of complainants vs respondent
- Rent Officer for: office name/region
- Person Summoned: respondent name (one summons per respondent — loop if >1)
- Nature of Complaint, Appearance Date + Time, Issued At, Date Issued

Trigger remains in `ComplaintCaseFile.tsx` when a hearing is scheduled; output saved as `draft` in `complaint_documents` so the officer can edit/finalize before sending.

### 5. Case File tweaks

- Show generated Form 7 with a **"Preview / Download / Regenerate"** row (uses new generator)
- Show Form 33 draft per respondent with the same row
- Display `case_number` prominently once issued; add inline "Edit case number" for admins

## Out of scope

- Workflow/state machine changes
- Notifications/SMS changes
- Rich-text document editor (TipTap) — keep as-is for free-form rulings
- Backend RLS changes (current policies already cover the new columns)

## Technical notes

- Migration adds nullable columns only — no destructive changes, no policy rewrites.
- PDF generators use `jspdf` + `jspdf-autotable` (already installed). No new deps.
- Live preview component reuses the same `form7.ts` render but to a hidden canvas → image via `jspdf`'s `output('datauristring')`.
- Case number sequence: `case_number_seq` int sequence + a small SQL helper `issue_case_number()` returning `CAR <n>/<YYYY>`.
- Storage path unchanged: `complaints/{caseId}/form-7-v{n}.pdf`, `complaints/{caseId}/form-33-v{n}.pdf`.

## Files

- **Migration**: new columns on `complaints` + `case_number_seq` sequence + `issue_case_number()` function
- **Created**: `src/lib/pdf/form7.ts`, `src/lib/pdf/form33.ts`, `src/components/regulator/Form7LivePreview.tsx`
- **Rewritten**: `src/pages/regulator/AdminFileComplaint.tsx`
- **Updated**: `src/lib/complaintForms.ts` (route Form 7/33 to new generators), `src/pages/regulator/ComplaintCaseFile.tsx` (case number display, regenerate buttons)
