-- 1) GRA Tax toggle on agreement_template_config
ALTER TABLE public.agreement_template_config
  ADD COLUMN IF NOT EXISTS gra_tax_enabled boolean NOT NULL DEFAULT true;

-- 2) Service Fee engine
CREATE TABLE IF NOT EXISTS public.service_fee_configurations (
  payment_type  text PRIMARY KEY,
  enabled       boolean NOT NULL DEFAULT false,
  percentage    numeric NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid
);

GRANT SELECT ON public.service_fee_configurations TO authenticated, anon;
GRANT ALL ON public.service_fee_configurations TO service_role;

ALTER TABLE public.service_fee_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read service fee configs"
  ON public.service_fee_configurations FOR SELECT
  USING (true);

CREATE POLICY "Admins manage service fee configs"
  ON public.service_fee_configurations FOR ALL
  TO authenticated
  USING (public.is_main_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.service_fee_splits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type  text NOT NULL REFERENCES public.service_fee_configurations(payment_type) ON DELETE CASCADE,
  payer_segment text NOT NULL CHECK (payer_segment IN ('standard','student')),
  recipient     text NOT NULL CHECK (recipient IN ('platform','nugs','admin','igf','rent_control')),
  percentage    numeric NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  sort_order    int NOT NULL DEFAULT 0,
  UNIQUE(payment_type, payer_segment, recipient)
);

GRANT SELECT ON public.service_fee_splits TO authenticated, anon;
GRANT ALL ON public.service_fee_splits TO service_role;

ALTER TABLE public.service_fee_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read service fee splits"
  ON public.service_fee_splits FOR SELECT
  USING (true);

CREATE POLICY "Admins manage standard service fee splits"
  ON public.service_fee_splits FOR ALL
  TO authenticated
  USING (public.is_main_admin(auth.uid()) AND (payer_segment = 'standard' OR public.is_super_admin(auth.uid())))
  WITH CHECK (public.is_main_admin(auth.uid()) AND (payer_segment = 'standard' OR public.is_super_admin(auth.uid())));

-- Validation trigger: sum per (payment_type, payer_segment) must be <= 100
CREATE OR REPLACE FUNCTION public.validate_service_fee_splits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum numeric;
BEGIN
  SELECT COALESCE(SUM(percentage), 0) INTO v_sum
  FROM public.service_fee_splits
  WHERE payment_type = COALESCE(NEW.payment_type, OLD.payment_type)
    AND payer_segment = COALESCE(NEW.payer_segment, OLD.payer_segment)
    AND id <> COALESCE(NEW.id, OLD.id);
  IF TG_OP <> 'DELETE' THEN
    v_sum := v_sum + NEW.percentage;
  END IF;
  IF v_sum > 100 THEN
    RAISE EXCEPTION 'Service fee splits for % / % would exceed 100%% (got %)',
      COALESCE(NEW.payment_type, OLD.payment_type),
      COALESCE(NEW.payer_segment, OLD.payer_segment),
      v_sum;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_service_fee_splits ON public.service_fee_splits;
CREATE TRIGGER trg_validate_service_fee_splits
  BEFORE INSERT OR UPDATE OR DELETE ON public.service_fee_splits
  FOR EACH ROW EXECUTE FUNCTION public.validate_service_fee_splits();

-- 3) escrow_splits flag so receipts can exclude service-fee rows
ALTER TABLE public.escrow_splits
  ADD COLUMN IF NOT EXISTS is_service_fee boolean NOT NULL DEFAULT false;

-- 4) Seed inert config for current live payment types
INSERT INTO public.service_fee_configurations (payment_type, enabled, percentage) VALUES
  ('rent_payment', false, 0),
  ('rent_combined', false, 0),
  ('complaint_fee', false, 0),
  ('agreement_sale', false, 0),
  ('landlord_registration', false, 0),
  ('tenant_registration', false, 0),
  ('student_registration', false, 0),
  ('student_complaint_fee', false, 0),
  ('rent_card', false, 0),
  ('student_rent_card_fee', false, 0)
ON CONFLICT (payment_type) DO NOTHING;

INSERT INTO public.service_fee_splits (payment_type, payer_segment, recipient, percentage, sort_order)
SELECT payment_type, 'standard', 'platform', 100, 0
FROM public.service_fee_configurations
ON CONFLICT DO NOTHING;

INSERT INTO public.service_fee_splits (payment_type, payer_segment, recipient, percentage, sort_order) VALUES
  ('rent_payment', 'student', 'platform', 25, 0),
  ('rent_payment', 'student', 'nugs', 25, 1),
  ('rent_payment', 'student', 'admin', 25, 2),
  ('rent_payment', 'student', 'igf', 25, 3),
  ('rent_combined', 'student', 'platform', 25, 0),
  ('rent_combined', 'student', 'nugs', 25, 1),
  ('rent_combined', 'student', 'admin', 25, 2),
  ('rent_combined', 'student', 'igf', 25, 3)
ON CONFLICT DO NOTHING;