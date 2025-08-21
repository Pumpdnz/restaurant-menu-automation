# Pumpd Registration UI Selectors Reference

## Registration Form (Step 1-2)
```javascript
// Email field
'input[type="email"]'
'input[placeholder*="E-Mail"]'

// Password fields
'input[type="password"]:first-of-type'  // Password
'input[type="password"]:last-of-type'   // Confirm Password

// Continue button
'button:has-text("Continue")'
'button.primary[type="submit"]'
```

## Email Confirmation (Step 3)
```javascript
// Confirmation code input
'input[placeholder*="Confirmation Code"]'
'input[placeholder*="E-Mail Confirmation Code"]'

// Complete registration button
'button:has-text("Complete Registration")'

// Resend code link
'a:has-text("Resend e-mail confirmation code")'
```

## Dashboard (Step 4)
```javascript
// Create restaurant button
'button:has-text("Create New Restaurant")'
'.create-restaurant-btn'
```

## Restaurant Setup Form (Step 5-15)
```javascript
// Basic Information
'input[name="name"]'              // Restaurant name
'input[name="subdomain"]'         // Subdomain

// Map Data Source
'label:has-text("Google Maps")'   // Google Maps option
'label:has-text("Open Street Maps")' // Alternative option

// Address Configuration
'input[placeholder*="Start typing"]'  // Address search
'.pac-container .pac-item'            // Google autocomplete items
'.autocomplete-dropdown-container'    // Alternative selector

// Phone Number
'input[placeholder*="contact number"]'
'input[type="tel"]'

// Operating Hours
'button:has-text("Add Time Slot")'    // Add time slot button
'select[name*="day"]'                 // Day selector
'input[type="time"]'                  // Time inputs
'input[type="checkbox"][name*="24"]' // 24 hour toggle

// Regional Settings
'div[class*="locale"] input'         // Locale selector
'select[name="locale"]'              // Alternative
'div[class*="timezone"] input'       // Timezone selector
'select[name="timezone"]'            // Alternative
'div[class*="currency"] input'       // Currency selector
'select[name="currency"]'            // Alternative

// Tax Settings
'label:has-text("Tax In Prices")'   // Tax toggle label
'input[type="checkbox"][name*="tax"]' // Tax checkbox

// Submit Button
'button:has-text("Create Restaurant")'
'button.primary[type="submit"]'
```

## Dynamic Elements Handling

### Dropdowns with Search
```javascript
// Generic pattern for searchable dropdowns
async function selectFromSearchableDropdown(page, containerSelector, searchText, optionText) {
  // Click to open dropdown
  await page.click(containerSelector);
  
  // Type to search
  await page.keyboard.type(searchText);
  
  // Wait for filtered results
  await page.waitForTimeout(1000);
  
  // Select option
  await page.click(`div:has-text("${optionText}")`);
}
```

### Google Maps Autocomplete
```javascript
// Wait for and handle autocomplete
await page.waitForSelector('.pac-container', { visible: true });
await page.evaluate(() => {
  // Select first autocomplete result
  document.querySelector('.pac-item:first-child').click();
});
```

### Time Input Fields
```javascript
// Clear and set time
async function setTimeInput(input, time) {
  await input.click({ clickCount: 3 }); // Select all
  await input.type(time);
}
```

## Validation Selectors
```javascript
// Error messages
'.error-message'
'.field-error'
'span.text-red-500'

// Success messages
'.success-message'
'.toast-success'

// Loading indicators
'.spinner'
'.loading'
'[aria-busy="true"]'
```

## Navigation & State
```javascript
// Check current page
const isOnRegistration = await page.$('h1:has-text("Register")') !== null;
const isOnDashboard = await page.$('nav.dashboard-nav') !== null;

// Wait for navigation
await page.waitForNavigation({ waitUntil: 'networkidle2' });

// Wait for specific elements
await page.waitForSelector('selector', { 
  visible: true,
  timeout: 30000 
});
```

## Best Practices
1. Always use `waitForSelector` before interacting with elements
2. Use text-based selectors as fallbacks when IDs/classes change
3. Add explicit waits after actions that trigger dynamic updates
4. Take screenshots before and after critical steps
5. Use `page.evaluate` for complex DOM interactions
6. Handle both old and new UI versions with alternative selectors