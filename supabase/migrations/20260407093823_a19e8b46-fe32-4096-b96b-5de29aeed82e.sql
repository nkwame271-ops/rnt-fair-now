
-- Step 1: Reassign FK references from offices being deleted to regional HQs
UPDATE cases SET office_id = 'accra_central' WHERE office_id IN ('ablekuma','accra_north','achimota','airport_area','awoshie','cantonment','dome','dzorwulu','east_legon','kaneshie','la','lapaz','madina','osu','roman_ridge','spintex','teshie_nungua');
UPDATE escrow_transactions SET office_id = 'accra_central' WHERE office_id IN ('ablekuma','accra_north','achimota','airport_area','awoshie','cantonment','dome','dzorwulu','east_legon','kaneshie','la','lapaz','madina','osu','roman_ridge','spintex','teshie_nungua');
UPDATE office_fund_requests SET office_id = 'accra_central' WHERE office_id IN ('ablekuma','accra_north','achimota','airport_area','awoshie','cantonment','dome','dzorwulu','east_legon','kaneshie','la','lapaz','madina','osu','roman_ridge','spintex','teshie_nungua');
UPDATE office_payout_accounts SET office_id = 'accra_central' WHERE office_id IN ('ablekuma','accra_north','achimota','airport_area','awoshie','cantonment','dome','dzorwulu','east_legon','kaneshie','la','lapaz','madina','osu','roman_ridge','spintex','teshie_nungua');

-- Reassign Savannah offices to Tamale
UPDATE cases SET office_id = 'tamale' WHERE office_id IN ('damongo','salaga','bimbilla');
UPDATE escrow_transactions SET office_id = 'tamale' WHERE office_id IN ('damongo','salaga','bimbilla');
UPDATE office_fund_requests SET office_id = 'tamale' WHERE office_id IN ('damongo','salaga','bimbilla');
UPDATE office_payout_accounts SET office_id = 'tamale' WHERE office_id IN ('damongo','salaga','bimbilla');

-- Reassign North East to Tamale
UPDATE cases SET office_id = 'tamale' WHERE office_id = 'nalerigu';
UPDATE escrow_transactions SET office_id = 'tamale' WHERE office_id = 'nalerigu';
UPDATE office_fund_requests SET office_id = 'tamale' WHERE office_id = 'nalerigu';
UPDATE office_payout_accounts SET office_id = 'tamale' WHERE office_id = 'nalerigu';

-- Reassign other deleted offices
UPDATE cases SET office_id = 'kumasi' WHERE office_id = 'kumasi_south';
UPDATE escrow_transactions SET office_id = 'kumasi' WHERE office_id = 'kumasi_south';
UPDATE cases SET office_id = 'koforidua' WHERE office_id IN ('suhum','oda');
UPDATE escrow_transactions SET office_id = 'koforidua' WHERE office_id IN ('suhum','oda');
UPDATE cases SET office_id = 'cape_coast' WHERE office_id IN ('elmina','saltpond');
UPDATE escrow_transactions SET office_id = 'cape_coast' WHERE office_id IN ('elmina','saltpond');
UPDATE cases SET office_id = 'bolgatanga' WHERE office_id = 'bawku';
UPDATE escrow_transactions SET office_id = 'bolgatanga' WHERE office_id = 'bawku';
UPDATE cases SET office_id = 'sefwi_wiawso' WHERE office_id = 'bibiani';
UPDATE escrow_transactions SET office_id = 'sefwi_wiawso' WHERE office_id = 'bibiani';

