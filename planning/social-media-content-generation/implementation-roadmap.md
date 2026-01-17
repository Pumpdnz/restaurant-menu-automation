# Implementation Roadmap

## Overview

This document provides a step-by-step implementation guide for building the social media content generation system. Follow these phases in order for the smoothest development experience.

---

## 🎯 CURRENT STATUS (Updated: 2025-10-09)

### ✅ Completed Phases

**Phase 1: Database Setup** - COMPLETE
- ✅ Table `social_media_videos` created with all fields (including voice-over fields for Phase 5)
- ✅ Indexes created (org, status, restaurant, sora_id, user, active jobs, voice-enabled)
- ✅ RLS policies implemented (view, create, update, delete by organization)
- ✅ Triggers created (updated_at, completed_at)
- ✅ Storage bucket `social-media-videos` created with policies
- ✅ Tested and verified working

**Phase 2: Core Services** - COMPLETE
- ✅ `SoraService` - OpenAI Sora 2 wrapper (create, status, download, delete)
- ✅ `GeminiImageService` - Google Gemini 2.5 Flash Image wrapper
- ✅ `SocialStorageService` - Database + Supabase Storage operations
- ✅ `VideoGenerationService` - Main orchestrator with background polling (10s intervals)
- ✅ **Portrait/Landscape Support**: Automatic aspect ratio detection, sharp image resizing
- ✅ **Tested**: Mode 2 (text-to-video) working, Mode 3 (AI image-to-video) working

**Phase 3: API Layer** - COMPLETE
- ✅ `src/routes/social-media-routes.js` created with 6 endpoints
- ✅ Routes mounted in `server.js` at `/api/social-media`
- ✅ Full request validation (mode, prompt, videoConfig, soraModel)
- ✅ Organization-based access control (RLS + manual verification)
- ✅ Comprehensive error handling with proper HTTP status codes
- ✅ Ready for testing

### 🚀 Next Phase: Phase 4 Additional Features (Steps 4.8-4.10)

**Status**: 🚧 Testing & Polish
**Completed**:
- ✅ Step 4.7: Centralized Dashboard (Complete)
- ✅ Step 4.8: Standalone Image Generation (Complete with Bug Fixes)

**Remaining Time**: 0.5-2 hours (testing + optional prompt builders)
**What to Do Next**:
1. ✅ Step 4.8: Standalone Image Generation - **COMPLETE WITH BUG FIXES**
   - ✅ Database table: `social_media_images` created with RLS
   - ✅ Service: `image-generation-service.js` with multi-image composition
   - ✅ API endpoints: 7 image management endpoints operational
   - ✅ UI Components: 4 components (ImageModeSelector, ImageModelSelector, ImageConfigForm, ReferenceImageSelector)
   - ✅ UI: `ImagesTab.tsx` complete with create/list/preview views
   - ✅ **BUG FIXES APPLIED** (2025-10-10):
     - ✅ Fixed image preview dialog sizing issues
     - ✅ Added logo images as reference images
     - ✅ Added AI images to video generation selector
     - ✅ Fixed uploaded images not working in video generation (multi-source support)
   - ⏸️ **TESTING NEEDED**: End-to-end testing with all fixes
2. Step 4.9: Intelligent Prompt Builders (2-3 hours) - **OPTIONAL**
   - Research prompt best practices
   - Video prompt builder component
   - Image prompt builder component
3. Step 4.10: Integration and Testing (1 hour) - **IN PROGRESS**
   - Test image generation flow
   - Fix any issues found
   - Performance testing

**See Below**: Detailed implementation steps and testing requirements

### 📁 Key Files Created

```
UberEats-Image-Extractor/
├── src/
│   ├── services/social-media/
│   │   ├── sora-service.js                 ✅ COMPLETE
│   │   ├── gemini-image-service.js         ✅ COMPLETE
│   │   ├── social-storage-service.js       ✅ COMPLETE
│   │   └── video-generation-service.js     ✅ COMPLETE
│   │
│   └── routes/
│       └── social-media-routes.js          ✅ COMPLETE
│
└── server.js                                ✅ UPDATED (routes mounted)
```

### 🔑 Important Notes for Phase 4 Implementation

1. **API Endpoints Available** at `http://localhost:3007/api/social-media`:
   - POST `/generate` - Create video job
   - GET `/videos/:id/status` - Get status
   - POST `/videos/:id/refresh` - Force refresh
   - GET `/videos` - List videos (with filters)
   - DELETE `/videos/:id` - Delete video
   - GET `/videos/:id` - Full details

2. **Authentication Required**: All endpoints use `authMiddleware`
   - Access `req.user.organisationId` for organization context
   - Access `req.user.id` for user ID

3. **Video Configuration**:
   - Sizes: `1280x720`, `1920x1080` (landscape), `720x1280`, `1080x1920` (portrait)
   - Durations: 4, 8, or 12 seconds
   - Models: `sora-2` (fast), `sora-2-pro` (high quality)

4. **Three Generation Modes**:
   - Mode 1: `image-to-video` (requires `inputSource.imageId`)
   - Mode 2: `text-to-video` (prompt only)
   - Mode 3: `generated-image-to-video` (requires `imagePrompt` + `prompt`)

5. **Testing Commands**: See Phase 3 section below for curl examples

---

## Prerequisites

### 1. API Keys

Obtain the following API keys:

- **OpenAI API Key**: https://platform.openai.com/api-keys
  - Requires billing setup
  - Sora API access

- **Google Gemini API Key**: https://aistudio.google.com/app/apikey
  - Free tier available
  - Gemini 2.5 Flash Image access

### 2. Environment Setup

Add to `UberEats-Image-Extractor/.env`:

```bash
# OpenAI Sora 2 API
OPENAI_API_KEY=sk-proj-...

# Google Gemini API
GOOGLE_GENAI_API_KEY=AI...

# Existing variables
# ...
```

### 3. Install Dependencies

```bash
cd UberEats-Image-Extractor
npm install openai @google/generative-ai
```

---

## Phase 1: Database Setup ✅ COMPLETE

**Status**: ✅ Complete
**Completed**: 2025-10-08
**Time Taken**: ~30 minutes

### Step 1.1: Create Migration File ✅

Create the migration file as documented in `database-schema.md`:

```bash
# Using Supabase CLI
supabase migration new create_social_media_videos

# Or via MCP tool
mcp__supabase__apply_migration
```

### Step 1.2: Run Migration

Execute the migration on your Supabase project:

```sql
-- Run the complete migration from database-schema.md
-- This creates:
-- - social_media_videos table
-- - Indexes
-- - RLS policies
-- - Triggers
-- - Storage bucket
```

### Step 1.3: Verify Setup

```sql
-- Verify table exists
SELECT * FROM social_media_videos LIMIT 1;

-- Verify storage bucket
SELECT * FROM storage.buckets WHERE id = 'social-media-videos';

-- Test RLS policies
INSERT INTO social_media_videos (
  organisation_id, mode, prompt, sora_model, created_by
) VALUES (
  '<your-org-id>', 'text-to-video', 'Test prompt', 'sora-2', auth.uid()
);
```

**Deliverable**: ✅ Database table and storage bucket created

**What Was Created**:
- Table: `social_media_videos` with all fields including voice-over support
- Indexes: 7 performance indexes created
- RLS Policies: 5 policies for organization-based access control
- Triggers: 2 triggers for auto-updating timestamps
- Storage Bucket: `social-media-videos` with 3 access policies
- Directory Structure: `{org_id}/videos/`, `{org_id}/thumbnails/`, `{org_id}/generated-images/`

---

## Phase 2: Core Services ✅ COMPLETE

**Status**: ✅ Complete
**Completed**: 2025-10-08
**Time Taken**: ~5 hours
**Tested**: Mode 2 and Mode 3 successfully tested

### Step 2.1: Create SoraService ✅

**File**: `UberEats-Image-Extractor/src/services/social-media/sora-service.js`

1. Create the service directory:
```bash
mkdir -p UberEats-Image-Extractor/src/services/social-media
```

2. Implement `SoraService` class (see `service-layer.md`)
3. Test with simple API call:

```javascript
const service = new SoraService();
const video = await service.createVideo({
  model: 'sora-2',
  prompt: 'A test video of a spinning cube',
  size: '1280x720',
  seconds: 4
});
console.log('Created video:', video.id);
```

**Deliverable**: ✅ SoraService can create videos and check status

**Implementation Details**:
- Uses OpenAI SDK with `toFile()` wrapper for image uploads
- Supports both `sora-2` and `sora-2-pro` models
- Implements createVideo(), checkStatus(), downloadVideo(), downloadThumbnail()
- File: `src/services/social-media/sora-service.js`

### Step 2.2: Create GeminiImageService ✅

**File**: `UberEats-Image-Extractor/src/services/social-media/gemini-image-service.js`

1. Implement `GeminiImageService` class
2. Test image generation:

```javascript
const service = new GeminiImageService();
const image = await service.generateImage('A professional burger photo');
console.log('Generated image:', image.buffer.length, 'bytes');
```

**Deliverable**: ✅ GeminiImageService can generate images

**Implementation Details**:
- Uses Google Generative AI SDK
- Generates images with aspect ratio hints (16:9 or 9:16)
- Returns PNG images as Buffer
- File: `src/services/social-media/gemini-image-service.js`

### Step 2.3: Create SocialStorageService ✅

**File**: `UberEats-Image-Extractor/src/services/social-media/social-storage-service.js`

1. Implement all database methods
2. Implement all storage methods
3. Test CRUD operations:

```javascript
const service = new SocialStorageService();

// Create job
const job = await service.createJob({
  organisation_id: '<org-id>',
  mode: 'text-to-video',
  prompt: 'Test',
  sora_model: 'sora-2',
  status: 'queued',
  created_by: '<user-id>'
});

// Update job
await service.updateJob(job.id, { status: 'in_progress', progress: 50 });

// Get job
const fetched = await service.getJob(job.id);
console.log('Job status:', fetched.status);
```

**Deliverable**: ✅ SocialStorageService working with database

**Implementation Details**:
- Full CRUD operations on `social_media_videos` table
- Upload/download methods for videos, thumbnails, generated images
- Organization-based file paths for multi-tenancy
- File: `src/services/social-media/social-storage-service.js`

### Step 2.4: Create VideoGenerationService ✅

**File**: `UberEats-Image-Extractor/src/services/social-media/video-generation-service.js`

1. Implement main orchestrator
2. Implement polling mechanism
3. Test Mode 2 (simplest - text-to-video):

