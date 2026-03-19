

# Rent Card Workflow Overhaul: Physical Serial Assignment

## What Changes

The current system auto-generates serial numbers at purchase time. The new workflow separates **purchase** from **serial assignment**, requiring a physical office visit.

### New Flow
```text
Landlord buys cards → status: "awaiting_serial" (no serial)
         ↓
Landlord visits Rent Control office
         ↓
Officer searches by Landlord ID or Purchase ID
         ↓
Officer clicks "Assign" → system attaches serials from office stock
         ↓
Landlord sees real serial numbers, status: "valid"
         ↓
Landlord assigns card to property/unit/tenant → status: "active"
```

## Database Changes (Migration)

### 1. New table: `rent_card_serial_stock`
Pre-loaded physical serial numbers per office:
- `id`, `serial_number` (unique), `office_name`, `status` (available/assigned), `assigned_to_card_id` (nullable FK to rent_cards), `created_at`, `assigned_at`
- RLS: Regulators can read/update all; service_role full access

### 2. Alter `rent_cards` table
- Make `serial_number` nullable (remove NOT NULL + default) — cards start without serials
- Add `purchase_id text` — groups cards from one purchase (e.g., "PUR-20260319-0001")
- Add new purchase_id sequence

### 3. Update `generate_rent_card_serial()` → no longer used as default; serials come from stock

## Backend Changes

### `verify-payment/index.ts`
- When creating rent cards after purchase, set `status: "awaiting_serial"` instead of `"valid"`
- Set `serial_number: null`
- Generate and assign a shared `purchase_id` to all cards in the batch

### `paystack-checkout/index.ts`
- When fee is skipped (waived), same logic: create cards with `awaiting_serial`

## Frontend Changes

### 1. `ManageRentCards.tsx` (Landlord)
- Add `"awaiting_serial"` to status badge (amber/warning color)
- Show purchase_id grouping
- Cards with "awaiting_serial" show "Collect from office" message instead of serial number
- Filter includes "Awaiting Serial" option

### 2. New: `RegulatorRentCards.tsx` (Regulator — Rent Card Management)
- **Search bar**: Search by Landlord ID or Purchase ID
- **Results panel**: Shows landlord name, purchase ID, pending quantity, date purchased
- **Office stock display**: Shows available serial count for the officer's office
- **Assign button**: Auto-attaches next N available serials from stock to the purchase's cards
- **Bulk serial upload**: Simple form to add new serials to office stock (serial range or CSV)
- Success confirmation with assigned serial numbers listed

### 3. `RegulatorLayout.tsx`
- Add nav item: "Rent Cards" → `/regulator/rent-cards`

### 4. `App.tsx`
- Add route: `/regulator/rent-cards` → `RegulatorRentCards`

## Files