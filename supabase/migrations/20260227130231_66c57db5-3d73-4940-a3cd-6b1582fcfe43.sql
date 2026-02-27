
-- 1. Tenant Preferences table
CREATE TABLE public.tenant_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id uuid NOT NULL,
  current_location text,
  preferred_location text,
  property_type text,
  min_budget numeric,
  max_budget numeric,
  preferred_move_in_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own preferences" ON public.tenant_preferences
  FOR ALL USING (auth.uid() = tenant_user_id)
  WITH CHECK (auth.uid() = tenant_user_id);

CREATE POLICY "Regulators read all preferences" ON public.tenant_preferences
  FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE UNIQUE INDEX idx_tenant_preferences_user ON public.tenant_preferences(tenant_user_id);

-- 2. Rental Applications table
CREATE TABLE public.rental_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id uuid NOT NULL,
  landlord_user_id uuid NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  viewing_request_id uuid REFERENCES public.viewing_requests(id),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rental_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own applications" ON public.rental_applications
  FOR ALL USING (auth.uid() = tenant_user_id)
  WITH CHECK (auth.uid() = tenant_user_id);

CREATE POLICY "Landlords view applications for their properties" ON public.rental_applications
  FOR SELECT USING (auth.uid() = landlord_user_id);

CREATE POLICY "Landlords update application status" ON public.rental_applications
  FOR UPDATE USING (auth.uid() = landlord_user_id);

CREATE POLICY "Regulators read all applications" ON public.rental_applications
  FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

-- 3. Ratings table
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_user_id uuid NOT NULL,
  rated_user_id uuid NOT NULL,
  tenancy_id uuid NOT NULL REFERENCES public.tenancies(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rater_user_id, tenancy_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own ratings" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_user_id);

CREATE POLICY "Users read ratings for their tenancies" ON public.ratings
  FOR SELECT USING (
    auth.uid() = rater_user_id OR auth.uid() = rated_user_id
  );

CREATE POLICY "Regulators read all ratings" ON public.ratings
  FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

-- 4. Enable realtime for marketplace_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_messages;

-- 5. Triggers for updated_at
CREATE TRIGGER update_tenant_preferences_updated_at
  BEFORE UPDATE ON public.tenant_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rental_applications_updated_at
  BEFORE UPDATE ON public.rental_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. DB function to notify matching tenants when a new unit is listed
CREATE OR REPLACE FUNCTION public.notify_matching_tenants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop RECORD;
  pref RECORD;
BEGIN
  -- Only trigger when listing on marketplace
  IF NEW.status = 'vacant' THEN
    SELECT * INTO prop FROM public.properties WHERE id = NEW.property_id;
    
    FOR pref IN
      SELECT tp.tenant_user_id
      FROM public.tenant_preferences tp
      WHERE (tp.preferred_location IS NULL OR tp.preferred_location = '' OR prop.area ILIKE '%' || tp.preferred_location || '%' OR prop.region ILIKE '%' || tp.preferred_location || '%')
        AND (tp.property_type IS NULL OR tp.property_type = '' OR tp.property_type = NEW.unit_type)
        AND (tp.max_budget IS NULL OR tp.max_budget >= NEW.monthly_rent)
        AND (tp.min_budget IS NULL OR tp.min_budget <= NEW.monthly_rent)
    LOOP
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (
        pref.tenant_user_id,
        'New Property Match!',
        'A new ' || NEW.unit_type || ' in ' || prop.area || ', ' || prop.region || ' at GH₵' || NEW.monthly_rent || '/mo matches your preferences.',
        '/tenant/marketplace'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_tenants_on_new_listing
  AFTER INSERT ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.notify_matching_tenants();
