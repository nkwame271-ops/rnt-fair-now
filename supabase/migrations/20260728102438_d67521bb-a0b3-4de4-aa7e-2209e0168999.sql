CREATE POLICY "Regulators read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'regulator'::app_role));