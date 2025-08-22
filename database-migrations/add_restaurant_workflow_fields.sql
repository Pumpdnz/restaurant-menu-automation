-- Migration: Add comprehensive workflow fields to restaurants table
-- This migration adds all necessary fields for the complete restaurant onboarding workflow

-- Add lead information fields
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS weekly_sales_range TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lead_created_at TIMESTAMPTZ;

-- Add platform URLs
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS ubereats_url TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS doordash_url TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add social media URLs
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS facebook_url TEXT;

-- Add business details
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours JSONB;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours_text TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cuisine TEXT[];
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS organisation_name TEXT;

-- Add branding fields
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS theme TEXT CHECK (theme IN ('light', 'dark'));
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS secondary_color TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_nobg_url TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_standard_url TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_thermal_url TEXT;

-- Add account fields
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS user_password_hint TEXT; -- Store password convention hint, not actual password
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Add configuration fields
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS stripe_connect_url TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS payment_settings JSONB;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_settings JSONB;

-- Add workflow tracking
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'lead';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS workflow_notes TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_restaurants_onboarding_status ON restaurants(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_restaurants_contact_email ON restaurants(contact_email);
CREATE INDEX IF NOT EXISTS idx_restaurants_user_email ON restaurants(user_email);
CREATE INDEX IF NOT EXISTS idx_restaurants_subdomain ON restaurants(subdomain);

-- Add comments for documentation
COMMENT ON COLUMN restaurants.weekly_sales_range IS 'Weekly delivery app sales range from lead form';
COMMENT ON COLUMN restaurants.contact_name IS 'Primary contact person name';
COMMENT ON COLUMN restaurants.contact_email IS 'Contact email for restaurant operations';
COMMENT ON COLUMN restaurants.contact_phone IS 'Contact phone for restaurant operations';
COMMENT ON COLUMN restaurants.lead_created_at IS 'Timestamp when lead was created';

COMMENT ON COLUMN restaurants.ubereats_url IS 'UberEats ordering page URL';
COMMENT ON COLUMN restaurants.doordash_url IS 'DoorDash ordering page URL';
COMMENT ON COLUMN restaurants.website_url IS 'Restaurant website URL';

COMMENT ON COLUMN restaurants.opening_hours IS 'Structured opening hours data in JSON format';
COMMENT ON COLUMN restaurants.opening_hours_text IS 'Human-readable opening hours description';
COMMENT ON COLUMN restaurants.cuisine IS 'Array of cuisine types';

COMMENT ON COLUMN restaurants.theme IS 'UI theme preference (light or dark)';
COMMENT ON COLUMN restaurants.primary_color IS 'Primary brand color in hex format';
COMMENT ON COLUMN restaurants.secondary_color IS 'Secondary brand color in hex format';

COMMENT ON COLUMN restaurants.user_email IS 'Account owner email for admin portal login';
COMMENT ON COLUMN restaurants.user_password_hint IS 'Password convention hint (e.g., Restaurantname789!)';
COMMENT ON COLUMN restaurants.subdomain IS 'Pumpd subdomain (e.g., restaurant-name.pumpd.co.nz)';

COMMENT ON COLUMN restaurants.stripe_connect_url IS 'Stripe Connect onboarding URL';
COMMENT ON COLUMN restaurants.payment_settings IS 'Payment configuration in JSON format';
COMMENT ON COLUMN restaurants.service_settings IS 'Service configuration in JSON format';

COMMENT ON COLUMN restaurants.onboarding_status IS 'Current status in onboarding workflow';
COMMENT ON COLUMN restaurants.workflow_notes IS 'Notes about the onboarding process';