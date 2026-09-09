CREATE OR REPLACE FUNCTION public.readable_escrow_transaction_id_set()
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _main boolean;
  _reg boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;
  _main := is_main_admin(_uid);
  _reg := has_role(_uid, 'regulator'::app_role);

  IF _main AND _reg THEN
    RETURN QUERY SELECT et.id FROM public.escrow_transactions et;
  ELSIF _reg THEN
    RETURN QUERY SELECT et.id FROM public.escrow_transactions et
      WHERE et.is_student_revenue = false OR et.user_id = _uid;
  ELSIF _main THEN
    RETURN QUERY SELECT et.id FROM public.escrow_transactions et
      WHERE et.is_student_revenue = true OR et.user_id = _uid;
  ELSE
    RETURN QUERY SELECT et.id FROM public.escrow_transactions et WHERE et.user_id = _uid;
  END IF;
END;
$$;