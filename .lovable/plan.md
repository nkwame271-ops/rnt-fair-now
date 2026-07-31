## Verified root causes

1. **Digital Rent Cards infinite loading** — `src/components/rentcards/DigitalRentCardView.tsx` line 67 uses `tmap` before it is declared (line 84). That throws a ReferenceError inside the async loader, so `setLoading(false)` never runs → permanent loader.
2. **Tenants see no rent cards** — `rent_cards` has policies for landlord (`landlord_user_id = auth.uid()`), regulator, NUGS admin and service role, but **no tenant SELECT policy**. Even after the crash fix, tenants get 0 rows.
3. **Premium dashboard stuck on "Awaiting agent assignment"** — all 3 `premium_subscriptions` rows *do* have `assigned_agent_user_id` set, but `agent_staff` only allows SELECT by admins or the agent themselves. The landlord's lookup returns nothing, so `agent` is null and the placeholder text renders.
4. **Cashbook** — `CashbookReport.tsx` caps at `.limit(1000)` and computes totals from those rows only; permissions come from a single policy `regulator OR is_main_admin`, so scoping is app-side only.
5. **Agent "Open Workspace"** — the button in `AgentAssignedProperties.tsx` / `AgentAssignedTenants.tsx` is literally `disabled`; no workspace route exists.

## Plan

### 1. Rent Cards
- Move the tenancy fetch above the `propIds`/`unitIds` computation in `DigitalRentCardView.tsx`; wrap the loader in try/finally so loading always ends and errors surface as a toast plus an error state.
- Show Property / Unit / Landlord / Tenant rows always (with a clear fallback), not only when present.
- Migration: add tenant SELECT policy on `rent_cards` — visible when `tenant_user_id = auth.uid()` **or** the card's `tenancy_id` belongs to a tenancy whose `tenant_user_id = auth.uid()` (covers cards not yet backfilled), via a security-definer helper to avoid recursion. Backfill `rent_cards.tenant_user_id`, `property_id`, `unit_id` from `tenancies` where null so every card resolves its property/unit/parties.

### 2. Premium Service dashboard
- Migration: add a `SECURITY DEFINER` function `get_assigned_agent_profile(subscription_id)` returning only non-sensitive agent fields (name, agent id, phone, email, photo, operating area, status), authorized to the subscription's subscriber or an admin. Use it in `PremiumServicePage.tsx` instead of querying `agent_staff` directly (no broad grant on `agent_staff`).
- Render the full card: agent photo, agent ID, phone, email, service status, subscription status, expiry date, managed property; keep Call / SMS / Request Service / Revoke / Request Change actions.
- Confirm `premium-service-request` writes a `management_task_assignments` row targeting the assigned agent so requests land in the agent dashboard task queue.
- Sensitive-data guard stays: `BlockAgentGuard` remains on payment settings, payout accounts, password/PIN and verified contacts routes; verify every such landlord route is wrapped.

### 3. Cashbook (inherit Escrow Ledger permissions)
- Migration: replace the cashbook SELECT policy with the same predicate the escrow ledger uses — super admin unscoped; other admin staff limited to their `office`; plus a `SECURITY DEFINER` aggregate function `cashbook_totals(filters)` so totals cover **all** visible rows, not just the first page.
- Update `CashbookReport.tsx`: server-side paginated fetch (page size 100, `range()` instead of `limit(1000)`), totals from the aggregate RPC, and label cards "Money In / Money Out / Net Balance / Reconciled" over the visible (permission-scoped) set rather than "visible page".

### 4. Agent workspace
- New route `/agent/workspace/:ownerUserId` with a page that verifies an active `agent_assignments` row for `(agent = auth.uid(), owner = :ownerUserId)` before rendering; enable the Open Workspace buttons to link there.
- Workspace surfaces approved landlord workflows for that landlord only: properties, tenants, rent collection, complaints, service requests — read/act scoped by `agent_can_act_on(agent, owner)`.
- Every agent action writes to `agent_action_log` (existing table); sensitive account settings are excluded from the workspace entirely.

## Technical notes
- Migrations needed: rent_cards tenant policy + backfill, `get_assigned_agent_profile`, cashbook policy + totals RPC, and (if missing) RLS predicates letting agents read assigned landlords' properties/tenancies through `agent_can_act_on`.
- No changes to `rent_cards` shape or escrow logic; scoping helper `useAdminScope()` is reused for the cashbook UI.
