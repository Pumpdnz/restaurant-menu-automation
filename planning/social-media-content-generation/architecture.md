# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│  (React Components in UberEats-Image-Extractor/src/pages)       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REST API Layer                              │
│         (Express Routes: /api/social-media/*)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Video Generation Service                         │
│              (Main Orchestrator - Handles 3 Modes)               │
└───────┬──────────────┬──────────────┬──────────────┬────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌──────────────────┐
│   Sora     │ │  Gemini    │ │  Storage     │ │ ElevenLabs +     │
│  Service   │ │  Service   │ │  Service     │ │ Video Processing │
│  (OpenAI)  │ │  (Google)  │ │  (Supabase)  │ │ (Phase 2)        │
└─────┬──────┘ └──────┬─────┘ └──────┬───────┘ └────────┬─────────┘
      │               │              │                   │
      ▼               ▼              ▼                   ▼
┌──────────┐  ┌──────────────┐ ┌───────────┐  ┌────────────────┐
│ OpenAI   │  │  Gemini 2.5  │ │ Supabase  │  │ ElevenLabs API │
│ Sora 2   │  │ Flash Image  │ │ DB + STG  │  │   + FFmpeg     │
└──────────┘  └──────────────┘ └───────────┘  └────────────────┘
```

## Directory Structure

```
UberEats-Image-Extractor/
├── .env
│   ├── OPENAI_API_KEY
│   ├── GOOGLE_GENAI_API_KEY
│   ├── ELEVENLABS_API_KEY             # Phase 2
│   └── [existing keys...]
│
├── server.js                           # Mount social-media routes
│
├── src/
│   ├── services/
│   │   ├── social-media/              # NEW: Social media services
│   │   │   ├── video-generation-service.js    # Main orchestrator
│   │   │   ├── sora-service.js                # OpenAI Sora wrapper
│   │   │   ├── gemini-image-service.js        # Google Gemini wrapper
│   │   │   ├── social-storage-service.js      # DB & storage operations
│   │   │   ├── elevenlabs-service.js          # ElevenLabs TTS (Phase 2)
│   │   │   └── video-processing-service.js    # FFmpeg audio overlay (Phase 2)
│   │   │
│   │   └── [existing services...]
│   │
│   ├── routes/
│   │   ├── social-media-routes.js     # NEW: Social media API routes
│   │   └── [existing routes...]
│   │
│   ├── pages/
│   │   ├── SocialMediaVideos.tsx      # NEW: List all videos
│   │   ├── VideoGeneration.tsx        # NEW: Create new video
│   │   └── [existing pages...]
│   │
│   ├── components/
│   │   ├── social-media/              # NEW: Social media UI components
│   │   │   ├── VideoGenerationForm.tsx
│   │   │   ├── VideoPreview.tsx
│   │   │   ├── ModeSelector.tsx
│   │   │   ├── PromptInput.tsx
│   │   │   ├── VideoJobStatus.tsx
│   │   │   ├── VideoList.tsx
│   │   │   ├── VoiceConfigForm.tsx        # Voice-over config (Phase 2)
│   │   │   ├── VoiceSelector.tsx          # Voice selection (Phase 2)
│   │   │   └── VoiceSettings.tsx          # Voice parameters (Phase 2)
│   │   │
│   │   └── [existing components...]
│   │
│   └── hooks/
│       ├── useSocialMedia.ts          # NEW: React hooks for API calls
│       └── [existing hooks...]
│
└── package.json                        # Add: openai, @google/generative-ai
```

## Data Flow

### Mode 1: Database Image → Video

```
User Input (UI)
    │
    ├─ Prompt: "The burger sizzles, steam rises"
    ├─ Mode: "image-to-video"
    └─ Selected Image: menu_item_123.jpg
    │
    ▼
API Request: POST /api/social-media/generate
    │
    ▼
Video Generation Service
    │
    ├─ Fetch image from Supabase Storage
    │       ▼
    ├─ Download image buffer
    │       ▼
    ├─ Resize image to exact video dimensions using sharp
    │       │ (Parse videoConfig.size: e.g., 1280x720 or 720x1280)
    │       │ (Center-crop to preserve subject)
    │       ▼
    ├─ Send resized image to Sora API (with image reference)
    │       │
    │       └─ OpenAI Sora 2: Generate video
    │               │
    │               └─ Return job_id (async)
    │       ▼
    ├─ Store job in database (status: queued)
    │       ▼
    └─ Start background polling
            │
            ├─ Poll every 10 seconds
            │       ▼
            ├─ Update progress in DB
            │       ▼
            └─ When complete:
                    ├─ Download video from OpenAI
                    ├─ Upload to Supabase Storage
                    ├─ Save video URL in DB
                    └─ Update status: completed
```

### Mode 2: Text → Video

```
User Input (UI)
    │
    ├─ Prompt: "Cozy restaurant interior, warm lighting"
    └─ Mode: "text-to-video"
    │
    ▼
API Request: POST /api/social-media/generate
    │
    ▼
Video Generation Service
    │
    └─ Send to Sora API (no image reference)
            │
            └─ [Same flow as Mode 1 after this point]
```

### Mode 3: Generated Image → Video

```
User Input (UI)
    │
    ├─ Image Prompt: "Professional taco platter photo"
    ├─ Video Prompt: "Camera orbits around the dish"
    └─ Mode: "generated-image-to-video"
    │
    ▼
API Request: POST /api/social-media/generate
    │
    ▼
Video Generation Service
    │
    ├─ Determine aspect ratio from videoConfig.size
    │       │ (1280x720 → 16:9 landscape, 720x1280 → 9:16 portrait)
    │       ▼
    ├─ Send to Gemini API (generate image with aspect ratio)
    │       │
    │       └─ Google Gemini 2.5 Flash Image
    │               │
    │               └─ Return image buffer (~1024px max dimension)
    │       ▼
    ├─ Resize image to exact video dimensions using sharp
    │       │ (e.g., Gemini's 1024x576 → exact 1280x720)
    │       │ (Center-crop to preserve subject)
    │       ▼
    ├─ Upload resized generated image to Supabase
    │       ▼
    ├─ Send resized image + video prompt to Sora API
    │       │
    │       └─ [Same flow as Mode 1 after this point]
```

### Voice-Over Integration (Phase 2 - Optional)

```
Video Generation Complete
    │
    └─ If voiceConfig.enabled === true:
        │
        ├─ Generate audio with ElevenLabs
        │       │
        │       ├─ Text: voiceConfig.script
        │       ├─ Voice ID: voiceConfig.voiceId
        │       ├─ Model: voiceConfig.voiceModel
        │       └─ Settings: voiceConfig.voiceSettings
        │       │
        │       └─ ElevenLabs API: text-to-speech
        │               │
        │               └─ Return audio buffer (MP3)
        │       ▼
        ├─ Upload audio to Supabase Storage
        │       │
        │       └─ Save audio_url in DB
        │       ▼
        ├─ Download completed video from Supabase
        │       ▼
        ├─ Process with FFmpeg
        │       │
        │       ├─ Input 1: Original video with Sora audio (30% volume)
        │       ├─ Input 2: Voice-over audio (100% volume)
        │       │
        │       └─ Mix audio tracks + overlay
        │               │
        │               └─ Return final video buffer
        │       ▼
        ├─ Upload final video to Supabase Storage
        │       │
        │       └─ Save final_video_url in DB
        │       ▼
        └─ Update job status: completed (with voice-over)
```

## Service Layer Architecture

### VideoGenerationService (Orchestrator)

**Responsibilities**:
- Coordinate between all services
- Handle different generation modes
- Manage job lifecycle
- Implement polling mechanism
- Error handling and retry logic

**Key Methods**:
```javascript
generateVideo(request)        // Main entry point
pollJobCompletion(jobId)      // Background polling
getJobStatus(jobId)           // Status check
refreshJobStatus(jobId)       // Manual refresh
deleteVideo(jobId)            // Cleanup
listVideos(filters)           // List jobs
handleVoiceOver(jobId, config) // Voice-over processing (Phase 2)
```

### SoraService (OpenAI Integration)

**Responsibilities**:
- Wrap OpenAI Sora 2 API
- Handle video creation requests
- Status checking
- Video/thumbnail downloads
- Error handling

**Key Methods**:
```javascript
createVideo({ model, prompt, inputReference, size, seconds })
checkStatus(videoId)
downloadVideo(videoId)
downloadThumbnail(videoId)
deleteVideo(videoId)
```

**API Endpoints Used**:
- `POST /v1/videos` - Create video
- `GET /v1/videos/{video_id}` - Check status
- `GET /v1/videos/{video_id}/content` - Download video
- `GET /v1/videos/{video_id}/content?variant=thumbnail` - Download thumbnail
- `DELETE /v1/videos/{video_id}` - Delete video

### GeminiImageService (Google Integration)

**Responsibilities**:
- Wrap Google Gemini 2.5 Flash Image API
- Handle image generation requests
- Convert response to usable format
- Error handling

**Key Methods**:
```javascript
generateImage(prompt, config)
```

**API Configuration**:
```javascript
{
  model: 'gemini-2.5-flash-image',
  aspectRatio: '16:9' | '1:1' | '9:16' | '4:3' | '3:4',
  // Output: PNG image buffer
}
```

### SocialStorageService (Database & Storage)

**Responsibilities**:
- CRUD operations on `social_media_videos` table
- Upload videos/images to Supabase Storage
- Fetch menu item images
- Clean up storage on delete

**Key Methods**:
```javascript
createJob(data)                    // Create DB record
updateJob(jobId, updates)          // Update job status
getJob(jobId)                      // Fetch job details
listJobs(filters)                  // List with pagination
deleteJob(jobId)                   // Delete record

uploadVideo(buffer, jobId)         // Upload to storage
uploadThumbnail(buffer, jobId)     // Upload thumbnail
uploadGeneratedImage(buffer, jobId) // Upload Gemini image
getMenuItemImage(imageId)          // Fetch existing image
deleteJobAssets(jobId)             // Clean up storage
```

**Storage Buckets**:
```
social-media-videos/
├── videos/{job_id}.mp4
├── thumbnails/{job_id}.webp
├── generated-images/{job_id}.png
├── audio/{job_id}.mp3              # Voice-over audio (Phase 2)
└── final-videos/{job_id}.mp4       # Video with voice-over (Phase 2)
```

### ElevenLabsService (Phase 2 - Voice-Over)

**Responsibilities**:
- Wrap ElevenLabs text-to-speech API
- Handle voice generation requests
- Fetch available voices
- Preview voices
- Error handling

**Key Methods**:
```javascript
textToSpeech({ text, voiceId, modelId, voiceSettings, language })
getVoices()                         // List available voices
getVoice(voiceId)                   // Get specific voice details
```

**API Endpoints Used**:
- `POST /v1/text-to-speech/{voice_id}` - Generate speech
- `GET /v1/voices` - List voices
- `GET /v1/voices/{voice_id}` - Get voice details

**Models**:
- `eleven_flash_v2_5` - Fastest, good quality
- `eleven_turbo_v2_5` - Balanced speed and quality
- `eleven_multilingual_v2` - Best quality, 70+ languages

### VideoProcessingService (Phase 2 - Audio Overlay)

**Responsibilities**:
- Process video and audio files using FFmpeg
- Overlay voice-over audio onto video
- Mix audio tracks (preserve Sora audio at 30%, voice-over at 100%)
- Handle temporary file management
- Error handling

**Key Methods**:
```javascript
overlayAudio(videoBuffer, audioBuffer, jobId)
extractAudio(videoBuffer)
mixAudio(track1Buffer, track2Buffer, volume1, volume2)
```

**Dependencies**:
- `fluent-ffmpeg` - Node.js wrapper for FFmpeg
- FFmpeg binary (system-level installation)

**Audio Mixing Configuration**:
```javascript
{
  soraAudioVolume: 0.3,      // 30% - preserve ambient sounds
  voiceOverVolume: 1.0,      // 100% - clear narration
  codec: 'aac',              // AAC audio codec
  bitrate: '192k'            // Audio quality
}
```

## Async Job Processing

### Polling Strategy

**Why Polling Instead of Webhooks (Initially)**:
1. Simpler implementation for MVP
2. No need for public webhook endpoint
3. Works behind firewalls/NAT
4. Can be upgraded to webhooks later

**Polling Configuration**:
```javascript
const POLL_INTERVAL = 10000;      // 10 seconds
const MAX_POLLS = 360;             // 1 hour timeout
const EXPONENTIAL_BACKOFF = false; // Can enable if needed
```

**Polling Flow**:
```
Job Created (status: queued)
    │
    └─ Start polling after 10 seconds
        │
        └─ Every 10 seconds:
            ├─ Call Sora API: GET /videos/{id}
            ├─ Update local DB with status/progress
            │
            └─ If status === 'completed':
                ├─ Download video
                ├─ Upload to Supabase
                ├─ Save URL in DB
                └─ Stop polling

            └─ If status === 'failed':
                ├─ Log error
                └─ Stop polling

            └─ If status === 'in_progress':
                └─ Continue polling
```

### Future: Webhook Integration

**OpenAI Webhook Events**:
- `video.completed`
- `video.failed`

**Implementation**:
```javascript
// Future endpoint
POST /api/social-media/webhooks/sora
  → Verify signature
  → Update job status
  → Download video if completed
```

## Error Handling

### Error Types

1. **Validation Errors** (400)
   - Missing required fields
   - Invalid mode selection
   - Invalid model selection

2. **Authentication Errors** (401)
   - Missing/invalid API keys
   - Expired tokens

3. **Not Found Errors** (404)
   - Job ID not found
   - Image ID not found

4. **API Errors** (500)
   - OpenAI API failures
   - Google API failures
   - Network timeouts

5. **Content Policy Violations** (422)
   - Copyrighted content
   - Inappropriate prompts
   - Face detection in images

### Error Recovery

**Retry Strategy**:
```javascript
{
  maxRetries: 3,
  retryDelay: 5000,        // 5 seconds
  retryableErrors: [
    'RATE_LIMIT',
    'TIMEOUT',
    'SERVICE_UNAVAILABLE'
  ]
}
```

**Failure Handling**:
- Store error message in DB
- Increment retry count
- Stop after max retries
- Allow manual retry from UI

## Security Considerations

### API Key Management
- Store in `.env` file
- Never commit to git
- Rotate keys periodically

### Row Level Security (RLS)
- Users can only access videos in their organization
- Enforced at database level
- Prevents unauthorized access

### Content Moderation
- Sora API enforces content restrictions
- Reject copyrighted characters
- No real people generation
- U18 content only (configurable later)

### Storage Security
- Supabase storage bucket policies
- Signed URLs for private content
- Automatic URL expiration (24 hours)

## Performance Considerations

### Video Generation Time
- **Sora 2**: 2-5 minutes average
- **Sora 2 Pro**: 5-15 minutes average
- **Gemini Image**: 10-30 seconds
- **ElevenLabs TTS**: 2-5 seconds (Phase 2)
- **FFmpeg Audio Overlay**: 5-15 seconds (Phase 2)

### Cost Optimization
- Use `sora-2` for quick iterations (~$0.40-0.60/video)
- Use `sora-2-pro` for final output (~$0.80-1.20/video)
- Cache generated images for reuse (~$0.039/image)
- Use `eleven_flash_v2_5` for voice-over (~$0.008-0.015/generation) (Phase 2)
- Clean up old videos (retention policy)
- Consider voice-over optional to save ~2% on costs

### Database Optimization
- Index on status + created_at
- Index on organisation_id
- Index on sora_video_id
- Pagination on list queries

### Storage Optimization
- Compress videos before upload
- Use WebP for thumbnails
- Set storage retention policies
- Archive old content to cold storage

## Scalability

### Current Architecture (MVP)
- Single server polling
- In-memory job tracking
- File system storage

### Future Scaling (Production)
- Redis for job queue
- Bull/BullMQ for job processing
- Multiple worker processes
- CDN for video delivery
- Webhook-based updates
- Horizontal scaling

## Monitoring & Logging

### Metrics to Track
- Video generation success rate
- Average generation time
- API error rates (Sora, Gemini, ElevenLabs)
- Cost per video (with/without voice-over)
- Storage usage
- Voice-over usage rate (Phase 2)
- Audio processing time (Phase 2)

### Logging Strategy
```javascript
// Log levels
- ERROR: API failures, system errors
- WARN: Retries, slow operations
- INFO: Job state changes
- DEBUG: API requests/responses
```

### Health Checks
```
GET /api/social-media/health
  → Check API connectivity
  → Check database connection
  → Check storage access
```

## Integration Points

### Existing Systems

**Authentication**:
- Reuse `authMiddleware` from server.js
- Access `req.user.organisationId`
- Access `req.user.id`

**Database Service**:
- Reuse `database-service.js` patterns
- Use existing Supabase client
- Follow existing RLS patterns

**Storage**:
- Use existing Supabase storage buckets
- Follow existing upload patterns
- Reuse CDN configuration

**UI Framework**:
- React + TypeScript
- Existing component library
- TanStack Query for API calls
- Existing routing structure

## Testing Strategy

### Unit Tests
- Each service independently
- Mock external APIs
- Test error handling

### Integration Tests
- End-to-end flows
- Database operations
- API endpoint testing

### UI Tests
- Component rendering
- Form validation
- User interactions

### Manual Testing
- Test all 3 modes
- Test different prompts
- Test error scenarios
- Performance testing

---

Last Updated: 2025-10-07
