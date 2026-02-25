
-- =============================================
-- Fix all RLS policies: drop RESTRICTIVE, recreate as PERMISSIVE
-- =============================================

-- user_roles
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Regulators can read all roles" ON public.user_roles;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Regulators can read all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

-- profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Regulators can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Regulators can read all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));
CREATE POLICY "Landlords can read tenant profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'landlord'::app_role));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- properties
DROP POLICY IF EXISTS "Authenticated can view properties" ON public.properties;
DROP POLICY IF EXISTS "Landlords manage own properties" ON public.properties;
DROP POLICY IF EXISTS "Regulators can read all properties" ON public.properties;

CREATE POLICY "Authenticated can view properties" ON public.properties FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Landlords manage own properties" ON public.properties FOR ALL USING (auth.uid() = landlord_user_id);
CREATE POLICY "Regulators can read all properties" ON public.properties FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

-- property_images
DROP POLICY IF EXISTS "Anyone can view property images" ON public.property_images;
DROP POLICY IF EXISTS "Landlords manage own property images" ON public.property_images;

CREATE POLICY "Anyone can view property images" ON public.property_images FOR SELECT USING (true);
CREATE POLICY "Landlords manage own property images" ON public.property_images FOR ALL USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = property_images.property_id AND properties.landlord_user_id = auth.uid()));

-- units
DROP POLICY IF EXISTS "Authenticated can view units" ON public.units;
DROP POLICY IF EXISTS "Landlords manage own units" ON public.units;

CREATE POLICY "Authenticated can view units" ON public.units FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Landlords manage own units" ON public.units FOR ALL USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = units.property_id AND properties.landlord_user_id = auth.uid()));

-- tenancies
DROP POLICY IF EXISTS "Landlords create tenancies" ON public.tenancies;
DROP POLICY IF EXISTS "Landlords view own tenancies" ON public.tenancies;
DROP POLICY IF EXISTS "Participants update tenancies" ON public.tenancies;
DROP POLICY IF EXISTS "Regulators read all tenancies" ON public.tenancies;
DROP POLICY IF EXISTS "Tenants view own tenancies" ON public.tenancies;

CREATE POLICY "Landlords create tenancies" ON public.tenancies FOR INSERT WITH CHECK (auth.uid() = landlord_user_id);
CREATE POLICY "Landlords view own tenancies" ON public.tenancies FOR SELECT USING (auth.uid() = landlord_user_id);
CREATE POLICY "Tenants view own tenancies" ON public.tenancies FOR SELECT USING (auth.uid() = tenant_user_id);
CREATE POLICY "Participants update tenancies" ON public.tenancies FOR UPDATE USING ((auth.uid() = tenant_user_id) OR (auth.uid() = landlord_user_id));
CREATE POLICY "Regulators read all tenancies" ON public.tenancies FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

-- rent_payments
DROP POLICY IF EXISTS "Landlords insert payments" ON public.rent_payments;
DROP POLICY IF EXISTS "Landlords view own payments" ON public.rent_payments;
DROP POLICY IF EXISTS "Participants update payments" ON public.rent_payments;
DROP POLICY IF EXISTS "Regulators read all payments" ON public.rent_payments;
DROP POLICY IF EXISTS "Tenants view own payments" ON public.rent_payments;

CREATE POLICY "Landlords insert payments" ON public.rent_payments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM tenancies WHERE tenancies.id = rent_payments.tenancy_id AND tenancies.landlord_user_id = auth.uid()));
CREATE POLICY "Landlords view own payments" ON public.rent_payments FOR SELECT USING (EXISTS (SELECT 1 FROM tenancies WHERE tenancies.id = rent_payments.tenancy_id AND tenancies.landlord_user_id = auth.uid()));
CREATE POLICY "Tenants view own payments" ON public.rent_payments FOR SELECT USING (EXISTS (SELECT 1 FROM tenancies WHERE tenancies.id = rent_payments.tenancy_id AND tenancies.tenant_user_id = auth.uid()));
CREATE POLICY "Participants update payments" ON public.rent_payments FOR UPDATE USING (EXISTS (SELECT 1 FROM tenancies WHERE tenancies.id = rent_payments.tenancy_id AND (tenancies.tenant_user_id = auth.uid() OR tenancies.landlord_user_id = auth.uid())));
CREATE POLICY "Regulators read all payments" ON public.rent_payments FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

-- complaints
DROP POLICY IF EXISTS "Regulators read all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Regulators update complaints" ON public.complaints;
DROP POLICY IF EXISTS "Tenants manage own complaints" ON public.complaints;

CREATE POLICY "Tenants manage own complaints" ON public.complaints FOR ALL USING (auth.uid() = tenant_user_id);
CREATE POLICY "Regulators read all complaints" ON public.complaints FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));
CREATE POLICY "Regulators update complaints" ON public.complaints FOR UPDATE USING (has_role(auth.uid(), 'regulator'::app_role));

-- landlords
DROP POLICY IF EXISTS "Regulators can read all landlords" ON public.landlords;
DROP POLICY IF EXISTS "Users can insert own landlord record" ON public.landlords;
DROP POLICY IF EXISTS "Users can read own landlord record" ON public.landlords;
DROP POLICY IF EXISTS "Users can update own landlord record" ON public.landlords;

CREATE POLICY "Users can read own landlord record" ON public.landlords FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own landlord record" ON public.landlords FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own landlord record" ON public.landlords FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Regulators can read all landlords" ON public.landlords FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

-- tenants
DROP POLICY IF EXISTS "Landlords can search tenants" ON public.tenants;
DROP POLICY IF EXISTS "Regulators can read all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can insert own tenant record" ON public.tenants;
DROP POLICY IF EXISTS "Users can read own tenant record" ON public.tenants;
DROP POLICY IF EXISTS "Users can update own tenant record" ON public.tenants;

CREATE POLICY "Users can read own tenant record" ON public.tenants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tenant record" ON public.tenants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tenant record" ON public.tenants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Landlords can search tenants" ON public.tenants FOR SELECT USING (has_role(auth.uid(), 'landlord'::app_role));
CREATE POLICY "Regulators can read all tenants" ON public.tenants FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

-- viewing_requests
DROP POLICY IF EXISTS "Landlords update viewing requests" ON public.viewing_requests;
DROP POLICY IF EXISTS "Landlords view own viewing requests" ON public.viewing_requests;
DROP POLICY IF EXISTS "Tenants manage own viewing requests" ON public.viewing_requests;

CREATE POLICY "Tenants manage own viewing requests" ON public.viewing_requests FOR ALL USING (auth.uid() = tenant_user_id);
CREATE POLICY "Landlords view own viewing requests" ON public.viewing_requests FOR SELECT USING (auth.uid() = landlord_user_id);
CREATE POLICY "Landlords update viewing requests" ON public.viewing_requests FOR UPDATE USING (auth.uid() = landlord_user_id);

-- agreement_template_config
DROP POLICY IF EXISTS "Authenticated users can read template config" ON public.agreement_template_config;
DROP POLICY IF EXISTS "Regulators can insert template config" ON public.agreement_template_config;
DROP POLICY IF EXISTS "Regulators can update template config" ON public.agreement_template_config;

CREATE POLICY "Authenticated users can read template config" ON public.agreement_template_config FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Regulators can insert template config" ON public.agreement_template_config FOR INSERT WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));
CREATE POLICY "Regulators can update template config" ON public.agreement_template_config FOR UPDATE USING (has_role(auth.uid(), 'regulator'::app_role));
