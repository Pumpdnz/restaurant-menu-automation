-- Create pumpd_accounts table to track registered Pumpd platform accounts
CREATE TABLE IF NOT EXISTS pumpd_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Account credentials
    email VARCHAR(255) NOT NULL,
    user_password_hint VARCHAR(255), -- Store password hint (not the actual password)
    
    -- Registration details
    registration_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    registration_date TIMESTAMP WITH TIME ZONE,
    registration_method VARCHAR(50), -- 'new_account', 'existing_account'
    
    -- Account metadata
    restaurant_count INTEGER DEFAULT 0, -- Number of restaurants registered to this account
    is_primary_account BOOLEAN DEFAULT true, -- If this is the primary account for the restaurant
    
    -- Platform details
    pumpd_user_id VARCHAR(255), -- User ID from Pumpd platform if available
    pumpd_dashboard_url TEXT, -- Direct dashboard URL
    
    -- Error tracking
    last_error TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(org_id, email),
    UNIQUE(org_id, restaurant_id, email) -- Prevent duplicate registrations
);

-- Create index for queries
CREATE INDEX idx_pumpd_accounts_org_id ON pumpd_accounts(org_id);
CREATE INDEX idx_pumpd_accounts_restaurant_id ON pumpd_accounts(restaurant_id);
CREATE INDEX idx_pumpd_accounts_email ON pumpd_accounts(email);
CREATE INDEX idx_pumpd_accounts_status ON pumpd_accounts(registration_status);

-- Create pumpd_restaurants table to track restaurant registrations on Pumpd
CREATE TABLE IF NOT EXISTS pumpd_restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    pumpd_account_id UUID REFERENCES pumpd_accounts(id) ON DELETE SET NULL,
    
    -- Pumpd platform identifiers
    pumpd_restaurant_id VARCHAR(255), -- Restaurant ID from Pumpd platform
    pumpd_subdomain VARCHAR(255), -- e.g., "pizzapalace" for pizzapalace.pumpd.co.nz
    pumpd_full_url TEXT, -- Full URL to restaurant site
    
    -- Registration details
    registration_status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
    registration_date TIMESTAMP WITH TIME ZONE,
    registration_type VARCHAR(50), -- 'account_and_restaurant', 'restaurant_only'
    
    -- Configuration applied
    configured_name VARCHAR(255),
    configured_address TEXT,
    configured_phone VARCHAR(50),
    configured_hours JSONB, -- Store the actual hours configuration sent
    configured_locale VARCHAR(50) DEFAULT 'en-NZ',
    configured_timezone VARCHAR(50) DEFAULT 'Pacific/Auckland',
    configured_currency VARCHAR(10) DEFAULT 'NZD',
    tax_in_prices BOOLEAN DEFAULT true,
    
    -- Dashboard URLs
    dashboard_url TEXT, -- Restaurant-specific dashboard URL
    settings_url TEXT,
    menu_url TEXT,
    
    -- Status tracking
    is_active BOOLEAN DEFAULT true,
    last_sync_date TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50), -- 'synced', 'pending_sync', 'sync_failed'
    
    -- Error tracking
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(org_id, restaurant_id), -- One registration per restaurant per org
    UNIQUE(pumpd_subdomain) -- Subdomains must be globally unique
);

-- Create indexes for queries
CREATE INDEX idx_pumpd_restaurants_org_id ON pumpd_restaurants(org_id);
CREATE INDEX idx_pumpd_restaurants_restaurant_id ON pumpd_restaurants(restaurant_id);
CREATE INDEX idx_pumpd_restaurants_account_id ON pumpd_restaurants(pumpd_account_id);
CREATE INDEX idx_pumpd_restaurants_status ON pumpd_restaurants(registration_status);
CREATE INDEX idx_pumpd_restaurants_subdomain ON pumpd_restaurants(pumpd_subdomain);

-- Create registration_logs table for tracking registration attempts
CREATE TABLE IF NOT EXISTS registration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    pumpd_account_id UUID REFERENCES pumpd_accounts(id) ON DELETE CASCADE,
    pumpd_restaurant_id UUID REFERENCES pumpd_restaurants(id) ON DELETE CASCADE,
    
    -- Log details
    action VARCHAR(100) NOT NULL, -- 'account_creation', 'restaurant_registration', 'login_attempt', etc.
    status VARCHAR(50) NOT NULL, -- 'started', 'success', 'failed'
    
    -- Request/Response data
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    
    -- Execution details
    script_name VARCHAR(255),
    execution_time_ms INTEGER,
    screenshot_paths TEXT[], -- Array of screenshot file paths
    
    -- User context
    initiated_by VARCHAR(255), -- User who initiated the action
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for logs
CREATE INDEX idx_registration_logs_org_id ON registration_logs(org_id);
CREATE INDEX idx_registration_logs_restaurant_id ON registration_logs(restaurant_id);
CREATE INDEX idx_registration_logs_action ON registration_logs(action);
CREATE INDEX idx_registration_logs_status ON registration_logs(status);
CREATE INDEX idx_registration_logs_created_at ON registration_logs(created_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pumpd_accounts_updated_at BEFORE UPDATE ON pumpd_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pumpd_restaurants_updated_at BEFORE UPDATE ON pumpd_restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE pumpd_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pumpd_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_logs ENABLE ROW LEVEL SECURITY;

-- Policy for pumpd_accounts
CREATE POLICY pumpd_accounts_org_policy ON pumpd_accounts
    FOR ALL
    USING (org_id IN (
        SELECT org_id FROM user_organizations 
        WHERE user_id = auth.uid()
    ));

-- Policy for pumpd_restaurants
CREATE POLICY pumpd_restaurants_org_policy ON pumpd_restaurants
    FOR ALL
    USING (org_id IN (
        SELECT org_id FROM user_organizations 
        WHERE user_id = auth.uid()
    ));

-- Policy for registration_logs
CREATE POLICY registration_logs_org_policy ON registration_logs
    FOR ALL
    USING (org_id IN (
        SELECT org_id FROM user_organizations 
        WHERE user_id = auth.uid()
    ));