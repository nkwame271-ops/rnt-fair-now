-- 1. Hostel room categories
CREATE TABLE public.hostel_room_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  label text NOT NULL,
  capacity_per_room integer NOT NULL CHECK (capacity_per_room > 0),
  room_count integer NOT NULL CHECK (room_count > 0),
  monthly_rent numeric NOT NULL DEFAULT 0,
  block_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hostel_room_categories_property ON public.hostel_room_categories(property_id);

ALTER TABLE public.hostel_room_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hostel categories"
  ON public.hostel_room_categories FOR SELECT USING (true);

CREATE POLICY "Landlords manage own hostel categories"
  ON public.hostel_room_categories FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.properties p
            WHERE p.id = property_id AND p.landlord_user_id = auth.uid())
    OR public.is_main_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties p
            WHERE p.id = property_id AND p.landlord_user_id = auth.uid())
    OR public.is_main_admin(auth.uid())
  );

-- 2. Hostel rooms
CREATE TABLE public.hostel_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.hostel_room_categories(id) ON DELETE CASCADE,
  block_label text NOT NULL DEFAULT 'Block A',
  room_number text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, block_label, room_number)
);

CREATE INDEX idx_hostel_rooms_property ON public.hostel_rooms(property_id);
CREATE INDEX idx_hostel_rooms_category ON public.hostel_rooms(category_id);

ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hostel rooms"
  ON public.hostel_rooms FOR SELECT USING (true);

CREATE POLICY "Landlords manage own hostel rooms"
  ON public.hostel_rooms FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.properties p
            WHERE p.id = property_id AND p.landlord_user_id = auth.uid())
    OR public.is_main_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties p
            WHERE p.id = property_id AND p.landlord_user_id = auth.uid())
    OR public.is_main_admin(auth.uid())
  );

-- 3. Extend units for bed-space model
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS hostel_room_id uuid REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS bed_label text,
  ADD COLUMN IF NOT EXISTS unit_kind text NOT NULL DEFAULT 'standard';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_units_room_bed
  ON public.units(hostel_room_id, bed_label)
  WHERE hostel_room_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_units_hostel_room ON public.units(hostel_room_id);

-- 4. Capacity enforcement trigger
CREATE OR REPLACE FUNCTION public.enforce_room_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_capacity integer;
  v_existing integer;
BEGIN
  IF NEW.hostel_room_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT capacity INTO v_capacity FROM hostel_rooms WHERE id = NEW.hostel_room_id;
  IF v_capacity IS NULL THEN
    RAISE EXCEPTION 'Hostel room % not found', NEW.hostel_room_id;
  END IF;

  SELECT count(*) INTO v_existing FROM units
  WHERE hostel_room_id = NEW.hostel_room_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_existing >= v_capacity THEN
    RAISE EXCEPTION 'Room capacity (%) reached for room %', v_capacity, NEW.hostel_room_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_room_capacity ON public.units;
CREATE TRIGGER trg_enforce_room_capacity
  BEFORE INSERT OR UPDATE OF hostel_room_id ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.enforce_room_capacity();