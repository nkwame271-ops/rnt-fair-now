ALTER TABLE public.landlord_complaints
  ADD COLUMN IF NOT EXISTS linked_unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_landlord_complaints_linked_unit ON public.landlord_complaints(linked_unit_id);