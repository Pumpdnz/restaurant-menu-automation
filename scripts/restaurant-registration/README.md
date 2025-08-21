# Restaurant Registration Automation

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Run Registration
```bash
# Run with debug mode (recommended for first run)
npm run register:debug

# Run in production mode
npm run register

# Run without Chrome automation profile (if profile is in use)
node register-restaurant.js --no-profile --debug

# Test individual steps
npm run test:step 1  # Test navigation
npm run test:step 2  # Test form filling
```

## File Structure
```
restaurant-registration/
├── register-restaurant.js      # Main automation script
├── test-registration-steps.js  # Step-by-step testing
├── package.json               # Dependencies
├── .env.example              # Environment variables template
├── screenshots/              # Debug screenshots (created automatically)
└── registration-result.json  # Output file with results
```

## Usage with Agent

This automation is designed to be called by the orchestration agent:

```javascript
await Task({
  subagent_type: "restaurant-registration-browser",
  prompt: `Register restaurant: ${restaurantName}`,
  data: registrationData
});
```

## Debugging

### Enable Debug Mode
- Keeps browser open after execution
- Takes screenshots at each step
- Provides detailed console logging

### Common Issues
1. **Selector not found**: Update selectors in registration-selectors.md
2. **Timeout errors**: Increase wait times in script
3. **Authentication issues**: Check Chrome profile is loaded correctly

## Data Format

### Input
```javascript
{
  user: {
    name: "Contact Name",
    email: "email@example.com",
    phone: "+64xxxxxxxxx",
    password: "SecurePassword123!",
    adminPassword: "AdminCode"
  },
  restaurant: {
    name: "Restaurant Name",
    city: "City",
    address: "Full Address",
    phone: "+64xxxxxxxxx",
    openingHours: [...]
  }
}
```

### Output
```javascript
{
  success: true,
  restaurantId: "generated-id",
  dashboardUrl: "https://admin.pumpd.co.nz/restaurant/[id]",
  subdomain: "restaurantname"
}
```