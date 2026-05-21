## Problem

Admin "File Complaint" (menu → `/regulator/complaints/new`) is `ComplaintWizard.tsx`. The wizard starts with `complainantRole = "tenant"` and `targetTable = "complaints"`. A `useEffect` keeps `targetTable` in sync with `complainantRole`, **but only until `targetLocked` flips to true after the first insert**.

Two failure paths that match the bug:

1. **State staleness on first save** — if the user clicks the Save/Submit action before React's effect has flushed the `targetTable` update after switching role to Landlord, the closure can still hold the old value.
2. **More common path** — any silent/auto-draft creation that happens before the role selector is touched commits the row to `complaints` and then `targetLocked = true` permanently freezes it, even after the admin explicitly picks "landlord".

Database evidence confirms it: every admin-filed row with `complainant_role = 'landlord'` (10 of the last 10) actually lives in the `complaints` table, none in `landlord_complaints`.

The downstream split in `RegulatorComplaints.tsx` reads the two tables for the Tenant and Landlord tabs respectively, so a landlord complaint trapped in `complaints` is rendered under the Tenant tab — exactly what the user is reporting.

## Fix (frontend only, no DB changes)

Edit `src/pages/regulator/ComplaintWizard.tsx`:

1. **Derive the target table from `complainantRole` at the moment of the first insert**, not from a separate piece of state. Compute `const tableForInsert = complainantRole === "landlord" ? "landlord_complaints" : "complaints"` inside `saveDraft` right before the `INSERT`, and use it for that call.
2. After the first insert succeeds, persist `tableForInsert` as the locked `targetTable` (`setTargetTable(tableForInsert); setTargetLocked(true);`). This keeps later updates pointed at the correct table even if the admin changes the role afterwards.
3. Keep the existing hydration logic (`useEffect` on `draftId`) that picks the table from where the row was found — that path is already correct.
4. Keep the post-submit navigation hint (`tab=landlord` vs `tab=tenant`) deriving from the same `tableForInsert` / locked `targetTable`, so the redirect lands on the matching tab.

No changes to `AdminFileComplaint.tsx`, the finalize-payment edge function, or the Complaint Management tabs — those already branch on the table correctly. No migrations needed; existing mis-routed rows can be left alone or, if you want, moved later in a separate cleanup step (out of scope for this fix).

## Verification

- File a new complaint as admin with Complainant = Landlord → row should appear in `landlord_complaints`, show up under "Landlord Complaints" tab, and the post-submit redirect should land on `?tab=landlord`.
- File a new complaint as admin with Complainant = Tenant → row in `complaints`, "Tenant Complaints" tab, `?tab=tenant`.
- Re-opening an existing draft via `?draft=<id>` should still hydrate into the correct table (unchanged behaviour).
