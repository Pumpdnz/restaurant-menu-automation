# Opening Puppeteer Browser with Chrome Automation Profile

## Overview
This guide explains how to launch Puppeteer with a pre-configured Chrome profile that contains saved passwords and authenticated sessions.

## Chrome Profile Configuration

### Profile Location
- **Path**: `/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile`
- **Purpose**: Dedicated automation profile with saved credentials, isolated from personal browsing

### Saved Credentials
- **Google Account**: gianni@pumpd.co.nz (authenticated)
- **Password Manager**: Chrome's built-in password manager with imported credentials

## Launching Browser with Puppeteer

### Required Parameters
```javascript
const launchOptions = {
  headless: false,              // Set to true for background automation
  userDataDir: "/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile",
  allowDangerous: true          // Required for certain Chrome flags
};
```

### Implementation
```javascript
// Navigate to a URL with the automation profile
await puppeteer_navigate(url, allowDangerous, launchOptions);
```

### Example Usage
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

## Important Notes

1. **Session Persistence**: The profile maintains login states between automation runs
2. **Chrome Conflicts**: Ensure Chrome is not already running with the same profile
3. **Security**: The profile contains sensitive credentials - ensure proper access controls
4. **First Navigation**: Always include launchOptions on the first navigation to ensure the profile loads

## Benefits

- No need to re-authenticate for each automation run
- Access to saved passwords for form filling
- Consistent browser environment across sessions
- Faster automation execution without login delays