-- Also reassign non-FK text references
UPDATE admin_staff SET office_id = 'accra_central' WHERE office_id IN ('ablekuma','accra_north','achimota','airport_area','awoshie','cantonment','dome','dzorwulu','east_legon','kaneshie','la','lapaz','madina','osu','roman_ridge','spintex','teshie_nungua');
UPDATE admin_staff SET office_id = 'tamale' WHERE office_id IN ('damongo','salaga','bimbilla','nalerigu');
UPDATE admin_staff SET office_id = 'kumasi' WHERE office_id = 'kumasi_south';
UPDATE admin_staff SET office_id = 'koforidua' WHERE office_id IN ('suhum','oda');
UPDATE admin_staff SET office_id = 'cape_coast' WHERE office_id IN ('elmina','saltpond');
UPDATE admin_staff SET office_id = 'bolgatanga' WHERE office_id = 'bawku';
UPDATE admin_staff SET office_id = 'sefwi_wiawso' WHERE office_id = 'bibiani';

UPDATE office_allocations SET office_id = 'accra_central' WHERE office_id IN ('ablekuma','accra_north','achimota','airport_area','awoshie','cantonment','dome','dzorwulu','east_legon','kaneshie','la','lapaz','madina','osu','roman_ridge','spintex','teshie_nungua');
UPDATE office_allocations SET office_id = 'tamale' WHERE office_id IN ('damongo','salaga','bimbilla','nalerigu');
UPDATE office_allocations SET office_id = 'kumasi' WHERE office_id = 'kumasi_south';
UPDATE office_allocations SET office_id = 'koforidua' WHERE office_id IN ('suhum','oda');
UPDATE office_allocations SET office_id = 'cape_coast' WHERE office_id IN ('elmina','saltpond');
UPDATE office_allocations SET office_id = 'bolgatanga' WHERE office_id = 'bawku';
UPDATE office_allocations SET office_id = 'sefwi_wiawso' WHERE office_id = 'bibiani';

-- Reassign rent_card_serial_stock office references
UPDATE rent_card_serial_stock SET office_name = 'ACCRA Central Office (HQ)' WHERE office_name IN ('Ablekuma Office','Accra North Office','Achimota Office','Airport Area Office','Awoshie Office','Cantonment Office','Dome Office','Dzorwulu Office','East Legon Office','Kaneshie Office','La Office','Lapaz Office','Madina Office','Osu Office','Roman Ridge Office','Spintex Office','Teshie-Nungua Office');
UPDATE rent_card_serial_stock SET office_name = 'Tamale' WHERE office_name IN ('Damongo Office','Salaga Office','Bimbilla Office','Nalerigu Office');
UPDATE rent_card_serial_stock SET office_name = 'Kumasi' WHERE office_name = 'Kumasi South Office';
UPDATE rent_card_serial_stock SET office_name = 'Koforidua' WHERE office_name IN ('Suhum Office','Oda Office');
UPDATE rent_card_serial_stock SET office_name = 'Cape Coast' WHERE office_name IN ('Elmina Office','Saltpond Office');
UPDATE rent_card_serial_stock SET office_name = 'Bolgatanga' WHERE office_name = 'Bawku Office';
UPDATE rent_card_serial_stock SET office_name = 'Sefwi Wiawso' WHERE office_name = 'Bibiani Office';

-- Also reassign complaints, landlord_complaints, daily_stock_reports, office_reconciliation_snapshots, payment_receipts
UPDATE complaints SET office_id = 'accra_central' WHERE office_id IN ('ablekuma','accra_north','achimota','airport_area','awoshie','cantonment','dome','dzorwulu','east_legon','kaneshie','la','lapaz','madina','osu','roman_ridge','spintex','teshie_nungua');
UPDATE complaints SET office_id = 'tamale' WHERE office_id IN ('damongo','salaga','bimbilla','nalerigu');
UPDATE landlord_complaints SET office_id = 'accra_central' WHERE office_id IN ('ablekuma','accra_north','achimota','airport_area','awoshie','cantonment','dome','dzorwulu','east_legon','kaneshie','la','lapaz','madina','osu','roman_ridge','spintex','teshie_nungua');
UPDATE landlord_complaints SET office_id = 'tamale' WHERE office_id IN ('damongo','salaga','bimbilla','nalerigu');

