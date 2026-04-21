
## Keep students inside the NUGS portal + split residence updater out of overview

### Problem
Students log into `/nugs/*` (NUGS portal with student-themed sidebar, header, and identity). But several actions silently kick them back into the regular `/tenant/*` portal, which loads `TenantLayout` and the generic Tenant Dashboard — wiping the student framing (Student ID, school, hostel/hall, room).

Also: the "Update Residence" dialog is currently embedded inside the student info overview card, which mixes a write action into a read-only summary.

### Fix 1 — Stop kicking students back to the tenant portal

`src/pages/tenant/FileComplaint.tsx` (line ~343): after a successful complaint submission, hard-redirects to `/tenant/my-cases`. When a student lands here via `/nugs/file-complaint`, they get bounced into the tenant portal.

Change: detect the current portal from the URL and redirect within the same portal:
```ts
const inNugs = window.location.pathname.startsWith("/nugs");
navigate(inNugs ? "/nugs/my-complaints" : "/tenant/my-cases");
```

No other tenant pages currently link out of `/nugs` — `Marketplace.tsx` keeps the user on whatever route they came in on (no cross-portal navigation), so it stays as-is, matching your note.

### Fix 2 — Make the student dashboard identity persistent in headers

`src/components/NugsLayout.tsx` header currently shows just `"NUGS Student"`. To reinforce student identity across every page (not only the dashboard), show the student's school + hostel chip in the top header for student users.

- Fetch `tenants.school` and `tenants.hostel_or_hall` once at the layout level for student users.
- Render next to the title in the header as a small chip: e.g. `University of Ghana · Volta Hall`. Hidden on very small screens, visible from `sm:` up.

This way, even when a student opens File Complaint, My Complaints, Profile, or Hostel Listings, the header still confirms they're in the student portal with their context attached.

### Fix 3 — Split "Update Hostel Accommodation" out of the overview card

`src/pages/nugs/NugsDashboard.tsx` `<StudentView>`:

- Remove `<UpdateResidenceDialog>` from the student info card. Also remove the inline "View residence history" collapsible from inside that card.
- The student info card becomes purely read-only: Student ID, Institution, Hostel/Hall, Room/Bed.
- Add a new dedicated section directly below it titled **"Hostel Accommodation"** with its own card:
  - Heading + brief description ("Update your school, hostel, or room. Previous records are kept in your residence history.")
  - The `<UpdateResidenceDialog>` trigger button (primary action).
  - A "View residence history" collapsible showing `<StudentResidenceTrail>`.

### Files touched
- `src/pages/tenant/FileComplaint.tsx` — portal-aware redirect after submit.
- `src/components/NugsLayout.tsx` — fetch + display student context chip in header.
- `src/pages/nugs/NugsDashboard.tsx` — extract Update Residence + history into its own section below the overview card.

### Out of scope (unchanged)
- Marketplace (works correctly as you noted).
- Admin (`nugs_admin`) view.
- Routing config in `App.tsx` — `/nugs/file-complaint` and `/nugs/marketplace` already render under `NugsLayout`.
- KYC, payments, RLS, schema.
