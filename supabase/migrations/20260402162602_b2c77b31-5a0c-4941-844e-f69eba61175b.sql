-- Drop the existing unique constraint on serial_number
ALTER TABLE rent_card_serial_stock DROP CONSTRAINT rent_card_serial_stock_serial_number_key;

-- Add composite unique constraint allowing same serial with different pair_index
ALTER TABLE rent_card_serial_stock ADD CONSTRAINT rent_card_serial_stock_serial_pair_unique UNIQUE (serial_number, pair_index);