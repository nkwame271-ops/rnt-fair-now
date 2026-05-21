## Problem

`/regulator/complaints/new` opens the **Complaint Wizard** (`src/pages/regulator/ComplaintWizard.tsx`). Its "Complainant > Role" selector accepts `tenant | landlord | interested_person`, but every write path is hard-coded to the `complaints` table — which is the **tenant** queue in Complaint Management. As a result, a landlord-complainant case filed through the wizard is invisible in the Landlord Complaints tab and shows up (incorrectly) under Tenant Complaints once routed through the case file.

DB confirms the bug: multiple recent `complaints` rows have `filed_by_admin = true` and `complainant_role = 'landlord'`, which should never coexist.

`AdminFileComplaint.tsx` (`/regulator/complaints/new-simple`) already routes correctly by computing `targetTable = complainantRole === "landlord" ? "landlord_complaints" : "complaints"` and shaping the insert payload accordingly. The wizard must do the same.

## Fix (frontend only)

Update **`src/pages/regulator/ComplaintWizard.tsx`** so the chosen complainant role drives every read/write:

1. **Target-table state.** Add `const [targetTable, setTargetTable] = useState<"complaints" | "landlord_complaints">("complaints")`. Initial value derived from `complainantRole`. Locked in as soon as a draft row exists (so the user can't flip the role mid-flow and orphan the row). If the role is changed before any draft is saved, recompute `targetTable` from the new role.

2. **Hydration (the `useEffect` on `draftId`)** — try `landlord_complaints` first, fall back to `complaints`; set `targetTable` accordingly. Read placeholder/landlord fields from whichever table won.

3. **`buildPayload`** — split into two shaped payloads:
   - `complaints` (today's shape, unchanged) for tenant / interested-person complainant.
   - `landlord_complaints` shape: `landlord_user_id`, `placeholder_landlord_name/phone` for the complainant, `tenant_name` + `placeholder_respondent_name/phone` for the respondent. Mirrors the working block in `AdminFileComplaint.tsx` (lines 284–305).

4. **`saveDraft`** — `supabase.from(targetTable).insert(...)` / `.update(...)`. On first successful insert, lock `targetTable`. Witness sync (`complaint_witnesses`) is unchanged since it already keys on `case_id` + `case_kind = "complaint"` and both tables share that contract.

5. **`submitForReview`** — `supabase.from(targetTable).update({ status: "submitted" })`. `transitionStage` already accepts the case id; pass `case_kind: targetTable === "landlord_complaints" ? "landlord_complaint" : "complaint"` if the helper supports it (verify and keep current behaviour if not).

6. **Form 7 auto-generation** — only run when `targetTable === "complaints"` (matches `AdminFileComplaint.tsx`). Today the wizard's submit doesn't call it; leaving as-is is fine.

7. **Navigation after submit** — `navigate("/regulator/complaints?tab=" + (targetTable === "landlord_complaints" ? "landlord" : "tenant"))` so the officer lands directly on the tab where the case now lives.

## Out of scope

- The Tenant File-Complaint page (tenants can only file as tenant — no role choice).
- Landlord File-Complaint page (already constrained to landlord side).
- Backfilling the existing misrouted rows in `complaints` (separate cleanup; ask before mutating).
- `AdminFileComplaint.tsx` — already routes correctly.
- Database schema, RLS, edge functions, or Complaint Management list/tab queries.

## Files to edit

- `src/pages/regulator/ComplaintWizard.tsx` — all six changes above. No other files need touching.

## Verification

- Filing as **Tenant complainant** → row created in `complaints`, appears under **Tenant Complaints** tab. (Regression check.)
- Filing as **Landlord complainant** → row created in `landlord_complaints`, appears under **Landlord Complaints** tab, never in Tenant Complaints.
- Filing as **Interested Person** → stays in `complaints` (current behaviour preserved; no separate tab today).
- Re-opening an existing draft from either table rehydrates correctly and saves back to the same table.
