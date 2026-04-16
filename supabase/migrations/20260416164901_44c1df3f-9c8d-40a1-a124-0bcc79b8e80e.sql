-- 1. Add NUGS admin role to enum (must be in its own transaction to be usable later)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'nugs_admin';

-- 2. Add student fields to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_student boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS school text,
  ADD COLUMN IF NOT EXISTS hostel_or_hall text,
  ADD COLUMN IF NOT EXISTS room_or_bed_space text;

-- 3. Add template_type column to agreement_template_config (allow multiple types)
ALTER TABLE public.agreement_template_config
  ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS template_label text NOT NULL DEFAULT 'Standard Tenancy Agreement';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agreement_template_config_template_type_key'
  ) THEN
    ALTER TABLE public.agreement_template_config
      ADD CONSTRAINT agreement_template_config_template_type_key UNIQUE (template_type);
  END IF;
END $$;

-- Seed hostel template if not exists
INSERT INTO public.agreement_template_config (template_type, template_label, terms, custom_fields)
SELECT 'hostel', 'Hostel Tenancy Agreement',
  ARRAY[
    'The Student/Tenant shall pay hostel fees as agreed for the academic period.',
    'Hostel rules and regulations of the institution apply in addition to this agreement.',
    'Bed space or room assignment may be reviewed by the hostel management each academic year.',
    'The Tenant/Student shall not sublet the room or bed space to any third party.',
    'The Hostel Operator shall maintain the property in habitable condition with water and electricity.',
    'Damage to hostel property beyond normal wear and tear shall be paid for by the responsible Tenant.'
  ]::text[],
  '[]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.agreement_template_config WHERE template_type = 'hostel'
);