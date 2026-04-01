
-- FIX: notifications INSERT - restrict to service_role only
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Service role inserts notifications"
ON public.notifications FOR INSERT
TO service_role
WITH CHECK (true);

-- FIX: rent_market_data INSERT - restrict to regulators only
DROP POLICY IF EXISTS "Authenticated insert market data" ON public.rent_market_data;
CREATE POLICY "Regulators insert market data"
ON public.rent_market_data FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));
