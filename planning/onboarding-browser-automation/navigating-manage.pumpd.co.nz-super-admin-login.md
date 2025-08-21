# Navigating to manage.pumpd.co.nz - Super Admin Login

## Overview
This guide explains how to login to the Pump'd Marketing Hub dashboard using Google Sign-In with saved credentials.

## Initial Navigation

### Step 1: Navigate to the Login Page
```javascript
await puppeteer_navigate(
  "https://manage.pumpd.co.nz",
  true,
  {
    headless: false,
    userDataDir: "/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile"
  }
);
```

### Step 2: Check Login State
**Important**: The browser may automatically log you in if a session is already active.

```javascript
// Take a screenshot to verify current state
await puppeteer_screenshot("login_check", 1080, 800);
```

If you see the dashboard immediately, you're already logged in. To verify which account you are logged in with, take a screenshot and check the account information in the bottom left of the screen. A name, email and role badge will be present. If the user has instructed you to be logged in with a different account than is displayed, you may need to logout first.

## Login Flow (When Not Already Logged In)

### Step 1: Click "Sign in with Google"
The login page has a "Sign in with Google" button. Due to selector limitations, use JavaScript evaluation:

```javascript
await puppeteer_evaluate(`
  const buttons = Array.from(document.querySelectorAll('button'));
  const googleButton = buttons.find(button => button.textContent.includes('Sign in with Google'));
  if (googleButton) {
    googleButton.click();
  }
`);
```
IMPORTANT: If you get an error message on the tool call such as "Script execution failed: Execution context was destroyed, most likely because of a navigation.", this usually means that the click worked (context was destroyed means navigation happened)

### Step 2: Handle Google Account Selection
After clicking, you'll be redirected to Google's account selection page. Take a screenshot to verify the current page, then click the Super Admin account to log in: 

```javascript
// Click on the gianni@pumpd.co.nz account
await puppeteer_click('div[data-identifier="gianni@pumpd.co.nz"]');
```

### Step 3: Developer Info Popup (Conditional)
**Note**: A "Developer info" popup may appear, but not always. It typically shows:
- Email: gianni@pumpd.co.nz
- Redirect info: https://lqcgatpunhuiwcyqesap.supabase.co
- A "Got it" button

If the popup appears, you can handle it by:

**Option 1: Click the account element behind the popup**
```javascript
// This often works by clicking the account selection behind the popup
await puppeteer_evaluate(`
  const accountElements = Array.from(document.querySelectorAll('[data-identifier], [aria-label*="gianni@pumpd.co.nz"]'));
  if (accountElements.length > 0) {
    accountElements[0].click();
  }
`);
```

**Option 2: Click the "Got it" button directly**
```javascript
// If you need to specifically click "Got it"
await puppeteer_click('button.VfPpkd-LgbsSe');
```

**Note**: In practice, clicking the account element behind the popup often bypasses the need to interact with the popup itself, allowing the authentication to proceed directly.

### Step 4: Verify Successful Login
After authentication, you should see the Pump'd Marketing Hub dashboard:

```javascript
// Take screenshot to confirm dashboard access
await puppeteer_screenshot("dashboard_logged_in", 1080, 800);
```

## Expected Dashboard Elements
- Restaurant name (e.g., "Base Pizza Riverside")
- Metrics: Total Orders, Average Order Value, Total Revenue, New Customers
- User info showing "Gianni Munro" with "Super Admin" role
- Navigation menu with Dashboard, SMS Campaigns, Restaurants, etc.

## Troubleshooting

### Selector Issues
Puppeteer doesn't support pseudo-selectors like `:has-text()`. Use JavaScript evaluation to find elements by text content.

### Navigation Timing
Allow 2-3 seconds after clicks for page transitions:
```javascript
await new Promise(resolve => setTimeout(resolve, 3000));
```

### Session Persistence
- If consistently auto-logged in, use the Logout button to practice the full flow
- Sessions persist across browser restarts with the automation profile

## Complete Example
```javascript
// 1. Navigate to site
await puppeteer_navigate("https://manage.pumpd.co.nz", true, {
  headless: false,
  userDataDir: "/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile"
});

// 2. Check if already logged in
await puppeteer_screenshot("initial_state", 1080, 800);

// 3. If on login page, click Sign in with Google
await puppeteer_evaluate(`
  const buttons = Array.from(document.querySelectorAll('button'));
  const googleButton = buttons.find(button => button.textContent.includes('Sign in with Google'));
  if (googleButton) googleButton.click();
`);

// 4. Wait for navigation
await new Promise(resolve => setTimeout(resolve, 3000));

// 5. Select account
await puppeteer_click('div[data-identifier="gianni@pumpd.co.nz"]');

// 6. Wait and handle potential popup
await new Promise(resolve => setTimeout(resolve, 3000));
await puppeteer_click('button.VfPpkd-LgbsSe'); // If "Got it" appears

// 7. Verify dashboard access
await puppeteer_screenshot("final_dashboard", 1080, 800);
```