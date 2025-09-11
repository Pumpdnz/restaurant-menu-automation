# Pumpd Registration Implementation Plan

## Overview
This document outlines the implementation of the Pumpd platform registration workflow, transitioning from a fully agentic approach to a human-in-the-loop application with upcoming API integration for user registration.

## Current Status

### ✅ Completed Work

#### 1. Database Infrastructure
**Tables Created:**
- `pumpd_accounts` - Tracks user accounts on Pumpd platform
  - Fields: organisation_id, restaurant_id, email, user_password_hint, registration_status, registration_date, registration_method, restaurant_count, is_primary_account, pumpd_user_id, pumpd_dashboard_url, last_error, retry_count
  - Indexes on: organisation_id, restaurant_id, email, registration_status
  - Unique constraints on (organisation_id, email) and (organisation_id, restaurant_id, email)

- `pumpd_restaurants` - Tracks restaurant registrations on Pumpd
  - Fields: organisation_id, restaurant_id, pumpd_account_id, pumpd_restaurant_id, pumpd_subdomain, pumpd_full_url, registration_status, registration_date, registration_type, configured_name/address/phone/hours, dashboard_url, settings_url, menu_url, is_active, last_sync_date, sync_status, last_error, error_count
  - Indexes on: organisation_id, restaurant_id, pumpd_account_id, registration_status, pumpd_subdomain
  - Unique constraints on (organisation_id, restaurant_id) and (pumpd_subdomain)

- `registration_logs` - Audit trail for all registration attempts
  - Fields: organisation_id, restaurant_id, pumpd_account_id, pumpd_restaurant_id, action, status, request_data, response_data, error_message, script_name, execution_time_ms, screenshot_paths, initiated_by
  - Indexes on: organisation_id, restaurant_id, action, status, created_at

**Row Level Security (RLS):**
- All tables have RLS enabled with policies scoped to organisation_id
- Users can only see/modify data within their organisation

#### 2. API Endpoints Created
Location: `/src/routes/registration-routes.js`

**Endpoints:**
- `GET /api/registration/status/:restaurantId` - Check registration status for a restaurant
- `POST /api/registration/register-account` - Register new account only
- `POST /api/registration/register-restaurant` - Register restaurant with three options
- `GET /api/registration/logs/:restaurantId` - Get registration logs

**Registration Types Supported:**
1. `new_account_with_restaurant` - Full registration from scratch
2. `existing_account_first_restaurant` - Login to existing account and add first restaurant
3. `existing_account_additional_restaurant` - Add another restaurant to existing account

#### 3. Features Implemented
- Automatic midnight-crossing hours handling (splits into two day entries)
- Password convention enforcement: "Restaurantname789!"
- Comprehensive error tracking and retry logic
- Registration status tracking with detailed logging
- Organisation-scoped data isolation
- Integration with existing restaurant data model

## ✅ Completed API Integration Preparation

### Phase 1: User Registration API Integration (Ready to Implement)
**Status:** CloudWaitress API documentation received January 9, 2025

#### CloudWaitress API Details:
**Base URL:** `https://api.cloudwaitress.com`

**Credentials:**
- `integrator_id`: "CWI_e2dae966-8523-4fd6-a853-58586a296bff"
- `secret`: "CWS_09908059-7b25-492f-86c9-34c672d689a4"

**Two-Step Registration Process (Fully Automated):**
1. **Start Registration** - `POST /users/register/start`
   ```javascript
   {
     integrator_id: "CWI_e2dae966-8523-4fd6-a853-58586a296bff",
     email: "user@email.com",
     phone: "+64123456789",
     password: "Password123!",
     signature: "hmac_sha256_signature"
   }
   // Returns: { token: "..." }
   ```

2. **Auto-Verify** - `POST /users/register/verify`
   ```javascript
   {
     token: "token_from_start",
     email_confirmation_code: "signature" // Use signature to bypass email verification
   }
   ```

**Key Implementation Notes:**
- ✅ **Fully automated** - Signature bypasses email verification
- ✅ **HMAC-SHA256 signature** - Generate using secret + email + phone + password
- ✅ **Phone number** - Will use phone from restaurants table (already collected)
- ✅ **Two-step process** - But can be executed sequentially without user interaction

2. **`POST /api/registration/register-restaurant`** ✅
   - For `new_account_with_restaurant` type:
     - Split into two phases: API user registration + Playwright restaurant registration
     - Added TODO for user registration API
     - Kept Playwright for restaurant registration only
   - For existing account types:
     - Kept Playwright automation as-is (login + restaurant registration)

