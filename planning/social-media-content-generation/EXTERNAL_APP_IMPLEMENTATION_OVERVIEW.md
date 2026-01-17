# Social Media Content Generation: External App Implementation Overview

**Date:** October 13, 2025
**Purpose:** Comprehensive analysis and planning for implementing AI-powered social media content generation in the customer-facing pumpd-webhook application

---

## Executive Summary

This document provides a comprehensive analysis of the social media content generation feature currently implemented in the internal automation app (UberEats-Image-Extractor) and outlines a plan for implementing it in the external customer-facing application (pumpd-webhook).

### Key Findings

1. **Feature Scope**: The feature generates AI videos and images using OpenAI Sora 2 and Google Gemini 2.5 Flash Image
2. **Database Dependency**: Relies on 2 main tables (`social_media_videos`, `social_media_images`) with complex relationships
3. **Architecture Pattern**: Follows service-oriented architecture with polling-based async job management
4. **Primary Challenge**: The internal app uses different database schema patterns (organisations, user_organisations) compared to the external app
5. **Recommended Approach**: Incremental implementation with schema adaptation and shared service layer

---

## Current Implementation Analysis

### Internal App (automation/UberEats-Image-Extractor)

#### Technology Stack
- **Backend**: Express.js (Node.js) on Port 3007
- **Frontend**: React + TypeScript with shadcn/ui components
- **Database**: Supabase with RLS policies
- **AI Services**:
  - OpenAI Sora 2 for video generation
  - Google Gemini 2.5 Flash Image for image generation
  - Sharp for image processing
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6

#### Core Features

##### Video Generation (3 Modes)
1. **Image-to-Video**: Animate existing images from database
   - Sources: menu items, AI-generated images, uploaded images, restaurant logos
   - Process: Fetch → Resize → Send to Sora → Poll → Download → Store

2. **Text-to-Video**: Generate videos from text descriptions
   - Process: Text prompt → Sora API → Poll → Download → Store

3. **Generated-Image-to-Video**: Create image first, then animate
   - Process: Text → Gemini Image → Resize → Sora API → Poll → Download → Store

##### Image Generation (3 Modes)
1. **Text-to-Image**: Generate images from text using Gemini
2. **Uploaded**: Direct image upload with processing
3. **Reference-Images**: Multi-source image composition (menu + AI + uploaded + logos)

##### Job Management
- **Async Processing**: Polling-based status checking (10 sec intervals, 1 hour timeout)
- **Status Tracking**: queued → in_progress → completed/failed
- **Progress Updates**: Real-time progress percentage
- **Error Handling**: Retry logic, detailed error messages

---

## Database Schema Analysis

### Current Internal App Schema

#### Table: `social_media_videos`

**Purpose**: Track video generation jobs

**Key Columns**:
- `id` (uuid, PK)
- `organisation_id` (uuid, FK → organisations)
- `restaurant_id` (uuid, FK → restaurants, nullable)
- `menu_id`, `menu_item_id` (uuid, nullable)
- `mode` (text: 'image-to-video' | 'text-to-video' | 'generated-image-to-video')
- `prompt` (text: user video prompt)
- `image_prompt` (text: for mode 3)
- `source_image_id`, `source_image_url`, `source_image_type` (for mode 1)
- `generated_image_url` (for mode 3)
- `sora_video_id` (text: OpenAI job ID)
- `sora_model` (text: 'sora-2' | 'sora-2-pro')
- `status` (text: 'queued' | 'in_progress' | 'completed' | 'failed')
- `progress` (integer: 0-100)
- `video_url`, `thumbnail_url` (text: Supabase Storage URLs)
- `video_config` (jsonb: size, seconds)
- `error_message`, `retry_count` (error handling)
- `created_by` (uuid, FK → auth.users)
- `created_at`, `updated_at`, `completed_at` (timestamptz)

**Indexes**: 8 indexes on status, organisation_id, restaurant_id, sora_video_id, created_by

**RLS Policies**: Organisation-based access control

#### Table: `social_media_images`

**Purpose**: Track AI image generation jobs

