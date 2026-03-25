
-- Remove duplicate unique constraint (it's a constraint, not a bare index)
ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_feature_key_unique;

-- Re-analyze after previous index creation
ANALYZE public.feature_flags;
