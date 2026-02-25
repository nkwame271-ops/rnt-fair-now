
-- Drop the existing RESTRICTIVE policies on user_roles
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Regulators can read all roles" ON public.user_roles;

-- Recreate as PERMISSIVE policies (default) so ANY matching policy grants access
CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Regulators can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'regulator'::app_role));