```javascript
const service = new VideoGenerationService();

const job = await service.generateVideo({
  mode: 'text-to-video',
  prompt: 'A cozy cafe interior',
  organisationId: '<org-id>',
  userId: '<user-id>',
  soraModel: 'sora-2',
  videoConfig: { size: '1280x720', seconds: 4 }
});

console.log('Job created:', job.id);

// Wait and check status
setTimeout(async () => {
  const status = await service.getJobStatus(job.id);
  console.log('Status:', status.status, status.progress);
}, 30000);
```

**Deliverable**: ✅ VideoGenerationService can create and poll jobs

**Implementation Details**:
- Main orchestrator coordinating all services
- Background polling every 10 seconds (max 1 hour)
- **Portrait/Landscape Support**:
  - `resizeImageForVideo()` method using sharp with center-crop
  - Automatic aspect ratio detection from videoConfig.size
  - Works for all 4 video sizes (landscape + portrait)
- Handles all 3 generation modes
- File: `src/services/social-media/video-generation-service.js`

**Testing Results**:
- ✅ Mode 2 (text-to-video): Tested successfully
- ✅ Mode 3 (generated-image-to-video): Tested successfully with portrait/landscape
- ⏸️ Mode 1 (image-to-video): Not yet tested (should work)

---

## Phase 3: API Layer ✅ COMPLETE

**Status**: ✅ Complete
**Completed**: 2025-10-08
**Time Taken**: ~2 hours

### Step 3.1: Create API Routes ✅

**File**: `UberEats-Image-Extractor/src/routes/social-media-routes.js` ✅

**Implemented Endpoints**:
1. ✅ POST `/generate` - Create video generation job
2. ✅ GET `/videos/:id/status` - Get job status
3. ✅ POST `/videos/:id/refresh` - Force status refresh
4. ✅ GET `/videos` - List videos with filters
5. ✅ DELETE `/videos/:id` - Delete video and assets
6. ✅ GET `/videos/:id` - Get full job details

**Features**:
- ✅ Full request validation (mode, prompt, videoConfig, soraModel)
- ✅ Mode-specific validation (imageId for Mode 1, imagePrompt for Mode 3)
- ✅ Organization-based access control (RLS + manual checks)
- ✅ Comprehensive error handling with proper HTTP codes
- ✅ Detailed logging for debugging

### Step 3.2: Mount Routes in Server ✅

**File**: `UberEats-Image-Extractor/server.js` ✅

**Routes Mounted**:
```javascript
// Import social media routes
const socialMediaRoutes = require('./src/routes/social-media-routes');

// Mount routes with auth middleware
app.use('/api/social-media', authMiddleware, socialMediaRoutes);
```

**Location**: Line ~7382 in server.js

### Step 3.3: Test API Endpoints ✅

**Status**: Ready for testing (implementation complete)

**Prerequisites**:
```bash
# Set your JWT token
export TOKEN="your-jwt-token-here"

# Server should be running on port 3007
cd UberEats-Image-Extractor
npm start
```

**Test 1: Generate Video (Mode 2 - Text to Video)**
```bash
curl -X POST http://localhost:3007/api/social-media/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "text-to-video",
    "prompt": "A spinning red cube on a white background, camera slowly orbits",
    "soraModel": "sora-2",
    "videoConfig": {
      "size": "1280x720",
      "seconds": 4
    }
  }'
# Expected: 201 Created with job id and sora_video_id
```

**Test 2: Generate Portrait Video (Mode 3 - AI Image to Video)**
```bash
curl -X POST http://localhost:3007/api/social-media/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "generated-image-to-video",
    "imagePrompt": "Vertical portrait of a delicious milkshake with whipped cream",
    "prompt": "The milkshake rotates slowly, camera tilts up",
    "soraModel": "sora-2",
    "videoConfig": {
      "size": "720x1280",
      "seconds": 4
    }
  }'
# Expected: 201 Created
```

**Test 3: Get Job Status**
```bash
# Replace JOB_ID with id from Test 1 or 2
curl http://localhost:3007/api/social-media/videos/JOB_ID/status \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK with status, progress, video_url (when complete)
```

**Test 4: Refresh Job Status**
```bash
curl -X POST http://localhost:3007/api/social-media/videos/JOB_ID/refresh \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK with updated status
```

**Test 5: List All Videos**
```bash
# Basic list
curl http://localhost:3007/api/social-media/videos \
  -H "Authorization: Bearer $TOKEN"

# With filters
curl "http://localhost:3007/api/social-media/videos?status=completed&limit=10" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK with array of videos and pagination
```

**Test 6: Get Full Video Details**
```bash
curl http://localhost:3007/api/social-media/videos/JOB_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK with complete job object
```

**Test 7: Delete Video**
```bash
curl -X DELETE http://localhost:3007/api/social-media/videos/JOB_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK with success message
```

**Validation Tests**:

```bash
# Invalid mode
curl -X POST http://localhost:3007/api/social-media/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "invalid", "prompt": "test"}'
# Expected: 400 Bad Request - Invalid mode

# Missing required field for Mode 3
curl -X POST http://localhost:3007/api/social-media/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "generated-image-to-video", "prompt": "test"}'
# Expected: 400 Bad Request - imagePrompt required

# Invalid video size
curl -X POST http://localhost:3007/api/social-media/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "text-to-video",
    "prompt": "test",
    "videoConfig": {"size": "999x999", "seconds": 8}
  }'
# Expected: 400 Bad Request - Invalid video size
```

**Deliverable**: ✅ All API endpoints implemented and ready for testing

---

## Phase 4: UI Components 🚧 IN PROGRESS

**Status**: 🚧 Core components complete, additional features in progress (Updated: 2025-10-08)
**Completed Time**: ~3 hours (core UI)
**Remaining Time**: ~6-8 hours (centralized dashboard + image generation)
**Prerequisites**: All API endpoints working and tested

### Important: Read `ui-components.md` First!

Before starting Phase 4, **carefully read** `/planning/social-media-content-generation/ui-components.md` for:
- Complete component specifications with TypeScript interfaces
- React hook implementation with all methods
- Form validation rules
- State management patterns
- Error handling patterns
- UI/UX requirements

### Step 4.1: Create React Hook ✅ COMPLETE

**File**: `UberEats-Image-Extractor/src/hooks/useSocialMedia.ts`

**Implemented**:
- ✅ `generateVideo()` - POST to `/api/social-media/generate`
- ✅ `getJobStatus()` - GET from `/api/social-media/videos/:id/status`
- ✅ `refreshJobStatus()` - POST to `/api/social-media/videos/:id/refresh`
- ✅ `fetchVideos()` - GET from `/api/social-media/videos` with filters
- ✅ `deleteVideo()` - DELETE to `/api/social-media/videos/:id`
- ✅ `getVideoDetails()` - GET full video details
- ✅ Auto-navigation after video generation
- ✅ Toast notifications for success/error
- ✅ State management for loading, errors, videos array

**Deliverable**: ✅ Custom React hook with all API methods

### Step 4.2: Create Shared Components ✅ COMPLETE

**Directory**: `UberEats-Image-Extractor/src/components/social-media/`

Components created:

#### 1. **VideoPromptInput** ✅
- Textarea with character counter (maxLength: 500)
- Validation for min/max length
- Helper text support
- **File**: `src/components/social-media/VideoPromptInput.tsx`

#### 2. **ModeSelector** ✅
- 3 clickable card options with icons (Image, Wand2, Type)
- Mode descriptions and visual feedback
- **File**: `src/components/social-media/ModeSelector.tsx`

#### 3. **ModelSelector** ✅
- 2 detailed cards for sora-2 vs sora-2-pro
- Speed/quality/cost indicators
- Recommended badge for sora-2
- **File**: `src/components/social-media/ModelSelector.tsx`

#### 4. **VideoConfigForm** ✅ ⭐
- **Landscape/Portrait orientation tabs** with Monitor/Smartphone icons
- Radio buttons for HD/Full HD within each orientation
- Duration slider (4/8/12 seconds) with visual feedback
- Visual dimension preview box
- **File**: `src/components/social-media/VideoConfigForm.tsx`

#### 5. **ImageSelector** ✅ + Enhanced
- Grid of existing menu item images (6 columns responsive)
- Search/filter by item name
- ✅ **NEW**: Filter by restaurant dropdown
- Image preview on select with border highlight
- **File**: `src/components/social-media/ImageSelector.tsx`

#### 6. **VideoJobStatus** ✅
- Status badge with icons (queued, in_progress, completed, failed)
- Progress bar with percentage
- Error message display
- Success/failure notifications
- **File**: `src/components/social-media/VideoJobStatus.tsx`

#### 7. **VideoPreview** ✅
- HTML5 video player with controls
- Thumbnail fallback when video not ready
- Download button functionality
- Metadata display (mode, model, size, duration, prompts)
- Voice-over badge and script display
- **File**: `src/components/social-media/VideoPreview.tsx`

**Deliverable**: ✅ 7 reusable components in `src/components/social-media/`

### Step 4.3: Create Pages ✅ COMPLETE

**Directory**: `UberEats-Image-Extractor/src/pages/`

#### Page 1: **VideoGeneration** ✅
**File**: `src/pages/VideoGeneration.tsx`

**Implemented**:
- ✅ 3-column responsive layout (form, config, tips)
- ✅ All components orchestrated with conditional rendering
- ✅ Mode-specific UI (ImageSelector for Mode 1, dual prompts for Mode 3)
- ✅ Form validation with toast notifications
- ✅ Success redirect to `/social-media/videos`
- ✅ Error handling and loading states
- ✅ Quick tips sidebar with mode-specific guidance

#### Page 2: **SocialMediaVideos** ✅ + Enhanced
**File**: `src/pages/SocialMediaVideos.tsx`

**Implemented**:
- ✅ Table view with thumbnail previews
- ✅ Filters: status, mode
- ✅ ✅ **NEW**: Filter by restaurant dropdown
- ✅ Auto-polling for in-progress videos (10s intervals)
- ✅ Actions: View (eye icon), Refresh, Delete (trash icon)
- ✅ Preview dialog with full video player and metadata
- ✅ Empty states with helpful prompts
- ✅ Pagination support (limit/offset)

**Deliverable**: ✅ 2 pages for generation and listing with restaurant filtering

### Step 4.4: Add Navigation ✅ COMPLETE

**Files Updated**:
- `App.tsx` (lines 30-32, 162-163)
- `NavigationItems.jsx` (lines 12, 33)

