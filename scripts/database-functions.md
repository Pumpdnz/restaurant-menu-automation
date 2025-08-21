# Database Functions for Automation

## get_onboarding_id_by_email

**Purpose**: Get user_onboarding record ID and details by email address. Used in the onboarding automation workflow.

**Function Signature**:
```sql
get_onboarding_id_by_email(user_email text)
```

**Returns**:
- `onboarding_id` (uuid): The ID of the user_onboarding record
- `user_id` (uuid): The user's ID from the profiles table
- `email` (text): The user's email
- `name` (text): The user's name
- `onboarding_status` (text): Current onboarding status
- `created_at` (timestamptz): When the onboarding record was created

**Usage in Subagent**:

1. After creating a new user with `create-onboarding-user.js`, use this function to get the onboarding record ID:

```javascript
// Via MCP tool
mcp__supabase__execute_sql({
  project_id: "lqcgatpunhuiwcyqesap",
  query: "SELECT * FROM public.get_onboarding_id_by_email('user@example.com')"
})
```

2. Check if result is empty (user not found):
```javascript
if (result.length === 0) {
  // Handle error - user not found or onboarding record doesn't exist
}
```

3. Extract the onboarding_id for updating the record:
```javascript
const onboarding_id = result[0].onboarding_id;
const user_id = result[0].user_id;
```

4. Update the user_onboarding record with collected data:

**Required Fields to Update:**
```javascript
mcp__supabase__execute_sql({
  project_id: "lqcgatpunhuiwcyqesap",
  query: `
    UPDATE public.user_onboarding 
    SET 
      -- REQUIRED FIELDS
      restaurant_name = 'Restaurant Name',           -- From Phase 1
      organisation_name = 'Organisation Name',       -- From Phase 3 registration
      address = '123 Main St, City',                -- From Phase 1
      email = 'restaurant@example.com',             -- From Phase 3 registration
      phone = '+6412345678',                        -- From Phase 1
      contact_person = 'Owner Name',                -- From Phase 3 registration
      venue_operating_hours = '${JSON.stringify(hours)}', -- From Phase 1 (jsonb)
      primary_color = '#FF0000',                    -- From Phase 2 logo extraction
      stripe_connect_link = 'https://connect.stripe.com/...', -- From Phase 6 payment setup
      
      -- OPTIONAL FIELDS (set if available)
      secondary_color = '#0000FF',                  -- From Phase 2 logo extraction (if available)
      facebook_url = 'https://facebook.com/...',    -- From Phase 1 (if found)
      instagram_url = 'https://instagram.com/...',  -- From Phase 1 (if found)
      
      -- SYSTEM FIELDS
      updated_at = NOW()
    WHERE id = '${onboarding_id}'
  `
})
```

**Note on Default Values:**
The following fields have database defaults and don't need to be set unless different values are required:
- `default_preparation_time_minutes`: 15
- `commission_rate`: 5
- `pickup_commission_rate`: 2
- `ubereats_commission_rate`: 34.5
- `ubereats_markup`: 15
- `average_cogs_percentage`: 30
- `primary_color`: '#3f92ff' (but should be overridden with extracted color)

## Security Notes

- Function uses SECURITY DEFINER to ensure proper permissions
- Accessible by both authenticated users and service_role
- Returns empty result set if email not found (no error thrown)
- Limited to returning single record per email (LIMIT 1)