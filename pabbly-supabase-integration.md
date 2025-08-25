# Pabbly Connect to Supabase Direct Integration

## Supabase REST API Configuration

### Endpoint Details
- **Base URL**: `https://qgabsyggzlkcstjzugdh.supabase.co`
- **Table Endpoint**: `https://qgabsyggzlkcstjzugdh.supabase.co/rest/v1/restaurants`
- **API Key (anon)**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYWJzeWdnemxrY3N0anp1Z2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NTI2OTQsImV4cCI6MjA3MTMyODY5NH0.4kSwUAw2hXVPddBSf9l7BstV9FQ_BwVQWfhvRXnUHC0`

## Pabbly Connect Configuration

### Step 1: Add HTTP Request Action in Pabbly

1. **Action Type**: HTTP Request / Webhook
2. **Method**: POST
3. **URL**: `https://qgabsyggzlkcstjzugdh.supabase.co/rest/v1/restaurants`

### Step 2: Headers Configuration

Add these headers:
```
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYWJzeWdnemxrY3N0anp1Z2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NTI2OTQsImV4cCI6MjA3MTMyODY5NH0.4kSwUAw2hXVPddBSf9l7BstV9FQ_BwVQWfhvRXnUHC0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYWJzeWdnemxrY3N0anp1Z2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NTI2OTQsImV4cCI6MjA3MTMyODY5NH0.4kSwUAw2hXVPddBSf9l7BstV9FQ_BwVQWfhvRXnUHC0
Content-Type: application/json
Prefer: return=representation
```

### Step 3: Request Body Mapping

Map the Facebook lead data to the restaurant table fields:

```json
{
  "name": "{{res2.what's_the_name_of_your_restaurant?}}",
  "email": "{{res2.email}}",
  "phone": "{{res2.phone_number}}",
  "weekly_sales_range": "{{res2.what_are_your_weekly_sales_through_delivery_apps?}}",
  "contact_name": "{{res2.full name}}",
  "contact_email": "{{res2.email}}",
  "contact_phone": "{{res2.phone_number}}",
  "city": "{{res2.city}}",
  "address": "{{res2.city}}, New Zealand",
  "lead_created_at": "{{res1.created_time}}",
  "onboarding_status": "lead_received",
  "metadata": {
    "lead_source": "facebook",
    "ad_id": "{{res1.ad_id}}",
    "ad_name": "{{res1.ad_name}}",
    "campaign_name": "{{res1.campaign_name}}",
    "form_id": "{{res1.form_id}}",
    "platform": "{{res1.platform}}"
  }
}
```

**IMPORTANT**: The `city` field is now a dedicated column (not in metadata) and is required for Google Business search functionality.

## Handling Duplicates (Upsert)

To prevent duplicate restaurants, use an UPSERT operation:

### Option 1: Use UPSERT Endpoint (Recommended)
Change the URL to include upsert parameters:
```
https://qgabsyggzlkcstjzugdh.supabase.co/rest/v1/restaurants?on_conflict=email
```

Add this header:
```
Prefer: resolution=merge-duplicates,return=representation
```

### Option 2: Check Before Insert
First, check if restaurant exists:

**GET Request**:
```
https://qgabsyggzlkcstjzugdh.supabase.co/rest/v1/restaurants?email=eq.{{res2.email}}
```

Then conditionally insert or update based on the response.

## Testing the Integration

### Test Payload
You can test with this sample data in Postman or curl:

```bash
curl -X POST 'https://qgabsyggzlkcstjzugdh.supabase.co/rest/v1/restaurants' \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYWJzeWdnemxrY3N0anp1Z2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NTI2OTQsImV4cCI6MjA3MTMyODY5NH0.4kSwUAw2hXVPddBSf9l7BstV9FQ_BwVQWfhvRXnUHC0' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYWJzeWdnemxrY3N0anp1Z2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NTI2OTQsImV4cCI6MjA3MTMyODY5NH0.4kSwUAw2hXVPddBSf9l7BstV9FQ_BwVQWfhvRXnUHC0' \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=representation' \
  -d '{
    "name": "Test Restaurant from Pabbly",
    "email": "test@example.com",
    "phone": "+64123456789",
    "weekly_sales_range": "$1,001_-_$2,999",
    "contact_name": "John Doe",
    "contact_email": "test@example.com",
    "contact_phone": "+64123456789",
    "address": "Wellington, New Zealand",
    "lead_created_at": "2025-08-22T08:00:00+0000",
    "onboarding_status": "lead_received",
    "metadata": {
      "lead_source": "facebook",
      "ad_id": "120213949281160194",
      "campaign_name": "Test Campaign",
      "form_id": "3381773785286875",
      "platform": "ig",
      "city": "Wellington"
    }
  }'
```

## Workflow Trigger After Lead Creation

Once the restaurant record is created, you can:

