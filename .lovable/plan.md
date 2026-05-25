## Goal

Introduce a **Sales Channel** layer for rent card sales that is fully hidden from non-Super Admins. Channels are an attribution + split-routing layer on top of the existing office/serial/IGF/receipt pipeline — they do not replace offices.

## 1. Database (new migration)

**`rent_card_sales_channels`** (Super Admin only via RLS using `is_super_admin`):
- `code` (unique slug, e.g. `rent_control_office`, `central_procurement`, `nugs_channel`, `field_agent`)
- `name`, `description`, `is_active`
- `default_office_id` (nullable — fallback office for receipt/reconciliation linkage)

**`rent_card_channel_splits`** (per-channel 3-way config, Super Admin only):
- `channel_id` FK
- `recipient` enum-like text: `igf` | `platform` | `admin`
- `amount_type` (`percent` | `flat`), `amount`, `sort_order`
- Unique (channel_id, recipient)

**Extensions to existing tables:**
- `rent_card_serial_stock.sales_channel_id` (nullable uuid)
- `escrow_transactions.sales_channel_id` (nullable uuid) — captured at checkout for rent card payments
- `rent_cards.sales_channel_id` (nullable uuid) — denormalized for fast channel reporting

**RLS:** all new columns/tables readable only when `is_super_admin(auth.uid())`. Existing office RLS unchanged so office admins keep seeing their stock/transactions without channel context.

## 2. Split routing

Update `supabase/functions/_shared/finalize-payment.ts` (and the rent card branch of `paystack-webhook`) so that when an escrow transaction has `sales_channel_id` set AND `payment_type IN ('rent_card','rent_card_bulk')`:
- Use `rent_card_channel_splits` for that channel instead of the default `split_configurations` rows.
- Write the resulting `escrow_splits` rows with the same `recipient` taxonomy already used elsewhere (`igf`, `platform`, `admin`) so existing visibility helpers (`getVisibleRecipients`, `sumVisibleSplits`) automatically hide `platform` for non-Super Admins.
- IGF allocation, receipt generation (`generate_receipt_number`), and reconciliation rows continue to fire exactly as today.

## 3. Engine Room — "Rent Card Sales Channel Splits"

In `src/pages/regulator/EngineRoom.tsx`, add a new card/section gated by `isSuperAdmin`:
- Lists each channel with editable 3-row split (IGF / Platform / Admin), percent or flat.
- Validation: percentages must sum to 100 when all rows are percent.
- Mutations restricted to Super Admin (DB-level RLS + UI gating).

## 4. Procurement workflow

New route group `src/pages/regulator/rent-cards/sales-channels/` (Super Admin only):
- **`SalesChannels.tsx`** — list / create / edit / deactivate channels.
- **`ChannelStockAllocation.tsx`** — allocate serial stock to a channel (sets `sales_channel_id` on rows in `rent_card_serial_stock`); supports uploading or generating serial ranges scoped to a channel via the existing serial generation RPC with a `channel_id` parameter.
- **`ChannelSalesReport.tsx`** — sales + reconciliation grouped by channel, with full split breakdown (IGF / Platform / Admin) — visible only to Super Admin.

Add a "Sales Channels" subnav under `RegulatorRentCards.tsx → Procurement` rendered only when `isSuperAdmin`.

## 5. Checkout attribution

When a Super Admin (or an internal flow they configure, e.g. NUGS purchases, field agent sales) initiates a rent card purchase, the `paystack-checkout` payload accepts an optional `sales_channel_id`. The edge function:
- Validates the channel exists and is active.
- Persists it on the resulting `escrow_transactions` row.
- Defaults to `null` (i.e. no channel — current behaviour) when omitted, so normal landlord-driven purchases are untouched.

## 6. Visibility / reporting rules

- All Sales Channel UI surfaces (Engine Room section, Procurement subnav, channel reports, channel columns) are wrapped in `isSuperAdmin` checks already established via `useAdminProfile`.
- Existing escrow / reconciliation / receipts views remain unchanged for non-Super Admins because:
  - The `platform` recipient is already hidden by `getVisibleRecipients`.
  - No channel column is rendered for non-Super Admin layouts.
  - Office totals continue to be computed from the same `escrow_splits` rows (IGF + admin portions still attribute to the office via `office_id`), so office reconciliation stays clean.
- Receipts, IGF reporting, and reconciliation status flow identically — only the *split percentages* differ when a channel is attached.

## 7. Files

**New**
- `supabase/migrations/<ts>_rent_card_sales_channels.sql`
- `src/pages/regulator/rent-cards/sales-channels/SalesChannels.tsx`
- `src/pages/regulator/rent-cards/sales-channels/ChannelStockAllocation.tsx`
- `src/pages/regulator/rent-cards/sales-channels/ChannelSalesReport.tsx`
- `src/lib/revenue/channelSplits.ts` (shared helper to load channel split config)

**Edited**
- `supabase/functions/_shared/finalize-payment.ts` (channel-aware split resolution)
- `supabase/functions/paystack-checkout/index.ts` (accept + validate `sales_channel_id`)
- `src/pages/regulator/EngineRoom.tsx` (new Super-Admin-only section)
- `src/pages/regulator/RegulatorRentCards.tsx` (Procurement subnav entry)
- `src/App.tsx` (routes)
- `src/hooks/useAdminProfile.ts` (feature route mapping for new pages)

## 8. Key principle enforcement

- Office workflows: unchanged. Office admins never see `sales_channel_id`, the new tables, or platform allocations.
- Sales Channels behave as a hidden attribution + split-routing overlay.
- Visibility and calculation stay aligned: if a user cannot see Platform, the existing `sumVisibleSplits` ensures totals exclude it; the channel report itself is gated entirely behind `isSuperAdmin`.

Confirm to proceed and I'll implement in this order: migration → edge function updates → Engine Room section → Procurement pages → routing.