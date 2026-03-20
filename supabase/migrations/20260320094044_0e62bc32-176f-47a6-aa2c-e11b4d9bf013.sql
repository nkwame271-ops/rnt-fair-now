-- Allow regulators to delete serial stock (needed for re-uploading revoked serials)
CREATE POLICY "Regulators can delete serial stock"
ON public.rent_card_serial_stock
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'regulator'::app_role));