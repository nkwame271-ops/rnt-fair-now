
-- Complainants can read documents for cases they filed
CREATE POLICY "Complainants read own case documents"
ON public.complaint_documents FOR SELECT
TO authenticated
USING (
  status = 'finalized' AND EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_documents.case_id
      AND c.tenant_user_id = auth.uid()
  )
);

-- Storage: allow complainants to read finalized form PDFs for their own cases
CREATE POLICY "Complainants read own form-outputs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'form-outputs'
  AND EXISTS (
    SELECT 1 FROM public.complaint_documents d
    JOIN public.complaints c ON c.id = d.case_id
    WHERE d.file_url = storage.objects.name
      AND d.status = 'finalized'
      AND c.tenant_user_id = auth.uid()
  )
);

-- Allow landlords to submit management requests via management_task_assignments
DROP POLICY IF EXISTS "Landlords insert management requests" ON public.management_task_assignments;
CREATE POLICY "Landlords insert management requests"
ON public.management_task_assignments FOR INSERT
TO authenticated
WITH CHECK (
  task_type IN ('landlord_request','buy_rent_card','rent_card_delivery','onboard_new_tenant','inquiry','other_request')
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = management_task_assignments.property_id
      AND p.landlord_user_id = auth.uid()
      AND p.management_enabled = true
  )
);

DROP POLICY IF EXISTS "Landlords read own management tasks" ON public.management_task_assignments;
CREATE POLICY "Landlords read own management tasks"
ON public.management_task_assignments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = management_task_assignments.property_id
      AND p.landlord_user_id = auth.uid()
  )
);
