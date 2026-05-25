
DROP POLICY IF EXISTS "Landlords can read tenant profiles" ON public.profiles;
CREATE POLICY "Landlords can read related tenant profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'landlord')
  AND (
    EXISTS (SELECT 1 FROM public.tenancies t
            WHERE t.landlord_user_id = auth.uid()
              AND t.tenant_user_id = profiles.user_id)
    OR EXISTS (SELECT 1 FROM public.rental_applications ra
               WHERE ra.landlord_user_id = auth.uid()
                 AND ra.tenant_user_id = profiles.user_id)
  )
);

DROP POLICY IF EXISTS "Landlords can search tenants" ON public.tenants;
CREATE POLICY "Landlords can read related tenants"
ON public.tenants FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'landlord')
  AND (
    EXISTS (SELECT 1 FROM public.tenancies t
            WHERE t.landlord_user_id = auth.uid()
              AND t.tenant_user_id = tenants.user_id)
    OR EXISTS (SELECT 1 FROM public.rental_applications ra
               WHERE ra.landlord_user_id = auth.uid()
                 AND ra.tenant_user_id = tenants.user_id)
  )
);

CREATE POLICY "Admins can read own staff record"
ON public.admin_staff FOR SELECT
TO authenticated
USING (user_id = auth.uid());

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
