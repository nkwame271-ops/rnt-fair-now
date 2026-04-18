

## Plan — Student portal navigation + profile/ID uploads

### Issue 1 — Student dashboard "vanishes" when clicking nav items

**Root cause**: `NugsLayout` student nav points to `/tenant/marketplace`, `/tenant/file-complaint`, `/nugs/my-complaints`, `/tenant/profile`. The `/tenant/*` paths render under `TenantLayout`, so the NUGS sidebar disappears and the student loses access to "Update Residence" (which lives on the NUGS dashboard).

**Fix**: Mount the student-facing tenant pages *under* the `/nugs` shell so the sidebar stays put.

In `src/App.tsx`, inside the existing `/nugs` route block, add child routes that reuse the existing tenant page components:
- `/nugs/marketplace` → `<Marketplace />`
- `/nugs/file-complaint` → `<KycGate><FileComplaint /></KycGate>`
- `/nugs/profile` → `<ProfilePage />`

Update `NugsLayout.tsx` `studentNav` to point at these `/nugs/*` paths instead of `/tenant/*`. The dashboard's quick-action buttons in `NugsDashboard.tsx` get the same swap.

This automatically solves the "Hostels marketplace not visible" report — `Marketplace.tsx` already filters to `property_category = 'hostel'` when `is_student = true` (line 95). The student just couldn't see it because they were being kicked out of their portal.

### Issue 2 — Profile picture (all roles) + Student ID upload (students)

**DB migration** — add to `public.profiles`:
- `avatar_url text`
- `student_id_url text` (students only, but the column lives on profiles for simplicity)

**Storage**:
- Create public bucket `avatars` (file size 2 MB, image/* only). RLS: anyone can read; users can insert/update/delete only objects under `auth.uid()/...`.
- Reuse the existing private `identity-documents` bucket for the Student ID upload (same access pattern as Ghana Card). New folder convention: `{user_id}/student-id.{ext}`.

**UI in `src/pages/shared/ProfilePage.tsx`** (one component, all roles):
- New "Profile Picture" card at the top of Personal Information: shows current avatar (or initials), an Upload button using the standard input/file flow → `supabase.storage.from('avatars').upload(...)` → updates `profiles.avatar_url`. Visible to **all roles** (tenant, landlord, regulator, student).
- New "Student Verification" card, shown only when `tenant.is_student === true`: upload Student ID image/PDF to `identity-documents/{user_id}/student-id.{ext}`, save signed URL to `profiles.student_id_url`. Shows current document name + replace button. Sets `tenants.student_id_verified_at = now()` (new nullable timestamp column) once admin reviews.
- Header avatars (sidebars / nav) read `profiles.avatar_url`. Out of scope for this plan unless requested — just persisting it correctly is enough for now.

**Validation**: max 2 MB for avatars, 5 MB for Student ID, MIME-type checked client-side and rejected with a toast on failure.

### Files to change
- `src/App.tsx` — add 3 student child routes under `/nugs`
- `src/components/NugsLayout.tsx` — repoint `studentNav` to `/nugs/*`
- `src/pages/nugs/NugsDashboard.tsx` — quick-action buttons use `/nugs/*`
- `src/pages/shared/ProfilePage.tsx` — add Avatar + Student-ID upload cards
- New migration — `profiles.avatar_url`, `profiles.student_id_url`, `tenants.student_id_verified_at`, `avatars` bucket + RLS

### Out of scope
- Showing the avatar in sidebars/nav headers (separate pass).
- An admin "Verify Student ID" workflow on the NUGS portal (can be added next; for now the URL is captured and visible to NUGS admins from the existing student detail view).

