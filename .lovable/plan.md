## Root-cause findings

1. **Beta Feedback / Contact emails** — The previous turn wired the forms to `send-notification`, but the underlying email queue infrastructure was never installed in this project: `email_send_log` table does not exist and the `enqueue_email` RPC call silently fails. Also, the configured email domain is `notify.hespariapartments.com` while `send-notification` is hardcoded to send from `notify.rentcontrolghana.com`. Result: every notification email is dropped.
2. **NUGS Rent Cards menu** — The flag `nugs_admin_rent_cards` exists (currently `is_enabled=false`) and `NugsLayout` already filters by it. After toggling on, the item appears. Likely user effect: cached `useAllFeatureFlags` not refetching after toggle without page reload.
3. **Agreement tenant placeholder** — `DeclareExistingTenancy` was patched to always populate `placeholder_tenant_name/phone`, and the `clear_placeholder_on_tenant_accept` trigger wipes them only when tenant accepts. Verified shipped. Needs a quick sanity test on the PDF generator (`generateAgreementPdf.ts`) to confirm it reads `placeholder_tenant_name` rather than `landlord_name` as a fallback.
4. **Rent card unlinking on tenancy delete** — Trigger `trg_unlink_rent_cards_on_tenancy_delete` is in place. `admin-action`'s `delete_existing_tenancy` performs a hard `DELETE`, so trigger fires. Already working.
5. **Rent increase lock** — DB triggers `prevent_unit_rent_unlock` / `prevent_property_rent_unlock` and `EditProperty` read-only field already shipped. Already working.
6. **Rent Reviews clickable property** — "Property" column with link to `/regulator/properties?focus=…` already shipped.
7. **Tax payment status** — Top-level "Pay All Advance Tax" toggles to confirmed panel; no further user reports require change unless polling delay still observed.

## Plan — focus on the only outstanding blockers

### A. Make Beta Feedback & Contact emails actually deliver

**Step 1 — Provision email infrastructure (one-time, idempotent)**
Call `email_domain--setup_email_infra` to create `email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens`, the pgmq queues (`auth_emails`, `transactional_emails`), the `enqueue_email` / `read_email_batch` / `delete_email` / `move_to_dlq` RPC wrappers, the vault secret, and the pg_cron `process-email-queue` job. Without this the existing `send-notification` enqueue path is a no-op.

**Step 2 — Add the project's own sender domain**
`rentcontrolghana.com` is the project's brand domain. The currently-configured domain (`notify.hespariapartments.com`) belongs to a different pilot. Open the email setup dialog so the user can add `notify.rentcontrolghana.com`, then the queue can render From-headers correctly.

**Step 3 — Make `send-notification` use the actual configured sender**
Read the active sender via the `email_domains` table (or hard-code it once the user picks one) instead of the hardcoded `notify.rentcontrolghana.com`. Redeploy the function.

**Step 4 — Default admin recipient**
Insert a single-row `system_settings` entry `admin_notify_email = 'info@rentcontrolghana.com'` (or whatever the user prefers). `RoleSelect.tsx` and `BetaFeedbackWidget.tsx` already pass that address — leave the call sites unchanged.

### B. NUGS Sub-Admin Rent Cards visibility refresh

Update `useAllFeatureFlags` (or `NugsLayout`'s consumer) to subscribe to `feature_flags` realtime changes (or refetch on focus) so toggling in Engine Room makes the menu appear without a hard refresh on the sub-admin's session. If realtime is too heavy, add a 60-second SWR refetch.

### C. Verification pass (no code changes unless a regression is found)

1. After step A completes, submit a contact form and a beta feedback entry → verify a row in `email_send_log` with `status='sent'` and the message in admin inbox.
2. Toggle `nugs_admin_rent_cards` ON in Engine Room, sign in as a NUGS sub-admin → menu item should appear (after refresh or within 60s).
3. Declare an existing tenancy with a tenant who has no account, view the agreement → tenant placeholder shows the captured tenant name (not the landlord). After tenant accepts in their portal → placeholder clears and live `tenant_user_id` name shows.
4. Delete an existing tenancy from Super Admin → confirm matching `rent_cards` reset to `status='valid'` (or `awaiting_serial`) and `tenancy_id IS NULL`.
5. Approve a rent increase request → confirm `units.monthly_rent` updates and any subsequent UI/SQL update attempt is rejected by the trigger.
6. Pay tax online via Paystack → confirm "Pay Tax Online" disappears and panel shows Paid / Tax Confirmed / Receipt Available within ~10s.

## Files / tools touched

- Tool: `email_domain--setup_email_infra` (creates DB infra)
- Tool: `email_domain--check_email_domain_status` (pre-check)
- Migration: insert `system_settings.admin_notify_email`
- Edited: `supabase/functions/send-notification/index.ts` (dynamic sender domain)
- Edited: `src/hooks/useFeatureFlag.ts` (refetch / realtime)
- No changes needed: `DeclareExistingTenancy.tsx`, `EditProperty.tsx`, `RegulatorRentReviews.tsx`, `Payments.tsx`, rent-card unlink trigger (already in place)

## Open question for the user

The configured email sender right now is `notify.hespariapartments.com`. To send Contact / Beta Feedback alerts from a RentControlGhana-branded address, we need to add `notify.rentcontrolghana.com`. Confirm before I open the email setup dialog, or tell me to keep the existing hespariapartments sender for now.

`notify.hespariapartments.com`.

&nbsp;

Not that `hespariapartments.com` is a totally different project don't mix with what's going on in our rent control 

&nbsp;