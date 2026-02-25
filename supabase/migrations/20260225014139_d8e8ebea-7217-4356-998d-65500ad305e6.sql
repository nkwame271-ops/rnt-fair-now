
-- Allow landlords to search tenant records (needed for AddTenant flow)
CREATE POLICY "Landlords can search tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'landlord'::app_role));

-- Allow all authenticated users to view profiles 
-- (needed for tenant↔landlord name display across the platform)
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
