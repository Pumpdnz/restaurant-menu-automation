# Steps for Registration Yolo Mode

## Step 1: Confirmation Dialog
Display all Current data to be used for full setup in a dialog for the user to be able to see that all data is accurate and configured as desired
- Make fields editable in the form before user confirms running the yolo mode
- All database based fields should be easily editable and there should be a save button which actually updates them
- There should be a seperate confirm button which executes the yolo mode 

**Account Details:**
- Register New User Checkbox (If disabled, skip user registration step) 
- Email
- Phone
- Password

**Restaurant Registration Details:**
- Registration Mode 
    - Register New Account - First Restaurant 
    - Existing Account - Register First Restaurant
    - Existing Account - Register New Restaurant
- Restaurant Name
- Opening Hours
- Restaurant Phone
- Restaurant Address
- Subdomain

**Menu to Upload:**
- Menu selection from available options for the restaurant
- Checkbox for whether to upload images
    - If Yes, upload images to cdn before executing the download csv with images
    - If No, download csv without images
- Checkbox for whether to upload option sets
- Checkbox for whether to add item tags

**Website configuration:**
- Theme
- Cuisine
- Primary Color
- Secondary Color
- Disable Gradients Checkbox
- Configure Header checkbox
    - Image to use for Header
    - Logo to use for Header Logo
        - Header logo tint options for dark and light (default to original with no changes)
- Logo to use for Nav Bar Selection
    - Nav logo tint options for dark and light pixels (default to original logo with no changes)
    - Nav text color (default to secondary for light theme or white for dark theme)
- Display Logo to use for favicon
- Item Layout Style (card or list)

**Setup payments and services configuration:**
- Checkbox for whether to include stripe link (default to disabled)

**Pump'd Onboarding:**
This should only display if the Onboarding User Management feature flags are enabled for the user's organisation. When feature flags not active the yolo mode should always execute without these steps. When enabled, they should only execute if the user has them enabled (default to enabled)
Checkboxes for feature flagged onboarding steps:
- Register New Onboarding User
    - Feature flag: onboardingUserManagement: 'Onboarding User Management',
- Update onboarding record
    - Feature flag: onboardingSync: 'Onboarding Sync',

## Step 2: Execute Yolo Mode in appropriate order
Execute the scripts with the user configured settings in an order that respects the logical dependencies while maximising efficiency with parallel execution of non-dependent scripts

### Order of Script Execution
**Phase 1:**
- Account Registration
    - Restaurant Registration (can be executed as soon as Account Registration is completed)
- Image Uploading
    - CSV downloading from menu data (can be executed as soon as Image Uploading is completed)
- Code Injection Generation
- Onboarding User Creation

**Phase 2:**
- Website Settings Configuration (Dependent on Restaurant Registration and Code Injection Generation)
- Menu Importing (Dependent on Restaurant Registration)
- Payment Settings Configuration (Dependent on Restaurant Registration)
- Services Settings Configuration (Dependent on Restaurant Registration)
- Updating Onboarding Record (Dependent on Onboarding User Creation)

**Phase 3:**
- Option Sets Configuration (Dependent on Menu Importing)

**Phase 4:**
- Item Tags Configuration (Dependent on Menu Importing and cannot be executed at the same time as Option sets configuration)