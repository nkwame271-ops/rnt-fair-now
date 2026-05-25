
DROP POLICY IF EXISTS "Tenants can read landlord profiles" ON public.profiles;
CREATE POLICY "Tenants can read landlord profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'tenant'::app_role)
  AND has_role(user_id, 'landlord'::app_role)
  AND (
    EXISTS (SELECT 1 FROM public.tenancies t
            WHERE t.landlord_user_id = profiles.user_id AND t.tenant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.rental_applications ra
               WHERE ra.landlord_user_id = profiles.user_id AND ra.tenant_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload evidence" ON storage.objects;
CREATE POLICY "Authenticated users can upload evidence"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'application-evidence'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] = 'complaints'
      AND EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND c.tenant_user_id = auth.uid()
      )
    )
    OR (
      (storage.foldername(name))[1] = 'landlord-complaints'
      AND EXISTS (
        SELECT 1 FROM public.landlord_complaints lc
        WHERE lc.id::text = (storage.foldername(name))[2]
          AND lc.landlord_user_id = auth.uid()
      )
    )
    OR has_role(auth.uid(), 'regulator'::app_role)
  )
);

DROP POLICY IF EXISTS "Admin manage witnesses" ON public.complaint_witnesses;
CREATE POLICY "Admin staff read witnesses"
ON public.complaint_witnesses
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));

CREATE POLICY "Privileged admins or assigned officers manage witnesses"
ON public.complaint_witnesses
FOR ALL
TO authenticated
USING (
  is_main_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'regulator'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_witnesses.case_id
      AND c.assigned_officer_user_id = auth.uid()
  )
)
WITH CHECK (
  is_main_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'regulator'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_witnesses.case_id
      AND c.assigned_officer_user_id = auth.uid()
  )
);
