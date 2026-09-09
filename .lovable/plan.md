# Make the whole platform fast again

## What I measured just now (not guessed)

The database itself is healthy — up, no restarts, 25 of 60 connections in use, disk 23%, memory 66%, no stuck queries. So this is not a size problem. It is one avoidable pattern burning almost all the database's time:

- Reading the **hearing rooms** list (only **670 rows**) has been run **56,774 times**, averaging **141 ms** and peaking at **5.9 seconds** — **8,016 seconds** of database time in total, by far the biggest cost on the platform.
- Cause confirmed in the access rules: the hearing-rooms rule calls the office-permission check **once per row**. Counters prove it: hearing rooms shows **55,965 full-table sweeps reading 37.5 million rows**, and the permission check has driven **175 million** lookups on the staff table and **34 million** on the offices table.
- The same per-row permission pattern is attached to **8 other tables**: complaints, landlord complaints, escrow transactions, receipts, tenants, landlords. That is why complaint management, properties and escrow all feel frozen, and why everything else — including signing in — queues behind them.
- Several key tables have **never had their statistics collected** (hearing rooms, offices, staff, receipts, payout transfers all report 0 or 2 rows to the planner). With wrong row estimates the planner picks the worst possible plan, which is exactly what we see.
- Secondary load: the activity log now holds **147,761 rows** and each write averages **71 ms** across 2,726 writes; a repair sweep RPC (`detect_receipt_drift`) was running mid-check.

## What to change

### 1. Check office permissions once per query instead of once per row
Add a permission helper that returns the **list of offices a staff member may see** and rewrite the 9 access rules to match against that list. Same people see exactly the same data — but the check runs once per request instead of hundreds of times. This alone should turn the 141 ms average on hearing rooms into single-digit milliseconds and free the database for everything else, sign-ins included.

Rules to rewrite: hearing rooms, complaints (read + update), landlord complaints (read + update), escrow transactions, receipts, tenants, landlords.

### 2. Collect statistics and keep them fresh
Run statistics collection on the affected tables and lower the auto-collection threshold on the small, heavily-read reference tables so the planner stops guessing.

### 3. Stop refetching the same reference lists
The shared 5-minute cache already exists for staff and hearing rooms; extend it to the remaining screens that still request the full hearing-room and staff lists per row/per open (complaint management and case assignment paths), and load rooms scoped to the case's office rather than all 670.

### 4. Trim the activity log
Index it for its actual read pattern and archive/prune entries older than 90 days, so every admin click stops paying for a 148k-row table.

### 5. Verify, then confirm
After applying: re-check the hearing-room, complaint and escrow query timings, confirm a scoped officer still sees only their own offices' rooms and cases, and confirm a super admin still sees everything.

## Technical detail

- New `public.admin_accessible_office_ids(_user_id uuid)` — `stable security definer`, `search_path = public` — returning `text[]` from `admin_staff` + `offices` (ALL_REGIONS → all office ids, SPECIFIC_REGION_ALL_OFFICES → region's offices, SPECIFIC_OFFICES → `office_ids`). Policies become `office_id = ANY (public.admin_accessible_office_ids(auth.uid()))` so it evaluates as a one-time InitPlan. Keep `admin_can_access_office()` in place for any non-policy callers.
- `ANALYZE` on `hearing_rooms, offices, admin_staff, payment_receipts, payout_transfers, units, tenants, landlord_complaints, complaints, escrow_transactions`; `ALTER TABLE ... SET (autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 50)` on the small reference tables.
- `src/lib/adminDirectory.ts`: add an office-scoped `fetchHearingRooms(officeId)` variant; use it in `ComplaintAssignmentControl`, `ScheduleComplainantDialog`, `AppointmentSlotPicker` and the complaint workspace instead of the full list.
- `admin_activity_log`: `create index if not exists idx_admin_activity_log_user_created on public.admin_activity_log(user_id, created_at desc)`; prune rows older than 90 days and add that prune to the existing cron cadence.
- No feature or permission changes for landlords, tenants, agents or regulators.
