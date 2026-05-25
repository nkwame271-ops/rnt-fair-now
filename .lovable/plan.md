## Student Hostel Data Flow

Goal: capture a tiny amount of hostel context at signup (region + contact) without slowing registration, then let students fill in the rest later from their dashboard. This unlocks hostel tracking even for hostels not yet registered in the system.

### 1. Database (migration on `public.tenants`)

Add nullable columns — none break existing rows:

- `hostel_region` text
- `hostel_contact_number` text (normalized `233XXXXXXXXX`)
- `hostel_landlord_name` text
- `ghana_post_gps` text  (e.g. `GA-123-4567`)
- `hostel_location_lat` numeric
- `hostel_location_lng` numeric
- `hostel_location_address` text (formatted address from the map pin)

Update the existing `snapshot_student_residence` trigger's `OF` column list so changes to hostel/contact/location also append a snapshot to `student_residence_history` (the table already exists; we'll add matching nullable columns there for parity so history is meaningful).

### 2. Signup — `src/pages/RegisterTenant.tsx`

In the student branch (both mobile + desktop blocks where school/hostel inputs already live), add two required fields right after "Hostel / Hall":

- **Hostel Region** — `<Select>` with Ghana's 16 regions (reuse the constant already used elsewhere; fall back to a local list if none).
- **Hostel contact number (optional)** — phone input normalized via the existing `normalizePhone` helper. Label clearly states "if known"; not required so signup stays fast.

Persist alongside the existing `school` / `hostel_or_hall` insert at line ~169.

### 3. Student dashboard — Update Accommodation Details

Rename `UpdateResidenceDialog.tsx` trigger label to **"Update Accommodation Details"** and expand the form into two grouped sections:

**Accommodation**
- Hostel / Hall name (existing)
- Room number (existing `room_or_bed_space`, relabeled "Room number")
- Hostel contact number
- Landlord / Hostel manager name (if known)

**Location**
- Hostel region (Select)
- GhanaPostGPS (text, light validation `^[A-Z]{2}-\d{3}-\d{4}$`)
- Map pin — reuse the existing Google Maps Places autocomplete component used by property creation (loads `['places','visualization']` per project convention). Stores `address`, `lat`, `lng`.

Submit writes all fields to `tenants` in one update; the residence-history trigger captures the change. Keep the existing "Reason for change" textarea so history rows remain meaningful.

Mount point already exists in the Student Dashboard (the current `UpdateResidenceDialog` is rendered there) — only the dialog content + trigger label change, so no routing work needed.

### 4. Visibility / downstream

No regulator/NUGS UI changes in this pass — fields are additive and read-through. A follow-up can surface "hostel not yet registered" lists by grouping tenants on `hostel_or_hall + hostel_region` where no matching `properties` row exists.

### Files

- New migration: add 7 columns to `tenants` (+ mirror to `student_residence_history`) and update trigger column list.
- Edit: `src/pages/RegisterTenant.tsx` (student fields + insert payload).
- Edit: `src/components/student/UpdateResidenceDialog.tsx` (expanded form, region select, GPS, map pin, contact, landlord).

### Notes

- Region + contact at signup are kept minimal (1 select + 1 optional phone) to honour "fast data without making registration difficult".
- All new fields are nullable so existing students aren't blocked.
- Phone normalization and map loader follow existing project conventions (Core memory).
