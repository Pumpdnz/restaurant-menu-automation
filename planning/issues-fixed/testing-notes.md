# Restaurant Registration Script - Testing Notes

## Setup Completed
✅ Updated dependencies to latest stable versions
✅ Fixed deprecation warnings (removed eslint from dependencies)
✅ Created .env file with configuration
✅ Updated selectors to be compatible with Puppeteer v23

## Key Changes Made

### 1. Puppeteer API Updates
- Replaced deprecated `waitForXPath` with custom helper functions
- Created `clickButtonByText()` and `clickLabelByText()` helpers
- Updated all text-based selectors to use `page.evaluate()` approach

### 2. Chrome Profile Handling
- Added `--no-profile` flag option for testing without automation profile
- Improved error messages when Chrome profile is already in use
- Added fallback launch options

### 3. Improved Selector Robustness
- Added multiple selector fallbacks for form fields
- Better error handling with detailed screenshots
- More flexible input field detection

## Current Status

### Working Steps
1. ✅ Navigation to registration page
2. ✅ Filling registration form (email, password)
3. ✅ Clicking Continue button
4. ✅ Email confirmation step
5. ✅ Reaching dashboard after registration

### Issues Found
1. **Chrome Profile Conflict**: When Chrome is already running with the automation profile, script fails to launch
   - **Solution**: Use `--no-profile` flag for testing
   
2. **Restaurant Form Not Loading**: After clicking "Create New Restaurant", the form doesn't appear or takes too long
   - **Possible Causes**: 
     - Navigation/redirect not being handled
     - Form loaded in modal/iframe
     - Different UI for new vs existing accounts
   
3. **Selector Changes**: Some selectors like `:has-text()` are not standard CSS
   - **Solution**: Created helper functions for text-based selection

## Usage Commands

```bash
# Test without Chrome profile (recommended for development)
node register-restaurant.js --no-profile --debug

# Test with Chrome profile (for production-like testing)
node register-restaurant.js --debug

# Run simple selector test
node test-simple.js

# Test specific steps
node test-registration-steps.js 1
```

## Next Steps for Debugging

1. **Investigate Restaurant Form Loading**
   - Check if form opens in a modal or new page
   - Look for iframe elements
   - Check for JavaScript errors in console

2. **Map Actual UI Elements**
   - Run `test-simple.js` at each step to map actual selectors
   - Document exact element structures
   - Update selectors based on findings

3. **Handle Dynamic Content**
   - Add proper wait conditions for AJAX/dynamic content
   - Implement retry logic for flaky operations
   - Add network idle waits where needed

## Environment Variables
```
ADMIN_PASSWORD=7uo@%K2^Hz%yiXDeP39Ckp6BvF!2
CHROME_PROFILE_PATH=/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile
DEBUG_MODE=false
REGISTRATION_URL=https://admin.pumpd.co.nz/register
```

## Recommendations

1. **For Agent Implementation**:
   - Use `--no-profile` flag initially to avoid conflicts
   - Implement proper retry logic
   - Add detailed logging for each step
   - Consider breaking into smaller, more focused scripts

2. **For Production**:
   - Set up dedicated Chrome profile that's not used elsewhere
   - Add health checks before starting
   - Implement proper error recovery
   - Add monitoring and alerting

3. **For Testing**:
   - Create test accounts to avoid conflicts
   - Use staging environment if available
   - Document all UI changes found
   - Keep screenshot archive for debugging