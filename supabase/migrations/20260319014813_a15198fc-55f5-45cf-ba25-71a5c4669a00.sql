CREATE POLICY "Regulators can update rent cards"
ON public.rent_cards
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'regulator'::app_role))
WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));