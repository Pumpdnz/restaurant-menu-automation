# Social Media Video Generation - Phase 1 & 2 Implementation

## Overview

This document describes the completed implementation of Phase 1 (Database Setup) and Phase 2 (Core Services) for the Social Media Video Generation feature.

## What Was Implemented

### Phase 1: Database Setup ✅

1. **Database Table**: Created `social_media_videos` table with:
   - All core fields for video generation tracking
   - Voice-over fields (nullable) for future Phase 5
   - Proper foreign key relationships
   - Check constraints for data validation

2. **Indexes**: Created performance indexes for:
   - Organisation + status queries
   - Sora video ID lookups
   - Restaurant-specific queries
   - Status-based queries
   - Voice-enabled queries

3. **RLS Policies**: Implemented row-level security:
   - Users can only access videos in their organisation
   - Policies for SELECT, INSERT, UPDATE, DELETE operations

4. **Storage Bucket**: Created `social-media-videos` bucket with:
   - Public access for generated videos
   - Authenticated user policies
   - Proper directory structure:
     - `{org_id}/videos/` - Generated videos
     - `{org_id}/thumbnails/` - Video thumbnails
     - `{org_id}/generated-images/` - AI-generated images (Mode 3)

### Phase 2: Core Services ✅

Implemented 4 main services:

#### 1. SoraService (`src/services/social-media/sora-service.js`)

OpenAI Sora 2 API wrapper with methods for:
- `createVideo()` - Start video generation
- `checkStatus()` - Poll video status
- `downloadVideo()` - Download completed video
- `downloadThumbnail()` - Download video thumbnail
- `downloadSpritesheet()` - Download frame spritesheet
- `deleteVideo()` - Delete from OpenAI storage
- `createAndPoll()` - Convenience method with automatic polling

**Features**:
- Comprehensive error handling
- Support for both `sora-2` and `sora-2-pro` models
- Support for image-to-video (Mode 1 & 3)
- Detailed logging

#### 2. GeminiImageService (`src/services/social-media/gemini-image-service.js`)

Google Gemini 2.5 Flash Image API wrapper with methods for:
- `generateImage()` - Generate image from text
- `enhancePrompt()` - Add quality modifiers to prompts
- `validateImage()` - Validate PNG format
- `generateWithRetry()` - Generate with automatic retry logic

**Features**:
- Automatic prompt enhancement
- Food-specific prompt improvements
- Image validation
- Exponential backoff retry logic
- Support for aspect ratio hints

#### 3. SocialStorageService (`src/services/social-media/social-storage-service.js`)

Database and Supabase Storage operations with methods for:
- `createJob()` - Create new job record
- `updateJob()` - Update job status
- `getJob()` - Fetch job by ID
- `listJobs()` - List jobs with filtering
- `deleteJob()` - Delete job record
- `uploadVideo()` - Upload video to storage
- `uploadThumbnail()` - Upload thumbnail
- `uploadGeneratedImage()` - Upload AI-generated image
- `getMenuItemImage()` - Fetch database image
- `deleteJobAssets()` - Clean up all storage files

**Features**:
- Automatic organization-based file paths
- Public URL generation
- Comprehensive filtering
- Proper error handling
- Support for final videos with voice-over

#### 4. VideoGenerationService (`src/services/social-media/video-generation-service.js`)

Main orchestrator coordinating all services with methods for:
- `generateVideo()` - Main entry point for all 3 modes
- `handleMode1()` - Database image workflow
- `handleMode3()` - AI image generation workflow
- `pollJobCompletion()` - Background polling with 10s intervals
- `getJobStatus()` - Get current job status
- `refreshJobStatus()` - Force status refresh
- `listVideos()` - List videos with filters
- `deleteVideo()` - Delete video and assets
- `stopPolling()` - Stop background polling

**Features**:
- Automatic background polling (10 second intervals)
- 1 hour timeout protection
- Comprehensive error handling
- Progress tracking
- Support for all 3 generation modes

## File Structure

```
UberEats-Image-Extractor/
├── src/
│   └── services/
│       └── social-media/
│           ├── sora-service.js                 # OpenAI Sora 2 wrapper
│           ├── gemini-image-service.js         # Google Gemini wrapper
│           ├── social-storage-service.js       # Database & storage
│           └── video-generation-service.js     # Main orchestrator
│
├── test-social-media-services.js               # Test script
└── SOCIAL_MEDIA_IMPLEMENTATION.md              # This file
```

