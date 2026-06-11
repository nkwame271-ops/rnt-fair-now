ALTER TABLE public.management_task_assignments
  DROP CONSTRAINT IF EXISTS management_task_assignments_task_type_check;

ALTER TABLE public.management_task_assignments
  ADD CONSTRAINT management_task_assignments_task_type_check
  CHECK (task_type IN (
    'viewing_request','tenant_onboarding','inquiry','compliance','rent_followup',
    'landlord_request','buy_rent_card','rent_card_delivery','onboard_new_tenant','other_request'
  ));