#### Scripts Created/Modified: ✅
1. **Removed:** ✅ `register-account-only.js` (no longer needed with API)
2. **Modified:** ✅ `register-restaurant-production.js`
   - Removed all account creation logic
   - Now starts from login page instead of registration page
   - Assumes account already exists (created via API)
   - Made email, password, and name required parameters
   - Returns subdomain for API parsing
3. **Created:** ✅ `login-and-register-restaurant.js`
   - Handles login with existing credentials
   - Navigates to restaurant registration
   - Handles both first restaurant and additional restaurant scenarios

### Phase 2: Restaurant Registration (Keep Playwright)
Restaurant registration will continue using Playwright automation until API is available.

**Required Scripts:**
1. `login-and-register-restaurant.js` - Main restaurant registration script
   - Parameters: email, password, restaurant details, hasExistingRestaurants flag
   - Flow: Login → Navigate to restaurants → Create new restaurant → Fill form → Submit

2. `register-restaurant-production.js` - Keep for reference/fallback
   - Modify to remove account creation portion
   - Update to assume account exists

## 📋 Remaining Work

### 1. ✅ Frontend Implementation (COMPLETED)
**Location:** `/src/pages/RestaurantDetail.jsx`

**UI Elements Added:**
1. **Registration Status Card** ✅
   - Displays current registration status (account/restaurant)
   - Shows registration dates and URLs
   - Displays any error messages

2. **Action Buttons:** ✅
   - "Register Account" - Currently disabled (needs API integration)
   - "Register Restaurant" - Shows modal with registration type options
   - "View Registration Logs" - Shows history of registration attempts

3. **Registration Type Modal:**
   ```
   Select Registration Type:
   [ ] New Account with Restaurant (Coming Soon - API Required)
   [x] Login to Existing Account - First Restaurant
   [x] Login to Existing Account - Additional Restaurant
   ```

4. **Progress Indicators:**
   - Show registration in progress
   - WebSocket updates for real-time status
   - Success/failure notifications

### 2. ✅ Playwright Scripts Updates (COMPLETED)

#### Created: `/scripts/restaurant-registration/login-and-register-restaurant.js` ✅
```javascript
// Implemented functionality:
// 1. Login to existing account
// 2. Navigate to restaurant section
// 3. Click "Create Restaurant" or "Add Restaurant"
// 4. Fill restaurant details form
// 5. Handle operating hours (with midnight crossing)
// 6. Submit and capture result
```

#### Modified: `/scripts/restaurant-registration/register-restaurant-production.js` ✅
- Removed account creation section
- Updated to start from login page
- Kept restaurant registration logic intact
- Made email, password, and name required parameters
- Returns subdomain data for API parsing

### 3. API Integration Implementation (NEXT STEP)

#### Environment Variables to Add:
```env
# CloudWaitress API Configuration
CLOUDWAITRESS_API_URL=https://api.cloudwaitress.com
CLOUDWAITRESS_INTEGRATOR_ID=CWI_e2dae966-8523-4fd6-a853-58586a296bff
CLOUDWAITRESS_SECRET=CWS_09908059-7b25-492f-86c9-34c672d689a4
PUMPD_ADMIN_PASSWORD=<current-admin-password>
```

