
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('tenant', 'landlord', 'regulator');

-- User roles table (security best practice - roles separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  nationality TEXT NOT NULL DEFAULT 'Ghanaian',
  is_citizen BOOLEAN NOT NULL DEFAULT TRUE,
  ghana_card_no TEXT,
  residence_permit_no TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  occupation TEXT,
  work_address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  delivery_address TEXT,
  delivery_landmark TEXT,
  delivery_region TEXT,
  delivery_area TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Tenant registrations
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL UNIQUE, -- e.g. TN-2026-0042
  registration_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
  registration_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ, -- 1 year from registration
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Landlord registrations
CREATE TABLE public.landlords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  landlord_id TEXT NOT NULL UNIQUE, -- e.g. LL-2026-0042
  registration_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
  registration_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.landlords ENABLE ROW LEVEL SECURITY;

-- Properties
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_name TEXT,
  property_code TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  gps_location TEXT,
  region TEXT NOT NULL,
  area TEXT NOT NULL,
  property_condition TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Property units
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  unit_name TEXT NOT NULL,
  unit_type TEXT NOT NULL, -- Single Room, Chamber & Hall, etc.
  monthly_rent NUMERIC(10,2) NOT NULL,
  amenities TEXT[] DEFAULT '{}',
  water_available BOOLEAN DEFAULT FALSE,
  electricity_available BOOLEAN DEFAULT FALSE,
  has_kitchen BOOLEAN DEFAULT FALSE,
  has_toilet_bathroom BOOLEAN DEFAULT FALSE,
  has_polytank BOOLEAN DEFAULT FALSE,
  has_borehole BOOLEAN DEFAULT FALSE,
  custom_amenities TEXT,
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Tenancy records (Digital Rent Card)
CREATE TABLE public.tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) NOT NULL,
  tenant_user_id UUID REFERENCES auth.users(id) NOT NULL,
  landlord_user_id UUID REFERENCES auth.users(id) NOT NULL,
  tenant_id_code TEXT NOT NULL, -- TN-XXXX reference
  agreed_rent NUMERIC(10,2) NOT NULL,
  advance_months INTEGER NOT NULL DEFAULT 6,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  move_in_date DATE NOT NULL,
  registration_code TEXT NOT NULL UNIQUE,
  agreement_pdf_url TEXT,
  tenant_accepted BOOLEAN DEFAULT FALSE,
  landlord_accepted BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'terminated', 'disputed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenancies ENABLE ROW LEVEL SECURITY;

-- Rent payments (monthly tracking)
CREATE TABLE public.rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID REFERENCES public.tenancies(id) ON DELETE CASCADE NOT NULL,
  month_label TEXT NOT NULL, -- e.g. "March 2026"
  due_date DATE NOT NULL,
  monthly_rent NUMERIC(10,2) NOT NULL,
  tax_amount NUMERIC(10,2) NOT NULL, -- 8%
  amount_to_landlord NUMERIC(10,2) NOT NULL, -- 92%
  amount_paid NUMERIC(10,2) DEFAULT 0,
  tenant_marked_paid BOOLEAN DEFAULT FALSE,
  landlord_confirmed BOOLEAN DEFAULT FALSE,
  payment_method TEXT,
  receiver TEXT, -- Landlord, Agent, Caretaker, Property Manager
  paid_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

-- Complaints
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_code TEXT NOT NULL UNIQUE,
  tenant_user_id UUID REFERENCES auth.users(id) NOT NULL,
  complaint_type TEXT NOT NULL,
  landlord_name TEXT NOT NULL,
  property_address TEXT NOT NULL,
  region TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Property interest / viewing requests
CREATE TABLE public.viewing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) NOT NULL,
  property_id UUID REFERENCES public.properties(id) NOT NULL,
  tenant_user_id UUID REFERENCES auth.users(id) NOT NULL,
  landlord_user_id UUID REFERENCES auth.users(id) NOT NULL,
  preferred_date DATE,
  preferred_time TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;

-- Property images
CREATE TABLE public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;

-- ===== RLS POLICIES =====

-- User roles: users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
-- Regulators can read all roles
CREATE POLICY "Regulators can read all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'regulator'));

-- Profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Regulators can read all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'regulator'));

