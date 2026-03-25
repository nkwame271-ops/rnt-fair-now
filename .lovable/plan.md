

# Database Optimization Plan

## Key Findings

**Critical**: The `user_roles` table has **1.47 million sequential scans** because every RLS policy calls `has_role()`, which does a full table scan each time. This is the single biggest performance bottleneck.

**Missing indexes**: All newly added `office_id` columns (cases, escrow_transactions, complaints, tenancies, properties, etc.) have zero indexes — every office-filtered dashboard query triggers sequential scans.

**Duplicate index**: `feature_flags` has two identical unique indexes on `feature_key` (`feature_flags_feature_key_key` and `feature_flags_feature_key_unique`).

**No vacuum**: Several tables with dead tuples have never been vacuumed manually.

---

## Migration: Add Missing Indexes + Remove Duplicates

One migration with all changes:

### 1. Fix the has_role() bottleneck
```sql
-- Composite index on user_roles for has_role() function
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
  ON public.user_roles(user_id, role);
```
This directly targets the `has_role(user_id, role)` lookup pattern used in every RLS policy.

### 2. Index all office_id columns (dashboard filtering)
```sql
CREATE INDEX IF NOT EXISTS idx_cases_office_id ON public.cases(office_id);
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_case_type ON public.cases(case_type);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_office_id ON public.escrow_transactions(office_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status ON public.escrow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_splits_office_id ON public.escrow_splits(office_id);
CREATE INDEX IF NOT EXISTS idx_escrow_splits_escrow_tx ON public.escrow_splits(escrow_transaction_id);
CREATE INDEX IF NOT EXISTS idx_escrow_splits_recipient ON public.escrow_splits(recipient);
CREATE INDEX IF NOT EXISTS idx_complaints_office_id ON public.complaints(office_id);
CREATE INDEX IF NOT EXISTS idx_landlord_complaints_office_id ON public.landlord_complaints(office_id);
CREATE INDEX IF NOT EXISTS idx_landlord_complaints_landlord ON public.landlord_complaints(landlord_user_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_office_id ON public.tenancies(office_id);
CREATE INDEX IF NOT EXISTS idx_properties_office_id ON public.properties(office_id);
CREATE INDEX IF NOT EXISTS idx_admin_staff_office_id ON public.admin_staff(office_id);
```

### 3. Index rent_cards status (1036 rows, 323 seq scans)
```sql
CREATE INDEX IF NOT EXISTS idx_rent_cards_status ON public.rent_cards(status);
CREATE INDEX IF NOT EXISTS idx_rent_cards_purchase_id ON public.rent_cards(purchase_id);
```

### 4. Index complaint_schedules and tenancy_signatures for join queries
```sql
CREATE INDEX IF NOT EXISTS idx_complaint_schedules_complaint ON public.complaint_schedules(complaint_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_signatures_tenancy ON public.tenancy_signatures(tenancy_id);
```

### 5. Index payment_receipts for receipt lookups
```sql
CREATE INDEX IF NOT EXISTS idx_payment_receipts_escrow_tx ON public.payment_receipts(escrow_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_receipt_number ON public.payment_receipts(receipt_number);
```

### 6. Remove duplicate index
```sql
DROP INDEX IF EXISTS public.feature_flags_feature_key_unique;
```

### 7. Analyze tables to update query planner statistics
```sql
ANALYZE public.user_roles;
ANALYZE public.feature_flags;
ANALYZE public.escrow_transactions;
ANALYZE public.cases;
ANALYZE public.complaints;
ANALYZE public.tenancies;
ANALYZE public.properties;
ANALYZE public.rent_cards;
ANALYZE public.notifications;
ANALYZE public.profiles;
```

---

## Expected Impact

| Issue | Before | After |
|---|---|---|
| `has_role()` per RLS check | Seq scan on user_roles | Index scan on (user_id, role) |
| Office-filtered dashboards | Seq scan every table | Index scan on office_id |
| Escrow dashboard aggregations | Seq scan splits | Index on recipient + office_id |
| Duplicate index overhead | 2 identical indexes | 1 index (saves write overhead) |
| Query planner accuracy | Stale statistics | Fresh ANALYZE |

---

## Summary

- **1 migration** with ~25 CREATE INDEX statements, 1 DROP INDEX, and ANALYZE commands
- No schema changes, no code changes, no downtime
- All indexes use `IF NOT EXISTS` for safety

