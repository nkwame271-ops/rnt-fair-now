-- Allow admin staff (regulators/main/super admins) to file complaints on behalf of users
CREATE POLICY "Admin staff can file complaints"
ON public.complaints
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()
  )
);
