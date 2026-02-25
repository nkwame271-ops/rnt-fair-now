
-- Add marketplace listing flag to properties
ALTER TABLE public.properties ADD COLUMN listed_on_marketplace boolean NOT NULL DEFAULT false;
