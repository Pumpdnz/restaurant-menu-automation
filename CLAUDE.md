# Pumpd Restaurant Automation System

This repository contains the automation tools for onboarding restaurants to the Pumpd platform.

## Port Configuration
- UberEats Image Extractor API: Port 3007
- UberEats Image Extractor WebSocket: Port 5007

## Project Structure

### /UberEats-Image-Extractor
Menu extraction system for UberEats and DoorDash platforms
- Batch extraction method for large menus
- Image downloading and mapping
- CSV generation for menu import

### /scripts
Various automation scripts:
- `restaurant-registration/`: Playwright scripts for automated restaurant registration
- `menu-import/`: Scripts for importing CSV menus to Pumpd dashboard
- `image-upload/`: Scripts for uploading menu item images
- `instagram-image-extractor.js`: Extract logo and brand colors from Instagram
- `website-logo-extractor.js`: Extract logo and brand colors from websites

### /extracted-menus
Storage for extracted menu CSV files

### /planning
Planning documents and downloaded images for restaurants

### /.claude/agents
Specialized agent configurations for various automation tasks:
- `menu-extractor-batch`: Extract menus from delivery platforms
- `restaurant-registration-browser`: Automate restaurant registration
- `menu-import-uploader`: Import menus and upload images
- `restaurant-logo-search`: Find restaurant logos
- `restaurant-logo-instagram`: Extract logos from Instagram
- `restaurant-logo-website`: Extract logos from websites
- `google-business-extractor`: Extract business information
- `delivery-url-finder`: Find delivery platform URLs

## Environment Variables

### /UberEats-Image-Extractor/.env
```
FIRECRAWL_API_KEY=your_key_here
FIRECRAWL_API_URL=https://api.firecrawl.dev
```

### /scripts/.env
```
REMOVE_BG_API_KEY=your_key_here
REMOVE_BG_SIZE=auto
SHARP_QUALITY=90
DEBUG_MODE=false
```

### /scripts/restaurant-registration/.env
```
ADMIN_PASSWORD=admin-password-here
DEBUG_MODE=false
REGISTRATION_URL=https://admin.pumpd.co.nz/register
SCREENSHOT_DIR=./screenshots
HEADLESS=false
```

## Common Tasks

### Extract Menu from UberEats/DoorDash
Use the `menu-extractor-batch` agent with the restaurant's delivery URL

### Register a New Restaurant
Use the `restaurant-registration-browser` agent with restaurant details

### Import Menu and Upload Images
Use the `menu-import-uploader` agent with:
- CSV file path (use _no_images.csv version)
- Image mapping JSON
- Restaurant email

### Find Restaurant Information
Use the `google-business-extractor` agent to find hours, address, and social links

## Testing
Always test scripts in the new location before running in production:
```bash
cd UberEats-Image-Extractor
npm start
# Server should start on port 3007
```

## Notes
- All paths have been updated from `cursor-projects/pumpd-webhook/automation` to `cursor-projects/automation`
- Ports changed from 3006/5006 to 3007/5007 to avoid conflicts

# IMPORTANT NOTES
- Agent workflow has been make obsolete by MAJOR changes to application
- Agent instructions are now INCORRECT due to API changes and have yet to be updated to interact with the application in it's current state