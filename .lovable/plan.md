## Problem

QR codes printed on Forms 7 and 33 point to `https://www.rentcontrolghana.com/verify/form/<CODE>`. The codes ARE saved correctly in `complaint_documents.verification_code` (confirmed in DB — e.g. `EUBHGUZY`, `BU944HHM`, `VUQL3E9S`, etc.). But the verify page reads the table directly from the browser, and `complaint_documents` RLS only permits `admin_staff` rows. Anyone scanning the QR is anonymous, so the SELECT returns zero rows and the page shows "Verification failed. Document not found." The same RLS gate blocks the case-context lookup on `complaints` / `landlord_complaints`.

## Fix

Add a tiny public edge function that takes a verification code, looks the document up with the service-role key, and returns a sanitized payload (document metadata + case context). Point `VerifyForm.tsx` at the function instead of querying tables directly.

## Steps

1. **New edge function** `supabase/functions/verify-form/index.ts`
   - Accepts `GET ?code=XYZ` or `POST { code }`.
   - Uses `SUPABASE_SERVICE_ROLE_KEY` to:
     - Look up `complaint_documents` by `verification_code` (uppercased) — return 404 if missing.
     - Look up the linked row from `complaints` or `landlord_complaints` (based on `case_kind`) selecting only the fields the page already shows.
     - Look up `cases.case_number` via `related_complaint_id`.
   - Returns `{ doc, caseCtx }` with only the fields VerifyForm renders.
   - Standard CORS headers; no JWT verification needed (config: `verify_jwt = false`).

2. **`supabase/config.toml`** — add a `[functions.verify-form]` block with `verify_jwt = false` so anonymous QR scans work.

3. **`src/pages/shared/VerifyForm.tsx`** — replace the two direct `supabase.from(...)` calls with `supabase.functions.invoke("verify-form", { body: { code } })`. Keep all existing UI / fallbacks.

## Out of scope

- No changes to the PDF rendering, QR generation, code format, or the admin editor flow.
- No RLS changes on `complaint_documents` (keeps admin-only direct access intact).
