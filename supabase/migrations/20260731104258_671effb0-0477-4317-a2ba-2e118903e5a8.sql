
-- Agents may read the profile of clients assigned to them (and the tenants of those clients' tenancies)
CREATE OR REPLACE FUNCTION public.agent_can_view_profile(_agent uuid, _profile_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_assignments aa
    WHERE aa.agent_user_id = _agent AND aa.active AND aa.owner_user_id = _profile_user
  )
  OR EXISTS (
    SELECT 1
    FROM public.agent_assignments aa
    JOIN public.tenancies t
      ON t.landlord_user_id = aa.owner_user_id
    WHERE aa.agent_user_id = _agent AND aa.active AND t.tenant_user_id = _profile_user
  )
$$;

DROP POLICY IF EXISTS "Agents read assigned client profiles" ON public.profiles;
CREATE POLICY "Agents read assigned client profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.agent_can_view_profile(auth.uid(), user_id));

DROP POLICY IF EXISTS "Agents read assigned client tenancies" ON public.tenancies;
CREATE POLICY "Agents read assigned client tenancies"
ON public.tenancies
FOR SELECT
TO authenticated
USING (
  public.agent_can_act_on(auth.uid(), landlord_user_id)
  OR (tenant_user_id IS NOT NULL AND public.agent_can_act_on(auth.uid(), tenant_user_id))
);

DROP POLICY IF EXISTS "Agents read assigned client tasks" ON public.management_task_assignments;
CREATE POLICY "Agents read assigned client tasks"
ON public.management_task_assignments
FOR SELECT
TO authenticated
USING (
  assigned_staff_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = management_task_assignments.property_id
      AND public.agent_can_act_on(auth.uid(), p.landlord_user_id)
  )
);

DROP POLICY IF EXISTS "Agents log own actions" ON public.agent_action_log;
CREATE POLICY "Agents log own actions"
ON public.agent_action_log
FOR INSERT
TO authenticated
WITH CHECK (agent_user_id = auth.uid());
