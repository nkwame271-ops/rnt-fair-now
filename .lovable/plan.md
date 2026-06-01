# Landlord Management Support — Implementation Plan

A new operational layer where landlords can hand over day-to-day tenant interactions to platform staff, while still owning the property and receiving rent.

## 1. Data Model

**`properties` (extend)**
- `management_enabled` boolean default false
- `management_enabled_at` timestamptz
- `management_assigned_staff_id` uuid (admin_staff.user_id, nullable)
- `management_assigned_office_id` text (region/office routing)
- `management_notes` text

**`property_management_log`** (audit) — property_id, action (enabled/disabled/assigned/reassigned), actor_id, payload jsonb, created_at.

**`management_task_assignments`** — generic routing table for unit-of-work assignment:
- id, property_id, task_type (`viewing_request` | `tenant_onboarding` | `inquiry` | `compliance` | `rent_followup`), source_id (uuid of viewing_request / pending_tenant / inquiry), assigned_staff_id, status (`open|in_progress|done|reassigned`), assigned_at, completed_at, notes.

**Existing tables touched (foreign-key add):**
- `viewing_requests`, `pending_tenants`, `support_chats` (tenant-initiated property inquiries) — add `managed_by_platform` boolean (derived/cached) + `assigned_staff_id` uuid.

**RLS**
- Landlord: read/write own `properties.management_*` columns, read own task assignments (read-only).
- Tenant: never sees landlord contact when `management_enabled=true` — handled in API/views.
- Admin staff: read all managed properties; write only those assigned to them; super_admin/main_admin full access via `is_main_admin()`.
- Service role for routing triggers.

## 2. Landlord Portal

**`MyProperties.tsx`** — new "Management Support" card per property with:
- Toggle (on/off) — disabled if property has unresolved managed tasks
- Status badge ("Self-managed" / "Managed by Platform" amber)
- Helper text: "Platform handles tenant inquiries, viewings, onboarding, and compliance. You still receive rent."

**New page `LandlordManagementSupport.tsx`** (sidebar entry) — overview list of managed properties, current assigned office, open tasks count (read-only), rent settlement summary.

Landlord rent receipts unchanged — settlements still flow via existing `finalize-payment` splits.

## 3. Tenant-Facing Routing

When `properties.management_enabled = true`:
- **Marketplace listing** — hide landlord name/phone; show "Managed by Rent Control Ghana Platform" badge; CTA "Request Viewing" → routes to platform queue (no extra fee, existing GHS 2.00 viewing fee unchanged per memory).
- **Viewing request submission** — `viewing-request` edge function sets `assigned_staff_id` from `properties.management_assigned_staff_id` (fallback: office round-robin).
- **Inquiry / support chat** — `support_chats` created against platform staff, not landlord user.
- **Onboarding (AddTenant flow)** — when initiated for a managed property, route to platform; landlord notified read-only.
- **Compliance & complaints** — `complaints` linked to managed property cc the assigned staff.

A small shared helper `src/lib/managementRouting.ts` resolves recipient (`landlord_user_id` vs `assigned_staff_id`) for every tenant-facing surface.

## 4. Admin Portal — Property Management module

New top-level entry `regulator/PropertyManagement/`:

- **Overview** — KPI cards (Managed properties, Open viewings, Pending onboardings, Open inquiries, Compliance backlog).
- **Managed Properties** — table with filters (region, office, assigned staff, status), bulk assign action.
- **Assignment Console** — Super/Main Admin only: assign property → staff, bulk assign by region, reassign.
- **Task Queues** (tabs): Viewing Requests · Tenant Onboarding · Inquiries · Compliance · Rent Follow-ups. Each task row supports assign-to-staff and status updates.
- **Reports** — managed property reports (occupancy, revenue collected, time-to-respond per staff).

**Permissions** (extend `nugs_staff.permissions` pattern via new `admin_staff.permissions` keys):
- `property_management.view`
- `property_management.assign` (super/main admin only by default)
- `property_management.handle_viewings`
- `property_management.handle_onboarding`
- `property_management.handle_inquiries`
- `property_management.handle_compliance`

Use existing `resolve_feature_access()` infrastructure where applicable; otherwise straight permission check in RLS via `is_main_admin()` + admin_staff.permissions JSON.

## 5. Rent Payment Through Platform

Already partially supported by `paystack-checkout` (`rent_payment` / `rent_combined`). Changes:
- For managed properties, tenant rent payment UI in `MyAgreements.tsx` shows "Paid via Platform" badge; receipts unchanged.
- Add **Rent Follow-ups** queue: managed property + rent overdue ≥ N days → task auto-created via cron edge function or trigger.
- Existing splits/GRA tax/service fee engine all apply unchanged — landlord still gets `amount_to_landlord` in the split.

## 6. Edge Functions

- `assign-property-management` — toggle on/off, write audit log, optional auto-assign.
- `assign-management-task` — assign/reassign a task row, notify staff + landlord.
- `route-tenant-action` — shared helper invoked by viewing-request, support-chat-create, onboarding flows.

## 7. Out of Scope (this round)

- Landlord-billed management fee (rule: "tenants should not pay extra"). If platform wants to charge landlord, that's a follow-up via Service Fee engine with new `management_fee` payment_type.
- Mobile-app push notifications (use existing `notifications` + SMS routing).

## 8. Files to Create / Edit (high level)

- Migration (properties columns, new tables, RLS, permissions seed).
- `src/pages/landlord/LandlordManagementSupport.tsx` (new)
- `src/pages/landlord/MyProperties.tsx` (toggle UI)
- `src/pages/regulator/property-management/` (new folder: Overview, ManagedProperties, AssignmentConsole, TaskQueues, Reports)
- `src/lib/managementRouting.ts` (new shared helper)
- `src/components/layouts/*Sidebar.tsx` (nav entries — landlord + regulator)
- Edge functions: `assign-property-management/`, `assign-management-task/`, updates to `viewing-request*`, `support-chats*`, AddTenant invoke paths.
- Permission keys in `admin_staff.permissions` defaults.

After approval I'll deliver migration first, then frontend + edge functions in a single follow-up build.
