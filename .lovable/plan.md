## Manual Payment Confirmation Module

A user-facing flow for cases where Paystack charged the user but the platform never received/processed the callback (bad network, dropped webhook, browser closed). Users upload the Paystack SMS or email receipt, the system AI-verifies authenticity, cross-checks it against Paystack's API, and surfaces it to admins for **manual approval only**.

### Goals
- Give every user (tenant, landlord, NUGS, admin) one obvious place to say "I paid but the system didn't notice."
- Reduce fraud risk by combining AI receipt analysis + live Paystack `/transaction/verify` lookup before an admin sees it.
- Keep final fulfillment in admin hands — AI never auto-approves.

---

### 1. User-facing: "Report a Missing Payment"

A new page `src/pages/shared/ReportMissingPayment.tsx` reachable from:
- Tenant, Landlord, NUGS sidebars ("Payment Help")
- A persistent banner on every payment-failure / pending-payment screen ("Paid but not showing? Report it here")
- The Floating Action Hub

The form asks for:
1. **Reference / transaction ID** they were given (optional — many users won't have it)
2. **Amount paid** and **date/time**
3. **What were you paying for?** (dropdown: complaint fee, rent card, tenancy registration, viewing fee, etc.) + optional related case/property ID
4. **Upload proof** — screenshot of Paystack SMS or the email receipt (image or PDF, stored in a new `payment-proofs` bucket, private)
5. **Optional notes** (e.g. "I got the SMS at 2:14pm but the page reloaded")

A short explainer at the top tells the user *plainly*: *"Bad networks can sometimes interrupt payment confirmation. If your bank or Paystack confirmed the charge but our system hasn't, upload your receipt below. An officer will verify and credit your account — usually within a few hours."*

On submit → row inserted into `payment_proof_submissions` with status `pending_ai_review`, and an edge function `verify-payment-proof` is invoked.

---

### 2. AI + Paystack verification pipeline

New edge function `verify-payment-proof`:

1. **OCR / parse** the uploaded image with **Lovable AI Gateway** (`google/gemini-2.5-flash` — multimodal, cheap, accurate on receipts). The model extracts: merchant name, amount, currency, reference/transaction ID, date, last-4 of card, recipient/account.
2. **Authenticity heuristics** (returned by the same AI call as a structured JSON verdict):
   - Sender claims to be Paystack / a known Ghanaian bank
   - Amount and date look plausible
   - Reference format matches Paystack's pattern
   - Visual tampering signs (mismatched fonts, edited pixels) → flagged
3. **Live Paystack cross-check** — if a reference was extracted or supplied, call `https://api.paystack.co/transaction/verify/{ref}`. Possible outcomes:
   - `success` + amount matches → **`ai_verified_high_confidence`** (green)
   - `success` but amount or email mismatches user record → **`needs_admin_review`** (amber)
   - `failed` / `abandoned` → **`ai_rejected_paystack_says_unpaid`** (red)
   - reference missing or not found → **`needs_admin_review`** (amber, AI confidence shown)
4. Write the AI verdict, extracted fields, and Paystack response into the submission row + audit log.
5. Notify all admins with `reconcile_payment` permission via in-app notification + email.

**The function NEVER fulfills the payment itself.** Its only output is a verdict for the admin.

---

### 3. Admin review queue (inside Payment Reconciliation Centre)

Add a new tab **"User-Submitted Proofs"** to `src/pages/regulator/PaymentReconciliationCentre.tsx`.

Each row shows:
- User name, role, contact
- What they paid for + linked case/property
- AI verdict badge (green / amber / red) + confidence score
- Paystack live status side-by-side
- The uploaded image (zoomable) + extracted fields
- Buttons:
  - **Approve & Reconcile** → opens the existing reconciliation modal pre-filled with the verified reference, then runs the existing `reconcile-payment` pipeline. Officer must be selected.
  - **Reject** → requires a reason (free text + dropdown: "Paystack says unpaid", "Receipt appears edited", "Duplicate submission", "Wrong service", "Other"). User is notified by SMS + email.
  - **Request more info** → sends the user a templated message asking for the reference number, bank, etc.

All actions write to `payment_reconciliation_audit_log` (already exists) with a new `actor_action` of `user_proof_approved` / `user_proof_rejected` / `user_proof_info_requested`.

A small banner at the top: *"AI assists with verification but never approves payments. Every credit on this page is your decision."*

---

### 4. Database (new migration)

Add one new table:

`payment_proof_submissions`
- `user_id`, `service_type`, `related_case_id`, `related_property_id`
- `claimed_amount`, `claimed_reference`, `claimed_paid_at`, `notes`
- `proof_file_path` (storage path in `payment-proofs` bucket)
- `ai_verdict` (enum: `pending`, `ai_verified_high_confidence`, `needs_admin_review`, `ai_rejected_paystack_says_unpaid`, `ai_rejected_appears_fake`)
- `ai_confidence` (0-1), `ai_extracted_fields` (jsonb), `ai_reasoning` (text)
- `paystack_lookup_status`, `paystack_lookup_response` (jsonb)
- `submission_status` (enum: `pending_ai_review`, `awaiting_admin`, `approved`, `rejected`, `info_requested`)
- `reviewed_by_admin_id`, `reviewed_at`, `review_decision`, `review_notes`
- `resulting_fulfillment_id` (FK → `payment_fulfillments`, set on approval)

RLS:
- Users can insert their own row and read their own rows
- Admins with `reconcile_payment` permission (or `is_main_admin`/`is_super_admin`) can read/update all

New storage bucket `payment-proofs` (private), with RLS limiting reads to owner + admins.

---

### 5. Technical details

**Files to create**
- `supabase/migrations/...` — new table, bucket, RLS
- `supabase/functions/verify-payment-proof/index.ts` — AI + Paystack pipeline
- `src/pages/shared/ReportMissingPayment.tsx` — user form
- `src/components/regulator/UserProofReviewTab.tsx` — admin queue + review modal

**Files to edit**
- `src/App.tsx` — route `/report-missing-payment` (shared across roles)
- `src/components/TenantLayout.tsx`, `LandlordLayout.tsx`, `NugsLayout.tsx` — sidebar entry "Payment Help"
- `src/components/FloatingActionHub.tsx` — quick-action button
- `src/pages/regulator/PaymentReconciliationCentre.tsx` — add new tab
- `src/components/RegulatorLayout.tsx` — (no change; existing Payment Reconciliation entry already covers it)

**AI model**: `google/gemini-2.5-flash` via Lovable AI Gateway — multimodal, no extra key required. Prompt returns strict JSON; fallback to `needs_admin_review` if parsing fails.

**Safety guarantees**
- Approval funnels through the existing idempotent `finalizePayment` pipeline → no double-fulfillment.
- Uploads scoped to 5 MB, image/pdf only, virus-safe (server-side mime check).
- Rate limit: max 5 pending submissions per user.

---

### What I will NOT change
- Existing Paystack webhook, checkout, or reconciliation logic
- The admin-only reconciliation flow you already approved
- Role/permission model (just uses existing `reconcile_payment` permission)

Ready to implement once you approve.