-- Tenants
CREATE POLICY "Users can read own tenant record" ON public.tenants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tenant record" ON public.tenants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tenant record" ON public.tenants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Regulators can read all tenants" ON public.tenants FOR SELECT USING (public.has_role(auth.uid(), 'regulator'));

-- Landlords
CREATE POLICY "Users can read own landlord record" ON public.landlords FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own landlord record" ON public.landlords FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own landlord record" ON public.landlords FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Regulators can read all landlords" ON public.landlords FOR SELECT USING (public.has_role(auth.uid(), 'regulator'));

-- Properties: landlords manage their own, tenants can view all, regulators see all
CREATE POLICY "Landlords manage own properties" ON public.properties FOR ALL USING (auth.uid() = landlord_user_id);
CREATE POLICY "Authenticated can view properties" ON public.properties FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Regulators can read all properties" ON public.properties FOR SELECT USING (public.has_role(auth.uid(), 'regulator'));

-- Units
CREATE POLICY "Landlords manage own units" ON public.units FOR ALL USING (
  EXISTS (SELECT 1 FROM public.properties WHERE id = units.property_id AND landlord_user_id = auth.uid())
);
CREATE POLICY "Authenticated can view units" ON public.units FOR SELECT USING (auth.uid() IS NOT NULL);

-- Tenancies
CREATE POLICY "Tenants view own tenancies" ON public.tenancies FOR SELECT USING (auth.uid() = tenant_user_id);
CREATE POLICY "Landlords view own tenancies" ON public.tenancies FOR SELECT USING (auth.uid() = landlord_user_id);
CREATE POLICY "Landlords create tenancies" ON public.tenancies FOR INSERT WITH CHECK (auth.uid() = landlord_user_id);
CREATE POLICY "Participants update tenancies" ON public.tenancies FOR UPDATE USING (auth.uid() = tenant_user_id OR auth.uid() = landlord_user_id);
CREATE POLICY "Regulators read all tenancies" ON public.tenancies FOR SELECT USING (public.has_role(auth.uid(), 'regulator'));

-- Rent payments
CREATE POLICY "Tenants view own payments" ON public.rent_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tenancies WHERE id = rent_payments.tenancy_id AND tenant_user_id = auth.uid())
);
CREATE POLICY "Landlords view own payments" ON public.rent_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tenancies WHERE id = rent_payments.tenancy_id AND landlord_user_id = auth.uid())
);
CREATE POLICY "Participants update payments" ON public.rent_payments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.tenancies WHERE id = rent_payments.tenancy_id AND (tenant_user_id = auth.uid() OR landlord_user_id = auth.uid()))
);
CREATE POLICY "Landlords insert payments" ON public.rent_payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenancies WHERE id = rent_payments.tenancy_id AND landlord_user_id = auth.uid())
);
CREATE POLICY "Regulators read all payments" ON public.rent_payments FOR SELECT USING (public.has_role(auth.uid(), 'regulator'));

-- Complaints
CREATE POLICY "Tenants manage own complaints" ON public.complaints FOR ALL USING (auth.uid() = tenant_user_id);
CREATE POLICY "Regulators read all complaints" ON public.complaints FOR SELECT USING (public.has_role(auth.uid(), 'regulator'));
CREATE POLICY "Regulators update complaints" ON public.complaints FOR UPDATE USING (public.has_role(auth.uid(), 'regulator'));

-- Viewing requests
CREATE POLICY "Tenants manage own viewing requests" ON public.viewing_requests FOR ALL USING (auth.uid() = tenant_user_id);
CREATE POLICY "Landlords view own viewing requests" ON public.viewing_requests FOR SELECT USING (auth.uid() = landlord_user_id);
CREATE POLICY "Landlords update viewing requests" ON public.viewing_requests FOR UPDATE USING (auth.uid() = landlord_user_id);

-- Property images
CREATE POLICY "Anyone can view property images" ON public.property_images FOR SELECT USING (true);
CREATE POLICY "Landlords manage own property images" ON public.property_images FOR ALL USING (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_images.property_id AND landlord_user_id = auth.uid())
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenancies_updated_at BEFORE UPDATE ON public.tenancies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_complaints_updated_at BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_viewing_requests_updated_at BEFORE UPDATE ON public.viewing_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email
  );
  -- Auto-assign role from metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
