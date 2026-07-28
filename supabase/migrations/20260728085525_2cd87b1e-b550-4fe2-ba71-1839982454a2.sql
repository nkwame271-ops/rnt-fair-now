-- Register/ensure feature flags exist for newly introduced payment features
INSERT INTO public.feature_flags (feature_key, label, description, category, is_enabled, fee_enabled, fee_amount, fee_type, billing_frequency, payment_destination, revenue_split_json)
VALUES
  ('naflis_wallet', 'NAFLIS Wallet', 'In-app wallet for tenants, landlords, and agents', 'wallet', true, false, 0, 'fixed', 'one_time', 'platform', '[]'::jsonb),
  ('wallet_topup_fee', 'Wallet Top-up Fee', 'Fee charged when a user adds money to their wallet', 'platform_fees', true, false, 0, 'percentage', 'one_time', 'platform', '[]'::jsonb),
  ('property_assessment', 'Property Assessment Fee', 'Fee paid before an assessment application is created', 'platform_fees', true, true, 50, 'fixed', 'one_time', 'platform', '[]'::jsonb),
  ('premium_service_subscription', 'Premium Service Subscription', 'Landlord subscription for platform-managed tenancy operations', 'platform_fees', true, true, 200, 'fixed', 'monthly', 'platform', '[]'::jsonb),
  ('agent_application_fee', 'Agent Application Fee', 'One-time fee an applicant pays before their agent application is reviewed', 'platform_fees', true, true, 100, 'fixed', 'one_time', 'platform', '[]'::jsonb)
ON CONFLICT (feature_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = COALESCE(feature_flags.description, EXCLUDED.description),
  category = COALESCE(feature_flags.category, EXCLUDED.category);

-- Ensure car_case_prefix exists so admins can change the CAR prefix
INSERT INTO public.platform_config (config_key, config_value, description)
VALUES ('car_case_prefix', to_jsonb('CAR'::text), 'Prefix used for complaint case numbers (CAR NNN/YYYY)')
ON CONFLICT (config_key) DO NOTHING;