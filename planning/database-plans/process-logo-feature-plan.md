# Process Logo Feature Implementation Plan

## Current Status
**Last Updated**: August 27, 2025

### ✅ Completed
- All critical bug fixes (toast, thermal dimensions, favicon display)
- Multiple thermal logo versions (4 algorithms)
- Database schema updates for thermal versions
- Payload optimization (only send changed fields)

### 🚧 To Implement
- Process Logo button and dialog UI
- Manual logo URL processing without Firecrawl
- Selective version regeneration
- Existing logo reprocessing

## Overview
This document outlines the implementation plan for adding a new "Process Logo" feature that provides more flexibility for logo management without consuming unnecessary API credits.

## ✅ Completed Critical Fixes

### 1. Toast Import Error - COMPLETED
**Fixed**: Added `import { toast } from '../hooks/use-toast';` to RestaurantDetail.jsx

### 2. Thermal Logo Dimensions - COMPLETED
**Fixed**: Thermal logos now resize to 265px width with maintained aspect ratio

### 3. Favicon Display - COMPLETED
**Fixed**: Favicon now displays in branding section

### 4. Multiple Thermal Versions - COMPLETED
**Added**: 4 thermal processing algorithms:
- `logo_thermal_url` - Inverted (light backgrounds become black)
- `logo_thermal_alt_url` - Standard (dark stays dark) 
- `logo_thermal_contrast_url` - High contrast binary threshold
- `logo_thermal_adaptive_url` - Adaptive with mid-tone preservation

### 5. Payload Size Issue - COMPLETED
**Fixed**: handleSave now only sends changed fields, preventing base64 payload errors

## New Process Logo Feature

### UI Components

#### 1. Process Logo Button
- **Location**: Below "Extract Logo" button in branding section
- **Label**: "Process Logo"
- **Icon**: Image or Settings icon
- **Behavior**: Opens ProcessLogoDialog

#### 2. ProcessLogoDialog Component
The dialog will have two distinct modes based on whether a logo exists:

##### Mode A: No Existing Logo
**Trigger**: When `restaurant.logo_url` is empty/null

**Dialog Content**:
```
Title: "Process Restaurant Logo"
Description: "Choose how to add and process your restaurant logo"

Options:
○ Extract logo from website
   Automatically find and extract logo from your website
   
○ Enter logo URL manually
   Provide a direct link to your logo image

[Website link section if restaurant.website_url exists]
Visit website to find logo:
🔗 {restaurant.website_url}
Right-click on logo and select "Copy Image Address"

Footer:
[Cancel] [Continue]
```

**Behavior**:
- Extract option → Triggers existing extraction flow
- Manual URL → Shows URL input field
- Processes all 5 logo versions when URL provided

##### Mode B: Existing Logo Present
**Trigger**: When `restaurant.logo_url` has value

**Dialog Content**:
```
Title: "Process Restaurant Logo"
Description: "Update or reprocess your restaurant logo"

Current Logo:
[Preview of current logo_url]

Options:
○ Reprocess existing logo
   Generate updated versions from current logo
   
○ Replace with new logo URL
   Provide a different logo image

[If "Reprocess existing" selected]:
Select versions to regenerate:
□ Logo (No Background) - Remove/update background
□ Logo (Standard) - 500x500 optimized version  
☑ Logo (Thermal - Inverted) - For light background logos
☑ Logo (Thermal - Standard) - For dark background logos
□ Logo (Thermal - High Contrast) - Binary black/white
□ Logo (Thermal - Adaptive) - Preserves mid-tones
☑ Logo (Favicon) - 32x32 browser icon

[If "Replace with new" selected]:
Enter new logo URL: [_______________]

Select which versions to replace:
□ Logo URL (Original)
☑ Logo (No Background)
□ Logo (Standard)
☑ Logo (Thermal - Inverted)
☑ Logo (Thermal - Standard)
□ Logo (Thermal - High Contrast)  
□ Logo (Thermal - Adaptive)
☑ Logo (Favicon)

[Website link section if exists]

Footer:
[Cancel] [Process Logo]
```

### API Endpoints

#### 1. Modify `/api/website-extraction/process-selected-logo`
**Current**: Processes a logo URL and updates all versions
**Changes Needed**:
- Add optional `versionsToUpdate` parameter (array)
- Add optional `sourceVersion` parameter (which existing version to use as source)
- If `versionsToUpdate` provided, only update specified versions
- Default behavior (no params) remains: update all versions

**Request Schema**:
```javascript
{
  restaurantId: string,
  logoUrl: string,           // URL to process
  websiteUrl: string,
  versionsToUpdate?: [       // Optional: specific versions to update
    'logo_url',
    'logo_nobg_url', 
    'logo_standard_url',
    'logo_thermal_url',
    'logo_thermal_alt_url',
    'logo_thermal_contrast_url',
    'logo_thermal_adaptive_url',
    'logo_favicon_url'
  ],
  sourceVersion?: string      // Optional: 'original', 'nobg', 'standard'
}
```

#### 2. New Endpoint: `/api/logo/reprocess`
**Purpose**: Reprocess existing logo to regenerate specific versions
**Method**: POST
**Request**:
```javascript
{
  restaurantId: string,
  sourceField: string,        // Which logo field to use as source
  versionsToUpdate: string[]  // Which versions to regenerate
}
```

