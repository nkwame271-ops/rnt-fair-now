UPDATE public.offices SET name = 'Accra Regional Office (HQ) Ghana Highway Authority' WHERE id = 'accra_central';

UPDATE public.rent_card_serial_stock
SET office_name = 'Accra Regional Office (HQ) Ghana Highway Authority'
WHERE office_name IN ('ACCRA Central Office (HQ)', 'Accra Central Office', 'Central');