## Testing the Implementation

### Prerequisites

1. **Install Required Packages**:
```bash
cd UberEats-Image-Extractor
npm install openai @google/generative-ai axios
```

2. **Add Required Environment Variables to `.env`**:
```bash
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI Sora 2 API (Required)
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# Google Gemini API (Required for Mode 3)
GOOGLE_GENAI_API_KEY=YOUR_KEY_HERE

# Optional: Test IDs
TEST_ORG_ID=your-org-id
TEST_USER_ID=your-user-id
TEST_IMAGE_ID=your-image-id  # For Mode 1 testing
```

### Running Tests

The test script supports all three generation modes:

```bash
# Mode 2: Text → Video (Simplest, recommended for first test)
node test-social-media-services.js mode2

# Mode 1: Database Image → Video (requires TEST_IMAGE_ID)
node test-social-media-services.js mode1

# Mode 3: AI Generated Image → Video (requires both APIs)
node test-social-media-services.js mode3

# Check status of a specific job
node test-social-media-services.js status <job-id>

# List all videos
node test-social-media-services.js list

# Show help
node test-social-media-services.js help
```

### Expected Behavior

1. **Job Creation**: Script creates a job and returns immediately with job ID
2. **Background Polling**: Service polls Sora API every 10 seconds
3. **Video Generation**: Takes 2-5 minutes for `sora-2`, 5-15 minutes for `sora-2-pro`
4. **Completion**: Video and thumbnail automatically uploaded to Supabase Storage
5. **Database Update**: Job status updated to `completed` with URLs

### Checking Job Status

**Via SQL**:
```sql
SELECT
  id,
  mode,
  status,
  progress,
  video_url,
  thumbnail_url,
  error_message,
  created_at,
  completed_at
FROM social_media_videos
ORDER BY created_at DESC
LIMIT 10;
```

**Via Script**:
```bash
node test-social-media-services.js status <job-id>
```

## Generation Modes

### Mode 1: Database Image → Video

Uses an existing menu item image from the database.

**Example**:
```javascript
const request = {
  mode: 'image-to-video',
  prompt: 'The burger slowly rotates, steam rises from the hot patty',
  inputSource: {
    type: 'database',
    imageId: 'abc-123-def-456'
  },
  organisationId: 'org-id',
  userId: 'user-id',
  soraModel: 'sora-2',
  videoConfig: {
    size: '1280x720',
    seconds: 8
  }
};
```

### Mode 2: Text → Video

Generates video entirely from text description.

**Example**:
```javascript
const request = {
  mode: 'text-to-video',
  prompt: 'A cozy restaurant interior with warm lighting, camera pans across the dining room',
  organisationId: 'org-id',
  userId: 'user-id',
  soraModel: 'sora-2',
  videoConfig: {
    size: '1280x720',
    seconds: 8
  }
};
```

### Mode 3: Generated Image → Video

Generates an image with Gemini, then animates it with Sora.

**Example (Landscape)**:
```javascript
const request = {
  mode: 'generated-image-to-video',
  imagePrompt: 'Professional food photography of a gourmet burger, warm lighting',
  prompt: 'The burger rotates slowly, steam rises, camera zooms in',
  organisationId: 'org-id',
  userId: 'user-id',
  soraModel: 'sora-2',
  videoConfig: {
    size: '1280x720',
    seconds: 8
  }
};
```

**Example (Portrait for Instagram Stories/TikTok)**:
```javascript
const request = {
  mode: 'generated-image-to-video',
  imagePrompt: 'Vertical portrait photo of a delicious milkshake, studio lighting',
  prompt: 'The milkshake glass rotates slowly, camera tilts up',
  organisationId: 'org-id',
  userId: 'user-id',
  soraModel: 'sora-2',
  videoConfig: {
    size: '720x1280',  // Portrait orientation
    seconds: 4
  }
};
```

## Video Orientation Support

The system **automatically handles both landscape and portrait videos** across all modes:

### Supported Video Sizes

**Landscape (16:9)**:
- `1280x720` - HD landscape (YouTube, Facebook)
- `1920x1080` - Full HD landscape (professional content)

**Portrait (9:16)**:
- `720x1280` - HD portrait (Instagram Stories, TikTok)
- `1080x1920` - Full HD portrait (Instagram Reels, YouTube Shorts)

