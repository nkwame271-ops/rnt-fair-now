
-- 1. module_visibility_config
CREATE TABLE public.module_visibility_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'all',
  allowed_admin_ids UUID[] DEFAULT '{}',
  label_override TEXT,
  level TEXT NOT NULL DEFAULT 'section',
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(module_key, section_key)
);

ALTER TABLE public.module_visibility_config ENABLE ROW LEVEL SECURITY;

-- Security definer to check super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_staff
    WHERE user_id = _user_id AND admin_type = 'super_admin'
  )
$$;

CREATE POLICY "Admins can read visibility config"
  ON public.module_visibility_config FOR SELECT
  TO authenticated
  USING (
    public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can insert visibility config"
  ON public.module_visibility_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update visibility config"
  ON public.module_visibility_config FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete visibility config"
  ON public.module_visibility_config FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 2. feature_label_overrides
CREATE TABLE public.feature_label_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL,
  portal TEXT NOT NULL DEFAULT 'admin',
  original_label TEXT NOT NULL,
  custom_label TEXT NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(feature_key, portal)
);

ALTER TABLE public.feature_label_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read label overrides"
  ON public.feature_label_overrides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can insert label overrides"
  ON public.feature_label_overrides FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update label overrides"
  ON public.feature_label_overrides FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete label overrides"
  ON public.feature_label_overrides FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 3. platform_config
CREATE TABLE public.platform_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read platform config"
  ON public.platform_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can update platform config"
  ON public.platform_config FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert platform config"
  ON public.platform_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Seed default operational_start_date
INSERT INTO public.platform_config (config_key, config_value, description)
VALUES ('operational_start_date', '"2025-04-07"', 'Date from which reports and ledger calculations start. Data before this date is excluded from operational views.');

-- 4. Allow sub_admin read on visibility config
CREATE POLICY "Sub admins can read visibility config"
  ON public.module_visibility_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid())
  );

-- Drop the more restrictive read policy and replace with the broader one
DROP POLICY "Admins can read visibility config" ON public.module_visibility_config;
