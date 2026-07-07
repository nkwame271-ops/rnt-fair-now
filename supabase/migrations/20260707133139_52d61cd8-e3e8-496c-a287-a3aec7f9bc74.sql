
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent';

CREATE TABLE IF NOT EXISTS public.agent_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  professional_photo_url text,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  date_of_birth date,
  id_type text NOT NULL,
  id_number text NOT NULL,
  region text NOT NULL,
  operating_area text,
  residential_address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  supporting_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  reviewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes text,
  reviewed_at timestamptz,
  approved_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_applications_status ON public.agent_applications(status);
CREATE INDEX IF NOT EXISTS idx_agent_applications_applicant ON public.agent_applications(applicant_user_id);

GRANT SELECT, INSERT, UPDATE ON public.agent_applications TO authenticated;
GRANT SELECT, INSERT ON public.agent_applications TO anon;
GRANT ALL ON public.agent_applications TO service_role;
ALTER TABLE public.agent_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an agent application"
  ON public.agent_applications FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Applicant can view own application"
  ON public.agent_applications FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());
CREATE POLICY "Admins can view all applications"
  ON public.agent_applications FOR SELECT TO authenticated
  USING (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins can update applications"
  ON public.agent_applications FOR UPDATE TO authenticated
  USING (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.agent_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.agent_applications(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  full_name text,
  phone text,
  email text,
  professional_photo_url text,
  region text,
  operating_area text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.agent_staff TO authenticated;
GRANT ALL ON public.agent_staff TO service_role;
ALTER TABLE public.agent_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent reads own record"
  ON public.agent_staff FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins read all agents"
  ON public.agent_staff FOR SELECT TO authenticated
  USING (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins manage agents"
  ON public.agent_staff FOR ALL TO authenticated
  USING (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_agent(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.agent_staff WHERE user_id = _user_id AND status = 'active')
$$;

CREATE TABLE IF NOT EXISTS public.agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_role text NOT NULL CHECK (owner_role IN ('landlord','tenant')),
  scope_notes text,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_user_id, owner_user_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_assignments_agent ON public.agent_assignments(agent_user_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_agent_assignments_owner ON public.agent_assignments(owner_user_id) WHERE active;

GRANT SELECT ON public.agent_assignments TO authenticated;
GRANT ALL ON public.agent_assignments TO service_role;
ALTER TABLE public.agent_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent reads own assignments"
  ON public.agent_assignments FOR SELECT TO authenticated
  USING (agent_user_id = auth.uid());
CREATE POLICY "Owner reads own assignments"
  ON public.agent_assignments FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());
CREATE POLICY "Admins manage assignments"
  ON public.agent_assignments FOR ALL TO authenticated
  USING (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.agent_can_act_on(_agent uuid, _owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_assignments
    WHERE agent_user_id = _agent AND owner_user_id = _owner AND active
  )
$$;

CREATE TABLE IF NOT EXISTS public.agent_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_table text,
  target_record_id text,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_log_agent ON public.agent_action_log(agent_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_log_target ON public.agent_action_log(target_user_id, created_at DESC);

GRANT SELECT, INSERT ON public.agent_action_log TO authenticated;
GRANT ALL ON public.agent_action_log TO service_role;
ALTER TABLE public.agent_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent reads own action log"
  ON public.agent_action_log FOR SELECT TO authenticated
  USING (agent_user_id = auth.uid());
CREATE POLICY "Target owner reads log about them"
  ON public.agent_action_log FOR SELECT TO authenticated
  USING (target_user_id = auth.uid());
CREATE POLICY "Admins read all action logs"
  ON public.agent_action_log FOR SELECT TO authenticated
  USING (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Agent inserts own action log"
  ON public.agent_action_log FOR INSERT TO authenticated
  WITH CHECK (agent_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_agent_applications_touch ON public.agent_applications;
CREATE TRIGGER trg_agent_applications_touch BEFORE UPDATE ON public.agent_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS trg_agent_staff_touch ON public.agent_staff;
CREATE TRIGGER trg_agent_staff_touch BEFORE UPDATE ON public.agent_staff
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS trg_agent_assignments_touch ON public.agent_assignments;
CREATE TRIGGER trg_agent_assignments_touch BEFORE UPDATE ON public.agent_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
