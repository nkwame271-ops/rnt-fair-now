
CREATE POLICY "Regulators can delete api keys"
  ON public.api_keys
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'::app_role));
