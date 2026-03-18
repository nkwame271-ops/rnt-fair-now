
-- Add new columns to feature_flags
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT NULL;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS fee_enabled boolean NOT NULL DEFAULT true;

-- Update existing flags with categories
UPDATE public.feature_flags SET category = 'tenant' WHERE feature_key IN ('complaint_filing', 'legal_assistant', 'marketplace', 'rent_checker');
UPDATE public.feature_flags SET category = 'landlord' WHERE feature_key IN ('rent_assessment', 'viewing_requests');
UPDATE public.feature_flags SET category = 'general' WHERE feature_key = 'kyc_verification';

-- Insert tenant feature flags
INSERT INTO public.feature_flags (feature_key, label, description, is_enabled, category)
VALUES
  ('payments', 'Payments', 'Rent tax and payment tracking for tenants', true, 'tenant'),
  ('renewal', 'Renewal', 'Allow tenants to request tenancy renewals', true, 'tenant'),
  ('termination', 'Termination', 'Allow tenants to request tenancy termination', true, 'tenant'),
  ('report_side_payment', 'Report Side Payment', 'Allow tenants to report illegal side payments', true, 'tenant'),
  ('preferences', 'Preferences', 'Tenant marketplace search preferences', true, 'tenant'),
  ('tenant_messages', 'Messages', 'Tenant messaging system', true, 'tenant'),
  ('tenant_receipts', 'Receipts', 'Tenant payment receipts', true, 'tenant'),
  ('tenant_agreements', 'Agreements', 'Tenant tenancy agreements view', true, 'tenant'),
  ('tenant_cases', 'My Cases', 'Tenant complaint case tracking', true, 'tenant')
ON CONFLICT (feature_key) DO NOTHING;

-- Insert landlord feature flags
INSERT INTO public.feature_flags (feature_key, label, description, is_enabled, category)
VALUES
  ('register_property', 'Register Property', 'Allow landlords to register new properties', true, 'landlord'),
  ('add_tenant', 'Add Tenant', 'Allow landlords to admit tenants to properties', true, 'landlord'),
  ('declare_existing_tenancy', 'Declare Existing Tenancy', 'Allow landlords to declare pre-existing tenancies', true, 'landlord'),
  ('agreements', 'Agreements', 'Landlord tenancy agreements management', true, 'landlord'),
  ('landlord_applications', 'Applications', 'Landlord formal applications to Rent Control', true, 'landlord'),
  ('landlord_complaints', 'Complaints', 'Landlord complaint filing', true, 'landlord'),
  ('rental_applications', 'Rental Applications', 'Manage rental applications from tenants', true, 'landlord'),
  ('renewal_requests', 'Renewal Requests', 'Manage tenancy renewal requests', true, 'landlord'),
  ('landlord_ejection', 'Ejection Application', 'Landlord ejection/termination applications', true, 'landlord'),
  ('landlord_messages', 'Messages', 'Landlord messaging system', true, 'landlord'),
  ('rent_cards', 'Manage Rent Cards', 'Purchase and manage rent cards', true, 'landlord'),
  ('payment_settings', 'Payment Settings', 'Landlord payment method settings', true, 'landlord'),
  ('landlord_receipts', 'Receipts', 'Landlord payment receipts', true, 'landlord'),
  ('landlord_feedback', 'Beta Feedback', 'Submit beta feedback', true, 'landlord')
ON CONFLICT (feature_key) DO NOTHING;

-- Insert fee flags
INSERT INTO public.feature_flags (feature_key, label, description, is_enabled, category, fee_amount, fee_enabled)
VALUES
  ('tenant_registration_fee', 'Tenant Registration Fee', 'Fee charged for tenant registration', true, 'fee', 40, true),
  ('landlord_registration_fee', 'Landlord Registration Fee', 'Fee charged for landlord registration', true, 'fee', 30, true),
  ('viewing_fee', 'Viewing Fee', 'Fee charged for property viewing requests', true, 'fee', 2, true),
  ('listing_fee', 'Listing Fee', 'Fee charged for listing property on marketplace', true, 'fee', 2, true),
  ('add_tenant_fee', 'Add Tenant Fee', 'Fee charged when landlord admits a tenant', true, 'fee', 5, true),
  ('termination_fee', 'Termination Fee', 'Fee charged for tenant termination requests', true, 'fee', 5, true),
  ('complaint_fee', 'Complaint Filing Fee', 'Fee charged for filing complaints', true, 'fee', 2, true),
  ('rent_card_fee', 'Rent Card Fee', 'Fee charged per rent card', true, 'fee', 25, true),
  ('agreement_sale_fee', 'Agreement Sale Fee', 'Fee charged for tenancy agreement forms', true, 'fee', 30, true)
ON CONFLICT (feature_key) DO UPDATE SET category = EXCLUDED.category, fee_amount = EXCLUDED.fee_amount, fee_enabled = EXCLUDED.fee_enabled;

-- Add unique constraint on feature_key if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_flags_feature_key_unique') THEN
    ALTER TABLE public.feature_flags ADD CONSTRAINT feature_flags_feature_key_unique UNIQUE (feature_key);
  END IF;
END $$;
