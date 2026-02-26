ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS gps_location text,
ADD COLUMN IF NOT EXISTS gps_confirmed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS gps_confirmed_at timestamp with time zone;