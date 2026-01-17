# Fix: Closed Days in Restaurant Registration Opening Hours

## Issue
When the `--dayHours` argument contained days marked as closed (e.g., `"open": "Closed", "close": "Closed"`), the `login-and-register-restaurant.js` script would:
1. Create a time slot for the closed day
2. Attempt to type "Closed" into time input fields
3. Result in "00:00" or invalid values being entered
4. Cause form validation to reject submission

## Example Problem Data
```json
[
  {"day": "Monday", "hours": {"open": "Closed", "close": "Closed"}},
  {"day": "Tuesday", "hours": {"open": "16:30", "close": "21:00"}},
  ...
]
```

## Root Cause
The script processed all days in `dayEntries` without checking if a day was marked as closed. When "Closed" was typed into a time input field, the form couldn't parse it as a valid time.

## Solution
Added filtering logic after `dayEntries` is assigned (lines 438-456 in `login-and-register-restaurant.js`):

```javascript
// Filter out closed days (where both open and close are "Closed")
const originalCount = dayEntries.length;
dayEntries = dayEntries.filter(entry => {
  const openValue = entry.hours?.open?.toLowerCase() || '';
  const closeValue = entry.hours?.close?.toLowerCase() || '';
  const isClosedDay = openValue === 'closed' && closeValue === 'closed';
  return !isClosedDay;
});

if (dayEntries.length < originalCount) {
  const closedCount = originalCount - dayEntries.length;
  console.log(`  ℹ️ Skipping ${closedCount} closed day(s)`);
}

// Handle edge case where all days are closed
if (dayEntries.length === 0) {
  console.log('  ⚠️ All days are marked as closed - skipping opening hours configuration');
  await takeScreenshot(page, '10-no-open-days');
} else {
  // ... existing time slot configuration code ...
}
```

## File Modified
- `scripts/restaurant-registration/login-and-register-restaurant.js` (lines 438-540)

## Behavior After Fix
- Days with `"open": "Closed", "close": "Closed"` are excluded from processing
- Only operational days get time slots created
- Console logs indicate which days were skipped
- Form validation passes successfully
- Edge case handled: if all days are closed, skips opening hours configuration entirely

## Testing
Run with closed day data:
```bash
node login-and-register-restaurant.js \
  --email="test@example.com" \
  --password="Test123!" \
  --name="Test Restaurant" \
  --address="Wellington, New Zealand" \
  --phone="+6441234567" \
  --dayHours='[{"day":"Monday","hours":{"open":"Closed","close":"Closed"}},{"day":"Tuesday","hours":{"open":"16:30","close":"21:00"}}]'
```

Expected output:
```
🕐 STEP 11: Set opening hours
  ℹ️ Skipping 1 closed day(s)
  🔘 Adding 0 time slots...
  📅 Configuring days and times...
    ✓ Set row 1 to Tuesday
    ✓ Set Tuesday: 16:30 - 21:00
```

## Date Fixed
2025-01-04
