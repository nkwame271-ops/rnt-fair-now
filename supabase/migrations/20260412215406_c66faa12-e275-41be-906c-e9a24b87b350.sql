
-- Add band_type column to rent_bands
ALTER TABLE public.rent_bands
ADD COLUMN band_type TEXT NOT NULL DEFAULT 'add_tenant';

-- Add fee columns for existing tenancy bands
ALTER TABLE public.rent_bands
ADD COLUMN register_fee NUMERIC DEFAULT NULL,
ADD COLUMN filing_fee NUMERIC DEFAULT NULL,
ADD COLUMN agreement_fee NUMERIC DEFAULT NULL;

-- Create index for efficient lookups by band_type
CREATE INDEX idx_rent_bands_band_type ON public.rent_bands (band_type);

-- Duplicate existing rent bands as existing_tenancy type
INSERT INTO public.rent_bands (band_type, min_rent, max_rent, fee_amount, register_fee, filing_fee, agreement_fee, label)
SELECT 
  'existing_tenancy',
  min_rent,
  max_rent,
  fee_amount,
  fee_amount as register_fee,  -- default register fee to current fee_amount
  0 as filing_fee,             -- default filing fee to 0
  0 as agreement_fee,          -- default agreement fee to 0
  label
FROM public.rent_bands
WHERE band_type = 'add_tenant';
