-- Realign the counter past every number already issued today so freshly drawn
-- numbers cannot collide with existing rows.
DO $$
DECLARE v_max bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(receipt_number, '-', 3), '\D', '', 'g'), '')::bigint), 0)
    INTO v_max
  FROM public.payment_receipts
  WHERE receipt_number LIKE 'RCT-' || to_char(now(), 'YYYYMMDD') || '-%';
  PERFORM setval('public.receipt_number_seq', GREATEST(v_max, (SELECT last_value FROM public.receipt_number_seq)) + 1, false);
END $$;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix text := 'RCT-' || to_char(now(), 'YYYYMMDD') || '-';
  v_candidate text;
  i int := 0;
BEGIN
  LOOP
    i := i + 1;
    v_candidate := v_prefix || lpad(nextval('public.receipt_number_seq')::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.payment_receipts WHERE receipt_number = v_candidate
    );
    IF i >= 25 THEN
      -- Last resort: guarantee uniqueness with a random suffix.
      v_candidate := v_candidate || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
      EXIT;
    END IF;
  END LOOP;
  RETURN v_candidate;
END
$function$;