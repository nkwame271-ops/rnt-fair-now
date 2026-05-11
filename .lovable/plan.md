## Goal
Ensure this project's emails, SMS links, PDFs, and verification URLs are permanently locked to **`rentcontrolghana.com`** (sender subdomain `notify.rentcontrolghana.com`) and can never accidentally pick up another workspace domain (e.g. `hespariapartments.com`, `xtendedstaygh.com`, etc.).

## Current state (audit results)
- Project custom domain: `www.rentcontrolghana.com` ✅
- Workspace contains 9 email domains; this project is correctly bound to `rentcontrolghana.com`.
- All edge functions already hardcode `notify.rentcontrolghana.com` — no cross-domain leakage today.
- Risk: each function hardcodes the sender string independently, so a future edit could drift to another workspace domain unnoticed.

## Plan

### 1. Create a single source of truth for domains
New file `supabase/functions/_shared/project-domain.ts` exporting frozen constants:
- `ROOT_DOMAIN = "rentcontrolghana.com"`
- `SENDER_DOMAIN = "notify.rentcontrolghana.com"`
- `FROM_ADDRESS = "RentControlGhana <noreply@notify.rentcontrolghana.com>"`
- `PUBLIC_URL = "https://www.rentcontrolghana.com"`
- Helper `verifyUrl(path)` that always builds links off `PUBLIC_URL`.

### 2. Refactor edge functions to import the constants
Replace hardcoded strings in:
- `send-notification/index.ts` (enqueueEmail `from` + `sender_domain`)
- `paystack-webhook/index.ts` (receipt email `from` + `sender_domain`)
- `contact-reply/index.ts` (`from` + footer text)
- `auth-email-hook/index.ts` (`SENDER_DOMAIN`, `ROOT_DOMAIN`, `FROM_DOMAIN`, `SAMPLE_PROJECT_URL`)
- `paystack-checkout/index.ts` (default origin + synthetic email)
- `resolution-correction/index.ts` and `_shared/finalize-payment.ts` (QR verification URL)

### 3. Frontend: mirror the lock
New file `src/lib/projectDomain.ts` exporting the same `PUBLIC_URL`, `ROOT_DOMAIN`, and `verifyUrl()` helper. Update:
- `src/pages/landlord/ManageRentCards.tsx` (`PUBLISHED_URL`)
- `src/lib/generateAgreementPdf.ts`, `generateTenancyCardPdf.ts`, `TenancyCard.tsx` (verify URLs)
- Contact/feedback `info@` recipient stays as-is (it's a mailbox, not a sender).

### 4. Add a guard test
Add `src/test/projectDomain.test.ts` asserting the constants equal `rentcontrolghana.com` / `notify.rentcontrolghana.com`. Any future drift fails CI immediately.

### 5. Verification
- `rg "hespariapartments|xtendedstaygh|naflisghana|taxrightgh|essenceofafricashop|floodoflifeembassy|thetravelpot"` across the repo → must return zero hits.
- Send a test contact form + beta feedback after deploy → confirm `email_send_log.sender_domain = notify.rentcontrolghana.com`.

## Out of scope
- Removing the other 8 domains from the workspace (they belong to sibling projects).
- Changing the project's bound domain (already correct).

No DNS changes required — `rentcontrolghana.com` is already verified.