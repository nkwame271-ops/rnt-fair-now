

# Phase 1+2: Permanent Property Record + Fair Rent Engine v1

This is a large upgrade split into manageable implementation chunks. It introduces a permanent property identity system, prevents history-destroying deletions, adds expanded lifecycle statuses, and builds a rule-based Fair Rent Engine with price band controls at listing time.

---

## Database Changes (Migration)

### New columns on `properties` table
- `property_status` TEXT DEFAULT 'draft' — replaces the binary marketplace flag as the canonical lifecycle state. Values: `draft`, `pending_identity_review`, `pending_assessment`, `approved`, `live`, `occupied`, `off_market`, `pending_rent_review`, `suspended`, `archived`
- `archived_at` TIMESTAMPTZ
- `archived_reason` TEXT
- `room_count` INTEGER
- `bathroom_count` INTEGER
- `occupancy_type` TEXT (shared / self_contained)
- `furnishing_status` TEXT (unfurnished / semi_furnished / furnished)
- `ownership_type` TEXT (owner / agent / caretaker)
- `normalized_address` TEXT — system-generated lowercased, trimmed address for matching
- `property_fingerprint` TEXT — composite hash for duplicate detection

### New table: `rent_benchmarks`
Stores computed Fair Rent Engine outputs per property.

| Column | Type |
|---|---|
| id | UUID PK |
| property_id | UUID FK → properties |
| unit_id | UUID FK → units |
| zone_key | TEXT (region + area combo) |
| property_class | TEXT (type + room band) |
| benchmark_min | NUMERIC |
| benchmark_expected | NUMERIC |
| benchmark_max | NUMERIC |
| soft_cap | NUMERIC (max × 1.25) |
| hard_cap | NUMERIC (max × 1.50) |
| confidence | TEXT (high/medium/low) |
| comparable_count | INTEGER |
| computed_at | TIMESTAMPTZ |

### New table: `rent_increase_requests`
For the rent review workflow (used in Phase 3 but table created now for schema readiness).

| Column | Type |
|---|---|
| id | UUID PK |
| property_id | UUID FK |
| unit_id | UUID FK |
| landlord_user_id | UUID |
| current_approved_rent | NUMERIC |
| proposed_rent | NUMERIC |
| reason | TEXT |
| evidence_urls | TEXT[] |
| request_type | TEXT (active_tenancy / new_tenancy / material_upgrade) |
| status | TEXT DEFAULT 'pending' |
| reviewer_user_id | UUID |
| reviewer_notes | TEXT |
| reviewed_at | TIMESTAMPTZ |
| created_at | TIMESTAMPTZ |

### New table: `property_events`
Audit trail for all property lifecycle changes.

| Column | Type |
|---|---|
| id | UUID PK |
| property_id | UUID FK |
| event_type | TEXT (status_change / listing / delisting / archive / rent_update / assessment / duplicate_merge) |
| old_value | JSONB |
| new_value | JSONB |
| performed_by | UUID |
| reason | TEXT |
| created_at | TIMESTAMPTZ |

### New table: `rent_market_data`
Captures event-level pricing data for future index computation.

| Column | Type |
|---|---|
| id | UUID PK |
| property_id | UUID FK |
| unit_id | UUID FK |
| zone_key | TEXT |
| property_class | TEXT |
| asking_rent | NUMERIC |
| approved_rent | NUMERIC |
| accepted_rent | NUMERIC |
| advance_months | INTEGER |
| event_type | TEXT (listing / tenancy / review) |
| event_date | DATE |
| created_at | TIMESTAMPTZ |

### RLS Policies
- `rent_benchmarks`: Landlords read own (via property FK), regulators read all
- `rent_increase_requests`: Landlords manage own, regulators read/update all, tenants read via tenancy
- `property_events`: Regulators read all, landlords read own property events
- `rent_market_data`: Regulators read all (analytics), service_role insert

---

## Frontend Changes