**Key Columns**:
- Similar structure to videos table
- `mode` (text: 'uploaded' | 'text-to-image' | 'reference-images')
- `reference_image_ids` (uuid[]: backwards compatibility)
- `reference_image_sources` (jsonb: [{ id, sourceType }])
- `gemini_model` (text: 'gemini-2.5-flash-image')
- `image_config` (jsonb: aspectRatio)
- `width`, `height`, `file_size` (image metadata)

**Storage Bucket**: `social-media-videos` (contains videos, thumbnails, generated-images)

### Schema Dependencies

The internal app relies on these external tables:
1. **organisations** - Organisation management
2. **user_organisations** - User-org relationships
3. **restaurants** - Restaurant records
4. **menus** - Menu records
5. **menu_items** - Menu item records (soft reference)
6. **item_images** - Menu item images (for mode 1)
7. **auth.users** - Supabase auth users

---

## External App (pumpd-webhook) Analysis

### Current Architecture

#### Backend Structure
```
server/
├── src/
│   └── index.js                    # Express server, middleware, CORS
├── handlers/                       # Business logic handlers
│   ├── sms-api-handler.js
│   ├── email-campaigns-api-handler.js
│   ├── dashboard-api.js
│   └── ...
├── routes/
│   └── admin-routes.js
├── services/                       # Reusable services
├── middleware/                     # Auth, validation
└── utils/                          # Utilities
```

#### Frontend Structure
```
src/
├── pages/                          # Route components
│   ├── Dashboard.tsx
│   ├── SmsCampaigns.tsx
│   ├── EmailCampaigns.tsx
│   └── ...
├── components/                     # Reusable UI components
├── hooks/                          # Custom React hooks
├── api/                            # API client functions
├── context/                        # React context providers
└── types/                          # TypeScript types
```

#### Key Patterns
- **Handlers**: Each feature has a dedicated handler (e.g., `sms-api-handler.js`)
- **Authentication**: JWT-based auth with middleware
- **CORS**: Configured for multiple origins
- **Logging**: Structured JSON logging for Heroku
- **Error Handling**: Global error handlers
- **Database**: Direct Supabase client usage in handlers
- **Frontend State**: React Query for data fetching/caching

### Database Considerations

#### Potential Schema Differences
The external app likely uses:
- Similar `organisations` table structure
- Different user management patterns (may not have `user_organisations`)
- Existing `restaurants` table
- Potentially different menu/item structures

#### Authentication Pattern
- Uses Supabase Auth (`auth.users`)
- Middleware validates JWT tokens
- User context available in `req.user`

---

## Architecture Comparison

### Similarities
1. **Express Backend**: Both use Express.js for API server
2. **React Frontend**: Both use React with TypeScript
3. **Supabase**: Both use Supabase for database + storage
4. **Component Library**: Both use shadcn/ui components
5. **State Management**: Both use React Query
6. **Routing**: Both use React Router

### Differences

| Aspect | Internal App (automation) | External App (pumpd-webhook) |
|--------|---------------------------|------------------------------|
| **Port** | 3007 | Dynamic (Heroku) |
| **Routes Pattern** | Dedicated route files | Handlers mounted in index.js |
| **Service Layer** | Explicit service classes | Mixed (handlers + services) |
| **File Structure** | Service-first | Handler-first |
| **Database Access** | Via SocialStorageService | Direct Supabase calls |
| **Organization** | By feature (social-media/) | By type (handlers/, services/) |

---

## Implementation Strategy

### Phase 1: Database Schema Migration

#### 1.1 Create Core Tables

```sql
-- Migration: 20251013_create_social_media_tables.sql

-- Adapt social_media_videos table for external app
CREATE TABLE social_media_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context (adapt to external app's org structure)
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Generation config
  mode text NOT NULL CHECK (mode IN ('image-to-video', 'text-to-video', 'generated-image-to-video')),
  prompt text NOT NULL,
  image_prompt text,

  -- Source tracking
  source_image_id uuid,
  source_image_url text,
  source_image_type text CHECK (source_image_type IN ('menu', 'ai', 'uploaded', 'logo')),
  generated_image_url text,

  -- Sora API
  sora_video_id text UNIQUE,
  sora_model text NOT NULL DEFAULT 'sora-2' CHECK (sora_model IN ('sora-2', 'sora-2-pro')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- Output
  video_url text,
  thumbnail_url text,

  -- Config & errors
  video_config jsonb DEFAULT '{"size": "1280x720", "seconds": 8}'::jsonb,
  gemini_config jsonb,
  error_message text,
  retry_count integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,

  -- Constraints
  CONSTRAINT valid_mode_1_config CHECK (mode != 'image-to-video' OR source_image_id IS NOT NULL),
  CONSTRAINT valid_mode_3_config CHECK (mode != 'generated-image-to-video' OR image_prompt IS NOT NULL)
);

-- Create social_media_images table (similar adaptation)
-- ... (see database-schema.md for full definition)
```