-- Step 2: Rename offices that are staying but with new names/IDs
-- Swedru → Agona Swedru
UPDATE offices SET id = 'agona_swedru', name = 'Agona Swedru' WHERE id = 'swedru';
UPDATE cases SET office_id = 'agona_swedru' WHERE office_id = 'swedru';
UPDATE escrow_transactions SET office_id = 'agona_swedru' WHERE office_id = 'swedru';
UPDATE office_fund_requests SET office_id = 'agona_swedru' WHERE office_id = 'swedru';
UPDATE office_payout_accounts SET office_id = 'agona_swedru' WHERE office_id = 'swedru';
UPDATE admin_staff SET office_id = 'agona_swedru' WHERE office_id = 'swedru';
UPDATE office_allocations SET office_id = 'agona_swedru' WHERE office_id = 'swedru';
UPDATE complaints SET office_id = 'agona_swedru' WHERE office_id = 'swedru';
UPDATE landlord_complaints SET office_id = 'agona_swedru' WHERE office_id = 'swedru';

-- Berekum → Brekum
UPDATE offices SET id = 'brekum', name = 'Brekum' WHERE id = 'berekum';
UPDATE cases SET office_id = 'brekum' WHERE office_id = 'berekum';
UPDATE escrow_transactions SET office_id = 'brekum' WHERE office_id = 'berekum';
UPDATE office_fund_requests SET office_id = 'brekum' WHERE office_id = 'berekum';
UPDATE office_payout_accounts SET office_id = 'brekum' WHERE office_id = 'berekum';
UPDATE admin_staff SET office_id = 'brekum' WHERE office_id = 'berekum';
UPDATE office_allocations SET office_id = 'brekum' WHERE office_id = 'berekum';
UPDATE complaints SET office_id = 'brekum' WHERE office_id = 'berekum';
UPDATE landlord_complaints SET office_id = 'brekum' WHERE office_id = 'berekum';

-- Dormaa → Dormaa East
UPDATE offices SET id = 'dormaa_east', name = 'Dormaa East' WHERE id = 'dormaa';
UPDATE cases SET office_id = 'dormaa_east' WHERE office_id = 'dormaa';
UPDATE escrow_transactions SET office_id = 'dormaa_east' WHERE office_id = 'dormaa';
UPDATE office_fund_requests SET office_id = 'dormaa_east' WHERE office_id = 'dormaa';
UPDATE office_payout_accounts SET office_id = 'dormaa_east' WHERE office_id = 'dormaa';
UPDATE admin_staff SET office_id = 'dormaa_east' WHERE office_id = 'dormaa';
UPDATE office_allocations SET office_id = 'dormaa_east' WHERE office_id = 'dormaa';
UPDATE complaints SET office_id = 'dormaa_east' WHERE office_id = 'dormaa';
UPDATE landlord_complaints SET office_id = 'dormaa_east' WHERE office_id = 'dormaa';

-- Kpando → Kpando/ Hohoe (rename + new ID)
UPDATE offices SET id = 'kpando_hohoe', name = 'Kpando/ Hohoe' WHERE id = 'kpando';
UPDATE cases SET office_id = 'kpando_hohoe' WHERE office_id = 'kpando';
UPDATE escrow_transactions SET office_id = 'kpando_hohoe' WHERE office_id = 'kpando';
UPDATE office_fund_requests SET office_id = 'kpando_hohoe' WHERE office_id = 'kpando';
UPDATE office_payout_accounts SET office_id = 'kpando_hohoe' WHERE office_id = 'kpando';
UPDATE admin_staff SET office_id = 'kpando_hohoe' WHERE office_id = 'kpando';
UPDATE office_allocations SET office_id = 'kpando_hohoe' WHERE office_id = 'kpando';
UPDATE complaints SET office_id = 'kpando_hohoe' WHERE office_id = 'kpando';
UPDATE landlord_complaints SET office_id = 'kpando_hohoe' WHERE office_id = 'kpando';