#### API Service to Create:
Location: `/src/services/cloudwaitress-api-service.js`
```javascript
const crypto = require('crypto');

class CloudWaitressAPIService {
  constructor() {
    this.baseUrl = process.env.CLOUDWAITRESS_API_URL;
    this.integratorId = process.env.CLOUDWAITRESS_INTEGRATOR_ID;
    this.secret = process.env.CLOUDWAITRESS_SECRET;
  }

  generateSignature(email, phone, password) {
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(email).update(phone).update(password);
    return hmac.digest('hex');
  }

  async registerUser(email, phone, password) {
    // Phone will come from restaurant.phone
    // Format phone number for NZ if needed (+64...)
    const signature = this.generateSignature(email, phone, password);
    
    // Step 1: Start registration
    const startResponse = await fetch(`${this.baseUrl}/users/register/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrator_id: this.integratorId,
        email,
        phone,
        password,
        signature
      })
    });
    
    const { token } = await startResponse.json();
    
    // Step 2: Auto-verify using signature
    const verifyResponse = await fetch(`${this.baseUrl}/users/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        email_confirmation_code: signature // Bypass email verification
      })
    });
    
    return verifyResponse.json();
  }
}
```

### 4. Testing Requirements

#### Manual Testing Checklist:
- [ ] Test account registration via API (when available)
- [ ] Test restaurant registration via Playwright
- [ ] Test registration status checking
- [ ] Test registration logs retrieval
- [ ] Test error handling and retry logic
- [ ] Test midnight-crossing hours handling
- [ ] Test multi-organisation data isolation

#### Automated Testing:
- Unit tests for hours formatting/midnight crossing
- Integration tests for database operations
- E2E tests for complete registration flow (once API available)

## Timeline

### Immediate (Today):
1. ✅ Database tables created
2. ✅ Basic API endpoints created
3. ✅ Modified endpoints to prepare for API integration
4. ✅ Added TODO placeholders for API calls
5. ✅ Created/modified Playwright scripts for restaurant-only registration

### Short Term (This Week):
1. ⏳ Integrate user registration API once available (waiting for API documentation)
2. 📝 Add frontend UI components in RestaurantDetail
3. 📝 Test complete workflow
4. 📝 Create pumpd-api-service.js when API docs available

### Future (API Availability):
1. 🔮 Replace restaurant Playwright automation with API
2. 🔮 Remove all Playwright dependencies
3. 🔮 Deploy to cloud environment

## Migration Path

### From Current State to API Integration:
1. **Stage 1:** Current Playwright-based approach (fully automated)
2. **Stage 2:** Hybrid approach (API for users, Playwright for restaurants)
3. **Stage 3:** Full API integration (remove Playwright completely)

### Data Migration:
- Existing `pumpd_accounts` records will need `pumpd_user_id` updated from API
- Registration method field will help identify migration status
- Logs table preserves full history through transition

## Risk Mitigation

### Potential Issues:
1. **API Delays:** Keep Playwright fallback operational
2. **API Changes:** Abstract API calls in service layer
3. **Data Inconsistency:** Use transaction-based updates
4. **Rate Limiting:** Implement queue system for bulk registrations

### Rollback Strategy:
- Database migrations are reversible
- Keep original Playwright scripts as backup
- Maintain detailed logs for debugging

## Success Metrics

### Key Performance Indicators:
- Registration success rate > 95%
- Average registration time < 2 minutes
- Error recovery rate > 80%
- Zero data loss during migration

### Monitoring:
- Registration status dashboard
- Error rate alerts
- Performance metrics tracking
- User feedback collection

## Notes

### Password Convention:
- Format: "Restaurantname789!"
- Remove spaces and special characters from restaurant name
- Capitalize first letter
- Add standard suffix "789!"

### Hours Processing:
- Detect midnight crossing (close time < open time)
- Split into two entries for consecutive days
- Handle "Every day" expansion to all 7 days
- Support both object and array formats

### Organisation Context:
- All operations scoped to organisation_id
- Multi-tenant architecture maintained
- RLS policies enforce data isolation

## Contact & Resources

### Related Documents:
- Original agent: `/.claude/agents/restaurant-registration-browser.md`
- Database migrations: `/migrations/create_pumpd_accounts_and_restaurants_tables.sql`
- API routes: `/src/routes/registration-routes.js`

### Dependencies:
- Playwright for browser automation (temporary)
- Supabase for database operations
- Express.js for API endpoints
- React for frontend components

---

*Last Updated: January 9, 2025 (Evening)*
*Status: CloudWaitress API Documentation Received - Ready for Implementation*

## Summary of Progress (January 9, 2025)

### ✅ Morning Completed Work:
1. **Database Infrastructure** - All tables created with RLS policies
2. **API Endpoints** - All registration endpoints created with auth middleware
3. **Playwright Scripts** - Both scripts created/modified and tested:
   - `login-and-register-restaurant.js` - Working with restaurant name selector
   - `register-restaurant-production.js` - Modified to remove account creation
4. **Frontend UI Components** - Complete registration UI with password visibility

### ✅ Afternoon Updates:
1. **CloudWaitress API Documentation Received** - Not Pumpd API as expected
2. **API Strategy Clarified** - Signature bypasses email verification 
3. **Planning Updated** - Adjusted for two-step registration process

### 🚀 Next Immediate Steps:
1. **Create CloudWaitress API Service** - Implement HMAC signature and two-step registration
2. **Update Registration Routes** - Replace TODO with actual CloudWaitress API calls
3. **Enable "Register Account" Button** - Now that API is available
4. **Test Complete Flow** - Account creation → Restaurant registration

### 📌 Implementation Decisions:
- **Phone Number Source:** Use `restaurant.phone` from restaurants table (no additional field needed)
- **Password Convention:** Continue using "Restaurantname789!" format
- **Email Source:** Use `restaurant.email` or allow user override in modal