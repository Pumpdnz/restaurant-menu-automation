# Onboarding User Implementation Plan

## Overview
This document outlines the implementation plan for adding onboarding user creation and record management features to the Pumpd Registration tab in the RestaurantDetail page.

## Current Situation

### Architecture
1. **Main App Database**: `qgabsyggzlkcstjzugdh.supabase.co` (current app)
2. **Onboarding Database**: `lqcgatpunhuiwcyqesap.supabase.co` (separate project)
3. **Super Admin System**: `manage.pumpd.co.nz` (user creation)

### Existing Components
- `create-onboarding-user.js`: Creates "New Sign Up" users in Super Admin
- `get_onboarding_id_by_email`: Database function in onboarding database
- `user_onboarding` table: Stores onboarding data in separate database

### Challenge
The main challenge is accessing the onboarding database from our Express app, which is configured for a different Supabase project.

## Implementation Options

### Option 1: Direct Dual Database Connection (Recommended)
**Approach**: Create a secondary Supabase client specifically for the onboarding database.

**Pros**:
- Direct database access
- No additional infrastructure needed
- Fast and efficient
- Can reuse existing database functions

**Cons**:
- Requires storing credentials for second database
- Need to manage two database connections

**Implementation**:
```javascript
// In database-service.js or new onboarding-service.js
const onboardingSupabase = createClient(
  process.env.ONBOARDING_SUPABASE_URL,
  process.env.ONBOARDING_SUPABASE_SERVICE_KEY
);
```

### Option 2: Proxy API Endpoint
**Approach**: Create an API endpoint in the onboarding project that our app can call.

**Pros**:
- Clean separation of concerns
- Single point of access
- Better security (no direct DB access)

**Cons**:
- Requires deploying/maintaining separate API
- Additional network latency
- More complex error handling

### Option 3: Edge Function Bridge
**Approach**: Use Supabase Edge Functions as a bridge between projects.

**Pros**:
- Serverless, no infrastructure to manage
- Can leverage Supabase auth
- Good for cross-project communication

**Cons**:
- Requires learning Edge Functions
- Additional deployment step
- May have cold start latency

### Option 4: Backend Service Integration
**Approach**: Handle everything through our Express backend with proper service separation.

**Pros**:
- All logic in one place
- Easier to debug and maintain
- Can add business logic easily

**Cons**:
- Requires careful credential management
- Need to handle cross-database transactions

## Recommended Solution: Option 1 with Option 4 Architecture

We'll implement direct dual database connection within our Express backend, keeping all logic server-side for security.

## Implementation Details

### Phase 1: Script Modifications

#### 1.1 Update create-onboarding-user.js
Similar to ordering-page-customization.js modifications:

```javascript
// Add parameter support
const email = getArg('email');
const password = getArg('password');
const name = getArg('name');
const userEmail = getArg('userEmail');
const userPassword = getArg('userPassword');

// Use provided credentials or fallback to env
const LOGIN_EMAIL = email || process.env.MANAGE_EMAIL;
const LOGIN_PASSWORD = password || process.env.MANAGE_PASSWORD;
```

#### 1.2 Add Export for Programmatic Use
```javascript
export { createOnboardingUser };

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createOnboardingUser().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}
```

### Phase 2: Backend Implementation

#### 2.1 Create Onboarding Service
**File**: `/src/services/onboarding-service.js`

```javascript
const { createClient } = require('@supabase/supabase-js');

// Initialize onboarding database client
const onboardingSupabase = createClient(
  process.env.ONBOARDING_SUPABASE_URL,
  process.env.ONBOARDING_SUPABASE_SERVICE_KEY
);

async function getOnboardingIdByEmail(email) {
  const { data, error } = await onboardingSupabase
    .rpc('get_onboarding_id_by_email', { user_email: email });
  
  if (error) throw error;
  return data?.[0] || null;
}

async function updateOnboardingRecord(onboardingId, updates) {
  const { data, error } = await onboardingSupabase
    .from('user_onboarding')
    .update(updates)
    .eq('id', onboardingId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

module.exports = {
  getOnboardingIdByEmail,
  updateOnboardingRecord
};
```

#### 2.2 Add Routes to registration-routes.js

