# Master Plan: Student Hostel App Feature Parity

Ship this in phased migrations. Each phase is independently deployable. Total scope is large — expect 6–10 build turns.

## Phase 1 — Agent Program (Foundation)

**Public entry**
- Add "Become an agent" link to the public site nav (footer + header) alongside "Regulator", "Get the app", etc.
- New public page `/agent/register` with a shield-icon hero and the same form shown in your reference: professional photo upload, full name, phone, email, DOB, ID type, ID number, region, operating area, residential address, emergency contact, supporting docs. Uses the light theme + Plus Jakarta Sans already in the app.

**Auth model** — Separate agent account (per your choice).
- New `agent_staff` table (mirrors `nugs_staff`), tied to `auth.users` but distinct from tenant/landlord role. A single email cannot also be tenant/landlord.
- New `agent_applications` table for pending/approved/rejected registrations with reviewer, notes, and documents (Supabase storage bucket `agent-documents`).
- On approval: create auth user + `agent_staff` row + assign `agent` app_role in `user_roles`.

**Agent Portal** at `/agent/*`
- `AgentLayout` matching the "Premium Service Agent Portal" screenshot: hamburger, shield-with-check logo, dark-mode toggle.
- Dashboard: Welcome card + 3 stat cards (Assigned Hostels/Landlords, Assigned Students/Tenants, Pending Tasks) + Getting Started card.
- Sub-pages: Assigned Properties, Assigned Tenants, Pending Tasks, Activity log, Profile.

**Delegated actions (not impersonation)** — per your choice.
- Agents call scoped RPCs (`agent_list_assigned_properties`, `agent_create_inspection`, `agent_send_reminder`, `agent_upload_report`, `agent_message_party`, `agent_complete_task`, etc.) that check the agent–owner assignment before every write.
- Every write inserts a row into `agent_action_log` (agent_id, target_user_id, target_table, target_id, action, payload, timestamp) — visible to the account owner and Super Admin.

**Admin review**
- Super/main admin screen `/regulator/agents` with list of pending applications, approve/reject with notes, view identity docs, and manage assignments (link agent ↔ landlord/tenant).

## Phase 2 — NAFLIS Wallet (Ledger + rails)

**Ledger** (single source of truth)
- Tables: `wallets` (one per user, holds cached balances), `wallet_entries` (double-entry: debits/credits, no updates ever), `wallet_holds` (escrow/reserved/disputed), `wallet_payout_accounts` (mobile-money + bank), `wallet_settings` per user.
- Derived buckets displayed in UI: Available, Rent Escrow, Pending, Reserved/Disputed, Total Received, Total Withdrawn.
- Automatic receipt generation on every completed entry (reuses `payment_receipts`).
- Monthly wallet fee deducted by scheduled job into platform escrow.

**Rails** (new — you asked for MoMo/bank in addition to ledger)
- Add-money: extend the existing Paystack checkout to top up a wallet balance instead of an invoice.
- Withdraw: new `wallet-withdraw` edge function that calls Paystack Transfers API (mobile-money + bank) with recipient-code caching.
- QR payments + payment links: `/pay/{link_id}` public route that opens the same branded checkout, credits the recipient's wallet.
- Linked accounts: verification via Paystack `/bank/resolve` and MoMo lookup before saving.

**Surfaces**: `/tenant/wallet`, `/landlord/wallet`, `/agent/wallet` (agent's own; assigned users' wallets remain view-only through delegation).

## Phase 3 — Digital Rent Cards for Tenant + Landlord

- Reuse the existing NUGS `rent_cards` + QR system. Add `/tenant/rent-cards` and `/landlord/rent-cards` (Landlord Copy variant) rendered with the same red-header design.
- Live payment record table beneath the card is fed directly by `payment_receipts` + `rent_payments`, so tenant and landlord see identical rows.
- QR verification stays public at existing `/verify/rent-card/:token`.

## Phase 4 — Property Assessments

- New tables: `property_assessment_applications`, `property_assessment_inspections`, `property_assessment_certificates` (QR-verified, renewable).
- Landlord flow: apply → pay fee (through wallet or Paystack) → inspection scheduled → officer marks pass/fail → certificate + downloadable card issued → renewal reminder job.
- Tenant flow: request assessment for a property (feeds landlord's queue).

## Phase 5 — Drug Abuse & Safety Reporting

- Add `drug_abuse` category to existing `safety_reports.category` enum.
- New unified `/report/safety` form supporting: current GPS (existing hook), map pin, written directions, nearest landmark, "unknown location" toggle, person involved, description, date/time, photo/video upload (buckets exist), anonymous flag.

## Phase 6 — Profile Photo Rollout

- Profile photo already lives in `profiles.avatar_url`. Wire it into the header of Tenant, Landlord, and Agent dashboards using the same avatar upload widget used in Agent Registration.

## Phase 7 — Platform Escrow Dashboard (Super Admin only)

- New page `/super-admin/platform-escrow` showing: Premium Service fees (from agent contracts), Wallet fees, Rent-management deductions, Maintenance deductions, Agent payouts, Other platform charges — sourced from `escrow_splits` filtered to platform recipient.
- RLS ensures only `is_super_admin()` can read; hidden from every other role and from the existing office reconciliation reports.

## Phase 8 — Rent Collection for Landlords

- Consolidate existing `rent_payments`, `payment_receipts`, `escrow_splits`, wallet credits into a single `/landlord/rent-collection` workspace: rent records, payment status, receipts, escrow balances, wallet credits, linked tenants/properties, outstanding balances, payment history — following the hostel-owner module layout.

## Design system (applies to all phases)

Keep the existing light theme + primary `hsl(152, 55%, 28%)`. Reuse existing components: rounded cards, gradient page backgrounds (peach/rose/mint wash visible in your screenshots is already in the app), status badges (Active/Pending/Valid/Expired), soft borders, FAB (already exists), CommandSearch, LogoLoader.

## Technical notes

- Delegated-actions pattern uses SECURITY DEFINER RPCs that verify `EXISTS (SELECT 1 FROM agent_assignments WHERE agent_id = auth.uid() AND owner_user_id = <target>)` before any write. No JWT swap, no impersonation session.
- All new public-schema tables ship with `GRANT` statements and RLS in the same migration.
- Wallet money-in continues to go through the existing `paystack-checkout` + `verify-payment` + `finalize-payment` pipeline (which we've been hardening). Money-out (Withdraw, agent payouts) is a new `wallet-withdraw` edge function calling Paystack Transfers.
- Rent card / receipt tables are reused, not duplicated, so tenant + landlord + NUGS all see the same records.

## Sequencing

I'll implement Phase 1 first and stop for your review before starting Phase 2. Phases 2 and 8 are the biggest; Phases 3, 5, 6 are quick. Phase 4 and 7 are medium.