**Implemented Routes**:
```typescript
// App.tsx - Protected routes
<Route path="social-media/videos" element={<SocialMediaVideos />} />
<Route path="social-media/generate" element={<VideoGeneration />} />
```

**Navigation Menu**:
- ✅ "Social Media" menu item added to sidebar
- ✅ Video icon from lucide-react
- ✅ Active state highlighting
- ✅ Links to `/social-media/videos`

**Deliverable**: ✅ Navigation links working, pages accessible

### Step 4.5: Additional API Endpoint ✅ COMPLETE

**New Endpoint**: `GET /api/menus/images`

**File**: `server.js` (line 3505)

**Purpose**: Fetch menu item images for ImageSelector component

**Features**:
- ✅ Organization-filtered (multi-tenant support)
- ✅ Joins with menu_items table for item names
- ✅ Returns both original URL and CDN URL
- ✅ Ordered by most recent, limited to 500 images
- ✅ Authentication required

**Response Format**:
```json
{
  "success": true,
  "count": 150,
  "images": [
    {
      "id": "uuid",
      "url": "https://...",
      "cdn_url": "https://..." or null,
      "item_name": "Item Name",
      "menu_item_id": "uuid"
    }
  ]
}
```

**Deliverable**: ✅ Image selection API working with existing storage

### Step 4.6: Core UI Testing ⏸️ PENDING

**Test Scenarios**:

1. **Mode 2 (Text-to-Video) Flow**:
   - Navigate to `/social-media/generate`
   - Select "Text to Video" mode
   - Select "sora-2" model
   - Choose landscape size (1280x720) and 4 seconds
   - Enter prompt: "A cozy coffee shop interior"
   - Click Generate
   - Verify redirect to videos list
   - Verify job appears with "queued" status
   - Wait for auto-polling to update status
   - Verify completed video plays

2. **Mode 3 (AI Image-to-Video) with Portrait**:
   - Select "AI Image to Video" mode
   - Select "sora-2-pro" model
   - Switch to **Portrait tab** in VideoConfigForm
   - Choose 720x1280 and 8 seconds
   - Enter image prompt: "Professional milkshake photo"
   - Enter video prompt: "Milkshake rotates slowly"
   - Generate and verify

3. **Delete Video**:
   - Navigate to videos list
   - Click delete on a video
   - Confirm deletion
   - Verify removed from list

**Deliverable**: ⏸️ Core UI testing needed

---

## 🚧 Phase 4: Additional Features (NEW REQUIREMENTS)

**Status**: 🚧 In progress (Updated: 2025-10-09)
**Completed Time**: ~2 hours (Step 4.7)
**Remaining Time**: ~4-6 hours (Steps 4.8-4.10)
**Prerequisites**: Core UI components complete (Step 4.1-4.5)

The following features extend Phase 4 with centralized dashboard management, standalone image generation, and intelligent prompt building tools.

### Step 4.7: Centralized Social Media Dashboard ✅ COMPLETE

**Objective**: Create a unified tabbed dashboard for all social media content management, following the established SMS dashboard pattern.

#### Reference Files (MUST READ BEFORE STARTING):
- `/Users/giannimunro/Desktop/cursor-projects/pumpd-webhook/src/components/sms/dashboard/improved/SmsDashboard.tsx`
  - Study the tab structure, state management, and URL-based tab switching
  - Note the use of search params for tab persistence
  - Review the responsive TabsList layout with grid/flex patterns

- `/Users/giannimunro/Desktop/cursor-projects/pumpd-webhook/src/components/sms/dashboard/improved/tabs/TriggersTab.tsx`
  - Study the view state management (`list`, `create`, `edit`, `templates`)
  - Note how components switch between list view and form view
  - Review the error handling and empty state patterns

#### Implementation Details:

**New Route**: `/social-media` (becomes the main entry point)

**File**: `src/pages/SocialMediaDashboard.tsx`

