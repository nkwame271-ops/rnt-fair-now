
ALTER TABLE public.landlord_complaints
  ALTER COLUMN landlord_user_id DROP NOT NULL;

ALTER TABLE public.landlord_complaints
  ADD COLUMN IF NOT EXISTS placeholder_landlord_name text,
  ADD COLUMN IF NOT EXISTS placeholder_landlord_phone text,
  ADD COLUMN IF NOT EXISTS placeholder_respondent_name text,
  ADD COLUMN IF NOT EXISTS placeholder_respondent_phone text,
  ADD COLUMN IF NOT EXISTS complainant_role text,
  ADD COLUMN IF NOT EXISTS respondent_role text,
  ADD COLUMN IF NOT EXISTS filed_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_filer_user_id uuid,
  ADD COLUMN IF NOT EXISTS filing_fee_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS physical_docket_ref text,
  ADD COLUMN IF NOT EXISTS rent_amount numeric,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric,
  ADD COLUMN IF NOT EXISTS agreement_expiry_date date,
  ADD COLUMN IF NOT EXISTS occupied_months integer,
  ADD COLUMN IF NOT EXISTS tenants_intent text,
  ADD COLUMN IF NOT EXISTS relief_sought text,
  ADD COLUMN IF NOT EXISTS complainants jsonb,
  ADD COLUMN IF NOT EXISTS respondents jsonb,
  ADD COLUMN IF NOT EXISTS premises_house_no text,
  ADD COLUMN IF NOT EXISTS premises_town text,
  ADD COLUMN IF NOT EXISTS complainant_address text,
  ADD COLUMN IF NOT EXISTS complainant_gps_lat numeric,
  ADD COLUMN IF NOT EXISTS complainant_gps_lng numeric,
  ADD COLUMN IF NOT EXISTS gps_confirmed boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Admin staff can insert landlord complaints" ON public.landlord_complaints;
CREATE POLICY "Admin staff can insert landlord complaints"
  ON public.landlord_complaints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'regulator'::app_role)
  );

DROP POLICY IF EXISTS "Admin staff can update landlord complaints" ON public.landlord_complaints;
CREATE POLICY "Admin staff can update landlord complaints"
  ON public.landlord_complaints
  FOR UPDATE
  TO authenticated
  USING (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'regulator'::app_role)
  )
  WITH CHECK (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'regulator'::app_role)
  );
