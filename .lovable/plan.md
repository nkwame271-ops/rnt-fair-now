

# Fix: Admin Charge Must Follow Secondary Split Configuration

## Root Cause

The `secondary_split_configurations` table already has the correct Engine Room config:
- `admin → office: 0%`
- `admin → headquarters: 100%`
- `admin → platform: 0%`

But **both** `finalize-payment.ts` and `finalize-office-attribution` completely ignore this table. They treat the entire `admin` split amount as a single office payment. The admin charge must be sub-divided according to these secondary percentages.

## Current Data
For rent cards: GH₵15 → rent_control, GH₵10 → admin. The admin GH₵10 should be split per secondary config (currently 100% HQ, 0% office). Instead, the system sends all GH₵10 to the assigning office.

## Changes

### 1. `supabase/functions/_shared/finalize-payment.ts`
When creating `escrow_splits` for an `admin` recipient, load `secondary_split_configurations` for `parent_recipient = 'admin'`. Instead of creating one split row for the full admin amount, create multiple rows:
- One for `office` share (recipient: `admin`, sub_recipient marker in description, office_id set)
- One for `headquarters` share (recipient: `admin`, routed to system settlement account for `admin`)
- One for `platform` share if configured

If secondary splits total 0% or don't exist, fall back to current behavior (100% to admin/office).

The same logic applies in the auto-release fund request section — only the office's share should create a fund request.

### 2. `supabase/functions/finalize-office-attribution/index.ts`
Currently takes ALL deferred `admin` splits and attributes them to the assigning office. Must instead:
1. Load `secondary_split_configurations` for `parent_recipient = 'admin'`
2. For each deferred admin split, calculate the office percentage
3. If office% < 100%, split the row: create a new split for HQ's share, reduce the original to office's share
4. Only attribute the office portion to the assigning office
5. The HQ portion should be routed to the system `admin` settlement account for payout

### 3. `supabase/functions/paystack-checkout/index.ts`
No changes needed — this correctly loads from `split_configurations` and passes the split plan in metadata. The sub-splitting happens at finalization time.

## Technical Details

**Secondary split loading helper** (shared):
```typescript
async function loadSecondarySplits(supabaseAdmin: any, parentRecipient: string) {
  const { data } = await supabaseAdmin
    .from("secondary_split_configurations")
    .select("sub_recipient, percentage, description")
    .eq("parent_recipient", parentRecipient);
  return data || [];
}
```

**finalize-payment.ts split creation** — when building splitRows for `admin`:
```typescript
// Instead of one admin row, create sub-rows per secondary config
const secondarySplits = await loadSecondarySplits(supabaseAdmin, "admin");
const officeShare = secondarySplits.find(s => s.sub_recipient === "office");
const hqShare = secondarySplits.find(s => s.sub_recipient === "headquarters");

const officePct = officeShare?.percentage || 0;
const hqPct = hqShare?.percentage || 100;

// Office portion (deferred for deferred types)
if (officePct > 0) {
  rows.push({ recipient: "admin", amount: adminAmount * officePct / 100, 
    description: "Office share", office_id: isDeferredOffice ? null : officeId,
    disbursement_status: isDeferredOffice ? "deferred" : ... });
}
// HQ portion (never deferred — goes to system admin account)
if (hqPct > 0) {
  rows.push({ recipient: "admin_hq", amount: adminAmount * hqPct / 100,
    description: "HQ share", office_id: null,
    disbursement_status: "pending_transfer" });
}
```

**finalize-office-attribution** — only process the office share:
```typescript
// Load secondary config
const secondarySplits = await loadSecondarySplits(adminClient, "admin");
const officePct = secondarySplits.find(s => s.sub_recipient === "office")?.percentage || 0;

// If office gets 0%, just mark deferred splits as released to HQ
// If office gets partial %, split the amount accordingly
```

**Payout routing for admin_hq** — add `admin_hq` to `RECIPIENT_TO_ACCOUNT_TYPE` mapping:
```typescript
const RECIPIENT_TO_ACCOUNT_TYPE = {
  rent_control: "igf",
  admin: "admin",      // office payout
  admin_hq: "admin",   // HQ system settlement
  platform: "platform",
  gra: "gra",
};
```

## Files to Modify
1. `supabase/functions/_shared/finalize-payment.ts` — sub-split admin recipient using secondary config
2. `supabase/functions/finalize-office-attribution/index.ts` — only attribute office percentage, route HQ share separately
3. Both functions need the secondary split loading helper