### How It Works

1. **Automatic Aspect Ratio Detection**: The system parses `videoConfig.size` to determine orientation
   ```javascript
   const [width, height] = videoConfig.size.split('x').map(Number);
   const isPortrait = height > width;
   const aspectRatio = isPortrait ? '9:16' : '16:9';
   ```

2. **Mode 3 (Gemini)**: Aspect ratio is automatically passed to Gemini based on video size
   - Landscape videos → Gemini generates 16:9 images
   - Portrait videos → Gemini generates 9:16 images

3. **Image Resizing**: All images (Mode 1 & 3) are resized to **exact video dimensions** using sharp
   - Prevents Sora API errors
   - Uses center-crop to preserve main subject
   - Maintains aspect ratio

### Example Usage

**Generate landscape video for YouTube**:
```javascript
videoConfig: { size: '1920x1080', seconds: 12 }
```

**Generate portrait video for TikTok**:
```javascript
videoConfig: { size: '720x1280', seconds: 4 }
```

## Database Schema

### Table: `social_media_videos`

**Key Fields**:
- `id` - UUID primary key
- `organisation_id` - Organisation reference (required)
- `mode` - Generation mode: `image-to-video`, `text-to-video`, or `generated-image-to-video`
- `prompt` - Text prompt for video generation
- `sora_model` - `sora-2` or `sora-2-pro`
- `status` - `queued`, `in_progress`, `completed`, or `failed`
- `progress` - 0-100 percentage
- `video_url` - URL to generated video
- `thumbnail_url` - URL to video thumbnail

**Voice-Over Fields** (Phase 5 - Future):
- `voice_enabled` - Boolean flag
- `voice_script` - Narration script
- `voice_model` - ElevenLabs model
- `voice_id` - ElevenLabs voice ID
- `voice_settings` - JSON settings
- `audio_url` - Generated audio URL
- `final_video_url` - Video with audio overlay

## Cost Estimates

### OpenAI Sora 2

- **sora-2**: ~$0.40-0.60 per video (faster, good quality)
- **sora-2-pro**: ~$0.80-1.20 per video (slower, high quality)

### Google Gemini 2.5 Flash Image

- **Image generation**: $0.039 per image (~4 cents)

### Recommendations

- Use `sora-2` with 4-8 seconds for testing
- Use `sora-2-pro` with 8-12 seconds for production
- Mode 3 costs: ~$0.44 total (Gemini + Sora)

## Next Steps

### Phase 3: API Layer (Not Yet Implemented)

Create REST API endpoints:
- `POST /api/social-media/generate` - Start generation
- `GET /api/social-media/videos/:id/status` - Get status
- `GET /api/social-media/videos` - List videos
- `DELETE /api/social-media/videos/:id` - Delete video

### Phase 4: UI Components (Not Yet Implemented)

Build React components:
- VideoGeneration page
- ModeSelector component
- PromptInput component
- VideoJobStatus component
- VideoPreview component

### Phase 5: Voice-Over Integration (Future)

Implement ElevenLabs integration:
- ElevenLabsService
- VideoProcessingService (FFmpeg)
- Voice UI components

## Troubleshooting

### Error: "OPENAI_API_KEY not found"

**Solution**: Add your OpenAI API key to `.env`:
```bash
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
```

### Error: "Failed to fetch database image"

**Solution**: Ensure TEST_IMAGE_ID is set to a valid menu item image ID from your database

### Error: "Quota exceeded"

**Solution**: Check your API quota limits at:
- OpenAI: https://platform.openai.com/account/usage
- Google: https://console.cloud.google.com/apis/dashboard

### Job stuck in "in_progress"

**Solution**:
1. Check Sora API status: https://status.openai.com
2. Manually refresh status: `node test-social-media-services.js status <job-id>`
3. Generation can take 2-15 minutes depending on model

## Summary

✅ **Phase 1 Complete**: Database schema, indexes, RLS policies, and storage bucket created
✅ **Phase 2 Complete**: All 4 core services implemented with comprehensive error handling
✅ **Test Script**: Comprehensive testing utility for all 3 generation modes
✅ **Documentation**: Complete implementation guide with examples

**Ready for Phase 3**: API layer implementation
**Ready for Testing**: Use test script to validate the MVP

---

Last Updated: 2025-10-07
Implemented by: Claude Code