#### 1.2 Create Indexes

```sql
-- Performance indexes
CREATE INDEX idx_social_videos_org ON social_media_videos(organisation_id, created_at DESC);
CREATE INDEX idx_social_videos_user ON social_media_videos(user_id, created_at DESC);
CREATE INDEX idx_social_videos_status ON social_media_videos(status, created_at DESC);
CREATE INDEX idx_social_videos_sora_id ON social_media_videos(sora_video_id) WHERE sora_video_id IS NOT NULL;
```

#### 1.3 Create RLS Policies

**IMPORTANT**: External app likely has different RLS patterns. Need to:
1. Check existing RLS policies on other tables
2. Match the pattern (e.g., user_id-based vs organisation_id-based)
3. Add service_role policies for backend operations

```sql
ALTER TABLE social_media_videos ENABLE ROW LEVEL SECURITY;

-- Example: User can view their own videos
CREATE POLICY "Users can view own videos"
  ON social_media_videos FOR SELECT
  USING (user_id = auth.uid());

-- Example: Users can create videos
CREATE POLICY "Users can create videos"
  ON social_media_videos FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Service role needs full access
CREATE POLICY "Service role has full access"
  ON social_media_videos FOR ALL
  USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');
```

#### 1.4 Create Storage Bucket

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media-content', 'social-media-content', false);

