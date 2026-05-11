
ALTER TABLE public.units DISABLE TRIGGER USER;
ALTER TABLE public.tenancies DISABLE TRIGGER USER;

WITH latest AS (
  SELECT DISTINCT ON (unit_id) unit_id, proposed_rent, reviewed_at
  FROM public.rent_increase_requests
  WHERE status = 'approved' AND unit_id IS NOT NULL
  ORDER BY unit_id, reviewed_at DESC NULLS LAST, created_at DESC
)
UPDATE public.units u
SET monthly_rent = l.proposed_rent,
    rent_locked_at = COALESCE(l.reviewed_at, now()),
    rent_locked_amount = l.proposed_rent
FROM latest l
WHERE u.id = l.unit_id
  AND COALESCE(u.monthly_rent, 0) <> COALESCE(l.proposed_rent, 0);

WITH latest AS (
  SELECT DISTINCT ON (unit_id) unit_id, proposed_rent
  FROM public.rent_increase_requests
  WHERE status = 'approved' AND unit_id IS NOT NULL
  ORDER BY unit_id, reviewed_at DESC NULLS LAST, created_at DESC
)
UPDATE public.tenancies t
SET agreed_rent = l.proposed_rent
FROM latest l
WHERE t.unit_id = l.unit_id
  AND t.status IN ('active','pending','renewal_window','existing_declared')
  AND COALESCE(t.agreed_rent, 0) <> COALESCE(l.proposed_rent, 0);

ALTER TABLE public.units ENABLE TRIGGER USER;
ALTER TABLE public.tenancies ENABLE TRIGGER USER;
