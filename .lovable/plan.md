

# Updated Rent Card Logic (Implemented)

## Core Principle

Each physical rent card is treated as an individual record. Pairing of two cards happens only at tenancy creation.

## What Changed

### 1. Purchase creates 2 cards per unit purchased
- `verify-payment/index.ts`: `qty * 2` cards created per purchase
- `paystack-webhook/index.ts`: Same `qty * 2` logic for fallback card creation
- `ManageRentCards.tsx`: UI shows "pairs" instead of individual cards, pricing per pair

### 2. Assignment UI — bulk selection with checkboxes
- `PendingPurchases.tsx`: Individual card rows with checkboxes, "Select All" toggle, bulk assign opens mapping dialog for selected cards only
- Auto-fill sequential shortcut preserved

### 3. Status flow
- `awaiting_serial` → Awaiting Serial (Stage 1: after purchase)
- `valid` → Available (Stage 2: serial assigned)
- `active` → Used (Stage 3: linked to tenancy)
