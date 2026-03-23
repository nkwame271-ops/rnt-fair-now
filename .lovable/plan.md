

# Test Plan: Phases 1, 2, and 3

## What We're Testing

**Phase 1 — Permanent Property Record**: Property identity fields, archive workflow (no hard delete), property fingerprint, normalized address, lifecycle statuses.

**Phase 2 — Fair Rent Engine**: Benchmark computation logic, price band decision table (within/above/pending/rejected), listing approval controls.

**Phase 3 — Anti-Evasion & Compliance**: Duplicate detection scoring, compliance checks at listing, occupancy status transitions, rent increase relist controls.

## Test Strategy

We will create **unit tests** for the pure logic functions and **integration-style component tests** for the key UI workflows. Edge functions will be tested via the Deno test runner against the live backend.

## Files to Create

| File | What it tests |
|---|---|
| `src/test/normalizeAddress.test.ts` | `normalizeAddress()` — address standardization |
| `src/test/priceBands.test.ts` | Price band decision logic (within/above/pending/rejected thresholds) |
| `supabase/functions/check-property-duplicate/index.test.ts` | Duplicate detection edge function |
| `supabase/functions/compute-rent-benchmark/index.test.ts` | Benchmark computation edge function |

## Test Cases

### 1. Address Normalization (Phase 1)
- Strips special characters, lowercases, trims whitespace
- Handles multiple spaces, leading/trailing spaces

### 2. Price Band Logic (Phase 2)
- Rent ≤ benchmark max → "within"
- Rent > max but ≤ soft cap (1.25×) → "above"
- Rent > soft cap but ≤ hard cap (1.50×) → "pending_justification"
- Rent > hard cap → "rejected"

### 3. Duplicate Detection Edge Function (Phase 1 + 3)
- Returns `low` when no existing properties
- Returns `low` with no matching fields
- Tests GPS proximity scoring
- Tests GhanaPost GPS exact match
- Tests normalized address similarity

### 4. Benchmark Computation Edge Function (Phase 2)
- Returns valid benchmark for known zone + property class
- Falls back to region average for unknown area
- Correctly computes soft_cap and hard_cap
- Returns correct pricing_band for given asking_rent

## Technical Notes

- Frontend tests use Vitest + jsdom (already configured)
- Edge function tests use Deno test runner with dotenv for credentials
- The `normalizeAddress` function is inline in `RegisterProperty.tsx` — we'll import/re-export or duplicate the logic in the test
- Price band logic is computed inside `compute-rent-benchmark` edge function — we'll extract and test the decision table separately