-- Dambai+Nkwanta → Kedjebi
UPDATE offices SET id = 'kedjebi', name = 'Kedjebi' WHERE id = 'dambai';
UPDATE cases SET office_id = 'kedjebi' WHERE office_id = 'dambai';
UPDATE escrow_transactions SET office_id = 'kedjebi' WHERE office_id = 'dambai';
UPDATE office_fund_requests SET office_id = 'kedjebi' WHERE office_id = 'dambai';
UPDATE office_payout_accounts SET office_id = 'kedjebi' WHERE office_id = 'dambai';
UPDATE admin_staff SET office_id = 'kedjebi' WHERE office_id = 'dambai';
UPDATE office_allocations SET office_id = 'kedjebi' WHERE office_id = 'dambai';
UPDATE complaints SET office_id = 'kedjebi' WHERE office_id = 'dambai';
UPDATE landlord_complaints SET office_id = 'kedjebi' WHERE office_id = 'dambai';

-- Nkwanta → merge into Kedjebi
UPDATE cases SET office_id = 'kedjebi' WHERE office_id = 'nkwanta';
UPDATE escrow_transactions SET office_id = 'kedjebi' WHERE office_id = 'nkwanta';
UPDATE office_fund_requests SET office_id = 'kedjebi' WHERE office_id = 'nkwanta';
UPDATE office_payout_accounts SET office_id = 'kedjebi' WHERE office_id = 'nkwanta';
UPDATE admin_staff SET office_id = 'kedjebi' WHERE office_id = 'nkwanta';
UPDATE office_allocations SET office_id = 'kedjebi' WHERE office_id = 'nkwanta';
UPDATE complaints SET office_id = 'kedjebi' WHERE office_id = 'nkwanta';
UPDATE landlord_complaints SET office_id = 'kedjebi' WHERE office_id = 'nkwanta';

-- Move Nkawkaw from Ashanti to Eastern
UPDATE offices SET region = 'Eastern' WHERE id = 'nkawkaw';

-- Move Kasoa from Greater Accra to Central (already in Central in DB, just confirm)
UPDATE offices SET region = 'Central' WHERE id = 'kasoa';

-- Step 3: Update names for kept offices to match official list
UPDATE offices SET name = 'ACCRA Central Office (HQ)' WHERE id = 'accra_central';
UPDATE offices SET name = 'Adenta' WHERE id = 'adenta';
UPDATE offices SET name = 'Weija' WHERE id = 'weija';
UPDATE offices SET name = 'Ashaiman' WHERE id = 'ashaiman';
UPDATE offices SET name = 'Amasaman' WHERE id = 'amasaman';
UPDATE offices SET name = 'Tema' WHERE id = 'tema';
UPDATE offices SET name = 'Dansoman' WHERE id = 'dansoman';
UPDATE offices SET name = 'Cape Coast' WHERE id = 'cape_coast';
UPDATE offices SET name = 'Winneba' WHERE id = 'winneba';
UPDATE offices SET name = 'Mankessim' WHERE id = 'mankessim';
UPDATE offices SET name = 'Kasoa' WHERE id = 'kasoa';
UPDATE offices SET name = 'Takoradi' WHERE id = 'takoradi';
UPDATE offices SET name = 'Tarkwa' WHERE id = 'tarkwa';
UPDATE offices SET name = 'Koforidua' WHERE id = 'koforidua';
UPDATE offices SET name = 'Nkawkaw' WHERE id = 'nkawkaw';
UPDATE offices SET name = 'Akim Oda' WHERE id = 'akim_oda';
UPDATE offices SET name = 'Nsawam' WHERE id = 'nsawam';
UPDATE offices SET name = 'Kumasi' WHERE id = 'kumasi';
UPDATE offices SET name = 'Obuasi' WHERE id = 'obuasi';
UPDATE offices SET name = 'Kintampo' WHERE id = 'kintampo';
UPDATE offices SET name = 'Techiman' WHERE id = 'techiman';
UPDATE offices SET name = 'Sunyani' WHERE id = 'sunyani';
UPDATE offices SET name = 'Tamale' WHERE id = 'tamale';
UPDATE offices SET name = 'Yendi' WHERE id = 'yendi';
UPDATE offices SET name = 'Wa' WHERE id = 'wa';
UPDATE offices SET name = 'Bolgatanga' WHERE id = 'bolgatanga';
UPDATE offices SET name = 'Navrongo' WHERE id = 'navrongo';
UPDATE offices SET name = 'Goaso' WHERE id = 'goaso';
UPDATE offices SET name = 'Ho' WHERE id = 'ho';
UPDATE offices SET name = 'Hohoe' WHERE id = 'hohoe';
UPDATE offices SET name = 'Keta' WHERE id = 'keta';
UPDATE offices SET name = 'Sefwi Wiawso' WHERE id = 'sefwi_wiawso';