### 1. Property Registration (`RegisterProperty.tsx`)
- Add new fields: room count, bathroom count, occupancy type, furnishing status, ownership type
- Make GhanaPost GPS required (currently optional)
- On submit: generate `normalized_address` (lowercase, trim, remove special chars), compute `property_fingerprint` hash
- Call new edge function `check-property-duplicate` before creating — if high match, reuse Property ID; if medium, set status to `pending_identity_review`
- After property creation, call `compute-rent-benchmark` edge function to generate benchmark for each unit
- Show pricing feedback inline: "Within Benchmark", "Above Benchmark (warning)", "Pending Justification", or "Rejected — Excessive Pricing" based on unit rent vs benchmark

### 2. My Properties (`MyProperties.tsx`)
- Replace "Delete" button with "Archive" button
- Archive flow: show AlertDialog requiring password confirmation + reason text
- Call `admin-action` edge function with action `archive_property`
- Update property status to `archived` instead of deleting records
- Show `property_status` badge instead of just assessment_status
- Show benchmark pricing status per unit if available
- Add "Request Rent Increase" button (links to new page, Phase 3 implementation)

### 3. Edit Property (`EditProperty.tsx`)
- Add new fields matching registration (room count, bathroom count, etc.)
- Block editing of key identity fields (GPS, GhanaPost GPS) if `location_locked = true`

### 4. Marketplace (`Marketplace.tsx`)
- Only show properties with `property_status = 'live'`
- Show benchmark badge on each listing (Within Benchmark / Above Benchmark)

### 5. Regulator Properties (`RegulatorProperties.tsx`)
- Show full `property_status` lifecycle in the table
- Add "Duplicate Risk" column flagging properties in `pending_identity_review`
- Add pricing status column from benchmark data
- Allow admins to merge duplicate properties, change status, suspend listings

### 6. New Page: Rent Increase Request (`src/pages/landlord/RentIncreaseRequest.tsx`)
- Landlord selects property → unit → enters proposed rent, reason, uploads evidence
- System checks current approved rent from benchmark
- Submits to `rent_increase_requests` table
- Route: `/landlord/rent-increase-request`

### 7. Regulator Rent Reviews (`src/pages/regulator/RegulatorRentReviews.tsx`)
- Table of pending rent increase requests
- Admin can approve (updates approved rent + benchmark) or reject with notes
- Route: `/regulator/rent-reviews`

---

## Edge Functions

### `check-property-duplicate` (new)
- Receives property details (GPS, GhanaPost GPS, normalized address, landlord ID, unit signature)
- Queries existing properties with weighted similarity scoring
- Returns: `{ match: 'high' | 'medium' | 'low', existingPropertyId?: string, confidence: number }`

### `compute-rent-benchmark` (new)
- Receives property_id, zone_key (region + area), property_class (unit_type), asking_rent
- Looks up `rentPrices` data (initially from dummyData seed, later from `rent_market_data`)
- Computes benchmark_min, benchmark_expected, benchmark_max, soft_cap, hard_cap
- Determines pricing band (within / above / pending_justification / rejected)
- Inserts into `rent_benchmarks` table
- Returns benchmark result to caller

---

## Data Seeding

- Seed `rent_market_data` with initial values derived from the existing `rentPrices` array in `dummyData.ts` so the Fair Rent Engine has baseline data from day one

---

## Files Changed Summary

| File | Action |
|---|---|
| New migration SQL | Add columns + 4 new tables + RLS |
| `src/pages/landlord/RegisterProperty.tsx` | New fields, duplicate check, benchmark display |
| `src/pages/landlord/MyProperties.tsx` | Archive replaces delete, status badges, benchmark info |
| `src/pages/landlord/EditProperty.tsx` | New fields, lock controls |
| `src/pages/tenant/Marketplace.tsx` | Filter by `property_status='live'`, benchmark badges |
| `src/pages/regulator/RegulatorProperties.tsx` | Full lifecycle status, duplicate risk, pricing status |
| `src/pages/landlord/RentIncreaseRequest.tsx` | New page |
| `src/pages/regulator/RegulatorRentReviews.tsx` | New page |
| `supabase/functions/check-property-duplicate/index.ts` | New edge function |
| `supabase/functions/compute-rent-benchmark/index.ts` | New edge function |
| `src/App.tsx` | Add routes for new pages |
| `src/components/LandlordLayout.tsx` | Add nav link for Rent Increase Request |
| `src/components/RegulatorLayout.tsx` | Add nav link for Rent Reviews |

