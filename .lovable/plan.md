

# Landlord Portal Updates Plan

## 1. Change Greeting to "Hello"

**File**: `src/lib/greeting.ts`

Replace time-based greeting logic with a simple `Hello, {firstName} 👋`.

---

## 2. Fix Property Listing Bug

**Problem**: After paying the listing fee, the webhook correctly sets `listed_on_marketplace: true` on the property. However, the Marketplace query filters for `units.status = 'vacant'`. If units don't have `status: vacant`, the property won't appear even though it's listed.

**Also**: The MyProperties page shows "List on Marketplace" button even after listing succeeds because the local state isn't updated on return from Paystack redirect.

**Fixes**:
- `src/pages/landlord/MyProperties.tsx`: On page load, check URL params for `?status=listed` and refresh data / show success toast
- `src/pages/tenant/Marketplace.tsx`: Verify the query works correctly. The existing filter logic appears correct — units must be `vacant` AND property must be `listed_on_marketplace: true`. This is expected behavior (only vacant units show).

---

## 3. Rent Card Management System (New Feature)

### Concept
Landlords purchase rent cards in bulk. Each card has a unique serial number, starts as `valid` (purchased but unassigned), becomes `active` when tied to a tenancy, and becomes `used` when the tenancy ends. A rent card must be assigned when creating a tenancy — if the landlord has no available cards, they must purchase more.

### Database Migration

**New table: `rent_cards`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| serial_number | text | Unique, auto-generated (e.g. `RC-YYYYMMDD-XXXX`) |
| landlord_user_id | uuid | Owner |
| tenancy_id | uuid | Nullable FK — linked when assigned |
| status | text | `valid`, `active`, `used`, `voided` |
| purchased_at | timestamp | |
| activated_at | timestamp | Nullable |
| escrow_transaction_id | uuid | Nullable — links to purchase payment |
| created_at | timestamp | |

**Sequence**: `rent_card_serial_seq` for auto-generating serial numbers.

**Function**: `generate_rent_card_serial()` returns `RC-YYYYMMDD-XXXX`.

**RLS**: Landlords manage own cards. Regulators read all. Service role full access.

### Payment Flow

- Landlord selects quantity (1-50) on the Manage Rent Cards page
- Checkout type: `rent_card_bulk` with quantity parameter
- Amount: GH₵ 25 per card × quantity
- On webhook success: insert N `rent_cards` rows with status `valid`
- Update existing `rent_card` split in webhook for bulk handling

### Edge Function Updates

**`paystack-checkout`**: Add `rent_card_bulk` type that accepts `quantity`, calculates total as 25 × quantity.

**`paystack-webhook`**: On `rcard_` prefix, insert multiple rent_card rows based on quantity from metadata.

### Tenancy Integration

**`src/pages/landlord/AddTenant.tsx`**: 
- Before creating tenancy, check landlord has available rent cards (`status: valid`)
- Show available card count. If zero, block and link to "Manage Rent Cards"
- When tenancy is created, assign a rent card (set `tenancy_id`, status → `active`, `activated_at`)
- Store `rent_card_id` on the tenancy record (new column on `tenancies` table)

**`tenancies` table**: Add `rent_card_id uuid` nullable column.

### New Page: `src/pages/landlord/ManageRentCards.tsx`

- Show card inventory: total, valid (available), active, used
- Purchase section: quantity selector + "Buy Rent Cards" button
- List all cards with serial number, status, linked tenancy (if any)
- Filter by status

### TenancyCard & Agreement Linking

- `TenancyCard.tsx`: Add rent card serial number display
- `generateTenancyCardPdf.ts`: Include rent card serial in the PDF
- The tenancy card, rent card, and agreement are linked via `tenancy_id`

### Navigation

Add "Manage Rent Cards" to `LandlordLayout.tsx` nav items.

### Route

Add `/landlord/rent-cards` route to `App.tsx`.

---

## Files Summary

| File | Action |
|------|--------|
| `src/lib/greeting.ts` | Simplify to "Hello, {name}" |
| `src/pages/landlord/MyProperties.tsx` | Handle `?status=listed` callback to refresh state |
| DB migration | Create `rent_cards` table, sequence, function; add `rent_card_id` to `tenancies` |
| `supabase/functions/paystack-checkout/index.ts` | Add `rent_card_bulk` type with quantity |
| `supabase/functions/paystack-webhook/index.ts` | Generate rent card rows on bulk purchase |
| `src/pages/landlord/ManageRentCards.tsx` | New — card inventory, purchase, list |
| `src/pages/landlord/AddTenant.tsx` | Gate tenancy creation on available rent cards, assign card |
| `src/components/TenancyCard.tsx` | Display rent card serial |
| `src/lib/generateTenancyCardPdf.ts` | Include rent card serial |
| `src/components/LandlordLayout.tsx` | Add "Manage Rent Cards" nav item |
| `src/App.tsx` | Add `/landlord/rent-cards` route |

