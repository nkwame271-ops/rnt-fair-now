You’re right to call this out. I verified the current state instead of assuming, and several items are only partially done or wired incorrectly. Here is the implementation plan I will follow.

## Confirmed current problems

- **Engine Room is partial**
  - Backend feature rows exist for `naflis_wallet`, `property_assessment`, `premium_service_subscription`, and `agent_application_fee`, but Engine Room labels/mappings do not fully expose the new fee types in the payment UI (`src/pages/regulator/EngineRoom.tsx:69-87`, `1367-1380`).
  - Advanced configuration UI exists for fee type, billing frequency, destination, expiry, renewal, grace and split (`src/components/FeatureAdvancedDialog.tsx`), but the new features are not consistently surfaced in the right menus.

- **Cashbook scope/totals are not robust enough**
  - Cashbook applies office filtering in the frontend and then calculates totals from the loaded array (`src/components/regulator/CashbookReport.tsx:55-67`, `100-108`). It also loads up to 1000 records before local filtering.
  - Escrow Transaction Explorer currently loads counts/list without matching office scoping and limits the list to 200 (`src/components/regulator/TransactionExplorer.tsx:42-73`).

- **Agent paywall exists, but lifecycle/assignment is incomplete**
  - Agent registration already creates `awaiting_payment` rows and invokes `agent-apply-checkout` (`src/pages/agent/AgentRegister.tsx:133-166`, `198-245`).
  - Admin agent management only handles approve/reject application review; it does not yet provide full agent profile lifecycle, permissions, reports, activity, suspend/revoke/reactivate controls (`src/pages/regulator/AgentApplications.tsx:29-47`, `127-143`).
  - Property Management currently manages generic platform staff assignment, not a Premium Service active-paid subscription view assigning approved agents (`src/pages/regulator/RegulatorPropertyManagement.tsx:87-153`).

- **Complaint case number assignment is incomplete**
  - Form 33 assigns a CAR number when missing (`src/lib/complaintForms.ts:320-338`).
  - Form 7 does not assign one; it only prints an existing `case_number` (`src/lib/complaintForms.ts:314-318`, `78-89`). That can create blanks/mismatches when Form 7 is generated first.

- **Rent card linking still has a real bug**
  - The component fetches tenancy data, but property/unit display still reads `c.property_id` and `c.unit_id` from the rent card row instead of falling back to the tenancy’s `property_id` and `unit_id` (`src/components/rentcards/DigitalRentCardView.tsx:70-78`, `107-117`).

- **Checkout email fallback is suspect**
  - Assessment and Premium checkout read email from auth claims, then fall back to `profiles.eq("id", user.id)` (`supabase/functions/assessment-checkout/index.ts:80-85`, `supabase/functions/premium-checkout/index.ts:59-64`). Other app code generally reads profiles by `user_id`, so this can fail and pass no/invalid email to checkout.
  - Wallet top-up has similar email fallback behavior (`supabase/functions/wallet-topup/index.ts:45-56`).

- **Agreement workflow is still too fragile**
  - Tenant dashboard auto-links existing tenancies client-side by phone (`src/pages/tenant/MyAgreements.tsx:89-112`), but this should be server-side/consistent and notify the tenant.
  - Add Tenant creates a pending tenancy with landlord accepted and tenant not accepted (`src/pages/landlord/AddTenant.tsx:328-345`), but the assignment/notification/final validation path needs to be hardened.

- **Developer pages use broad selects**
  - Developer Accounts and API Access Requests use `select("*")` (`src/pages/regulator/DeveloperAccounts.tsx:48-51`, `src/pages/regulator/ApiAccessRequests.tsx:32-35`). Even if no password column is currently rendered, this is unsafe; these pages should select only safe fields and never expose credentials.

## Implementation plan

### 1. Engine Room completion
- Add the missing payment type labels and feature menu grouping for:
  - NAFLIS Wallet / wallet top-up
  - Property Assessment
  - Premium Service subscription
  - Agent application fee
- Ensure these features appear under the correct Tenant/Landlord/Admin menus and under **Platform Fees** where applicable.
- Wire each applicable row to the existing advanced settings dialog so fee type, percentage, billing frequency, expiry, renewal/grace and revenue split can be configured.
- Add/repair split configuration seed data for the new payment types so revenue routing is manageable from Engine Room.

### 2. Checkout “Invalid Email Address Passed” fix
- Patch `assessment-checkout`, `premium-checkout`, and `wallet-topup` to resolve payer email in this order:
  1. Valid auth claim email
  2. Auth user email from backend auth lookup
  3. Profile email by `user_id`
  4. For wallet payment links only, validated `payer_email`
- Validate the final email format before calling the payment processor and return a clear app error if missing.
- Deploy and test all three functions.

