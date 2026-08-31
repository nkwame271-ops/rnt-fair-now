-- Ensure all offices have hearing rooms 1 through 10.
INSERT INTO public.hearing_rooms (office_id, name, capacity, active)
SELECT o.id, 'Hearing Room ' || i, 10, true
FROM public.offices o, generate_series(1, 10) i
WHERE NOT EXISTS (
    SELECT 1 FROM public.hearing_rooms h 
    WHERE h.office_id = o.id AND h.name = 'Hearing Room ' || i
);
