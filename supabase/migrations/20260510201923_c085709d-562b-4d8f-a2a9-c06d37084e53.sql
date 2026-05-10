-- Student portal feature flags
INSERT INTO public.feature_flags (feature_key, label, description, is_enabled, category, fee_amount, fee_enabled)
VALUES
  ('student_marketplace', 'Student: Marketplace', 'Allow students to browse the property marketplace', true, 'student', NULL, false),
  ('student_rent_checker', 'Student: Rent Checker', 'Allow students to use the rent checker', true, 'student', NULL, false),
  ('student_payments', 'Student: Payments', 'Allow students to view and make rent / tax payments', true, 'student', NULL, false),
  ('student_receipts', 'Student: Receipts', 'Allow students to view their receipts', true, 'student', NULL, false),
  ('student_agreements', 'Student: Agreements', 'Allow students to view tenancy agreements', true, 'student', NULL, false),
  ('student_legal_assistant', 'Student: Legal Assistant', 'Allow students to access AI legal assistant', true, 'student', NULL, false),
  ('student_renewal', 'Student: Renewal', 'Allow students to request tenancy renewal', true, 'student', NULL, false),
  ('student_termination', 'Student: Termination', 'Allow students to request tenancy termination', true, 'student', NULL, false),
  ('student_report_side_payment', 'Student: Report Side Payment', 'Allow students to report illegal side payments', true, 'student', NULL, false),
  ('student_preferences', 'Student: Preferences', 'Allow students to manage notification preferences', true, 'student', NULL, false),
  ('student_messages', 'Student: Messages', 'Allow students to message landlords', true, 'student', NULL, false),
  ('student_invite_landlord', 'Student: Invite Landlord', 'Allow students to invite their landlord', true, 'student', NULL, false)
ON CONFLICT (feature_key) DO NOTHING;

-- Rent lock columns
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS rent_locked_at timestamptz;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS rent_locked_amount numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS rent_locked_at timestamptz;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS rent_locked_amount numeric;