### 3. Complaint Forms 7/33 case numbering
- Add one shared case-number assignment helper used by Form 7, Form 33, receipts, documents and notifications.
- Assign the number once, store it on the complaint record, and reuse it everywhere.
- Make the CAR prefix configurable through Engine Room/platform config.
- Update Form 7 generation so it creates/uses the same case number before rendering.
- Ensure Form 33 continues using the existing complaint case number instead of issuing a second one.

### 4. Digital Rent Cards linking
- Fix rent card enrichment to fall back to the linked tenancy’s `tenant_user_id`, `landlord_user_id`, `property_id`, and `unit_id` when the rent card row is incomplete.
- Backfill existing rent cards from their linked tenancies so tenant name, property and unit display consistently.
- Update rent card generation/assignment paths so every new rent card stores the tenancy linkage correctly.

### 5. Premium Service landlord dashboard + agent protection
- Complete landlord Premium Service dashboard fields:
  - assigned agent
  - profile picture
  - agent ID
  - phone number
  - email
  - service status
  - subscription status
  - expiry date
  - managed property
- Replace prompt-only service requests with persistent task records visible to the assigned agent.
- Keep Call, SMS, Request Service, Revoke Access, and Request Agent Change actions.
- Ensure agents cannot access sensitive landlord areas: payment settings, settlement accounts, passwords, PINs, verified contacts.

### 6. Admin Premium Service property assignment
- Add a Premium Service tab/view inside Admin → Property Management listing active paid Premium Service subscriptions.
- Show property, landlord, subscription status, service status and assigned agent.
- Add filters for region, status, agent and property.
- Add server-side pagination at 100 rows per page.
- Allow admin to assign, reassign, remove agent and view assignment history.
- Make assignment immediately update:
  - assigned agent dashboard
  - landlord Premium Service dashboard
  - admin property management view

### 7. Agent lifecycle/profile management
- Promote approved applications into persistent editable agent profiles.
- Support lifecycle transitions:
  - Pending → Approved → Suspended/Revoked → Reactivated
- Add admin actions:
  - Approve
  - Reject
  - Suspend
  - Revoke Access
  - Reactivate
  - Configure Permissions
  - View Reports
  - View Activity Log
- Agent profile view will show agent ID, identity/contact details, region/area, status, ratings, active properties, tasks, complaints/reports, permissions and audit history.

### 8. Cashbook and Escrow permission/totals alignment
- Move cashbook filtering and totals to backend/server-side queries so totals are calculated only from rows visible to the logged-in admin.
- Align Cashbook visibility with Escrow Ledger rules:
  - Super/Main Admin: all permitted transactions
  - Scoped Admin: only authorized office/assigned transactions
- Add server-side pagination for Cashbook and Escrow lists.
- Replace frontend-only totals with visible-scope summaries.

### 9. Agreement workflow repair
- Move existing-tenancy phone/user linking into a reliable backend action, not only client-side dashboard loading.
- Normalize phone matching and link tenancy to tenant account when a matching registered tenant exists.
- Send tenant notification when an existing tenancy or Add Tenant agreement is ready for review.
- Review final agreement validation so it accepts either:
  - recorded acceptance booleans plus signed timestamps, or
  - valid rows in `tenancy_signatures`
- Issue final agreement once both landlord and tenant approvals are recorded.

### 10. Pagination and responsive tables
- Convert database-heavy admin pages from local `slice()` pagination to server-side range/count pagination where needed.
- Cover at minimum:
  - Rent Card Pending & Assign
  - Tenant Database
  - Landlords
  - Receipts
  - Cashbook
  - Developer Accounts
  - API Access Requests
  - Agent Applications
  - Premium property assignment
- Fix table hover distortion by using stable table widths, `table-fixed`/min-width wrappers where needed, and removing hover styles that change layout dimensions.

### 11. Developer password exposure hardening
- Replace `select("*")` in developer admin pages with explicit safe field lists.
- Redact any credential-like fields from API Access Requests and Developer Accounts UI.
- If the database contains any password/secret fields in these tables, deny direct frontend reads and expose only safe views/fields.

### 12. Verification before I call it done
- Run backend checks for feature rows, policies, and assignment records.
- Test checkout functions live for assessment, premium and wallet top-up.
- Verify Form 7 and Form 33 for the same complaint produce the same case number.
- Verify rent card rows display tenant/property/unit after backfill.
- Verify scoped admin Cashbook totals differ correctly from Super Admin totals.
- Verify developer pages do not fetch or render credential fields.
- Verify agent cannot access sensitive landlord account/payment routes.

## Delivery order

1. Payment/email + rent card + Form 7/33 fixes first, because these are visible user-facing failures.
2. Engine Room completion and configurable fees next.
3. Premium assignment + agent lifecycle next.
4. Cashbook/escrow scoping and pagination next.
5. Agreement workflow hardening and developer credential hardening last in the same pass, with verification.

I will not mark any item as done unless it is either verified in the running app/backend or explicitly reported as unverified with the reason.