**Dashboard Structure**:
```typescript
<Card>
  <CardHeader>
    <CardTitle>Social Media Content Manager</CardTitle>
    <CardDescription>
      Create and manage AI-generated images, videos and social posts
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="manage">Manage</TabsTrigger>
        <TabsTrigger value="images">Images</TabsTrigger>
        <TabsTrigger value="videos">Videos</TabsTrigger>
        <TabsTrigger value="posts">Posts</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
      </TabsList>

      <TabsContent value="manage">
        <ManageTab /> {/* Placeholder */}
      </TabsContent>

      <TabsContent value="images">
        <ImagesTab /> {/* Step 4.8 */}
      </TabsContent>

      <TabsContent value="videos">
        <VideosTab /> {/* Refactored from SocialMediaVideos */}
      </TabsContent>

      <TabsContent value="posts">
        <PostsTab /> {/* Placeholder */}
      </TabsContent>

      <TabsContent value="performance">
        <PerformanceTab /> {/* Placeholder */}
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

**Tab State Management**:
- ✅ Use URL search params for tab persistence (e.g., `/social-media?tab=videos`)
- ✅ Support legacy redirects (e.g., `/social-media/videos` → `/social-media?tab=videos`)
- ✅ Default to "videos" tab if no param specified
- ✅ Update URL when tab changes

**Initial Tabs**:
1. **Manage** (Placeholder) - Future: Bulk operations, scheduling, approvals
2. **Images** (Step 4.8) - AI image generation and management
3. **Videos** (Refactor existing) - Video generation and management
4. **Posts** (Placeholder) - Future: Social media post composition
5. **Performance** (Placeholder) - Future: Analytics and metrics

#### Refactor Videos Tab:

**New File**: `src/components/social-media/tabs/VideosTab.tsx`

**View States** (following TriggersTab pattern):
- `'list'` - Show videos table with filters
- `'create'` - Show VideoGeneration form
- `'preview'` - Show video preview dialog

**Component Structure**:
```typescript
const VideosTab: React.FC = () => {
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'preview'>('list');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // Similar patterns to TriggersTab
  const handleCreateVideo = () => setCurrentView('create');
  const handlePreviewVideo = (id) => { setSelectedVideoId(id); setCurrentView('preview'); };
  const handleBackToList = () => { setCurrentView('list'); refetch(); };

  if (currentView === 'create') {
    return (
      <div>
        <Button onClick={handleBackToList}>Back to Videos</Button>
        <VideoGeneration onSuccess={handleBackToList} />
      </div>
    );
  }

  // Main list view with filters, table, etc.
  return <VideosList />;
};
```

**Files to Refactor**:
- Move `SocialMediaVideos.tsx` components → `VideosTab.tsx`
- Move `VideoGeneration.tsx` → Render inside VideosTab when `currentView === 'create'`
- Keep components modular for reuse

**Navigation Updates**:
- Update `NavigationItems.jsx`: `/social-media/videos` → `/social-media` ✅
- Add redirect: `/social-media/videos` → `/social-media?tab=videos` ✅
- Add redirect: `/social-media/generate` → `/social-media?tab=videos` ✅

**Deliverable**: ✅ Unified dashboard with Videos tab functional

**Implementation Details** (Completed: 2025-10-09):
- ✅ Created `SocialMediaDashboard.tsx` with URL-based tab persistence
- ✅ Created `VideosTab.tsx` with view state management (`list`, `create`, `preview`)
- ✅ Created placeholder tabs: `ManageTab.tsx`, `ImagesTab.tsx`, `PostsTab.tsx`, `PerformanceTab.tsx`
- ✅ Updated `App.tsx` routes:
  - Main route: `/social-media` → `SocialMediaDashboard`
  - Legacy redirects: `/social-media/videos` and `/social-media/generate` → `/social-media?tab=videos`
- ✅ Updated `NavigationItems.jsx`: Social Media link now points to `/social-media`
- ✅ Tab switching with URL persistence working
- ✅ Videos tab fully functional with create/list/preview views

---

### Step 4.8: Standalone Image Generation ✅ COMPLETE

**Status**: ✅ Implementation Complete - ✅ Critical Bug Fixes Applied
**Completed**: 2025-10-09
**Time Taken**: ~4 hours (implementation + bug fixes)

**Objective**: Allow users to generate AI images without automatically creating videos from them.

#### Database Schema Updates:

**New Table**: `social_media_images`

```sql
CREATE TABLE social_media_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  menu_id UUID REFERENCES menus(id) ON DELETE SET NULL,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,

  -- Generation details
  mode VARCHAR(50) NOT NULL, -- 'uploaded', 'text-to-image', 'image-reference', 'remix'
  prompt TEXT,
  reference_image_ids UUID[], -- Array of image IDs (supports multiple for 'image-reference' and 'remix')
  gemini_request_id TEXT, -- Google Gemini request ID
  gemini_model VARCHAR(50) DEFAULT 'gemini-2.5-flash-image',

  -- Image configuration
  image_config JSONB NOT NULL, -- { size: '1280x720', aspectRatio: '16:9' }
  gemini_config JSONB, -- { aspectRatio: '16:9' }

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'queued', -- 'queued', 'in_progress', 'completed', 'failed'
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Storage
  image_url TEXT, -- Generated image URL
  thumbnail_url TEXT,
  storage_path TEXT,

  -- Metadata
  width INTEGER,
  height INTEGER,
  file_size INTEGER,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Indexes
  CONSTRAINT valid_mode CHECK (mode IN ('uploaded', 'text-to-image', 'image-reference', 'remix')),
  CONSTRAINT valid_status CHECK (status IN ('queued', 'in_progress', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX idx_sm_images_org ON social_media_images(organisation_id, created_at DESC);
CREATE INDEX idx_sm_images_status ON social_media_images(status, created_at DESC);
CREATE INDEX idx_sm_images_restaurant ON social_media_images(restaurant_id, created_at DESC);
CREATE INDEX idx_sm_images_mode ON social_media_images(mode, created_at DESC);

-- RLS Policies
ALTER TABLE social_media_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view images from their organization"
  ON social_media_images FOR SELECT
  USING (organisation_id = auth.jwt() ->> 'organisationId'::text);

CREATE POLICY "Users can create images for their organization"
  ON social_media_images FOR INSERT
  WITH CHECK (organisation_id = auth.jwt() ->> 'organisationId'::text);

CREATE POLICY "Users can update images from their organization"
  ON social_media_images FOR UPDATE
  USING (organisation_id = auth.jwt() ->> 'organisationId'::text);

CREATE POLICY "Users can delete images from their organization"
  ON social_media_images FOR DELETE
  USING (organisation_id = auth.jwt() ->> 'organisationId'::text);

-- Triggers
CREATE TRIGGER update_sm_images_updated_at
  BEFORE UPDATE ON social_media_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sm_images_completed_at
  BEFORE UPDATE ON social_media_images
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION update_completed_at_column();
```

**Storage Bucket**: Use existing `social-media-videos` bucket with new path structure:
- `{org_id}/images/{image_id}.png` - Generated images
- `{org_id}/images/thumbnails/{image_id}.webp` - Thumbnails

#### API Endpoints:

**Base Path**: `/api/social-media/images`

```javascript
// POST /api/social-media/images/generate
// Generate a new image
{
  mode: 'text-to-image' | 'image-reference' | 'remix',
  prompt: string,
  referenceImageIds?: string[], // For 'image-reference' (1+ images) or 'remix' (multiple AI images)
  restaurantId?: string,
  menuId?: string,
  menuItemId?: string,
  geminiModel: 'gemini-2.5-flash-image',
  imageConfig: {
    size: '1280x720' | '1920x1080' | '720x1280' | '1080x1920',
    aspectRatio: '16:9' | '9:16'
  }
}

// GET /api/social-media/images
// List images with filters
?restaurantId=uuid&status=completed&mode=text-to-image&limit=50&offset=0

// GET /api/social-media/images/:id
// Get image details

// GET /api/social-media/images/:id/status
// Get generation status

// POST /api/social-media/images/:id/refresh
// Force status refresh

// DELETE /api/social-media/images/:id
// Delete image and files

// POST /api/social-media/images/upload
// Upload existing image (mode: 'uploaded')
```

#### Service Layer:

**New File**: `src/services/social-media/image-generation-service.js`

```javascript
class ImageGenerationService {
  constructor() {
    this.geminiService = new GeminiImageService();
    this.storageService = new SocialStorageService();
  }

  async generateImage(request) {
    // 1. Create job record
    const job = await this.storageService.createImageJob(request);

    // 2. Start background generation
    this.startImageGeneration(job.id, request);

    return job;
  }

  async startImageGeneration(jobId, request) {
    try {
      // Determine aspect ratio from imageConfig.size
      const [width, height] = request.imageConfig.size.split('x').map(Number);
      const aspectRatio = height > width ? '9:16' : '16:9';

      // Handle different modes
      if (request.mode === 'text-to-image') {
        // Simple text-to-image
        const image = await this.geminiService.generateImage(request.prompt, { aspectRatio });
        await this.storeImage(jobId, image);

      } else if (request.mode === 'image-reference') {
        // Generate with reference images (supports multiple menu item images)
        const referenceImages = await this.loadReferenceImages(request.referenceImageIds);
        const image = await this.geminiService.generateWithReference(
          request.prompt,
          referenceImages,
          { aspectRatio }
        );
        await this.storeImage(jobId, image);

      } else if (request.mode === 'remix') {
        // Remix existing AI images
        const sourceImages = await this.loadSourceImages(request.referenceImageIds);
        const image = await this.geminiService.remixImages(
          request.prompt,
          sourceImages,
          { aspectRatio }
        );
        await this.storeImage(jobId, image);
      }

      await this.storageService.updateImageJob(jobId, {
        status: 'completed',
        progress: 100
      });

    } catch (error) {
      await this.storageService.updateImageJob(jobId, {
        status: 'failed',
        error_message: error.message
      });
    }
  }

  async storeImage(jobId, imageBuffer) {
    // Upload to storage
    const imageUrl = await this.storageService.uploadGeneratedImage(imageBuffer, jobId, 'image');

    // Generate thumbnail
    const thumbnail = await sharp(imageBuffer).resize(300, 300, { fit: 'cover' }).toBuffer();
    const thumbnailUrl = await this.storageService.uploadGeneratedImage(thumbnail, jobId, 'thumbnail');

    // Update job with URLs
    await this.storageService.updateImageJob(jobId, {
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl
    });
  }
}
```

#### UI Components:

**File**: `src/components/social-media/tabs/ImagesTab.tsx`

**View States**:
- `'list'` - Image gallery with filters
- `'create'` - Image generation form
- `'preview'` - Image preview modal

**Image Generation Form** (when `currentView === 'create'`):

```typescript
<ImageGenerationForm>
  {/* 1. Generation Mode */}
  <ImageModeSelector
    modes={[
      { id: 'database-reference', label: 'Database Image Reference', description: 'Use 1+ menu images as reference', icon: Image },
      { id: 'text-to-image', label: 'Text → Image', description: 'Generate from text prompt only', icon: Type },
      { id: 'remix', label: 'Remix AI Images', description: 'Blend multiple AI-generated images', icon: Sparkles }
    ]}
  />

  {/* 2. AI Model (currently only Nano Banana) */}
  <ImageModelSelector
    models={[
      { id: 'gemini-2.5-flash-image', name: 'Nano Banana', cost: '$0.039/image' }
    ]}
  />

  {/* 3. Image Size */}
  <ImageConfigForm>
    {/* Orientation Tabs: Landscape | Portrait */}
    {/* Size Options: HD (1280x720 or 720x1280) | Full HD (1920x1080 or 1080x1920) */}
  </ImageConfigForm>

  {/* 4. Reference Image(s) - Conditional */}
  {(mode === 'database-reference' || mode === 'remix') && (
    <ReferenceImageSelector
      mode={mode}
      restaurantFilter={true}
      multiSelect={true} {/* Allow multiple images for both database-reference and remix modes */}
    />
  )}

  {/* 5. Prompt Input */}
  <ImagePromptInput
    label="Image Description"
    placeholder={getPlaceholder(mode)}
    maxLength={500}
  />

  <Button onClick={handleGenerate}>Generate Image</Button>
</ImageGenerationForm>
```

**Images List View** (when `currentView === 'list'`):

**Filters**:
- Restaurant dropdown (multi-select or single)
- Status (queued, in_progress, completed, failed)
- Mode (uploaded, text-to-image, image-reference, remix)

**Table Columns**:
1. Preview (thumbnail)
2. Mode (badge with icon)
3. Status (badge with progress)
4. Model (gemini-2.5-flash-image)
5. Size (1280x720, etc.)
6. Created (date/time)
7. Actions (View, Download, Delete)

**Actions**:
- **View** - Open preview modal with full-size image and metadata
- **Download** - Download image file
- **Delete** - Remove image and files (with confirmation)

**Key Features**:
- ✅ **Multi-Image Reference Support**: Both 'database-reference' and 'remix' modes support selecting multiple images
  - 'database-reference': Select 1+ menu item images from database → Gemini generates new image based on them
  - 'remix': Select multiple AI-generated images → Gemini blends/remixes them into a new image
- ✅ **Text-to-Image**: Generate images from text prompts only (no reference images needed)

**Deliverable**: ✅ Standalone image generation and management with multi-image reference support

**Implementation Summary** (Completed: 2025-10-09):

1. **Database Layer** ✅
   - Created `social_media_images` table with 4 generation modes
   - Indexes: org, status, restaurant, mode
   - RLS policies for organization-based access
   - Auto-triggers for updated_at and completed_at
   - Migration applied successfully

2. **Service Layer** ✅
   - `image-generation-service.js`: Complete orchestrator (520 lines)
   - Multi-image composition support (1-10 reference images)
   - 4 modes: uploaded, text-to-image, image-reference, remix
   - Automatic thumbnail generation
   - Image validation and processing
   - `social-storage-service.js`: Added uploadImageThumbnail() and deleteImageAsset()

3. **API Layer** ✅
   - 7 new endpoints at `/api/social-media/images`:
     - POST /generate - AI image generation
     - POST /upload - Direct file upload (multer)
     - GET / - List with filters
     - GET /:id/status - Get status
     - GET /:id - Full details
     - POST /:id/refresh - Refresh status
     - DELETE /:id - Delete image
   - Full validation and error handling
   - Organization access control

4. **UI Components** ✅
   - `ImageModeSelector.tsx` - 4-mode card selector
   - `ImageModelSelector.tsx` - Gemini model info display
   - `ImageConfigForm.tsx` - Aspect ratio selector with orientation tabs
   - `ReferenceImageSelector.tsx` - Multi-select image grid with restaurant filtering

5. **Images Tab** ✅
   - `ImagesTab.tsx` (828 lines) - Complete implementation
   - View states: list, create, preview
   - Create view: Full generation form with mode-specific inputs
   - List view: Table with filters (restaurant, status, mode)
   - Preview dialog: Image preview with details
   - Delete confirmation dialog
   - File upload support for 'uploaded' mode

**Files Created**:
```
✅ Database Migration: social_media_images
✅ Service: src/services/social-media/image-generation-service.js (520 lines)
✅ Service: src/services/social-media/social-storage-service.js (updated)
✅ Routes: src/routes/social-media-routes.js (+550 lines, 7 endpoints)
✅ Component: src/components/social-media/ImageModeSelector.tsx
✅ Component: src/components/social-media/ImageModelSelector.tsx
✅ Component: src/components/social-media/ImageConfigForm.tsx
✅ Component: src/components/social-media/ReferenceImageSelector.tsx
✅ Page: src/pages/social-media/ImagesTab.tsx (828 lines)
```

**Critical Bug Fixes Applied** ✅ (2025-10-10):

**Fix #1: Image Details Dialog Display Issues** ✅
- **Problem**: Image preview dialog was too large and exceeded screen size
- **Solution**:
  - Added `max-h-[90vh] overflow-y-auto` to DialogContent for scrollability
  - Added `max-h-[60vh] object-contain` to image element to limit size
  - Added flexbox centering to image container
- **Files Modified**: `ImagesTab.tsx` (lines 759, 772, 776)

**Fix #2: Logo Images as Reference Images** ✅
- **Problem**: Only menu item images were available as reference images
- **Solution**:
  - Created new API endpoint: `GET /api/restaurants/logos`
  - Updated `ReferenceImageSelector.tsx` to fetch and display logos
  - Added logo section above menu images in both image-reference and remix modes
  - Logos displayed in 8-column grid with `object-contain` styling
- **Files Modified**:
  - `server.js` (lines 3506-3561: new endpoint)
  - `ReferenceImageSelector.tsx` (added fetchLogos(), logo display section)

**Fix #3: AI Images in Video Generation** ✅
- **Problem**: Video generation image selector only showed menu images, not AI-generated images or logos
- **Solution**:
  - Added tabbed interface to `ImageSelector.tsx` with 3 sources: Menu Images, AI Generated, Logos
  - Each tab fetches from appropriate endpoint (menu images, social_media_images, restaurant logos)
  - Source-specific search and filtering
  - Proper image display (logos use object-contain, others use object-cover)
- **Files Modified**: `ImageSelector.tsx` (added Tabs, sourceType state, dynamic fetching)

**Fix #4: Uploaded Images Not Working in Video Generation** ✅
- **Problem**: Uploaded images from social_media_images table couldn't be used in video generation
- **Root Cause**: `handleMode1()` only fetched from item_images table (menu images)
- **Solution**:
  - Added `getSocialMediaImage()` method to fetch from social_media_images table
  - Added `getImageFromAnySource()` method with intelligent fallback logic:
    - Tries social_media_images first (for uploaded/AI images)
    - Falls back to item_images (for menu images)
    - Handles logos from restaurants table
    - Supports explicit sourceType hint ('menu', 'ai', 'logo')
  - Updated `handleMode1()` to use `getImageFromAnySource()`
  - Updated `ImageSelector` to pass sourceType along with imageId
  - Updated `VideosTab` to track and pass sourceType in video generation request
- **Files Modified**:
  - `social-storage-service.js` (added getSocialMediaImage, getImageFromAnySource methods)
  - `video-generation-service.js` (updated handleMode1 to use new method)
  - `ImageSelector.tsx` (updated onChange to pass sourceType)
  - `VideosTab.tsx` (added imageSourceType state, handleImageSelect handler)
  - `social-media-routes.js` (updated API docs to include sourceType parameter)

---

## Remaining Issues to Solve ⚠️

The following issues have been identified and need to be addressed in the next implementation session:

### ~~Issue #1: Restaurant Manual Selection Missing~~ ✅ RESOLVED

**Status**: ✅ **COMPLETE** (2025-10-10)

**What Was Completed**:

**Frontend Updates**:
1. ✅ Updated `ImagesTab.tsx`
   - Added restaurant dropdown selector to create view (visible for all modes)
   - Placed after ImageModeSelector, before AI-specific components
   - Dropdown allows selection from user's restaurants or "No specific restaurant"
   - Selected restaurant ID is passed to API in generation/upload requests
   - Optional but recommended for organizational purposes

2. ✅ Updated `VideosTab.tsx`
   - Added restaurant dropdown selector to video generation form
   - Available for all 3 video generation modes
   - Consistent UI pattern with ImagesTab
   - Restaurant ID passed to video generation API

**API Integration**:
- ✅ Both image and video generation endpoints already accept `restaurantId` parameter
- ✅ Backend properly stores `restaurant_id` in database records
- ✅ Works across all generation modes (uploaded, text-to-image, reference-images for images; image-to-video, text-to-video, generated-image-to-video for videos)

**User Experience**:
- Restaurant selection is **optional** - users can choose "No specific restaurant"
- Helps organize content by restaurant for multi-restaurant organizations
- Consistent experience across image and video generation workflows

**Files Modified**:
```
✅ Page: src/pages/social-media/ImagesTab.tsx (added restaurant selector)
✅ Page: src/pages/social-media/VideosTab.tsx (added restaurant selector)
```

**Impact**: ✅ **MEDIUM** - Improved content organization for multi-restaurant setups

**Time Taken**: ~0.5 hours

---

### ~~Issue #2: Image Upload UI Improvements~~ ✅ RESOLVED

**Status**: ✅ **COMPLETE** (2025-10-10)

**What Was Completed**:

**UI Enhancements**:
1. ✅ Added "Upload Image" button to main images list view
   - Positioned next to "Generate New Image" button in header
   - Direct access to upload mode without going through generation section
   - Better discoverability for users who want to upload existing images

2. ✅ Simplified upload mode UI
   - Created `FileUploadDropzone` component for enhanced upload experience
   - When "Upload Image" mode selected:
     - ✅ Hidden: ImageModelSelector (not needed for uploads)
     - ✅ Hidden: ImageConfigForm with aspect ratio (not applicable)
     - ✅ Hidden: Prompt input (not needed for uploads)
     - ✅ Shown: Mode selector, restaurant selector, upload area, upload button
   - Clean, focused interface for uploading

3. ✅ Enhanced upload component features
   - **Drag-and-drop support**: Users can drag files directly onto upload area
   - **Multi-file upload**: Support for uploading multiple files at once (up to 10)
   - **Visual feedback**: Hover states, drop zones, file count indicators
   - **File preview**: Shows selected file names before upload
   - **Batch processing**: Uploads files sequentially with success/error counting
   - **Progress indication**: Shows upload status for each file
   - **Restaurant association**: Restaurant selector available for all uploads

4. ✅ Dedicated upload entry point
   - `handleUploadImage()` method sets mode to 'uploaded' and shows create view
   - Separate from `handleCreateImage()` which defaults to 'text-to-image'
   - Clear separation between AI generation and direct upload workflows

**Component Created**:
```
✅ Component: src/components/social-media/FileUploadDropzone.tsx (NEW)
   - Drag-and-drop file upload component
   - Multi-file support (configurable max)
   - Visual feedback for drag states
   - File type validation (image/*)
   - Preview of selected files
```

**Files Modified**:
```
✅ Page: src/pages/social-media/ImagesTab.tsx
   - Added "Upload Image" button to list view header
   - Added handleUploadImage() method
   - Conditional rendering to hide AI-specific components in upload mode
   - Multi-file upload support with batch processing
   - Success/error counting and user feedback
```

**User Experience Improvements**:
- ✅ Upload accessible from main list view (1 click instead of 2+)
- ✅ Drag-and-drop makes uploading more intuitive
- ✅ Batch upload saves time when adding multiple images
- ✅ Clean UI without irrelevant AI generation options
- ✅ Restaurant association available for better organization
- ✅ Clear success/failure feedback for each upload

**Impact**: ✅ **HIGH** - Significantly improved UX for common upload task

**Time Taken**: ~1.5 hours

---

### ~~Issue #3: Unification of Image Reference Modes~~ ✅ RESOLVED

**Status**: ✅ **COMPLETE** (2025-10-10)

**What Was Completed**:

**Database Migrations** (3 migrations applied):
1. ✅ Added `reference_image_sources` (jsonb) column to `social_media_images` table
   - Stores array of source metadata: `[{ id: uuid, sourceType: 'menu'|'ai'|'uploaded'|'logo' }]`
   - Enables mixed-source image composition

2. ✅ Added `source_image_type` (text) column to `social_media_videos` table
   - Tracks source type for Mode 1 video generation
   - CHECK constraint ensures valid values: 'menu', 'ai', 'uploaded', 'logo'

3. ✅ Consolidated image generation modes
   - Merged 'image-reference' + 'remix' → 'reference-images'
   - Updated mode constraint to only allow: 'uploaded', 'text-to-image', 'reference-images'
   - Migrated 6 existing records to new unified mode

**Service Layer**:
1. ✅ Created `ImageFetcherService` (NEW)
   - `src/services/social-media/image-fetcher-service.js`
   - Unified fetching from all 4 sources: menu, ai, uploaded, logo
   - Methods: `fetchImage()`, `fetchMultipleImages()`, `fetchMenuImage()`, `fetchSocialMediaImage()`, `fetchLogoImage()`

2. ✅ Updated `ImageGenerationService`
   - Replaced `referenceImageIds` + `remixImageIds` → `referenceSources: [{ id, sourceType }]`
   - Consolidated `handleImageReference()` + `handleRemix()` → `handleReferenceImages()`
   - Uses `ImageFetcherService` for all image fetching
   - Stores both `reference_image_ids` (backwards compat) and `reference_image_sources` (new JSONB)

3. ✅ Updated `VideoGenerationService`
   - Updated `handleMode1()` to require `inputSource.sourceType`
   - Uses `ImageFetcherService.fetchImage()` instead of storage service
   - Stores `source_image_type` in database

**API Layer**:
1. ✅ Updated POST `/api/social-media/images/generate`
   - Replaced `referenceImageIds` + `remixImageIds` parameters → `referenceSources`
   - Mode validation updated: only accepts 'uploaded', 'text-to-image', 'reference-images'
   - Comprehensive validation for `referenceSources` array structure
   - Validates each source has `id` and `sourceType` properties

2. ✅ Updated POST `/api/social-media/generate` (video)
   - Made `inputSource.sourceType` REQUIRED
   - Added validation for sourceType: must be 'menu', 'ai', 'uploaded', or 'logo'

**Frontend Components**:
1. ✅ Updated `ImageModeSelector.tsx`
   - Consolidated from 4 modes → 3 modes
   - New "Reference Images" mode with Sparkles icon
   - Description: "Blend multiple images together or use a single image as a reference"

2. ✅ Created `UnifiedReferenceImageSelector.tsx` (NEW)
   - **4 Tabbed Image Sources**:
     - 📸 Menu - From `item_images` table
     - ✨ AI - AI-generated images only (excludes uploaded)
     - 📤 Uploaded - User-uploaded images only
     - 🏢 Logos - Restaurant logos from `restaurants` table
   - Restaurant filtering across all tabs
   - Search filtering by name/prompt
   - Visual selection order indicators (1, 2, 3...)
   - Returns `ImageSource[]` array with `{ id, sourceType }` structure

3. ✅ Updated `ImagesTab.tsx`
   - Replaced `referenceImageIds` + `remixImageIds` state → `referenceSources: ImageSource[]`
   - Updated validation for unified 'reference-images' mode
   - API request now sends `referenceSources` array
   - Single `UnifiedReferenceImageSelector` component replaces two separate selectors

4. ✅ Updated `VideosTab.tsx`
   - Added 'uploaded' to allowed source types
   - `imageSourceType` now accepts: 'menu', 'ai', 'uploaded', 'logo'
   - Already had source type support, just extended for 'uploaded'

**Files Created/Modified**:
```
✅ Database Migrations: 3 migrations applied
✅ Service: src/services/social-media/image-fetcher-service.js (NEW - 289 lines)
✅ Service: src/services/social-media/image-generation-service.js (UPDATED)
✅ Service: src/services/social-media/video-generation-service.js (UPDATED)
✅ Routes: src/routes/social-media-routes.js (UPDATED - both endpoints)
✅ Component: src/components/social-media/ImageModeSelector.tsx (UPDATED)
✅ Component: src/components/social-media/UnifiedReferenceImageSelector.tsx (NEW - 344 lines)
✅ Page: src/pages/social-media/ImagesTab.tsx (UPDATED)
✅ Page: src/pages/social-media/VideosTab.tsx (UPDATED)
```

**Impact**: ✅ **HIGH** - Users can now:
- Select from any combination of menu images, logos, AI-generated images, and uploaded images
- All 4 image sources work in both image generation and video generation
- Clear visual separation of image types with tabbed interface
- Consistent experience across image and video generation workflows
- Future-proof architecture with JSONB source metadata

**Time Taken**: ~2 hours (database + services + API + UI)

---

**Priority Order** (Updated):
1. ~~Issue #3 (High)~~ ✅ COMPLETE - Unification of image reference modes
2. ~~Issue #2 (High)~~ ✅ COMPLETE - Image upload UI improvements
3. ~~Issue #1 (Medium)~~ ✅ COMPLETE - Restaurant manual selection

**All Known Issues Resolved!** ✅

**Total Time Taken for All Issues**: ~4 hours
- Issue #3: ~2 hours (Image reference mode unification)
- Issue #2: ~1.5 hours (Image upload UI improvements)
- Issue #1: ~0.5 hours (Restaurant manual selection)

---

**Testing Status** ✅:
1. ✅ Image preview dialog - Fixed and working
2. ✅ Logo images as reference - Available in image generation
3. ✅ AI images in video selection - Tabbed interface working
4. ✅ Uploaded images for video - Multi-source support working
5. ✅ Image reference mode unification - Database, services, API, UI all updated
6. ✅ Restaurant manual selection - Available in both image and video generation
7. ✅ Image upload UI improvements - Drag-and-drop, multi-file, simplified UI
8. ⏸️ End-to-end image generation testing - Still needed
9. ⏸️ Multi-image composition testing - Still needed (now with 4 sources!)
10. ⏸️ Performance testing - Still needed

**Remaining Testing Required** ⏸️:
1. Test text-to-image generation
2. Test unified reference-images mode with mixed sources:
   - 1+ menu images + logos
   - AI images + uploaded images + logos
   - All 4 source types in one composition
3. Test file upload mode:
   - ✅ Single file upload
   - ✅ Multi-file upload (batch)
   - ✅ Drag-and-drop functionality
   - Restaurant association with uploads
4. Test video generation with all 4 image sources (menu, AI, uploaded, logo)
5. Test restaurant filtering across all modes
6. Test restaurant manual selection:
   - Image generation with restaurant selected
   - Video generation with restaurant selected
   - Verify restaurant_id stored in database
7. Performance testing with multiple generations
8. Verify backwards compatibility with existing records
9. **NEW**: Test upload UI improvements:
   - Upload button visibility in list view
   - Simplified UI in upload mode (AI components hidden)
   - Multi-file selection and batch processing
   - Success/error feedback for batch uploads

---

### Step 4.9: Intelligent Prompt Builders ⏸️ NEW

**Objective**: Create interactive prompt building tools with best practices for video and image generation.

#### Research Phase:

**Tasks**:
1. Research Sora 2 prompt best practices
   - Camera movements (zoom, pan, orbit, tracking, dolly)
   - Lighting styles (warm, cool, dramatic, soft, natural, cinematic)
   - Shot types (close-up, wide, medium, extreme close-up, overhead)
   - Effects (bokeh, depth of field, motion blur, time-lapse)

2. Research Gemini image generation best practices
   - Composition rules (rule of thirds, symmetry, leading lines)
   - Photography styles (product, editorial, lifestyle, flat-lay)
   - Color palettes (vibrant, muted, monochrome, complementary)
   - Lighting setups (studio, natural, dramatic, soft)

**Documentation**: Create `/planning/social-media-content-generation/prompt-builder-guide.md`

#### Implementation:

**Video Prompt Builder**:

**File**: `src/components/social-media/VideoPromptBuilder.tsx`

```typescript
interface PromptBuilderOptions {
  subject: string; // User input
  cameraMovement: 'static' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'orbit' | 'tracking' | 'dolly';
  shotType: 'close-up' | 'medium' | 'wide' | 'extreme-close-up' | 'overhead' | 'low-angle' | 'high-angle';
  lighting: 'warm' | 'cool' | 'dramatic' | 'soft' | 'natural' | 'cinematic' | 'moody';
  effects: ('bokeh' | 'depth-of-field' | 'motion-blur' | 'slow-motion')[];
  mood: string; // Optional user input
}

function buildVideoPrompt(options: PromptBuilderOptions): string {
  const parts = [];

  // Shot type
  if (options.shotType !== 'medium') {
    parts.push(`${options.shotType} shot of`);
  }

  // Subject
  parts.push(options.subject);

  // Camera movement
  const movements = {
    'zoom-in': 'camera slowly zooms in',
    'zoom-out': 'camera pulls back',
    'pan-left': 'camera pans left',
    'pan-right': 'camera pans right',
    'orbit': 'camera orbits around the subject',
    'tracking': 'camera tracks alongside',
    'dolly': 'camera dollies forward'
  };
  if (options.cameraMovement !== 'static') {
    parts.push(movements[options.cameraMovement]);
  }

  // Lighting
  const lightingDescriptions = {
    'warm': 'warm, golden lighting',
    'cool': 'cool, blue-toned lighting',
    'dramatic': 'dramatic, high-contrast lighting',
    'soft': 'soft, diffused lighting',
    'natural': 'natural daylight',
    'cinematic': 'cinematic lighting',
    'moody': 'moody, atmospheric lighting'
  };
  parts.push(lightingDescriptions[options.lighting]);

  // Effects
  if (options.effects.includes('bokeh')) parts.push('bokeh effect in background');
  if (options.effects.includes('depth-of-field')) parts.push('shallow depth of field');
  if (options.effects.includes('motion-blur')) parts.push('subtle motion blur');
  if (options.effects.includes('slow-motion')) parts.push('slow motion');

  // Mood
  if (options.mood) {
    parts.push(options.mood);
  }

  return parts.join(', ') + '.';
}
```

**UI Layout**:
- Toggle between "Simple" (direct text input) and "Guided" (builder interface)
- Guided mode shows:
  - Subject input field
  - Camera movement dropdown/buttons
  - Shot type buttons with icons
  - Lighting style buttons with color indicators
  - Effects checkboxes
  - Mood input (optional)
  - Live preview of generated prompt
  - "Use This Prompt" button to populate main prompt field

**Image Prompt Builder**:

**File**: `src/components/social-media/ImagePromptBuilder.tsx`

```typescript
interface ImagePromptOptions {
  subject: string;
  style: 'product' | 'editorial' | 'lifestyle' | 'flat-lay' | 'architectural';
  composition: 'centered' | 'rule-of-thirds' | 'symmetrical' | 'leading-lines';
  lighting: 'studio' | 'natural' | 'dramatic' | 'soft' | 'backlit' | 'golden-hour';
  colorPalette: 'vibrant' | 'muted' | 'monochrome' | 'warm' | 'cool' | 'complementary';
  details: string[]; // User-added details
}

function buildImagePrompt(options: ImagePromptOptions): string {
  const parts = [];

  // Style prefix
  const styles = {
    'product': 'Professional product photography of',
    'editorial': 'Editorial-style photograph of',
    'lifestyle': 'Lifestyle photography featuring',
    'flat-lay': 'Flat-lay composition of',
    'architectural': 'Architectural photograph of'
  };
  parts.push(styles[options.style]);

  // Subject
  parts.push(options.subject);

  // Composition
  const compositions = {
    'centered': 'centered composition',
    'rule-of-thirds': 'following rule of thirds',
    'symmetrical': 'symmetrical composition',
    'leading-lines': 'with leading lines'
  };
  parts.push(compositions[options.composition]);

  // Lighting
  const lightingDescriptions = {
    'studio': 'studio lighting setup',
    'natural': 'natural window light',
    'dramatic': 'dramatic side lighting',
    'soft': 'soft, diffused lighting',
    'backlit': 'beautifully backlit',
    'golden-hour': 'golden hour lighting'
  };
  parts.push(lightingDescriptions[options.lighting]);

  // Color palette
  const palettes = {
    'vibrant': 'vibrant, saturated colors',
    'muted': 'muted, pastel color palette',
    'monochrome': 'monochromatic color scheme',
    'warm': 'warm color tones',
    'cool': 'cool color tones',
    'complementary': 'complementary color scheme'
  };
  parts.push(palettes[options.colorPalette]);

  // Details
  if (options.details.length > 0) {
    parts.push(...options.details);
  }

  // Quality suffix
  parts.push('high resolution, professional quality');

  return parts.join(', ') + '.';
}
```

**Integration**:
- Add "Prompt Builder" button/icon next to prompt input fields
- Opens a modal/drawer with the builder interface
- Supports both video and image prompts
- Save builder presets for quick reuse
- "Copy to Prompt" button transfers built prompt to main field

**Deliverable**: ⏸️ Intelligent prompt builders with best practices

---

### Step 4.10: Integration and Testing ⏸️ NEW

**Tasks**:
1. Update navigation to use centralized dashboard
2. Migrate existing `/social-media/videos` and `/social-media/generate` to dashboard tabs
3. Test all view state transitions
4. Test image generation flow end-to-end
5. Test prompt builders with real generation
6. Verify restaurant filtering across all components
7. Performance test with large datasets

**Deliverable**: ⏸️ All Phase 4 features integrated and tested

---

## Phase 5: Voice-Over Integration (Optional - Future Enhancement)

**Estimated Time**: 3-5 hours

**Note**: This phase can be implemented after Phase 4 is complete and tested. It's optional for the initial release.

### Prerequisites

1. Add ElevenLabs API key to `.env`:
```bash
# ElevenLabs API (Phase 5)
ELEVENLABS_API_KEY=sk_...
```

2. Install additional dependencies:
```bash
npm install fluent-ffmpeg axios
# Also install FFmpeg system binary if not present
```

### Step 5.1: Create ElevenLabsService

**File**: `UberEats-Image-Extractor/src/services/social-media/elevenlabs-service.js`

1. Implement `ElevenLabsService` class (see `service-layer.md`)
2. Test text-to-speech:

```javascript
const service = new ElevenLabsService();
const audioBuffer = await service.textToSpeech({
  text: 'Welcome to our restaurant! Try our delicious burgers.',
  voiceId: '21m00Tcm4TlvDq8ikWAM', // Example voice ID
  modelId: 'eleven_flash_v2_5'
});
console.log('Generated audio:', audioBuffer.length, 'bytes');
```

**Deliverable**: ✅ ElevenLabsService can generate speech

### Step 5.2: Create VideoProcessingService

**File**: `UberEats-Image-Extractor/src/services/social-media/video-processing-service.js`

1. Implement `VideoProcessingService` class with FFmpeg
2. Test audio overlay:

```javascript
const service = new VideoProcessingService();
const finalVideo = await service.overlayAudio(
  videoBuffer,
  audioBuffer,
  'test-job-id'
);
console.log('Final video with audio:', finalVideo.length, 'bytes');
```

**Deliverable**: ✅ VideoProcessingService can overlay audio

### Step 5.3: Update VideoGenerationService

Update the existing `VideoGenerationService` to:

1. Add ElevenLabsService and VideoProcessingService dependencies
2. Implement `handleVoiceOver()` method
3. Call `handleVoiceOver()` when `voiceConfig.enabled` is true

**Deliverable**: ✅ Voice-over integrated into generation flow

### Step 5.4: Add Voice API Endpoints

**File**: `UberEats-Image-Extractor/src/routes/social-media-routes.js`

Add three new endpoints:

1. `GET /api/social-media/voices` - List available voices
2. `GET /api/social-media/voices/:voiceId` - Get voice details
3. `POST /api/social-media/voices/:voiceId/preview` - Preview voice

**Deliverable**: ✅ Voice endpoints working

### Step 5.5: Add Voice UI Components

Create components in this order:

1. **VoiceSettings** - Advanced voice parameter controls
2. **VoiceSelector** - Browse and preview voices
3. **VoiceConfigForm** - Main voice configuration UI

Update existing components:

1. **VideoGeneration** - Add VoiceConfigForm
2. **VideoPreview** - Use `final_video_url` when voice-over enabled

**Deliverable**: ✅ Voice-over UI functional

### Step 5.6: Test Voice-Over Integration

Test complete flow:

1. Generate a text-to-video
2. Enable voice-over toggle
3. Enter narration script
4. Select voice and model
5. Generate video with voice-over
6. Verify audio overlay in final video
7. Test download of final video

**Deliverable**: ✅ Voice-over working end-to-end

---

## Phase 6: Testing

**Estimated Time**: 2-4 hours

### Test Scenarios

#### Mode 1: Database Image → Video

1. Select an existing menu image
2. Enter prompt: "The burger sizzles, steam rises"
3. Generate video
4. Verify video uses image as first frame

#### Mode 2: Text → Video

1. Enter prompt: "Cozy restaurant interior, warm lighting"
2. Generate video
3. Verify video matches description

#### Mode 3: Generated Image → Video

1. Image prompt: "Professional taco platter photo"
2. Video prompt: "Camera orbits around the dish"
3. Generate video
4. Verify image generation, then video creation

#### Error Scenarios

1. Test with empty prompt (should fail validation)
2. Test with invalid API key (should fail gracefully)
3. Test with copyrighted content prompt (should reject)
4. Test polling timeout scenario

### Performance Testing

1. Generate multiple videos simultaneously
2. Verify polling doesn't overload server
3. Test with both sora-2 and sora-2-pro models
4. Measure generation times

**Deliverable**: ✅ All modes tested and working

---

## Phase 7: Refinement & Optimization

**Estimated Time**: 2-3 hours

### Step 6.1: Add Error Messages

Improve user-facing error messages:
- API rate limits
- Content policy violations
- Timeout errors

### Step 6.2: Add Loading States

Ensure all async operations show loading indicators:
- Image selector loading
- Video generation progress
- Status refresh

### Step 6.3: Add Confirmation Dialogs

- Confirm before deleting videos
- Warn about generation costs

### Step 6.4: Optimize Polling

Consider implementing:
- Exponential backoff
- WebSocket updates (future)
- Better error retry logic

### Step 6.5: Add Analytics

Track:
- Generation success rate
- Average generation time
- Most used mode
- Error types

**Deliverable**: ✅ Production-ready feature

---

## Testing Checklist

Use this checklist to verify implementation:

### Database (Phase 1) ✅ COMPLETE
- [x] Table `social_media_videos` exists
- [x] All indexes created
- [x] RLS policies working
- [x] Triggers firing correctly
- [x] Storage bucket created

### Services (Phase 2) ✅ COMPLETE
- [x] SoraService creates videos
- [x] SoraService checks status
- [x] SoraService downloads videos
- [x] GeminiImageService generates images
- [x] SocialStorageService CRUD operations work
- [x] VideoGenerationService orchestrates all modes
- [x] Polling mechanism works
- [x] **Portrait/Landscape Support**: Image resizing with sharp
- [x] **Aspect Ratio Detection**: Auto-detect from videoConfig.size
- [ ] ElevenLabsService generates speech (Phase 5 - Future)
- [ ] VideoProcessingService overlays audio (Phase 5 - Future)
- [ ] Voice-over integration works end-to-end (Phase 5 - Future)

### API (Phase 3) ✅ COMPLETE
- [x] POST /generate creates jobs
- [x] GET /videos/:id/status returns status
- [x] POST /videos/:id/refresh updates status
- [x] GET /videos lists all videos
- [x] DELETE /videos/:id deletes video
- [x] GET /videos/:id returns full details
- [x] Authentication required (authMiddleware)
- [x] Error handling works
- [x] Input validation (mode, prompt, videoConfig)
- [x] Organization-based access control
- [ ] GET /voices lists available voices (Phase 5 - Future)
- [ ] GET /voices/:id returns voice details (Phase 5 - Future)
- [ ] POST /voices/:id/preview generates preview (Phase 5 - Future)

### UI (Phase 4) ⏸️ NOT STARTED
- [ ] Can navigate to social media section
- [ ] Mode selector changes UI correctly
- [ ] Prompt input validates
- [ ] Image selector loads images (Mode 1)
- [ ] Video generation starts job
- [ ] Status updates automatically
- [ ] Completed videos play
- [ ] Can download videos
- [ ] Can delete videos
- [ ] **VideoConfigForm**: Landscape/Portrait tabs working
- [ ] **VideoConfigForm**: Orientation switching updates size options
- [ ] Voice-over toggle works (Phase 5 - Future)
- [ ] Voice selector shows available voices (Phase 5 - Future)
- [ ] Voice preview plays audio (Phase 5 - Future)
- [ ] Voice settings adjust parameters (Phase 5 - Future)
- [ ] Final video plays with audio overlay (Phase 5 - Future)

### Integration Testing ⏸️ PARTIAL
- [ ] Mode 1 works end-to-end (Not tested)
- [x] Mode 2 works end-to-end (Tested successfully)
- [x] Mode 3 works end-to-end (Tested successfully with portrait/landscape)
- [ ] Voice-over works with all modes (Phase 5 - Future)
- [ ] Error scenarios handled gracefully (Needs UI testing)
- [ ] Performance acceptable (Needs load testing)

---

## Deployment Checklist

Before deploying to production:

### Environment
- [ ] API keys set in production environment
- [ ] Database migration run on production
- [ ] Storage bucket created in production
- [ ] RLS policies verified

### Security
- [ ] API keys not committed to git
- [ ] RLS policies tested
- [ ] Rate limiting configured
- [ ] Content moderation enabled

### Monitoring
- [ ] Error logging configured
- [ ] Analytics tracking set up
- [ ] Performance monitoring enabled

### Documentation
- [ ] User guide created
- [ ] API documentation updated
- [ ] Known issues documented

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Database | 30 min | None |
| Phase 2: Services | 4-6 hrs | Phase 1 |
| Phase 3: API | 2-3 hrs | Phase 2 |
| Phase 4: UI | 4-6 hrs | Phase 3 |
| Phase 5: Voice-Over (Optional) | 3-5 hrs | Phase 4 |
| Phase 6: Testing | 2-4 hrs | Phase 4 or 5 |
| Phase 7: Refinement | 2-3 hrs | Phase 6 |
| **Total (without voice-over)** | **15-22 hrs** | |
| **Total (with voice-over)** | **18-27 hrs** | |

For a focused full day of work, core features can be completed in 2-3 days. With voice-over integration, allow 3-4 days.

---

## Troubleshooting

### Common Issues

**Issue**: OpenAI API returns 401
- **Solution**: Verify OPENAI_API_KEY is correct and has billing enabled

**Issue**: Gemini API returns quota exceeded
- **Solution**: Check Google Cloud Console for quota limits

**Issue**: Videos not downloading
- **Solution**: Check Supabase storage bucket permissions

**Issue**: Polling doesn't update UI
- **Solution**: Verify WebSocket connection or increase polling frequency

**Issue**: RLS policies blocking access
- **Solution**: Verify user is in correct organization

---

## Next Steps After Implementation

After completing Phases 1-7 (including optional Phase 5 voice-over):

1. **Templates**: Add predefined prompt templates for common video types
2. **Webhooks**: Implement webhook support for real-time generation updates
3. **Batch Generation**: Allow generating multiple videos at once
4. **Scheduling**: Schedule video generation for specific times
5. **Remix**: Implement video remixing and variation features
6. **Analytics Dashboard**: Track usage, costs, and generation metrics
7. **Social Media Integration**: Direct posting to Instagram, TikTok, YouTube Shorts
8. **Voice Cloning**: Custom voice cloning for brand-specific narration (ElevenLabs Pro)

---

## 🎯 HANDOFF SUMMARY

### Current Status: Phase 4 Core UI Complete, Additional Features Pending

**What's Done** ✅:
- ✅ **Phase 1**: Database (table, indexes, RLS, triggers, storage bucket)
- ✅ **Phase 2**: Core Services (Sora, Gemini, Storage, VideoGeneration with portrait/landscape)
- ✅ **Phase 3**: API Layer (6 REST endpoints with auth, validation, error handling)
- ✅ **Phase 4 (Core)**: UI Components complete (Steps 4.1-4.5)
  - ✅ React hook `useSocialMedia.ts` with all API methods
  - ✅ 7 reusable components (ModeSelector, VideoPromptInput, ModelSelector, VideoConfigForm, ImageSelector, VideoJobStatus, VideoPreview)
  - ✅ 2 pages (VideoGeneration, SocialMediaVideos)
  - ✅ Navigation integrated (sidebar menu item, routes)
  - ✅ Restaurant filtering added to ImageSelector and SocialMediaVideos
  - ✅ `/api/menus/images` endpoint for image selection

**What's Next** 🚀:
- 🚧 **Phase 4 (Additional Features)**: Steps 4.8-4.10 (0.5-2 hours remaining)
  - ✅ Step 4.7: Centralized Social Media Dashboard (tabbed interface) - COMPLETE
  - ✅ Step 4.8: Standalone Image Generation - COMPLETE (with 4 critical bug fixes applied)
  - ⏸️ Step 4.9: Intelligent Prompt Builders (video & image) - OPTIONAL
  - 🚧 Step 4.10: Integration and Testing - IN PROGRESS (end-to-end testing needed)
- 🔜 **Phase 5**: Voice-Over Integration (Optional - future enhancement)
- 🔜 **Phase 6**: Testing (comprehensive end-to-end testing)
- 🔜 **Phase 7**: Refinement (polish, optimization, analytics)

**For Next Developer - Starting Phase 4 Additional Features**:

1. **Read Reference Files First** (CRITICAL):
   - `/Users/giannimunro/Desktop/cursor-projects/pumpd-webhook/src/components/sms/dashboard/improved/SmsDashboard.tsx`
     - Study tab structure, URL search params, responsive layouts
   - `/Users/giannimunro/Desktop/cursor-projects/pumpd-webhook/src/components/sms/dashboard/improved/tabs/TriggersTab.tsx`
     - Study view state management (`list`, `create`, `edit` patterns)
     - Note component switching between views

2. **Review Current Implementation**:
   - `src/hooks/useSocialMedia.ts` - API integration hook
   - `src/components/social-media/` - All 7 core components
   - `src/pages/VideoGeneration.tsx` - Video generation form
   - `src/pages/SocialMediaVideos.tsx` - Videos list page

3. **Implementation Order for Additional Features**:
   - Step 4.7: Create `SocialMediaDashboard.tsx` with tabbed interface
   - Step 4.7: Refactor existing pages → `VideosTab.tsx` component
   - Step 4.8: Create database schema for `social_media_images`
   - Step 4.8: Implement image generation service & API
   - Step 4.8: Build `ImagesTab.tsx` with generation form
   - Step 4.9: Research prompt best practices, create builder components
   - Step 4.10: Integration testing

4. **Key Architecture Decisions**:
   - Main route changes: `/social-media` becomes dashboard entry point
   - Tab routing: `/social-media?tab=videos` (URL search params)
   - View states: `list`, `create`, `preview` (following SMS pattern)
   - Image storage: Reuse `social-media-videos` bucket with new paths
   - Prompt builders: Modal/drawer interface with live preview

**Key Files Created (Phase 4 Core)**:
```
UberEats-Image-Extractor/
├── src/
│   ├── hooks/
│   │   └── useSocialMedia.ts                    ✅ COMPLETE
│   ├── components/social-media/
│   │   ├── ModeSelector.tsx                     ✅ COMPLETE
│   │   ├── VideoPromptInput.tsx                 ✅ COMPLETE
│   │   ├── ModelSelector.tsx                    ✅ COMPLETE
│   │   ├── VideoConfigForm.tsx                  ✅ COMPLETE (portrait/landscape)
│   │   ├── ImageSelector.tsx                    ✅ COMPLETE (+ restaurant filter)
│   │   ├── VideoJobStatus.tsx                   ✅ COMPLETE
│   │   ├── VideoPreview.tsx                     ✅ COMPLETE
│   │   └── index.ts                             ✅ COMPLETE
│   ├── pages/
│   │   ├── VideoGeneration.tsx                  ✅ COMPLETE
│   │   └── SocialMediaVideos.tsx                ✅ COMPLETE (+ restaurant filter)
│   └── routes/
│       └── social-media-routes.js               ✅ COMPLETE (Phase 3)
└── server.js                                     ✅ UPDATED (line 3505: /api/menus/images)
```

**Files Created (Phase 4 Additional)**:
```
UberEats-Image-Extractor/
├── src/
│   ├── pages/
│   │   └── SocialMediaDashboard.tsx             ✅ Step 4.7 COMPLETE
│   ├── pages/social-media/
│   │   ├── VideosTab.tsx                        ✅ Step 4.7 COMPLETE
│   │   ├── ImagesTab.tsx                        ✅ Step 4.8 COMPLETE (828 lines)
│   │   ├── ManageTab.tsx                        ✅ Step 4.7 COMPLETE (placeholder)
│   │   ├── PostsTab.tsx                         ✅ Step 4.7 COMPLETE (placeholder)
│   │   └── PerformanceTab.tsx                   ✅ Step 4.7 COMPLETE (placeholder)
│   ├── components/social-media/
│   │   ├── VideoPromptBuilder.tsx               ⏸️ Step 4.9 (optional)
│   │   ├── ImagePromptBuilder.tsx               ⏸️ Step 4.9 (optional)
│   │   ├── ImageModeSelector.tsx                ✅ Step 4.8 COMPLETE
│   │   ├── ImageModelSelector.tsx               ✅ Step 4.8 COMPLETE
│   │   ├── ImageConfigForm.tsx                  ✅ Step 4.8 COMPLETE
│   │   └── ReferenceImageSelector.tsx           ✅ Step 4.8 COMPLETE
│   └── services/social-media/
│       └── image-generation-service.js          ✅ Step 4.8 COMPLETE (520 lines)
└── planning/social-media-content-generation/
    └── prompt-builder-guide.md                  ⏸️ Step 4.9 (optional - research doc)
```

**Database Changes Needed**:
- Create `social_media_images` table (see Step 4.8 for schema)
- Add indexes and RLS policies
- Setup storage paths in existing bucket

**API Endpoints to Create**:
- `POST /api/social-media/images/generate` - Generate image
- `GET /api/social-media/images` - List images (with filters)
- `GET /api/social-media/images/:id/status` - Get status
- `GET /api/social-media/images/:id` - Get details
- `POST /api/social-media/images/:id/refresh` - Force refresh
- `DELETE /api/social-media/images/:id` - Delete image
- `POST /api/social-media/images/upload` - Upload existing image

**Time Estimates**:
- Phase 4 Core (Complete): ~3 hours ✅
- Phase 4 Additional: ~6-8 hours (6 hours complete, 0.5-2 hours remaining)
  - Step 4.7 (Dashboard): 2 hours ✅ COMPLETE
  - Step 4.8 (Image Gen): 4 hours ✅ COMPLETE (implementation + bug fixes)
    - Initial implementation: 3 hours
    - Critical bug fixes: 1 hour (4 fixes applied)
  - Step 4.9 (Prompt Builders): 2-3 hours ⏸️ OPTIONAL
  - Step 4.10 (Testing): 0.5-2 hours 🚧 IN PROGRESS

**Server Info**:
- Port: 3007
- API Base: `/api/social-media`
- Auth: Required (authMiddleware provides `req.user.organisationId` and `req.user.id`)
- Images API: `/api/menus/images` (existing - for ImageSelector)

**Testing Strategy (Step 4.10 - Current Priority)**:
1. ✅ Test core video generation (Modes 1, 2, 3) - Previously tested
2. ✅ Test restaurant filtering in image selection - Implemented
3. ✅ Test dashboard tab switching and URL persistence - Working
4. ✅ **Bug Fixes Applied** (2025-10-10):
   - ✅ Fixed image preview dialog sizing and scrolling
   - ✅ Added logo images to reference image selection
   - ✅ Added AI-generated images to video generation selector (tabbed interface)
   - ✅ Fixed uploaded images not working in video generation (multi-source support)
5. ⏸️ **Test image generation flow end-to-end** - NEXT PRIORITY
   - Navigate to `/social-media?tab=images`
   - Test text-to-image mode
   - Test image-reference mode with menu images AND logos
   - Test remix mode with AI images AND logos
   - Test uploaded mode with file upload
   - Verify image preview and download work with fixes
   - Test deletion workflow
6. ⏸️ **Test video generation with all image sources** - HIGH PRIORITY
   - Test video from menu images (existing)
   - Test video from AI-generated images (NEW - just fixed)
   - Test video from uploaded images (NEW - just fixed)
   - Test video from logo images (NEW - just fixed)
7. ⏸️ Performance test with large image/video datasets
8. ⏸️ (Optional) Test prompt builders with actual generation

**Immediate Next Steps**:
1. Start server: `cd UberEats-Image-Extractor && npm start`
2. Navigate to `/social-media?tab=images`
3. Test each generation mode systematically
4. Document and fix any issues found
5. Verify all 4 modes work correctly:
   - `uploaded`: Direct file upload
   - `text-to-image`: AI generation from text
   - `image-reference`: Use 1+ menu images as reference
   - `remix`: Blend 2+ AI images together

**Known Testing Requirements**:
- Verify Gemini API key is configured in `.env`
- ✅ Multi-image selection in ReferenceImageSelector - Working with logos
- ✅ Logo images available in reference selection - Fixed
- ✅ AI images available in video generation - Fixed with tabbed interface
- ✅ Uploaded images work in video generation - Fixed with multi-source support
- ✅ Image preview dialog sizing - Fixed with scrollable container
- Verify storage bucket paths work correctly
- Test organization-based access control
- Verify thumbnail generation
- Test all error scenarios (quota exceeded, invalid input, etc.)
- Test video generation with all 3 image sources (menu, AI, logo)

**Recent Changes Log**:
- **2025-10-10 (Evening)**: ✅ **COMPLETED All Remaining Issues (#1, #2, #3)**
  - **Issue #1 - Restaurant Manual Selection**: Added restaurant dropdown to both ImagesTab and VideosTab
  - **Issue #2 - Image Upload UI Improvements**:
    - Created FileUploadDropzone component with drag-and-drop support
    - Added "Upload Image" button to main list view
    - Simplified upload mode UI (hides irrelevant AI components)
    - Multi-file batch upload support (up to 10 files)
    - Restaurant association for uploads
  - **Result**: All known UI/UX issues resolved, system ready for comprehensive testing
- **2025-10-10 (Afternoon)**: ✅ **COMPLETED Issue #3 - Image Reference Mode Unification**
  - Applied 3 database migrations (reference_image_sources, source_image_type, mode consolidation)
  - Created ImageFetcherService for unified image fetching (289 lines)
  - Updated ImageGenerationService and VideoGenerationService to use new architecture
  - Updated API endpoints for both image and video generation
  - Created UnifiedReferenceImageSelector component with 4 tabbed sources (344 lines)
  - Updated ImageModeSelector to consolidate modes
  - Updated ImagesTab and VideosTab to use new unified approach
  - **Result**: Users can now select from any combination of menu, AI, uploaded, and logo images
- **2025-10-10 (Morning)**: Applied 4 critical bug fixes to Step 4.8
  - Fix #1: Image preview dialog now scrollable with proper sizing
  - Fix #2: Logo images now available as reference images (new API endpoint)
  - Fix #3: Video generation selector now includes AI images and logos (tabbed interface)
  - Fix #4: Uploaded/AI-generated images now work in video generation (multi-source support)
- **2025-10-09**: Step 4.7 and 4.8 initial implementation completed
- **2025-10-08**: Phases 1-3 and Phase 4 (Steps 4.1-4.6) completed

---

**Last Updated**: 2025-10-10 (Phase 4: All Issues Resolved - Ready for Testing)
