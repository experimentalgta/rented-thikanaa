-- ==============================================================================
-- Rented Thikanaa Migration: Direct Contact (Call & WhatsApp) and Phone Privacy
-- Date: 2026-10-06
-- ==============================================================================

-- 1. Add direct phone_number and show_phone_number columns to public.properties
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS show_phone_number BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill show_phone_number based on legacy phone_privacy if present
UPDATE public.properties
SET show_phone_number = (phone_privacy = 'public')
WHERE show_phone_number IS NULL OR (show_phone_number = false AND phone_privacy = 'public');

-- 3. Document purpose of columns
COMMENT ON COLUMN public.properties.phone_number IS 'Owner/lister direct contact phone number (10-digit Indian mobile format)';
COMMENT ON COLUMN public.properties.show_phone_number IS 'When true, allows direct Call and WhatsApp actions on property detail. When false, direct phone number is kept strictly private and masked from public API queries.';
