# Prime Prompt: LeadDetailModal Enhancements

## Context

Phase 2 Registration Batch Orchestration is **COMPLETE**. The batch registration flow now has header image manual entry functionality. This session focuses on adding similar functionality to the LeadDetailModal, plus adding opening hours editing.

The previous sessions completed:
- Issue 16 (partial): Header image manual entry for batch registration
- WebsiteTab now supports URL paste → base64 save pattern
- Auto-selection of best available header image based on priority

## Remaining Work: LeadDetailModal.tsx Enhancements

### Problem
The LeadDetailModal (used to view/edit restaurant details from lead conversion flow) is missing:
1. Header image display and editing capability
2. Actual opening hours editing (currently only shows text format)

### Task 1: Add Header Image Display/Editing Section

**Current State:**
- LeadDetailModal shows restaurant details but no header images
- WebsiteTab has the pattern for header image editing (dropdown + URL input)
- Backend already supports header image field updates with base64 conversion

**What's Needed:**
Add a new "Header Images" section to LeadDetailModal with:

1. **Display Mode (when not editing):**
   - Show thumbnails of available header images (website_og_image, ubereats_og_image, doordash_og_image, facebook_cover_image)
   - Label each image with its source

2. **Edit Mode:**
   - Dropdown to select which image source to edit
   - Always show all 4 options (with "(empty)" indicator for missing ones)
   - URL input field below dropdown
   - "Apply & Save" button that saves directly to database
   - Preview of selected image

**UI Pattern to Follow:**
Match the pattern from `WebsiteTab.tsx` Header Configuration section:
```typescript
{/* Dropdown showing all 4 sources */}
<Select value={selectedSource} onValueChange={setSelectedSource}>
  {ALL_IMAGE_SOURCES.map((source) => {
    const imageUrl = getHeaderImageUrl(source.value);
    const hasImage = !!imageUrl && imageUrl.length > 0;
    return (
      <SelectItem key={source.value} value={source.value}>
        {hasImage ? <Preview /> : <EmptyIndicator />}
      </SelectItem>
    );
  })}
</Select>

{/* URL Input */}
<Input
  placeholder="https://example.com/image.jpg"
  value={urlInput}
  onChange={(e) => setUrlInput(e.target.value)}
/>
<Button onClick={handleSave}>Apply & Save</Button>
```

**Save Handler:**
- Call API to update restaurant record with the image URL
- Backend converts URL to base64 automatically
- Refresh modal data after save

### Task 2: Add Opening Hours Editing

**Current State:**
- LeadDetailModal shows "Opening Hours (text)" with a textarea
- The `OpeningHoursEditor.tsx` component exists and is reusable
- Opening hours are stored as JSONB in the restaurant record

**What's Needed:**
1. Keep existing text format display for reference
2. Add actual `OpeningHoursEditor` component below it
3. Wire up edit mode to allow modifying hours
4. Save changes to restaurant record

**OpeningHoursEditor Usage:**
```typescript
import { OpeningHoursEditor, OpeningHoursSlot } from '../OpeningHoursEditor';

// In component:
<OpeningHoursEditor
  value={restaurant.opening_hours}
  onChange={(newHours) => setOpeningHours(newHours)}
  isEditing={isEditing}
/>
```

**Data Format:**
The OpeningHoursEditor expects array format:
```typescript
interface OpeningHoursSlot {
  day: string;      // 'Monday', 'Tuesday', etc.
  hours: {
    open: string;   // "HH:MM" 24-hour format
    close: string;  // "HH:MM" 24-hour format
  };
}
```

It also accepts object format (which it normalizes internally):
```typescript
Record<string, { open: string; close: string }>
```

### Key Files to Investigate

**Primary file to modify:**
- `src/components/leads/LeadDetailModal.tsx`

**Components to import:**
- `src/components/OpeningHoursEditor.tsx` - Reusable hours editing
- Pattern from `src/components/registration/tabs/WebsiteTab.tsx` - Header image UI

**Reference for save functionality:**
- Check existing save handlers in LeadDetailModal
- The modal likely already has an update mechanism for other fields

### Implementation Steps

1. Read `LeadDetailModal.tsx` to understand current structure and edit mode
2. Identify where to add the Header Images section (likely near existing image fields)
3. Identify where to add Opening Hours editing (near existing hours text display)
4. Add state for:
   - Selected header image source
   - Header image URL input
   - Is saving state
   - Opening hours data (if not already tracked)
5. Create save handlers for both features
6. Add UI components
7. Test with a restaurant that has various data populated
8. Test header image save with a URL
9. Test opening hours editing and save

### Database Fields Reference

Restaurant table fields related to this task:
```sql
-- Header images
website_og_image TEXT,
ubereats_og_image TEXT,
doordash_og_image TEXT,
facebook_cover_image TEXT,

-- Opening hours
opening_hours JSONB,
```

### UI Placement Suggestions

Based on typical modal layout patterns:

1. **Header Images Section** - Add after branding/logo section:
   ```
   --- Branding ---
   Logo previews...

   --- Header Images ---   <-- NEW
   [Dropdown] [URL Input] [Save]
   [Preview]

   --- Contact ---
   ...
   ```

2. **Opening Hours Section** - Enhance existing:
   ```
   --- Opening Hours ---
   Opening Hours (text):
   [Textarea with raw text]

   Structured Hours:          <-- NEW
   [OpeningHoursEditor component]
   ```

### Notes

- LeadDetailModal is used in the lead conversion flow, so changes affect pre-registration editing
- The modal may have different edit modes - ensure changes work in appropriate mode
- Consider mobile responsiveness for the header image section
- The OpeningHoursEditor component handles its own day-by-day UI with add/remove slots
