-- 1. complaint_types table
CREATE TABLE public.complaint_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  fee_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (fee_mode IN ('fixed','percentage','rent_band')),
  fee_amount NUMERIC DEFAULT 0,
  fee_percentage NUMERIC DEFAULT 0,
  rent_band_config JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.complaint_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read complaint_types"
  ON public.complaint_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Main admins insert complaint_types"
  ON public.complaint_types FOR INSERT TO authenticated
  WITH CHECK (is_main_admin(auth.uid()));

CREATE POLICY "Main admins update complaint_types"
  ON public.complaint_types FOR UPDATE TO authenticated
  USING (is_main_admin(auth.uid()));

CREATE POLICY "Main admins delete complaint_types"
  ON public.complaint_types FOR DELETE TO authenticated
  USING (is_main_admin(auth.uid()));

CREATE TRIGGER trg_complaint_types_updated
  BEFORE UPDATE ON public.complaint_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults (fee_amount = current global default 50 GHS; admin can override)
INSERT INTO public.complaint_types (key, label, fee_mode, fee_amount, display_order) VALUES
  ('illegal_eviction', 'Illegal Eviction', 'fixed', 50, 10),
  ('rent_overcharge', 'Rent Overcharge', 'fixed', 50, 20),
  ('property_condition', 'Property Condition / Repairs', 'fixed', 50, 30),
  ('harassment', 'Harassment', 'fixed', 50, 40),
  ('lease_violation', 'Lease Violation', 'fixed', 50, 50),
  ('side_payment', 'Side Payment Demand', 'fixed', 50, 60),
  ('other', 'Other', 'fixed', 50, 90);

-- 2. Ticket generator
CREATE SEQUENCE IF NOT EXISTS public.complaint_ticket_seq;

CREATE OR REPLACE FUNCTION public.generate_complaint_ticket()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('public.complaint_ticket_seq');
  RETURN 'TKT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(next_val::text, 5, '0');
END;
$$;

-- 3. Add columns to complaints (office_id is TEXT to match offices.id)
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS complaint_type_id UUID REFERENCES public.complaint_types(id),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'awaiting'
    CHECK (payment_status IN ('awaiting','pending','paid')),
  ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES public.payment_receipts(id),
  ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC;

-- office_id already exists on complaints as text; add FK if not present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'complaints_office_id_fkey'
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT complaints_office_id_fkey
      FOREIGN KEY (office_id) REFERENCES public.offices(id);
  END IF;
END $$;

ALTER TABLE public.landlord_complaints
  ADD COLUMN IF NOT EXISTS ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS complaint_type_id UUID REFERENCES public.complaint_types(id),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'awaiting'
    CHECK (payment_status IN ('awaiting','pending','paid')),
  ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES public.payment_receipts(id),
  ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'landlord_complaints_office_id_fkey'
  ) THEN
    ALTER TABLE public.landlord_complaints
      ADD CONSTRAINT landlord_complaints_office_id_fkey
      FOREIGN KEY (office_id) REFERENCES public.offices(id);
  END IF;
END $$;

-- 4. Backfill office_id from region (uses existing resolve_office_id if present)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resolve_office_id') THEN
    EXECUTE 'UPDATE public.complaints SET office_id = public.resolve_office_id(region) WHERE office_id IS NULL AND region IS NOT NULL';
    EXECUTE 'UPDATE public.landlord_complaints SET office_id = public.resolve_office_id(region) WHERE office_id IS NULL AND region IS NOT NULL';
  END IF;
END $$;

-- Fallback: assign first office in region
UPDATE public.complaints c
SET office_id = (SELECT o.id FROM public.offices o WHERE o.region = c.region LIMIT 1)
WHERE c.office_id IS NULL AND c.region IS NOT NULL;

UPDATE public.landlord_complaints c
SET office_id = (SELECT o.id FROM public.offices o WHERE o.region = c.region LIMIT 1)
WHERE c.office_id IS NULL AND c.region IS NOT NULL;

-- 5. Backfill ticket_number for legacy rows
UPDATE public.complaints
SET ticket_number = 'TKT-LEGACY-' || left(id::text, 8)
WHERE ticket_number IS NULL;

UPDATE public.landlord_complaints
SET ticket_number = 'TKT-LEGACY-' || left(id::text, 8)
WHERE ticket_number IS NULL;

-- 6. Backfill payment_status from escrow_transactions
UPDATE public.complaints c
SET payment_status = 'paid'
WHERE EXISTS (
  SELECT 1 FROM public.escrow_transactions et
  WHERE et.related_complaint_id = c.id AND et.status = 'completed'
);

UPDATE public.landlord_complaints c
SET payment_status = 'paid'
WHERE EXISTS (
  SELECT 1 FROM public.escrow_transactions et
  WHERE et.related_complaint_id = c.id AND et.status = 'completed'
);

-- 7. Backfill complaint_type_id from text complaint_type → complaint_types.key (best-effort)
UPDATE public.complaints c
SET complaint_type_id = ct.id
FROM public.complaint_types ct
WHERE c.complaint_type_id IS NULL
  AND lower(replace(c.complaint_type, ' ', '_')) = ct.key;

UPDATE public.landlord_complaints c
SET complaint_type_id = ct.id
FROM public.complaint_types ct
WHERE c.complaint_type_id IS NULL
  AND lower(replace(c.complaint_type, ' ', '_')) = ct.key;

-- 8. Enforce NOT NULL + UNIQUE on ticket_number
ALTER TABLE public.complaints ALTER COLUMN ticket_number SET NOT NULL;
ALTER TABLE public.landlord_complaints ALTER COLUMN ticket_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_ticket_number ON public.complaints(ticket_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_landlord_complaints_ticket_number ON public.landlord_complaints(ticket_number);

-- 9. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_complaints_office ON public.complaints(office_id);
CREATE INDEX IF NOT EXISTS idx_complaints_payment_status ON public.complaints(payment_status);
CREATE INDEX IF NOT EXISTS idx_complaints_type ON public.complaints(complaint_type_id);
CREATE INDEX IF NOT EXISTS idx_landlord_complaints_office ON public.landlord_complaints(office_id);
CREATE INDEX IF NOT EXISTS idx_landlord_complaints_payment_status ON public.landlord_complaints(payment_status);

-- 10. Default ticket_number for new rows
ALTER TABLE public.complaints ALTER COLUMN ticket_number SET DEFAULT public.generate_complaint_ticket();
ALTER TABLE public.landlord_complaints ALTER COLUMN ticket_number SET DEFAULT public.generate_complaint_ticket();

-- 11. Realtime
ALTER TABLE public.complaints REPLICA IDENTITY FULL;
ALTER TABLE public.landlord_complaints REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.landlord_complaints;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;