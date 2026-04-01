

# Plan: Serial Pairing, Office Stock Overhaul, Daily Reports, Escrow Splits, and Admin Deletions

This is a large set of changes spanning serial generation logic, office stock display, automated daily reporting, escrow settlement improvements, dashboard cleanup, module restructuring, and admin deletion capabilities across regulator pages.

---

## 1. Paired Serial Generation Mode

**`src/pages/regulator/rent-cards/SerialGenerator.tsx`**
- Add a "Generate in Pairs" toggle (default ON)
- When ON: if user enters quantity 100, system generates 50 unique serials, each stored twice (with a `card_role` or `pair_index` marker: copy 1 and copy 2)
- When OFF: generates 100 unique serials as-is
- Update quantity display to show "50 unique serials x 2 = 100 physical cards" when paired mode is on
- Preview reflects duplicated output

**`supabase/functions/admin-action/index.ts`** (`generate_serials` case)
- Accept `paired_mode` flag from frontend
- When paired: generate half the range as unique serials, insert each twice with `pair_index` (1 and 2) metadata
- Track `usage_count` per serial (how many times it appears in stock)

**Database migration**
- Add `pair_index` (integer, nullable) and `pair_group` (text, nullable) columns to `rent_card_serial_stock` to track which copy a row represents

---

## 2. Office Stock Display Overhaul

**`src/pages/regulator/rent-cards/OfficeSerialStock.tsx`**
- Replace current summary cards with rent-card-pair terminology:
  - Opening Rent Card Pairs
  - Assigned Rent Card Pairs
  - Sold Rent Card Pairs
  - Spoilt Rent Card Pairs
  - Closing Rent Card Pairs
- Under "Assigned Serials" section, show both total serial numbers and equivalent rent card pairs
- Calculate pairs as: total unique serials (count distinct serial_number) and physical cards (total rows)

**Database migration**
- Add `status` value support for `spoilt` in `rent_card_serial_stock` (no schema change needed, just status convention)

---

## 3. Daily Rent Card Assignment Report (Automated)

**New component: `src/pages/regulator/rent-cards/DailyReport.tsx`**
- "Generate Daily Report" button that auto-compiles from system data:
  - Opening Rent Card Pairs (available at start of day)
  - Total Assigned Today
  - Total Sold Today
  - Total Spoilt
  - Closing Balance
- All values auto-calculated from `rent_card_serial_stock` activity (using `assigned_at`, `created_at` timestamps)
- Staff reviews, optionally adds a note, signs off by typing full name
- System auto-attaches: Staff ID, Name, Office ID, Office Name, Date/Time
- Save report to a new `daily_stock_reports` table

**Database migration**
- Create `daily_stock_reports` table: id, office_id, office_name, staff_user_id, staff_name, report_date, opening_pairs, assigned_today, sold_today, spoilt_today, closing_pairs, notes, signed_name, created_at
- RLS: regulators can read/insert

---

## 4. Admin Report View and Download

**New component: `src/pages/regulator/rent-cards/AdminReportView.tsx`**
- Admin can view aggregated daily reports across offices
- Filters: date range, office, staff
- Shows: per-office summary, per-staff breakdown, totals
- Export as Excel (xlsx via SheetJS) and PDF (jsPDF)
- Clean, structured format aligned with existing reporting templates

---

## 5. Simplified Assignment (Pending & Assign)

**`src/pages/regulator/rent-cards/PendingPurchases.tsx`**
- Replace manual serial-by-serial picker with:
  - Quantity input: "How many cards to assign?"
  - System auto-selects next available serials from office stock
  - Optional "Start from serial" field for specific range
  - Optional "Select range" (start serial - end serial) for bulk assignment
- Remove current autofill logic, replace with context-aware auto-selection starting from next available serial in office
- Keep search and grouping by purchase_id

---

## 6. Module Restructuring: Procurement vs Sales

**`src/pages/regulator/RegulatorRentCards.tsx`**
- Split into two workspace tabs under one parent module:

**Procurement workspace:**
- Generate Serials
- Serial Batch Upload
- Stock Alerts
- Procurement Audit (subset of audit log filtered to generation/upload/revoke actions)

**Sales workspace:**
- Office Stock
- Pending & Assign
- Assignment History
- Daily Report
- Admin Report View
- Sales Audit (subset of audit log filtered to assignment/sales actions)

- Permission-based access: Main Super Admin sees all; Procurement and Sales roles see only their workspace
- Use `allowed_features` from admin_staff to gate access (e.g., `rent_card_procurement`, `rent_card_sales`)

---

## 7. Move Account Management to Engine Room

