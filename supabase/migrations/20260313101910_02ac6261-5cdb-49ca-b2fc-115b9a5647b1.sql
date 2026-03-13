
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL,
  api_key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  created_by uuid
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators can manage api keys"
  ON public.api_keys
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'regulator'::app_role));
