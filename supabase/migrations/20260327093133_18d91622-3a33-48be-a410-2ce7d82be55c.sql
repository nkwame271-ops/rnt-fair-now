CREATE POLICY "Tenants can read landlord profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'tenant'::app_role)
    AND public.has_role(user_id, 'landlord'::app_role)
  );