**`src/pages/regulator/rent-cards/AdminActions.tsx`**
- Remove the Account Management section (search/deactivate/archive/delete accounts)
- Keep serial-related admin actions: Revoke Batch, Unassign Serial, Void Upload, Audit Log

**`src/pages/regulator/EngineRoom.tsx`**
- Add Account Management section (moved from AdminActions) with same functionality:
  - Search by landlord/tenant/admin
  - Deactivate, Archive, Delete Permanently
  - Password confirmation required for all destructive actions

---

## 8. Escrow & Revenue: Real Allocation Posting

The current implementation already:
- Builds dynamic splits from Engine Room config (`getSplitConfigFromDB`)
- Sends Paystack split objects with subaccount codes (`buildPaystackSplit`)
- Posts splits to `escrow_splits` table in webhook
- Displays allocation breakdown in Escrow Dashboard

**Verification/fixes needed in `paystack-checkout/index.ts`:**
- Ensure every payment type actually passes the split object to Paystack initialization (verify all cases call `buildPaystackSplit`)
- Ensure split amounts are correctly calculated per transaction, not fixed

**`src/pages/regulator/EscrowDashboard.tsx`**
- Verify allocation summary refreshes after each payment (already reading from escrow_splits)
- No major structural changes needed; the pipeline is already in place

---

## 9. Dashboard: Remove Registration Revenue (est.)

**`src/pages/regulator/RegulatorDashboard.tsx`**
- Remove the "Registration Revenue (est.)" line from Quick Summary section (lines 152-155)
- This removes the hardcoded `GH₵ (tenants * 40) + (landlords * 30)` estimate

---

## 10. Admin Deletion of Submitted Records

**`supabase/functions/admin-action/index.ts`**
- Add new action cases: `delete_complaint`, `delete_application`, `delete_property`, `delete_agreement`, `delete_assessment`, `delete_rent_review`, `delete_termination`
- Each validates main_admin status, requires password, logs to audit

**Regulator pages that need delete buttons (Main Admin only):**
- `RegulatorComplaints.tsx` — delete complaint
- `RegulatorApplications.tsx` — delete application
- `RegulatorProperties.tsx` — delete property
- `RegulatorAgreements.tsx` — delete agreement
- `RegulatorRentAssessments.tsx` — delete assessment
- `RegulatorRentReviews.tsx` — delete rent review
- `RegulatorTerminations.tsx` — delete termination

Each page gets a "Delete" button (visible only to Main Admin) that triggers `AdminPasswordConfirm` and calls the `admin-action` edge function.

---

## Database Migrations

1. `rent_card_serial_stock`: Add `pair_index` (int, nullable), `pair_group` (text, nullable)
2. New table `daily_stock_reports`: id, office_id, office_name, staff_user_id, staff_name, report_date, opening_pairs, assigned_today, sold_today, spoilt_today, closing_pairs, notes, signed_name, created_at (with RLS for regulators)

## Files to Create/Modify

| File | Change |
|---|---|
| `src/pages/regulator/rent-cards/SerialGenerator.tsx` | Paired mode toggle |
| `src/pages/regulator/rent-cards/OfficeSerialStock.tsx` | Pair-based display, spoilt tracking |
| `src/pages/regulator/rent-cards/DailyReport.tsx` | **New** — automated daily report |
| `src/pages/regulator/rent-cards/AdminReportView.tsx` | **New** — admin aggregated reports with export |
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Simplified quantity-based assignment |
| `src/pages/regulator/RegulatorRentCards.tsx` | Procurement/Sales workspace split |
| `src/pages/regulator/rent-cards/AdminActions.tsx` | Remove account management section |
| `src/pages/regulator/EngineRoom.tsx` | Add account management section |
| `src/pages/regulator/RegulatorDashboard.tsx` | Remove registration revenue estimate |
| `src/pages/regulator/RegulatorComplaints.tsx` | Add delete button (Main Admin) |
| `src/pages/regulator/RegulatorApplications.tsx` | Add delete button |
| `src/pages/regulator/RegulatorProperties.tsx` | Add delete button |
| `src/pages/regulator/RegulatorAgreements.tsx` | Add delete button |
| `src/pages/regulator/RegulatorRentAssessments.tsx` | Add delete button |
| `src/pages/regulator/RegulatorRentReviews.tsx` | Add delete button |
| `src/pages/regulator/RegulatorTerminations.tsx` | Add delete button |
| `supabase/functions/admin-action/index.ts` | Paired generation + record deletion actions |
| `supabase/functions/paystack-checkout/index.ts` | Verify all types use dynamic splits |
| Migration | Add columns + new table |