-- Storage policies (adapt to external app's auth pattern)
CREATE POLICY "Users can upload own content"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'social-media-content'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own content"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'social-media-content'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

**Storage Structure**:
```
social-media-content/
└── {user_id}/
    ├── videos/
    │   └── {job_id}.mp4
    ├── thumbnails/
    │   └── {job_id}.webp
    └── generated-images/
        └── {job_id}.png
```

---

### Phase 2: Backend Implementation

#### 2.1 Create Services Layer

**Location**: `server/services/social-media/`

**Files to Port**:
1. `video-generation-service.js` - Main orchestrator
2. `image-generation-service.js` - Image orchestrator
3. `sora-service.js` - OpenAI Sora wrapper
4. `gemini-image-service.js` - Google Gemini wrapper
5. `social-storage-service.js` - Database + storage operations
6. `image-fetcher-service.js` - Unified image fetching

**Key Adaptations**:
- Update database queries to match external app's schema
- Adapt RLS policy assumptions
- Update storage paths to use `user_id` instead of `organisation_id`
- Ensure compatibility with external app's Supabase client setup

#### 2.2 Create API Handler

**Location**: `server/handlers/social-media-api-handler.js`

**Pattern**: Follow existing handlers (e.g., `sms-api-handler.js`, `email-campaigns-api-handler.js`)

```javascript
// server/handlers/social-media-api-handler.js
const VideoGenerationService = require('../services/social-media/video-generation-service');
const ImageGenerationService = require('../services/social-media/image-generation-service');

class SocialMediaApiHandler {
  constructor() {
    this.videoService = new VideoGenerationService();
    this.imageService = new ImageGenerationService();
  }

  // Video endpoints
  async generateVideo(req, res) { /* ... */ }
  async getVideoStatus(req, res) { /* ... */ }
  async listVideos(req, res) { /* ... */ }
  async deleteVideo(req, res) { /* ... */ }

  // Image endpoints
  async generateImage(req, res) { /* ... */ }
  async uploadImage(req, res) { /* ... */ }
  async listImages(req, res) { /* ... */ }
  async deleteImage(req, res) { /* ... */ }
}

module.exports = new SocialMediaApiHandler();
```

#### 2.3 Mount Routes in Server

**Location**: `server/src/index.js`

```javascript
// Add to server/src/index.js
const socialMediaApi = require('../handlers/social-media-api-handler');

// Mount routes
app.post('/api/social-media/generate', socialMediaApi.generateVideo);
app.get('/api/social-media/videos/:id/status', socialMediaApi.getVideoStatus);
app.get('/api/social-media/videos', socialMediaApi.listVideos);
app.delete('/api/social-media/videos/:id', socialMediaApi.deleteVideo);

app.post('/api/social-media/images/generate', socialMediaApi.generateImage);
app.post('/api/social-media/images/upload', multer(...), socialMediaApi.uploadImage);
app.get('/api/social-media/images', socialMediaApi.listImages);
app.delete('/api/social-media/images/:id', socialMediaApi.deleteImage);
```

#### 2.4 Environment Variables

**Add to `.env`**:
```bash
# OpenAI Sora 2
OPENAI_API_KEY=sk-proj-...

# Google Gemini
GOOGLE_GENAI_API_KEY=...

# Storage bucket name
SOCIAL_MEDIA_BUCKET=social-media-content
```

---

### Phase 3: Frontend Implementation

#### 3.1 Create API Client

**Location**: `src/api/socialMedia.ts`

```typescript
// src/api/socialMedia.ts
import { supabase } from '@/integrations/supabase/client';

export interface GenerateVideoRequest {
  mode: 'image-to-video' | 'text-to-video' | 'generated-image-to-video';
  prompt: string;
  imagePrompt?: string;
  inputSource?: { imageId: string; sourceType: string };
  restaurantId?: string;
  soraModel: 'sora-2' | 'sora-2-pro';
  videoConfig: { size: string; seconds: number };
}

export const socialMediaApi = {
  generateVideo: async (request: GenerateVideoRequest) => {
    const response = await fetch('/api/social-media/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(request),
    });
    return response.json();
  },

  // ... other endpoints
};
```

#### 3.2 Create Custom Hook

**Location**: `src/hooks/useSocialMedia.ts`

**Port from**: `automation/UberEats-Image-Extractor/src/hooks/useSocialMedia.ts`

**Key Changes**:
- Update API endpoints to match external app's URL structure
- Adapt authentication to use external app's auth pattern
- Update navigation paths

#### 3.3 Create UI Components

**Location**: `src/components/social-media/`

**Components to Port**:
1. `ModeSelector.tsx` - Select video generation mode
2. `VideoPromptInput.tsx` - Text prompt input
3. `ModelSelector.tsx` - Sora 2 vs Sora 2 Pro
4. `VideoConfigForm.tsx` - Size, duration settings
5. `ImageSelector.tsx` - Select source image
6. `VideoJobStatus.tsx` - Status indicator
7. `VideoPreview.tsx` - Preview completed video
8. `VideoList.tsx` - List of videos

**Adaptations**:
- Update component imports to match external app's structure
- Ensure compatibility with external app's design system
- Update paths, button styles to match existing patterns

#### 3.4 Create Pages

**Location**: `src/pages/`

**Pages to Create**:
1. `SocialMediaVideos.tsx` - Video list view
2. `VideoGeneration.tsx` - Create new video
3. `SocialMediaImages.tsx` - Image list view
4. `ImageGeneration.tsx` - Create new image

**Integration**:
- Add routes to `src/App.tsx`
- Add navigation links to sidebar/menu
- Follow existing page structure patterns

#### 3.5 Update Navigation

**Location**: `src/components/` (wherever navigation is defined)

```typescript
// Add to navigation
{
  title: "Social Media",
  href: "/social-media",
  icon: Video,
  items: [
    { title: "Videos", href: "/social-media/videos" },
    { title: "Generate Video", href: "/social-media/generate" },
    { title: "Images", href: "/social-media/images" },
  ]
}
```

---

### Phase 4: Testing & Refinement

#### 4.1 Backend Testing
- Test all API endpoints with Postman/curl
- Verify database operations (create, read, update, delete)
- Test error handling and retry logic
- Verify polling mechanism
- Test file upload/download
- Verify storage bucket access

#### 4.2 Frontend Testing
- Test video generation for all 3 modes
- Test image generation for all 3 modes
- Verify real-time status updates
- Test pagination, filtering, sorting
- Test delete operations
- Verify error messages display correctly

#### 4.3 Integration Testing
- End-to-end video generation flow
- Verify storage URLs are accessible
- Test with different user accounts
- Verify RLS policies work correctly
- Test concurrent job processing

---

## Key Considerations

### 1. Database Schema Alignment

**Challenge**: The internal app uses `organisation_id` + `user_organisations` pattern. The external app may have different patterns.

**Solution**:
- Investigate external app's existing tables (organisations, users, etc.)
- Match the RLS pattern used in other tables
- Consider adding `organisation_id` if not present
- May need to use `user_id` directly instead of `organisation_id`

### 2. Authentication & Authorization

**Challenge**: Different auth middleware and user context patterns.

**Solution**:
- Use existing auth middleware from external app
- Adapt handlers to use `req.user` structure from external app
- Update RLS policies to match external app's auth pattern
- Test with external app's user roles/permissions

### 3. Storage Paths

**Challenge**: Internal app uses `organisation_id` in storage paths; external may need `user_id`.

**Solution**:
```javascript
// Internal app: /social-media-videos/{organisation_id}/videos/{job_id}.mp4
// External app: /social-media-content/{user_id}/videos/{job_id}.mp4
```

Adapt `social-storage-service.js` to use appropriate path structure.

### 4. API Costs

**Important**: Notify users about costs:
- Sora 2: ~$0.40-0.60 per 8-second video
- Sora 2 Pro: ~$0.80-1.20 per video
- Gemini Image: $0.039 per image

**Recommendations**:
- Add cost estimates in UI
- Consider usage limits/quotas per organization
- Add billing/tracking in future phases
- Show cost breakdown before generation

### 5. Performance & Scalability

**Polling**: Current implementation uses in-memory polling. For external app:
- Consider Redis for distributed polling if multiple server instances
- Or implement webhook-based updates from OpenAI
- Monitor polling overhead on server resources

**Job Queuing**: Current implementation has no queue. Consider:
- Bull/BullMQ for job queuing
- Rate limiting per user/organization
- Priority queuing for different user tiers

### 6. Error Handling

**Critical Error Cases**:
1. **Content Policy Violations**: Sora rejects inappropriate content
   - Show clear error messages
   - Provide guidance on acceptable prompts

2. **API Failures**: OpenAI/Google API downtime
   - Implement retry logic (already present)
   - Show user-friendly error messages
   - Allow manual retry from UI

3. **Storage Failures**: Supabase storage issues
   - Handle gracefully
   - Retry uploads
   - Clean up partial uploads

---

## Recommended Implementation Order

### Step 1: Infrastructure Setup (Week 1)
1. Create database tables + indexes
2. Set up RLS policies
3. Create storage bucket
4. Add environment variables
5. Test database access

### Step 2: Backend Core Services (Week 2)
1. Port service layer files
2. Adapt to external app's schema
3. Test services independently
4. Create handler
5. Mount routes

### Step 3: Basic Frontend (Week 3)
1. Create API client
2. Port useSocialMedia hook
3. Create basic pages (list, create)
4. Add navigation
5. Test end-to-end flow

### Step 4: Full UI Components (Week 4)
1. Port all components
2. Add video preview
3. Add image gallery
4. Polish UI/UX
5. Add loading states, errors

### Step 5: Testing & Refinement (Week 5)
1. Comprehensive testing
2. Performance optimization
3. Error handling improvements
4. Documentation
5. User training materials

---

## Risk Mitigation

### High-Risk Areas
1. **RLS Policies**: Mismatch with external app patterns → Thoroughly test auth
2. **Database Schema**: Different org structure → Map carefully, test queries
3. **API Costs**: Unexpected high usage → Add usage tracking, limits
4. **Polling Overhead**: Memory leaks, server load → Monitor, consider webhooks

### Mitigation Strategies
1. **Test with copy of production database**: Avoid breaking changes
2. **Feature flags**: Roll out gradually to users
3. **Usage monitoring**: Track API costs, set alerts
4. **Rollback plan**: Keep database migrations reversible
5. **Documentation**: Document all changes, assumptions

---

## External App Specific Adaptations Needed

### Database Schema
- [ ] Check if `organisations` table exists and has same structure
- [ ] Verify `auth.users` table structure
- [ ] Check `restaurants` table columns
- [ ] Verify menu/item table structures
- [ ] Determine org-user relationship pattern

### Authentication
- [ ] Identify auth middleware used
- [ ] Map `req.user` structure
- [ ] Verify JWT token format
- [ ] Check role-based permissions pattern

### Storage
- [ ] Verify Supabase storage configuration
- [ ] Check existing bucket naming conventions
- [ ] Verify RLS on storage objects
- [ ] Test storage URL generation

### API Patterns
- [ ] Match existing handler patterns
- [ ] Follow error response format
- [ ] Use consistent logging format
- [ ] Match CORS configuration

### Frontend
- [ ] Match existing routing structure
- [ ] Follow component organization pattern
- [ ] Use consistent styling approach
- [ ] Match navigation patterns

---

## Success Metrics

### Technical Metrics
- Video generation success rate > 95%
- Average generation time < 5 minutes (Sora 2)
- API error rate < 1%
- Storage upload success > 99%
- Polling overhead < 5% CPU

### User Experience Metrics
- Time to first video < 3 minutes
- User retention after first video > 80%
- Feature adoption rate > 30% of active users
- User satisfaction score > 4.5/5

---

## Next Steps

1. **Immediate**: Get approval for implementation plan
2. **Week 1**: Set up meeting with external app team to review schema
3. **Week 1**: Create development branch
4. **Week 1**: Run database migrations in development
5. **Week 2**: Begin backend implementation
6. **Week 3**: Begin frontend implementation
7. **Week 5**: Internal testing
8. **Week 6**: Beta testing with select users
9. **Week 7**: Full rollout

---

## Appendix: File Mapping

### Services to Port

| Internal App File | External App Location | Adaptation Required |
|-------------------|----------------------|---------------------|
| `services/social-media/video-generation-service.js` | `server/services/social-media/video-generation-service.js` | Schema, auth |
| `services/social-media/image-generation-service.js` | `server/services/social-media/image-generation-service.js` | Schema, auth |
| `services/social-media/sora-service.js` | `server/services/social-media/sora-service.js` | Minimal |
| `services/social-media/gemini-image-service.js` | `server/services/social-media/gemini-image-service.js` | Minimal |
| `services/social-media/social-storage-service.js` | `server/services/social-media/social-storage-service.js` | Schema, storage paths |
| `services/social-media/image-fetcher-service.js` | `server/services/social-media/image-fetcher-service.js` | Schema |

### Components to Port

| Internal App Component | External App Location | Adaptation Required |
|------------------------|----------------------|---------------------|
| `components/social-media/ModeSelector.tsx` | `src/components/social-media/ModeSelector.tsx` | Styling |
| `components/social-media/VideoPromptInput.tsx` | `src/components/social-media/VideoPromptInput.tsx` | Styling |
| `components/social-media/ModelSelector.tsx` | `src/components/social-media/ModelSelector.tsx` | Styling |
| `components/social-media/VideoConfigForm.tsx` | `src/components/social-media/VideoConfigForm.tsx` | Styling |
| `components/social-media/ImageSelector.tsx` | `src/components/social-media/ImageSelector.tsx` | API, styling |
| `components/social-media/VideoJobStatus.tsx` | `src/components/social-media/VideoJobStatus.tsx` | Styling |
| `components/social-media/VideoPreview.tsx` | `src/components/social-media/VideoPreview.tsx` | Styling |

### Pages to Port

| Internal App Page | External App Location | Adaptation Required |
|-------------------|----------------------|---------------------|
| `pages/SocialMediaVideos.tsx` | `src/pages/SocialMediaVideos.tsx` | API, routing |
| `pages/VideoGeneration.tsx` | `src/pages/VideoGeneration.tsx` | API, routing |
| `pages/SocialMediaDashboard.tsx` | `src/pages/SocialMediaDashboard.tsx` | API, routing |

---

**Document Version**: 1.0
**Last Updated**: October 13, 2025
**Author**: Claude (based on codebase investigation)
**Review Status**: Pending team review
