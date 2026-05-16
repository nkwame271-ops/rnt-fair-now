
# Admin-Assisted Complaint Filing & Rent Control Form Engine

This is a large, two-part build. I'll deliver it in two coordinated phases inside the Admin (Regulator) Portal so the existing complaint workflow stays intact.

---

## Part 1 — Admin-Assisted Complaint Filing

### New page
`src/pages/regulator/AdminFileComplaint.tsx` — accessible from `RegulatorComplaints` via a new **"File Complaint on Behalf"** button, and as a route `/regulator/complaints/new`.

### Form fields
- Complainant type: Tenant / Landlord / Interested Person
- Respondent type: Tenant / Landlord / Interested Person
- Complainant: search existing user (by phone/name/Ghana Card) OR enter name + phone
- Respondent: search existing user OR enter name + phone
- Property/premises: if complainant or respondent is linked, show their registered properties → select property → select unit (multi-unit) → auto-load rent value, rent band, tenancy
- Free-text address fallback when no linked property
- Rent amount (auto-filled from unit if linked, editable)
- Complaint type (existing `complaint_types` table)
- Description (long text)
- Attachments (uploads to existing `application-evidence` bucket)
- Office handling complaint (offices dropdown, defaults from region)
- Optional **docket / physical case reference number** (free text, stored on complaint)
- Optional region (auto from office)

### Submission behavior
Insert into existing `complaints` table with:
- `filed_by_admin = true` (new column)
- `admin_filer_user_id = auth.uid()`
- `physical_docket_ref` (new column)
- `complainant_role`, `respondent_role` (extend existing columns / add)
- `placeholder_complainant_name/phone`, `placeholder_respondent_name/phone` for non-platform users
- Reuses `generate_complaint_ticket()` so ticket flows identically
- Status: `submitted` → admin can request payment, assign, schedule (existing flows in `RegulatorComplaints` continue to work)

### Placeholder profiles & SMS invites
- If a party isn't on the platform, store their name/phone on the complaint as placeholder fields
- Send SMS via existing `send-sms` function:
  - Complainant: "Your complaint TKT-… has been filed on your behalf at <office>. Register at rentcontrolghana.com using <phone> to track it."
  - Respondent: "A complaint TKT-… has been filed against you at <office>. Register at rentcontrolghana.com using <phone> to respond."
- SMS only fires when phone provided

### Search component
New `src/components/PartySearchCombobox.tsx` — searches `profiles` by phone/name, returns `{user_id, full_name, phone, role}`. Used for both complainant and respondent fields.

### Property/unit cascade
New `src/components/LinkedPropertyPicker.tsx` — when a tenant/landlord is linked, fetches their properties (landlord) or current tenancy property (tenant), then units, then auto-fills rent + rent band via existing `compute-rent-benchmark` logic.

---

## Part 2 — Rent Control Form Engine

A flexible, metadata-driven template system. Templates are stored in DB, rendered + filled at runtime, exported as PDF.

### Database (one migration)

```text
form_templates
  id, form_name, form_number, regulation_ref, department, version,
  effective_date, status (draft/active/retired), schema (jsonb),
  layout (jsonb), created_by, created_at, updated_at

form_submissions
  id, template_id, complaint_id (nullable), case_id (nullable),
  data (jsonb), status (draft/finalized), pdf_url, generated_by,
  created_at, updated_at
```

`schema` jsonb shape:
```text
{
  sections: [
    { id, title, order, fields: [
      { id, type, label, required, options?, autofill?: {source, path}, ... }
    ]}
  ]
}
```

`layout` jsonb shape: title position, header, footer, signature/stamp/QR areas, page size.

RLS: only admin staff (`is_main_admin`) can CRUD templates; submissions readable by admins + linked complaint parties.

### Field types supported
text, number, date, dropdown, checkbox, long text, file upload, signature, stamp, table, auto-filled

