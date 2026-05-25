
INSERT INTO public.feature_flags (feature_key, label, description, is_enabled, category)
VALUES ('processor_reconciliation', 'Processor Reconciliation', 'Reconcile payment processor balances and settlements against platform-recorded splits.', false, 'finance')
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO public.module_visibility_config (module_key, section_key, visibility, level)
VALUES
  ('escrow', 'allocation_platform', 'super_admin_only', 'global'),
  ('escrow', 'processor_platform_breakdown', 'super_admin_only', 'global')
ON CONFLICT DO NOTHING;