1. **Monitor New Records**: Set up a Supabase webhook or polling mechanism to detect new restaurants with `onboarding_status = 'lead_received'`

2. **Trigger Automation**: Use the restaurant ID to trigger the setup-new-lead workflow

3. **Update Status**: As the workflow progresses, update the `onboarding_status` field:
   - `lead_received` → `contact_attempted` → `details_collected` → `menu_extracted` → `account_created` → `completed`

## Error Handling in Pabbly

Add error handling steps:
1. Check HTTP response code (should be 201 for created, 200 for updated)
2. Log any errors to a Google Sheet or send notification
3. Retry logic for temporary failures

## Alternative: RPC Function for Complex Logic

If you need more complex logic (e.g., deduplication, validation, triggering workflows), create a Supabase Edge Function:

```sql
CREATE OR REPLACE FUNCTION handle_facebook_lead(
  lead_data jsonb
) RETURNS jsonb AS $$
DECLARE
  restaurant_id uuid;
  existing_restaurant jsonb;
BEGIN
  -- Check for existing restaurant by email
  SELECT to_jsonb(r.*) INTO existing_restaurant
  FROM restaurants r
  WHERE r.email = lead_data->>'email'
  OR r.contact_email = lead_data->>'email';
  
  IF existing_restaurant IS NOT NULL THEN
    -- Update existing restaurant
    UPDATE restaurants
    SET 
      weekly_sales_range = COALESCE(lead_data->>'weekly_sales_range', weekly_sales_range),
      contact_name = COALESCE(lead_data->>'contact_name', contact_name),
      contact_phone = COALESCE(lead_data->>'contact_phone', contact_phone),
      metadata = metadata || (lead_data->'metadata'),
      updated_at = NOW()
    WHERE id = (existing_restaurant->>'id')::uuid
    RETURNING id INTO restaurant_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'updated',
      'restaurant_id', restaurant_id
    );
  ELSE
    -- Insert new restaurant
    INSERT INTO restaurants (
      name, email, phone, weekly_sales_range,
      contact_name, contact_email, contact_phone,
      address, lead_created_at, onboarding_status, metadata
    ) VALUES (
      lead_data->>'name',
      lead_data->>'email',
      lead_data->>'phone',
      lead_data->>'weekly_sales_range',
      lead_data->>'contact_name',
      lead_data->>'contact_email',
      lead_data->>'contact_phone',
      lead_data->>'address',
      (lead_data->>'lead_created_at')::timestamptz,
      'lead_received',
      lead_data->'metadata'
    )
    RETURNING id INTO restaurant_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'created',
      'restaurant_id', restaurant_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
```

Then call it from Pabbly:
```
POST https://qgabsyggzlkcstjzugdh.supabase.co/rest/v1/rpc/handle_facebook_lead
```

## Recommended Implementation for Pabbly

Use the **RPC function method** for better duplicate handling:

### Pabbly Configuration:
1. **URL**: `https://qgabsyggzlkcstjzugdh.supabase.co/rest/v1/rpc/handle_facebook_lead`
2. **Method**: POST
3. **Authentication**: Bearer Token (use the API key provided above)
4. **Payload Type**: JSON
5. **Additional Headers**:
   - `apikey`: (use the same key as Bearer token)

6. **Body Parameters** (flat structure - add each as a separate field in Pabbly):

| Field Name | Value to Map |
|------------|--------------|
| name | {{res2.what's_the_name_of_your_restaurant?}} |
| email | {{res2.email}} |
| contact_name | {{res2.full name}} |
| contact_email | {{res2.email}} |
| contact_phone | {{res2.phone_number}} |
| weekly_sales_range | {{res2.what_are_your_weekly_sales_through_delivery_apps?}} |
| lead_created_at | {{res1.created_time}} |
| city | {{res2.city}} |
| campaign_name | {{res1.campaign_name}} |
| platform | {{res1.platform}} |
| ad_id | {{res1.ad_id}} |
| ad_name | {{res1.ad_name}} |
| form_id | {{res1.form_id}} |

**Note**: The RPC function now accepts flat parameters instead of nested JSON, making it compatible with Pabbly's interface. All parameters are optional except name and email.

## Testing Results

✅ **Direct Insert**: Successfully creates new restaurant records
✅ **RPC Function**: Successfully handles both create and update scenarios
✅ **Duplicate Handling**: Existing restaurants are updated, not duplicated
✅ **Metadata Merging**: New lead metadata is merged with existing data
✅ **App Integration**: Records appear immediately in the UI at http://localhost:5007/

## Notes

- The `weekly_sales_range` field stores the value as-is from Facebook (e.g., "$1,001_-_$2,999")
- The `metadata` field stores all Facebook ad tracking information as JSON
- `lead_created_at` preserves the original timestamp from Facebook
- The integration creates a new restaurant record that can be edited/completed via the UI
- The RPC function prevents duplicates by checking email addresses
- All new leads have `onboarding_status` set to `lead_received`