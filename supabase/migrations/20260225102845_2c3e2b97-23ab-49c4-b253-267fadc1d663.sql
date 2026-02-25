
ALTER TABLE public.agreement_template_config ADD COLUMN custom_fields jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.tenancies ADD COLUMN custom_field_values jsonb DEFAULT '{}'::jsonb;