### Service Layer Updates

#### logo-extraction-service.js

**New Function**: `reprocessExistingLogo`
```javascript
async function reprocessExistingLogo(sourceUrl, versionsToProcess) {
  // Download source image
  // Process only requested versions
  // Return updated versions
}
```

**Update**: `processLogoVersions` function
- Add parameter for selective version processing
- Add source buffer parameter option
- Ensure thermal uses 265px width

### Database Considerations

Current database schema includes all logo fields:
- `logo_url` - Original/primary logo
- `logo_nobg_url` - No background version
- `logo_standard_url` - 500x500 standard version
- `logo_thermal_url` - Thermal inverted version (265px wide)
- `logo_thermal_alt_url` - Thermal standard version (265px wide)
- `logo_thermal_contrast_url` - Thermal high contrast version (265px wide)
- `logo_thermal_adaptive_url` - Thermal adaptive version (265px wide)
- `logo_favicon_url` - 32x32 favicon

**Note**: All base64 data is stored directly in these columns. Future optimization could move to Supabase Storage.

### Component Structure

```
RestaurantDetail.jsx
├── Extract Logo Button (existing)
├── Process Logo Button (new)
└── ProcessLogoDialog (new component)
    ├── NoLogoMode
    │   ├── ExtractOption
    │   └── ManualUrlOption
    └── ExistingLogoMode
        ├── ReprocessOption
        │   └── VersionSelector
        └── ReplaceOption
            ├── UrlInput
            └── VersionSelector
```

### State Management

**New State Variables**:
```javascript
const [processLogoDialogOpen, setProcessLogoDialogOpen] = useState(false);
const [processMode, setProcessMode] = useState('extract'); // 'extract', 'manual', 'reprocess', 'replace'
const [newLogoUrl, setNewLogoUrl] = useState('');
const [versionsToUpdate, setVersionsToUpdate] = useState({
  logo_url: false,
  logo_nobg_url: true,
  logo_standard_url: false,
  logo_thermal_url: true,
  logo_thermal_alt_url: true,
  logo_thermal_contrast_url: false,
  logo_thermal_adaptive_url: false,
  logo_favicon_url: true
});
```

**Implementation Note**: The handleSave function already implements field-level change tracking to prevent sending unchanged base64 data, ensuring payload optimization.

## Implementation Steps

### ✅ Phase 1: Critical Fixes - COMPLETED
1. ✅ Fixed toast import error
2. ✅ Updated thermal logo dimensions to 265px wide
3. ✅ Added favicon display to frontend
4. ✅ Created multiple thermal versions
5. ✅ Fixed payload size issue

### Phase 2: Process Logo Button & Basic Dialog (NEXT)
1. Add Process Logo button to UI
2. Create ProcessLogoDialog component shell
3. Implement dialog open/close logic
4. Add mode detection (existing logo vs no logo)

### Phase 3: No Logo Mode Implementation
1. Implement extraction option (reuse existing flow)
2. Implement manual URL input
3. Connect to existing process-selected-logo endpoint
4. Test full logo creation flow

### Phase 4: Existing Logo Mode Implementation  
1. Add logo preview in dialog
2. Implement version selection checkboxes
3. Create reprocess endpoint
4. Update logo-extraction-service for selective processing
5. Test reprocessing with version selection

### Phase 5: Replace Logo Feature
1. Add URL input for replacement
2. Implement version replacement selection
3. Update API to handle partial updates
4. Test replacement scenarios

### Phase 6: Polish & Edge Cases
1. Add loading states
2. Add error handling
3. Add success notifications
4. Handle edge cases (invalid URLs, failed processing)
5. Add confirmation dialogs for replacements

## Testing Checklist

### Completed Features
- [x] Toast error is fixed
- [x] Thermal logos are 265px wide
- [x] Thermal logos maintain aspect ratio for rectangular logos  
- [x] Favicon displays correctly
- [x] Multiple thermal versions generate correctly
- [x] Payload optimization prevents base64 update errors

### To Be Implemented & Tested
- [ ] Process Logo button appears and functions
- [ ] Dialog shows correct mode based on logo presence
- [ ] Manual URL entry works without extraction
- [ ] Reprocessing existing logo works
- [ ] Selective version updating works (including all thermal versions)
- [ ] Website link appears and is clickable
- [ ] Default selections are correct (nobg, thermal, thermal_alt, favicon)
- [ ] Error states are handled gracefully
- [ ] Success states update UI correctly
- [ ] User can select which thermal version to use

## Backwards Compatibility

The existing "Extract Logo" functionality must remain unchanged:
- Continues to use Firecrawl API
- Shows candidate selection dialog
- Processes all versions when logo selected
- Manual URL entry within extraction dialog still works

## Benefits

1. **Cost Savings**: No Firecrawl credits used when user has direct logo URL
2. **Flexibility**: Users can update specific logo versions without regenerating all
3. **Efficiency**: Reprocess existing logos without re-uploading
4. **Control**: Users choose which versions to update
5. **Clarity**: Clear UI separates extraction from processing

## Success Criteria

- All critical issues are resolved
- Process Logo feature works for both new and existing logos
- No regression in existing Extract Logo functionality
- Thermal logos are correctly sized at 265px wide
- User can process logos without using Firecrawl credits when URL is known