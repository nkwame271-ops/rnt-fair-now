-- Add unique constraint to prevent duplicate rooms in the same office
ALTER TABLE public.hearing_rooms ADD CONSTRAINT hearing_rooms_office_name_key UNIQUE (office_id, name);

-- Ensure all offices have hearing rooms 1 through 10.
DO $$
DECLARE
    o RECORD;
    i INTEGER;
BEGIN
    FOR o IN SELECT id FROM public.offices LOOP
        FOR i IN 1..10 LOOP
            INSERT INTO public.hearing_rooms (office_id, name, capacity, active)
            VALUES (o.id, 'Hearing Room ' || i, 10, true)
            ON CONFLICT (office_id, name) DO UPDATE SET active = true;
        END LOOP;
    END LOOP;
END $$;