```javascript
// Create onboarding user
router.post('/create-onboarding-user', async (req, res) => {
  const { 
    userName, 
    userEmail, 
    userPassword,
    restaurantId 
  } = req.body;
  
  try {
    // Get restaurant details for default password if not provided
    const restaurant = await getRestaurantDetails(restaurantId);
    
    // Generate default password if not provided
    const password = userPassword || generateDefaultPassword(restaurant.name);
    
    // Execute script
    const command = [
      'node',
      scriptPath,
      `--name="${userName}"`,
      `--userEmail="${userEmail}"`,
      `--userPassword="${password}"`,
      `--email="${adminEmail}"`,  // Admin credentials
      `--password="${adminPassword}"`
    ].join(' ');
    
    const { stdout, stderr } = await execAsync(command);
    
    res.json({
      success: true,
      userEmail,
      message: 'User created successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update onboarding record
router.post('/update-onboarding-record', async (req, res) => {
  const { 
    userEmail,
    restaurantId,
    updates 
  } = req.body;
  
  try {
    // Get restaurant and account details
    const restaurant = await getRestaurantDetails(restaurantId);
    const account = await getAccountDetails(restaurantId);
    
    // Get onboarding record
    const onboarding = await getOnboardingIdByEmail(userEmail);
    
    if (!onboarding) {
      throw new Error('Onboarding record not found');
    }
    
    // Prepare update data
    const updateData = {
      restaurant_name: restaurant.name,
      organisation_name: restaurant.organisation_name,
      address: restaurant.address,
      email: restaurant.email,
      phone: restaurant.phone,
      contact_person: updates.contactPerson || userName,
      venue_operating_hours: JSON.stringify(restaurant.opening_hours),
      primary_color: restaurant.primary_color,
      secondary_color: restaurant.secondary_color,
      facebook_url: restaurant.facebook_url,
      instagram_url: restaurant.instagram_url,
      stripe_connect_link: restaurant.stripe_connect_url,
      logo_url: restaurant.hosted_logo_url,
      updated_at: new Date().toISOString()
    };
    
    // Update record
    const updated = await updateOnboardingRecord(
      onboarding.onboarding_id, 
      updateData
    );
    
    res.json({
      success: true,
      onboardingId: onboarding.onboarding_id,
      updated
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

### Phase 3: Frontend Implementation

#### 3.1 Add State Management
```jsx
// In RestaurantDetail.jsx
const [isCreatingOnboardingUser, setIsCreatingOnboardingUser] = useState(false);
const [onboardingUserStatus, setOnboardingUserStatus] = useState(null);
const [isUpdatingOnboarding, setIsUpdatingOnboarding] = useState(false);
const [onboardingUpdateStatus, setOnboardingUpdateStatus] = useState(null);
const [onboardingUserEmail, setOnboardingUserEmail] = useState('');
const [onboardingUserName, setOnboardingUserName] = useState('');
const [onboardingUserPassword, setOnboardingUserPassword] = useState('');
```

#### 3.2 Add Handler Functions
```jsx
const handleCreateOnboardingUser = async () => {
  setIsCreatingOnboardingUser(true);
  setOnboardingUserStatus(null);
  
  try {
    const response = await api.post('/registration/create-onboarding-user', {
      restaurantId: id,
      userName: onboardingUserName,
      userEmail: onboardingUserEmail,
      userPassword: onboardingUserPassword || generateDefaultPassword(restaurant.name)
    });
    
    setOnboardingUserStatus(response.data);
    
    if (response.data.success) {
      toast({
        title: "Success",
        description: "Onboarding user created successfully",
      });
    }
  } catch (error) {
    toast({
      title: "Error",
      description: error.response?.data?.error || "Failed to create user",
      variant: "destructive"
    });
  } finally {
    setIsCreatingOnboardingUser(false);
  }
};

