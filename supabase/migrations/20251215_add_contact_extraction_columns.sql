-- Migration: Add contact extraction columns to restaurants table
-- Purpose: Support Companies Office extraction, email/phone extraction, and personal contact details
-- Date: 2025-12-15

BEGIN;

-- ============================================================================
-- BUSINESS DETAILS COLUMNS (from Companies Office extraction)
-- ============================================================================

-- Full legal name of the owner/director
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS full_legal_name TEXT;

-- New Zealand Business Number
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS nzbn TEXT;

-- Companies Office registration number
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS company_number TEXT;

-- GST registration number
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS gst_number TEXT;

-- ============================================================================
-- ADDITIONAL CONTACTS METADATA (JSONB for directors, shareholders, etc.)
-- ============================================================================

-- Stores additional contacts extracted from Companies Office
-- Structure: {
--   directors: [{ name, full_legal_name, position, address, status }],
--   shareholders: [{ name, shares, percentage }],
--   addresses: [{ address_type, full_address, contact_name }],
--   nzbn_details: { phone_numbers, email_addresses, trading_name, websites },
--   extraction_date: "2025-12-15T00:00:00Z",
--   source_company_number: "1234567"
-- }
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS additional_contacts_metadata JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- PERSONAL CONTACT SOCIAL LINKS
-- ============================================================================

-- Contact's Instagram profile URL
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS contact_instagram TEXT;

-- Contact's Facebook profile URL
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS contact_facebook TEXT;

-- Contact's LinkedIn profile URL
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS contact_linkedin TEXT;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on NZBN for lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_nzbn
  ON public.restaurants(nzbn)
  WHERE nzbn IS NOT NULL;

-- Index on company number for lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_company_number
  ON public.restaurants(company_number)
  WHERE company_number IS NOT NULL;

-- GIN index on additional_contacts_metadata for JSONB queries
CREATE INDEX IF NOT EXISTS idx_restaurants_additional_contacts_metadata
  ON public.restaurants USING GIN (additional_contacts_metadata);

-- ============================================================================
-- COLUMN DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN public.restaurants.full_legal_name IS 'Full legal name of the business owner/director from Companies Office';
COMMENT ON COLUMN public.restaurants.nzbn IS 'New Zealand Business Number (13-digit identifier)';
COMMENT ON COLUMN public.restaurants.company_number IS 'Companies Office registration number';
COMMENT ON COLUMN public.restaurants.gst_number IS 'GST registration number';
COMMENT ON COLUMN public.restaurants.additional_contacts_metadata IS 'JSONB storage for directors, shareholders, and other contacts from Companies Office';
COMMENT ON COLUMN public.restaurants.contact_instagram IS 'Instagram profile URL for the primary contact';
COMMENT ON COLUMN public.restaurants.contact_facebook IS 'Facebook profile URL for the primary contact';
COMMENT ON COLUMN public.restaurants.contact_linkedin IS 'LinkedIn profile URL for the primary contact';

COMMIT;
