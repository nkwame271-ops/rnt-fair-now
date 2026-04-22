
## Admin Complaints — audio fix, downloadable case, full receipts, staff assignment, scoping & reports

### 1. Audio recordings stop playing after a while — root cause + fix

`complaints.audio_url` and `landlord_complaints.audio_url` point at `https://…/storage/v1/object/public/application-evidence/...`, but the `application-evidence` bucket is **private** (`public = false`). The "public" URL only works while Supabase happens to honour it for the original uploader; for other users / sessions it eventually returns 400/401 — which presents exactly as "audio works for a while, then stops". Evidence images suffer the same issue.

Fix (no schema change to existing data):
- New helper `useSignedStorageUrl(url)` (in `src/hooks/useSignedStorageUrl.ts`): given any `…/object/public/<bucket>/<path>` or `…/object/<bucket>/<path>` URL pointing at `application-evidence`, parse out the path and call `supabase.storage.from("application-evidence").createSignedUrl(path, 3600)`. Returns a fresh signed URL and refreshes every ~50 min while the component is mounted.
- New `<SignedAudio src={url} />` and `<SignedImage src={url} />` wrappers using that hook.
- Replace the bare `<audio src={c.audio_url}>` and `<img src={url}>` in `RegulatorComplaints.tsx` (both tenant and landlord blocks), `LandlordComplaints.tsx` admin views, `RegulatorApplications.tsx`, `LandlordApplications.tsx`, and `FileComplaint` history view with the signed wrappers.
- Add a one-time backfill is **not** needed because we re-sign at render time — old rows continue to work.

### 2. Downloadable full complaint record (with description)

Add a "Download Complaint" button next to "Download Profile" in both tenant and landlord complaint cards. New helper `src/lib/generateComplaintPdf.ts` produces a one-page PDF with: complaint code + ticket #, filed date, status, payment status, complainant (name/phone/email), respondent name, property address + region + GPS, **full description**, evidence file list (URLs), audio file URL, fee basket items + totals, assigned staff + assignment history, and appointment details if scheduled. Uses the existing `jspdf` setup matching `generateProfilePdf.ts` style.

### 3. Receipt shows full breakdown of all charges billed

`PaymentReceipt.tsx` currently lists only escrow recipient splits. For `complaint_fee` receipts, also fetch and render the line-item breakdown from `complaint_basket_items` (label, kind, amount, IGF/Admin/Platform split per row) above the recipient splits. Update `RegulatorReceipts.tsx` to pass `complaintId` so the receipt component can pull basket items. Tenant `Receipts.tsx` and landlord `Receipts.tsx` get the same treatment so payers see what they were billed for.

### 4. Staff assignment + reassignment with history

New tables (migration):
```text
complaint_assignments
  id uuid pk
  complaint_id uuid not null
  complaint_table text check in ('complaints','landlord_complaints')
  assigned_to uuid not null            -- admin_staff.user_id
  assigned_by uuid not null
  assigned_at timestamptz default now()
  unassigned_at timestamptz null       -- null = current assignment
  reason text null
  unique (complaint_id, complaint_table) where unassigned_at is null  -- one active per complaint
```
RLS:
- Regulators read all.
- `is_main_admin` insert/update.
- A staff member reads their own rows.

UI in `RegulatorComplaints.tsx` complaint card (both tenant + landlord blocks):
- New "Assigned to" row showing current assignee name + office, plus a `Select` listing invited staff (`admin_staff` rows joined to `profiles.full_name`).
- Changing the select calls a small wrapper that closes any active assignment row (`unassigned_at = now()`) and inserts a new one — preserving full history.
- "View assignment history" collapsible lists prior assignees with timestamps and who reassigned.

### 5. Show payment status + assigned staff on the summary row

In the collapsed summary row (currently 6 columns), adjust to display:
- Payment status badge (already partly shown — make it a first-class column for both tabs).
- Assigned staff chip (`@FirstName · OfficeName`, or "Unassigned").

Same chips appear in the CSV export (new columns `Payment Status`, `Assigned Staff`).

### 6. Sub-admins / assigned staff see only their own complaints

`useAdminProfile` already exposes `isSuperAdmin` / `isMainAdmin`. Add an application-level filter in `fetchComplaints`/`fetchLandlordComplaints`:
- If user is **not** super/main admin: after the existing office-scope filter, also restrict to `complaint_id` ∈ (active `complaint_assignments.assigned_to = auth.uid()`).
- Done in two passes: first query `complaint_assignments` for current user's active assignments, then `.in("id", assignedIds)` on the complaints query (or skip entirely if zero).
- Also add a matching RLS policy on `complaint_assignments` so this query works under their grants.

This is application-layer (consistent with how `useAdminScope` already works); RLS still allows regulators to read all rows so reassignment/oversight from main admin is unaffected.

### 7. Full complaint + staff-assignment reports

New "Reports" button on `RegulatorComplaints.tsx` (visible to super/main admin only) opens a small dialog with date range + office filters and two export options:
- **Complaint report** — CSV/PDF of all complaints in scope: code, ticket, type, complainant, respondent, region, status, payment status, basket total, current assignee, filed date, resolved date, days open.
- **Staff assignment report** — grouped by assignee: total assigned, currently active, resolved, average time-to-resolution, reassignment count. Powered by `complaint_assignments` joined to `complaints`/`landlord_complaints`.

Implementation in `src/lib/generateComplaintReports.ts` (jspdf for PDF; plain CSV for spreadsheet).

### 8. Student complaints — visible only to Super Admin inside Rent Control

`RegulatorComplaints.tsx` already has a "Student Complaints" tab driven by `isStudentRow`. Gate that tab so it's only rendered when `profile?.isSuperAdmin === true`. For non-super admins:
- Hide the tab button.
- Filter student rows out of the Tenant tab as well (already done via `isStudentRow` split).
- The Student tab counter is hidden.

### 9. NUGS dashboard shows only student complaints

`NugsComplaints.tsx` relies on the existing RLS policy `"NUGS admins read student complaints"` which already filters to `tenants.is_student = true`. No code change needed beyond verifying the dashboard widget on `NugsDashboard.tsx` uses this same source (it does). Confirmed in scope — no change required other than a sanity pass.

---

### Files touched
- `src/hooks/useSignedStorageUrl.ts` *(new)*
- `src/components/SignedMedia.tsx` *(new — `SignedAudio`, `SignedImage`)*
- `src/lib/generateComplaintPdf.ts` *(new)*
- `src/lib/generateComplaintReports.ts` *(new)*
- `src/components/PaymentReceipt.tsx` — render basket items for `complaint_fee`
- `src/pages/regulator/RegulatorReceipts.tsx` — pass complaint id / basket
- `src/pages/tenant/Receipts.tsx`, `src/pages/landlord/Receipts.tsx` — same
- `src/pages/regulator/RegulatorComplaints.tsx` — assignment UI + payment/assignee in summary + Reports button + super-admin gate for Student tab + apply per-staff visibility
- `src/pages/regulator/RegulatorApplications.tsx`, `src/pages/landlord/LandlordApplications.tsx`, `src/pages/landlord/LandlordComplaints.tsx`, `src/pages/tenant/FileComplaint.tsx` — switch audio/image to signed wrappers
- Migration: create `complaint_assignments` table + RLS

### Out of scope / unchanged
- Audio capture/upload logic in `FileComplaint`/`LandlordComplaints` — only the rendering switches to signed URLs. Existing rows continue to work without backfill.
- Existing payment/escrow/scheduling flow.
- NUGS-side data scoping (already RLS-enforced).
