ALTER TABLE public.complaint_hearings
  ADD COLUMN IF NOT EXISTS room_label TEXT;