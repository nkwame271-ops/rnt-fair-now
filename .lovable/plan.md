## Goal

Make Form 7, Form 33 (and Form 32A) generate as **official Rent Control branded legal documents** — not field lists — with a per-complaint editable Form Editor and full version history attached to every complaint record.

## What's broken today

- "Generate Form 7" runs silently from complaint data with no editor — admin can't fix names, narrative, hearing details, signature block, etc. before the PDF is produced.
- Form 33 is only triggered when a hearing is scheduled; no manual "Generate Form 33" entry-point inside the complaint record.
- The Form Engine's generic field-list renderer still gets used for some statutory forms — output looks like a key/value dump, not the legal template in the references.
- No support for Form 32A at all.
- Documents tab shows generated PDFs but lacks Preview / Regenerate / per-version actions and a clean "Complaint Documents" hub with the four canonical downloads (Profile, Form 7, Form 33, Form 32A).

## Scope

Frontend + PDF generators + a tiny schema add. No workflow / RLS / notification changes.

### 1. Documents hub on the complaint record

Replace the current Documents tab with a sectioned hub:

```text
Documents
├─ Quick downloads
│   • Download Complaint Profile
│   • Generate / Regenerate Form 7
│   • Generate / Regenerate Form 33
│   • Generate / Regenerate Form 32A
└─ Generated documents (versioned list)
    Form 7  v3  [Preview] [Download] [Regenerate] [History]
    Form 33 v1  …
    Form 32A v2 …
```

Each "Generate …" button opens the **Form Editor modal** for that form. Each existing version exposes Preview (signed URL in a dialog), Download, Regenerate (re-opens editor pre-filled from the latest version's `form_data_json`), and History (lists previous versions with download links).

### 2. Form Editor (modal, one per form)

Full-screen `Dialog` titled "Form 7", "Form 33" or "Form 32A".

Layout: **left = editable fields, right = live PDF preview** (re-uses the form's renderer to a data-URI iframe; same pattern as `Form7LivePreview`).

Editable variables:

- Form 7: case reference, case number, complainant name + postal address + telephone, respondent name/address (multi), tenant name, landlord name, premises address + house number, complaint category, **complaint statement (textarea, prefilled but fully editable)**, signature name, signature date, stamp text, rent office, footer slogan.
- Form 33: case prefix ("CA"), case number, "complainants VRS respondent" line, rent office, rent officer, person summoned (To:), complaint category (bold/underlined), hearing time, hearing date, hearing venue, **summons paragraph (textarea, fully editable with sensible default body)**, issued office, issued date.
- Form 32A: case number, parties, complainant/respondent particulars, hearing reference, decision/order body (textarea), issued office, issued date, signature name.

Save flow:
- "Save Draft" → upserts `complaint_documents` row with `status='draft'`, `form_data_json` = current editor state, no PDF.
- "Generate" → renders PDF via the form-specific renderer, uploads to `form-outputs/complaints/{caseId}/form-{n}-v{ver}.pdf`, inserts a new `complaint_documents` row (`status='finalized'`, `version_number = max+1`, `form_data_json` saved alongside) and closes.

### 3. Official document templates (PDF generators)

All three render legal-document layouts, never field lists.

- `src/lib/pdf/form7.ts` — rewritten to match the reference image: REPUBLIC OF GHANA header strip with Rent Control logo + faint diagonal watermark, centered `FORM 7`, heading, legal references (`Rent Regulation 13` / `Rent Regulation, 1964 (LI 369)`), the six numbered fields, narrative paragraph block, right-aligned signature + date area, stamp box, centered footer "We Promote Peace & Reconcile Parties".
- `src/lib/pdf/form33.ts` — rewritten: top-left `CA <case number>`, top-right `<complainants> VRS <respondent>`, horizontal rule, centered `FORM 33`, heading, legal refs, "Rent Officer for <office>" + "To: <name>" block, "Whereas your attendance is necessary…" intro, centered bold-underlined complaint category, summons paragraph (uses editor's body verbatim), Issue line, centered stamp + signature area, watermark.
- `src/lib/pdf/form32a.ts` — new, same branded shell as Form 33 with the decision/order body.

Shared helpers in `src/lib/pdf/_brand.ts`: header strip, watermark, footer, signature/stamp box, A4 layout primitives — so the three forms look identical in chrome.

Logo: import `public/placeholder.svg` for now if no real Rent Control mark is bundled; rendered into the PDF as a small image via jsPDF (`addImage`). Watermark is the same image at 0.06 alpha rotated 30°.

### 4. Template routing

`complaint_documents.form_type` already exists (`form_7` / `form_33`; add `form_32a`). The Documents hub and Form Editor call the per-form renderer directly — the generic `generateDynamicFormPdf` is bypassed for these three form types. Existing `form_templates` rows are ignored for Form 7/33/32A.

### 5. Data model

Migration only adds what's missing:

- `complaint_documents.form_data_json jsonb` (nullable) — stores the exact editor state used to render this version, so Regenerate can pre-fill from any past version.
- Allow `'form_32a'` in any existing CHECK on `form_type` (drop+recreate the constraint if present, otherwise no-op).
- `complaint_documents.document_title text` already covered by existing `title` — reuse.

No new tables, no RLS changes (existing policies already cover insert/select for admins on complaint_documents).

### 6. Files

- **Created**
  - `src/lib/pdf/_brand.ts` — branded chrome (header, footer, watermark, signature block)
  - `src/lib/pdf/form32a.ts`
  - `src/components/regulator/FormEditorDialog.tsx` — generic editor shell + per-form field sets + live preview
  - `src/components/regulator/ComplaintDocumentsHub.tsx` — the new Documents tab content
- **Rewritten**
  - `src/lib/pdf/form7.ts` (legal-document layout, branding, narrative paragraph)
  - `src/lib/pdf/form33.ts` (CA header, VRS line, branded chrome, editable summons body)
  - `src/lib/complaintForms.ts` (accept `form_data_json` from editor; insert with that JSON; support form_32a)
- **Updated**
  - `src/pages/regulator/ComplaintCaseFile.tsx` — Documents tab swapped for `ComplaintDocumentsHub`
- **Migration** — `complaint_documents.form_data_json` + form_type CHECK extension
