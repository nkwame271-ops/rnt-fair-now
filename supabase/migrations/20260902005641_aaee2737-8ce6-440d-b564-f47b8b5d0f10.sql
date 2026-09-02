CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix text := 'RCT-' || to_char(now(), 'YYYYMMDD') || '-';
  v_seq text;
  v_candidate text;
  i int := 0;
BEGIN
  LOOP
    i := i + 1;
    v_seq := nextval('public.receipt_number_seq')::text;
    -- NOTE: lpad() TRUNCATES values longer than the target width, which previously
    -- collapsed every number above 9999 to four digits and caused duplicate keys.
    IF length(v_seq) < 4 THEN
      v_seq := lpad(v_seq, 4, '0');
    END IF;
    v_candidate := v_prefix || v_seq;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.payment_receipts WHERE receipt_number = v_candidate
    );
    IF i >= 25 THEN
      v_candidate := v_candidate || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
      EXIT;
    END IF;
  END LOOP;
  RETURN v_candidate;
END
$function$;