const handleUpdateOnboardingRecord = async () => {
  setIsUpdatingOnboarding(true);
  setOnboardingUpdateStatus(null);
  
  try {
    const response = await api.post('/registration/update-onboarding-record', {
      restaurantId: id,
      userEmail: onboardingUserEmail,
      updates: {
        contactPerson: onboardingUserName
      }
    });
    
    setOnboardingUpdateStatus(response.data);
    
    if (response.data.success) {
      toast({
        title: "Success",
        description: "Onboarding record updated successfully",
      });
    }
  } catch (error) {
    toast({
      title: "Error",
      description: error.response?.data?.error || "Failed to update record",
      variant: "destructive"
    });
  } finally {
    setIsUpdatingOnboarding(false);
  }
};
```

#### 3.3 Add UI Components
```jsx
{/* Onboarding User Management Section */}
<div className="border rounded-lg p-6 space-y-4">
  <div>
    <h3 className="text-lg font-semibold mb-2">Onboarding User Management</h3>
    <p className="text-sm text-gray-600">
      Create and manage onboarding users for restaurant setup
    </p>
  </div>
  
  {/* Input fields */}
  <div className="space-y-4">
    <div>
      <label className="text-sm font-medium">User Name</label>
      <Input
        value={onboardingUserName}
        onChange={(e) => setOnboardingUserName(e.target.value)}
        placeholder="Restaurant Owner Name"
      />
    </div>
    
    <div>
      <label className="text-sm font-medium">User Email</label>
      <Input
        type="email"
        value={onboardingUserEmail}
        onChange={(e) => setOnboardingUserEmail(e.target.value)}
        placeholder="owner@restaurant.com"
      />
    </div>
    
    <div>
      <label className="text-sm font-medium">
        Password (optional - auto-generated if empty)
      </label>
      <Input
        type="password"
        value={onboardingUserPassword}
        onChange={(e) => setOnboardingUserPassword(e.target.value)}
        placeholder="Leave empty for auto-generation"
      />
    </div>
  </div>
  
  {/* Action buttons */}
  <div className="flex gap-4">
    <Button
      onClick={handleCreateOnboardingUser}
      disabled={isCreatingOnboardingUser || !onboardingUserName || !onboardingUserEmail}
      className="flex items-center gap-2"
    >
      {isCreatingOnboardingUser ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating User...
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Create Onboarding User
        </>
      )}
    </Button>
    
    <Button
      onClick={handleUpdateOnboardingRecord}
      disabled={isUpdatingOnboarding || !onboardingUserEmail}
      variant="outline"
      className="flex items-center gap-2"
    >
      {isUpdatingOnboarding ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Updating Record...
        </>
      ) : (
        <>
          <Database className="h-4 w-4" />
          Update Onboarding Record
        </>
      )}
    </Button>
  </div>
  
  {/* Status displays */}
  {onboardingUserStatus && (
    <Alert className={onboardingUserStatus.success ? 'border-green-500' : 'border-red-500'}>
      <AlertDescription>
        {onboardingUserStatus.message}
      </AlertDescription>
    </Alert>
  )}
  
  {onboardingUpdateStatus && (
    <Alert className={onboardingUpdateStatus.success ? 'border-green-500' : 'border-red-500'}>
      <AlertDescription>
        {onboardingUpdateStatus.success 
          ? `Record updated: ${onboardingUpdateStatus.onboardingId}`
          : onboardingUpdateStatus.error}
      </AlertDescription>
    </Alert>
  )}
</div>
```

### Phase 4: Environment Configuration

#### 4.1 Add Environment Variables
```env
# Onboarding Database Configuration
ONBOARDING_SUPABASE_URL=https://lqcgatpunhuiwcyqesap.supabase.co
ONBOARDING_SUPABASE_SERVICE_KEY=your_service_key_here

# Super Admin Credentials (for create-onboarding-user.js)
MANAGE_EMAIL=claude.agent@gmail.com
MANAGE_PASSWORD=your_password_here
```

## Security Considerations

1. **Credential Management**:
   - Store all sensitive credentials in environment variables
   - Never expose service keys to frontend
   - Use server-side execution only

2. **Access Control**:
   - Verify user has permission to create onboarding users
   - Log all operations for audit trail
   - Implement rate limiting

3. **Data Validation**:
   - Validate all inputs before database operations
   - Sanitize data to prevent injection attacks
   - Check for duplicate users before creation

4. **Error Handling**:
   - Graceful fallback if onboarding DB unavailable
   - Clear error messages for debugging
   - Don't expose internal errors to frontend

## Testing Plan

1. **Unit Tests**:
   - Test database connection to both projects
   - Test script execution with various parameters
   - Test error handling scenarios

2. **Integration Tests**:
   - Test full flow from UI to database
   - Test with missing/invalid data
   - Test concurrent operations

3. **Manual Testing**:
   - Create user with all fields
   - Create user with minimal fields
   - Update existing record
   - Handle duplicate email scenarios

## Rollout Plan

### Phase 1: Backend Setup (Day 1)
- [ ] Add environment variables
- [ ] Create onboarding service
- [ ] Update create-onboarding-user.js script
- [ ] Add backend routes

### Phase 2: Frontend Implementation (Day 2)
- [ ] Add UI components
- [ ] Implement state management
- [ ] Add form validation
- [ ] Connect to backend

### Phase 3: Testing & Refinement (Day 3)
- [ ] Complete testing
- [ ] Fix any issues
- [ ] Documentation
- [ ] Deploy to staging

### Phase 4: Production Release (Day 4)
- [ ] Final review
- [ ] Production deployment
- [ ] Monitor for issues
- [ ] User training if needed

## Alternative Approaches Considered

1. **MCP Tools Integration**: Not viable as MCP tools are for Claude agents, not Express apps
2. **Direct SQL Queries**: Risky without proper abstraction
3. **Manual Process**: Too error-prone and time-consuming
4. **Single Database**: Would require significant data migration

## Conclusion

The recommended approach provides a balance of security, maintainability, and functionality. By using dual database connections within our Express backend, we can:
- Leverage existing database functions
- Maintain security through server-side execution
- Provide a seamless user experience
- Keep the implementation relatively simple

This solution allows us to integrate the onboarding workflow while maintaining separation between the two systems, which may be important for compliance or organizational reasons.