### Auto-fill sources
`profile`, `landlord`, `tenant`, `complaint`, `property`, `tenancy`, `payment`, `appointment`, `officer` — resolved server-side via a lightweight resolver in `src/lib/formAutofill.ts` that takes `{templateId, complaintId}` and returns the merged data object.

### Pages
- `src/pages/regulator/FormEngine.tsx` — list of templates + "New Template" + edit/clone
- `src/pages/regulator/FormTemplateEditor.tsx` — drag-order sections/fields, configure metadata, layout, autofill mapping, preview
- `src/pages/regulator/FormFill.tsx` — fill a template against an optional complaint, save draft, preview, generate PDF, attach to complaint
- Entry from `RegulatorComplaints` complaint detail: **"Generate Form"** button → choose template → opens FormFill prefilled

### PDF rendering
`src/lib/generateDynamicFormPdf.ts` — uses existing `jsPDF` (already a dep via `generateComplaintPdf`). Reads `layout` + filled `data`, renders sections/fields, embeds signatures (PNG), QR (existing qrcode dep), page-size aware. Saves to storage bucket `form-outputs` (new, private) and stores URL on `form_submissions`. Attaches to complaint via `complaint_attachments` (existing) when "Attach to complaint" chosen.

### Preloaded templates
After migration, seed two `form_templates` rows via the `insert` tool:
- **Form 7 — Complaint Against Conduct of Landlord/Tenant/Person Interested in Premises**
  Sections: Complainant Details, Respondent Details, Premises Details, Particulars of Complaint, Declaration, Officer Section
  Autofill from `complaint` + `complainant.profile` + `respondent.profile` + `property` + `tenancy`
- **Form 33 — Summons to Person Against Whom Complaint Has Been Made**
  Sections: Court/Office Header, Respondent Details, Complaint Reference, Hearing Details, Officer Signature, Stamp
  Autofill from `complaint` + `appointment` + `office`

### Form actions on FormFill page
Save draft · Preview · Generate PDF · Download · Print · Attach to complaint · Send by SMS link (uses existing `send-sms` with a tokenised public link)

### Separation of concerns
- Template = `form_templates.schema/layout`
- Data = `form_submissions.data` + autofill resolver pulling live records
- Output = generated PDF saved to `form-outputs` bucket

---

## Files to create
- `src/pages/regulator/AdminFileComplaint.tsx`
- `src/pages/regulator/FormEngine.tsx`
- `src/pages/regulator/FormTemplateEditor.tsx`
- `src/pages/regulator/FormFill.tsx`
- `src/components/PartySearchCombobox.tsx`
- `src/components/LinkedPropertyPicker.tsx`
- `src/components/forms/FieldRenderer.tsx`
- `src/components/forms/SectionEditor.tsx`
- `src/lib/formAutofill.ts`
- `src/lib/generateDynamicFormPdf.ts`
- One migration: `form_templates`, `form_submissions`, `complaints` extensions, `form-outputs` bucket + RLS

## Files to edit
- `src/pages/regulator/RegulatorComplaints.tsx` — "File on Behalf" button + per-complaint "Generate Form" button
- `src/App.tsx` — new routes
- `src/components/RegulatorLayout.tsx` — sidebar entries: "File Complaint", "Form Engine"
- `src/integrations/supabase/types.ts` — auto-regenerated

## Order of execution
1. Migration (DB schema + bucket + RLS)
2. Seed Form 7 + Form 33 templates
3. Backend helpers (`formAutofill.ts`, `generateDynamicFormPdf.ts`)
4. Admin-Assisted Complaint Filing page + supporting components
5. Form Engine pages (list, editor, fill)
6. Wiring into `RegulatorComplaints` + sidebar + routes
7. Smoke test: file a complaint on behalf → request payment → generate Form 7 → attach PDF

---

This is a sizeable build (≈12 new files + 1 migration). Approve and I'll implement straight through; the existing complaint dashboard, payment, assignment, and scheduling flows will continue to work unchanged.
