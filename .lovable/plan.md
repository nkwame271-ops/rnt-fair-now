## Fix plan for the reported Rent Control Digital Platform errors

### 1. Cashbook must inherit Escrow Ledger permissions
- Align Cashbook office scoping with the Escrow Ledger by filtering `cashbook_entries.office` with the logged-in admin's `office_id`, not the office display name.
- Lock the Cashbook office filter for scoped admins so they cannot switch to another office.
- Calculate all Cashbook totals from the same visible/scoped transaction set.
- Replace misleading global running-balance usage for filtered views with period totals based only on visible entries.

### 2. Landlord Add Tenant property dropdown
- Update the property/unit query so the dropdown only includes properties owned by the landlord that have at least one vacant unit.
- Exclude fully occupied properties even if the property itself is approved/live/occupied.
- Keep vacant units visible even when the property-level status is not a reliable vacancy signal.

### 3. Existing tenancy tenant search and linking
- Replace exact phone-number matching with proper Ghana phone normalization.
- Recognize `024...`, `23324...`, `+23324...`, spaced, dashed, and mixed-format phone values.
- Link the tenancy to an existing tenant account when a match is found instead of creating a duplicate pending tenant or invitation.

### 4. Digital Rent Cards data linking
- Fix the unit field lookup to use the real unit column (`unit_name`) so unit details stop showing `-`.
- Strengthen card-to-tenancy enrichment so each rent card resolves tenant name, landlord, property, and unit from its corresponding tenancy.
- Add fallbacks for migrated tenancies using placeholder tenant details when the tenant account is not yet linked.

### 5. Checkout “Invalid Email Address Passed”
- Update `wallet-topup`, `premium-checkout`, and `assessment-checkout` to resolve email in this order: authenticated user email, profile email, tenant/landlord record email, then a validated request body email.
- Normalize and validate emails safely so null/empty profile fields do not trigger Paystack email errors.
- Redeploy the three corrected backend functions.

### 6. Premium Service landlord dashboard
- Expand the Premium Service page to show assigned agent, profile picture, agent ID, phone, email, service status, subscription status, expiry date, and managed property.
- Keep Call Agent and Send SMS actions.
- Implement landlord actions: Request Service, Revoke Access, and Request Agent Change.
- Persist service requests into the existing management task system so they appear for the assigned agent.

### 7. Agent task dashboard and sensitive access controls
- Replace the placeholder agent pending-task page with a real list of assigned landlord service requests.
- Allow agents to mark tasks in progress/completed and keep audit trail entries.
- Confirm sensitive landlord routes remain blocked for agents: payment settings, settlement accounts, passwords, transaction PINs, verified contacts, and profile changes.

### 8. Agreement workflow
- Ensure both Existing Tenancy and Add Tenant flows assign agreements to the tenant dashboard once a tenant account is matched or linked.
- Add/update tenant notification creation for newly assigned agreements.
- Fix final agreement validation so it accepts both the `tenancy_signatures` audit table and tenancy-level acceptance/signature columns.
- Allow final agreement issuance once landlord and tenant approvals/signatures are both recorded.

### 9. Admin Premium Service property assignment
- Expand admin actions to include Approve, Reject, Suspend, Revoke Access, Reactivate, Configure Permissions, View Reports, and View Activity Log.
- Show complete agent profile details: agent ID, identity/contact details, region/operating area, approval status, ratings/reviews, active assigned properties, completed/pending tasks, complaints/reports, permission set, and audit history.

### 10. Verification
- Run targeted checks for the edited frontend files and backend functions.
- Verify the exact screens named in your report: Cashbook, Add Tenant, Existing Tenancy search, Rent Cards, Wallet Add Money, Assessment Subscribe, Premium Subscribe, Tenant Agreements, Premium landlord dashboard, Agent tasks, and Admin Premium Assignments.

### Technical notes from confirmed inspection
- Cashbook currently filters by office display name while the ledger uses office ID.
- Cashbook totals are currently limited to fetched rows and use global running balances for filtered views.
- Rent card unit lookup uses a mismatched unit field name.
- Agent pending tasks page is currently a placeholder.
- Agreement final validation is centralized in `renderTenancyAgreement` and needs broader signature recognition.