-- Step 4: Delete offices no longer on the official list
DELETE FROM offices WHERE id IN (
  'ablekuma','accra_north','achimota','airport_area','awoshie','cantonment',
  'dome','dzorwulu','east_legon','kaneshie','la','lapaz','madina','osu',
  'roman_ridge','spintex','teshie_nungua',
  'kumasi_south','suhum','oda','elmina','saltpond',
  'bawku','nkwanta','damongo','salaga','bimbilla','nalerigu','bibiani'
);

-- Step 5: Insert new offices
INSERT INTO offices (id, name, region) VALUES
  ('adjen_kotoku', 'Adjen Kotoku', 'Greater Accra'),
  ('ningo_prampram', 'Ningo- Prampram', 'Greater Accra'),
  ('tema_new_town', 'Tema New Town', 'Greater Accra'),
  ('dodowa', 'Dodowa', 'Greater Accra'),
  ('sowutuom', 'Sowutuom', 'Greater Accra'),
  ('attah_deka', 'Attah Deka', 'Greater Accra'),
  ('ofankor', 'Ofankor', 'Greater Accra'),
  ('buduburam', 'Buduburam', 'Central'),
  ('wassa_akropong', 'Wassa Akropong', 'Western'),
  ('jomoro', 'Jomoro', 'Western'),
  ('ellembele', 'Ellembele', 'Western'),
  ('krobo_odumase', 'Krobo Odumase', 'Eastern'),
  ('kibi', 'Kibi', 'Eastern'),
  ('asamankese', 'Asamankese', 'Eastern'),
  ('ejisu', 'Ejisu', 'Ashanti'),
  ('mamponteng', 'Mamponteng', 'Ashanti'),
  ('asokore_mampong', 'Asokore Mampong', 'Ashanti'),
  ('ashanti_mampong', 'Ashanti Mampong', 'Ashanti'),
  ('konongo', 'Konongo', 'Ashanti'),
  ('nkawie', 'Nkawie', 'Ashanti'),
  ('effiduase', 'Effiduase', 'Ashanti'),
  ('asanti_bekwai', 'Asanti Bekwai', 'Ashanti'),
  ('agogo', 'Agogo', 'Ashanti'),
  ('offinso', 'Offinso', 'Ashanti'),
  ('nkoranza', 'Nkoranza', 'Bono East'),
  ('lawra', 'Lawra', 'Upper West'),
  ('jirapa', 'Jirapa', 'Upper West'),
  ('denu', 'Denu', 'Volta'),
  ('akatsi', 'Akatsi', 'Volta')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, region = EXCLUDED.region;

-- Step 6: Delete region_codes for removed regions
DELETE FROM region_codes WHERE region IN ('Savannah', 'North East');

-- Step 7: Update resolve_office_id function to use new default
CREATE OR REPLACE FUNCTION public.resolve_office_id(p_region text, p_area text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  resolved text;
BEGIN
  IF p_area IS NOT NULL THEN
    SELECT id INTO resolved FROM offices
    WHERE lower(replace(name, ' Office', '')) = lower(p_area)
    LIMIT 1;
    IF resolved IS NOT NULL THEN RETURN resolved; END IF;
  END IF;
  SELECT id INTO resolved FROM offices
  WHERE lower(region) = lower(p_region)
  LIMIT 1;
  RETURN COALESCE(resolved, 'accra_central');
END;
$function$;
