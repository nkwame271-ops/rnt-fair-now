
-- Admin staff hierarchy table
CREATE TABLE public.admin_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  admin_type text NOT NULL DEFAULT 'sub_admin',
  office_id text,
  office_name text,
  allowed_features text[] DEFAULT '{}',
  muted_features text[] DEFAULT '{}',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_staff ENABLE ROW LEVEL SECURITY;

-- All regulators can read
CREATE POLICY "Regulators read admin_staff" ON public.admin_staff
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

-- Use security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_staff WHERE user_id = _user_id AND admin_type = 'main_admin'
  )
$$;

-- Main admins can insert
CREATE POLICY "Main admins insert admin_staff" ON public.admin_staff
  FOR INSERT TO authenticated
  WITH CHECK (public.is_main_admin(auth.uid()));

-- Main admins can update
CREATE POLICY "Main admins update admin_staff" ON public.admin_staff
  FOR UPDATE TO authenticated
  USING (public.is_main_admin(auth.uid()));

-- Service role full access
CREATE POLICY "Service role manages admin_staff" ON public.admin_staff
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
