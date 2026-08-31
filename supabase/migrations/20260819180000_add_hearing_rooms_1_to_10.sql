-- Ensure all offices have hearing rooms 1 through 10.
-- First, we can remove the existing "Hearing Room 1" if we want to be clean, 
-- or just use ON CONFLICT or a loop that skips existing ones.
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
