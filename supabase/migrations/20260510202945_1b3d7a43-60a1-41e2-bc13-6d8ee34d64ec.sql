-- Trigger: when a tenancy is deleted, unlink any rent cards attached to it
-- so they immediately return to the landlord's reusable pool.
CREATE OR REPLACE FUNCTION public.unlink_rent_cards_on_tenancy_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rent_cards
  SET tenancy_id = NULL,
      tenant_user_id = NULL,
      property_id = NULL,
      unit_id = NULL,
      start_date = NULL,
      expiry_date = NULL,
      current_rent = NULL,
      previous_rent = NULL,
      advance_paid = NULL,
      last_payment_status = NULL,
      activated_at = NULL,
      qr_token = NULL,
      status = CASE
        WHEN serial_number IS NOT NULL THEN 'valid'
        ELSE 'awaiting_serial'
      END
  WHERE tenancy_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_unlink_rent_cards_on_tenancy_delete ON public.tenancies;
CREATE TRIGGER trg_unlink_rent_cards_on_tenancy_delete
AFTER DELETE ON public.tenancies
FOR EACH ROW
EXECUTE FUNCTION public.unlink_rent_cards_on_tenancy_delete();