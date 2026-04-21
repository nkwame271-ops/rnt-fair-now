
## Marketplace price visibility + Remove KYC gating

### 1. Marketplace card — price always visible

In `src/pages/tenant/Marketplace.tsx` (the listing card around lines 401–420), the price chip is currently floated inside the image as an `absolute bottom-3 right-3` overlay, so on smaller card widths and certain images it gets visually buried (image overlap) and clipped on narrow screens.

Fix: move the price OUT of the image container into the card body so it can never be obscured.

- Remove the `absolute bottom-3 right-3` price chip from the image overlay.
- Render the price as a dedicated row at the top of the text block (`p-4` section), e.g. a flex row with the property title on the left and a bold price pill on the right that wraps cleanly:
  - `GH₵ {monthly_rent}/mo` — `text-base font-bold text-primary`, with `whitespace-nowrap` and its own line so it never collapses behind the title.
- Keep the Registered badge, Available Soon badge, and watchlist heart on the image. No other card content changes.

Result: price renders in the solid card body with full contrast — never covered by image, gradient, or other badges, on any viewport.

### 2. Remove mandatory KYC gating from workflows

The `KycGate` wrapper currently blocks several core actions until Ghana Card is verified. Per request, KYC must NOT be a precondition for these workflows.

Edits in `src/App.tsx`:
- Tenant route: `file-complaint` — unwrap from `<KycGate>`, render `<FileComplaint />` directly.
- Landlord routes: `add-tenant`, `declare-existing-tenancy` — unwrap both.
- NUGS route: `file-complaint` — unwrap.

Edits in `src/pages/landlord/RegisterProperty.tsx`:
- Remove the `<KycGate action="register a property">` wrapper around the page; keep the inner JSX as-is. Also drop the now-unused `KycGate` import.

Edit in `src/pages/tenant/Marketplace.tsx`:
- In `handleRequestViewing`, remove the `if (!kycVerified) { toast.error(...); return; }` block (lines ~283–286) so viewing applications no longer require Ghana Card verification.
- Drop the now-unused `useKycStatus` import and `kycVerified` destructure.

### What is NOT changing

- KYC submission flow itself (`KycVerificationCard`, `useKycStatus`, `verify-ghana-card` edge function, profile pages) stays intact — landlords/tenants/students can still verify voluntarily; it just isn't a hard gate anymore.
- `KycGate.tsx` file remains in the repo (no longer referenced) in case you want to re-enable gating later.
- No backend, RLS, or schema changes.
- Marketplace filtering, modal, viewing-fee payment flow, watchlist, and all other card content unchanged.

### Files touched
- `src/pages/tenant/Marketplace.tsx`
- `src/App.tsx`
- `src/pages/landlord/RegisterProperty.tsx`
