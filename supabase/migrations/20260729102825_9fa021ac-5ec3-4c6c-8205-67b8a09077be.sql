CREATE POLICY "Regulators can insert audit log"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_main_admin(auth.uid()) AND admin_user_id = auth.uid());