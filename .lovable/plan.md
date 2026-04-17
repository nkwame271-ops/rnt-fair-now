

## Plan — Hostel/Hall Property Model + Landlord "My Tenants" View

### Current state (verified)
- `properties.category` already exists (residential/commercial/hostel etc.).
- `units` table is the single tenant slot model — one row per rentable space.
- `tenancies.unit_id` ties a tenant to one unit.
- `RegisterProperty.tsx` collects units as a flat list with `unit_type/monthly_rent/...`.
- No room/bed-space hierarchy exists; no landlord "My Tenants" page (only `MyProperties`).

### Approach: model bed-spaces as units (no schema fork)

To keep tenancies, rent cards, complaints, payments, and compliance scoring working **unchanged**, every bed space is stored as a `units` row. We only add light metadata to group them under rooms and categories. This avoids a parallel schema and means students get individual tenancies/rent-card pairs/complaints automatically — they already do, per unit.

### Schema changes (1 migration)

1. New table `public.hostel_room_categories`:
   - `id uuid pk`, `property_id uuid fk`, `label text` (e.g. "4-in-room"), `capacity_per_room int`, `room_count int`, `monthly_rent numeric` (per bed), `created_at`.
2. New table `public.hostel_rooms`:
   - `id uuid pk`, `property_id uuid fk`, `category_id uuid fk`, `block_label text` (e.g. "Block A"), `room_number text` (e.g. "001"), `capacity int`, unique(`property_id`, `block_label`, `room_number`).
3. Add columns to `public.units`:
   - `hostel_room_id uuid` nullable fk → `hostel_rooms.id`
   - `bed_label text` nullable (e.g. "Bed 2")
   - `unit_kind text default 'standard'` (`'standard' | 'bed_space'`)
   - Partial unique index on (`hostel_room_id`, `bed_label`) where `hostel_room_id is not null` — prevents duplicate beds.
4. **Capacity enforcement trigger** on `units` insert: when `hostel_room_id` is set, count existing beds for that room and reject if it would exceed `hostel_rooms.capacity`. Also trigger on `tenancies` insert: confirm target unit's `status != 'occupied'` (already enforced elsewhere; we just confirm it covers bed-spaces).
5. RLS: mirror existing `properties`/`units` policies (landlord owner read/write; admins all).

### Code changes

**`src/pages/landlord/RegisterProperty.tsx`** — branch when `category === 'hostel' || 'hall'`:
- Replace flat units list with a "Room Categories" builder:
  - rows of `{ label, room_count, capacity_per_room, monthly_rent, block_label? }`
  - Live preview: total rooms = sum, total beds = sum(room_count × capacity).
- On submit (hostel branch):
  1. Insert property row.
  2. For each category → insert `hostel_room_categories`.
  3. Generate rooms (`Block A – Room 001…`) → insert `hostel_rooms`.
  4. For each room generate N bed `units` rows (`bed_label = 'Bed 1'…`, `unit_kind='bed_space'`, `monthly_rent` from category).
  - Wrap in a single edge-function call OR sequential client inserts inside a `Promise.all` per category for speed.

**`src/pages/landlord/MyProperties.tsx`** — when property is hostel, show "X rooms · Y beds (Z occupied)" instead of unit count.

**New page `src/pages/landlord/MyTenants.tsx`** — landlord-scoped tenant directory:
- Query: `tenancies` join `tenants` join `units` join `hostel_rooms` (left) join `properties`, filtered by `landlord_user_id`.
- Columns: Tenant name, phone, property, room (if hostel), bed, status, rent, start/expiry, ticket count.
- Filters: text search (name/phone), property dropdown, room number (when a hostel property is selected), status.
- Row action: link to existing tenancy detail / message / complaints.
- Add to landlord sidebar in `LandlordLayout.tsx` and to command palette.

**Tenant assignment flow (`AddTenant.tsx`)** — already picks a unit; for hostel properties, group the unit picker by Block → Room → Bed and hide rooms with no available beds. Capacity is enforced automatically because each bed is a unit and `units.status='occupied'` blocks reuse.

**`src/components/PropertyMap.tsx` / verification pages** — display block/room/bed when present (read-only, optional polish).

### What stays untouched
Tenancies, rent cards (1:2 pair per tenant — works per bed), complaints, payments, escrow splits, compliance scoring, RLS on existing tables, NUGS portal, all other portals.

### Verification
1. Landlord registers hostel property → defines 1-in-room (10), 2-in-room (5), 4-in-room (3) → system creates 18 rooms and 32 beds (10+10+12).
2. Landlord assigns 5 students to a 4-in-room → 5th attempt blocked by trigger.
3. Each student receives their own tenancy agreement and rent card pair (existing flow, no change).
4. Each student can file independent complaints (existing flow).
5. Landlord opens **My Tenants** → sees all 32+ tenants, filters by room "001" → only that room's beds.
6. Standard residential properties continue to use the flat unit form (no regression).

### Files touched
- 1 migration (3 new objects + columns + trigger)
- `src/pages/landlord/RegisterProperty.tsx`
- `src/pages/landlord/MyProperties.tsx`
- `src/pages/landlord/AddTenant.tsx`
- `src/components/LandlordLayout.tsx`
- `src/components/CommandSearch.tsx` (palette entry)
- New: `src/pages/landlord/MyTenants.tsx`
- `src/App.tsx` (route)

