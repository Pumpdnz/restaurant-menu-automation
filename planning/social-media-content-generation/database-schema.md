# Database Schema

## Overview

This document defines the database schema for the social media content generation system, including table structures, indexes, and Row Level Security (RLS) policies.

## Table: `social_media_videos`

### Purpose
Tracks video generation jobs from creation through completion, storing metadata, status, and links to generated assets.

### Schema

```sql
CREATE TABLE social_media_videos (
  -- Primary Key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context & Relationships
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  menu_id uuid REFERENCES menus(id) ON DELETE SET NULL,
  menu_item_id uuid,  -- Soft reference (may not exist in DB)

  -- Generation Configuration
  mode text NOT NULL CHECK (
    mode IN ('image-to-video', 'text-to-video', 'generated-image-to-video')
  ),
  prompt text NOT NULL,           -- User-provided video generation prompt
  image_prompt text,              -- User-provided image generation prompt (mode 3 only)

  -- Input References
  source_image_id uuid,           -- Reference to image (mode 1)
  source_image_url text,          -- Full URL of source image
  source_image_type text CHECK (  -- Type of source image (mode 1)
    source_image_type IS NULL OR
    source_image_type IN ('menu', 'ai', 'uploaded', 'logo')
  ),
  generated_image_url text,       -- URL of Gemini-generated image (mode 3)

  -- Sora API Job Tracking
  sora_video_id text UNIQUE,      -- OpenAI video job ID (e.g., "video_abc123...")
  sora_model text NOT NULL DEFAULT 'sora-2' CHECK (
    sora_model IN ('sora-2', 'sora-2-pro')
  ),
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'in_progress', 'completed', 'failed')
  ),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- Generated Assets
  video_url text,                 -- Final video URL (Supabase Storage)
  thumbnail_url text,             -- Thumbnail URL (Supabase Storage)
  spritesheet_url text,           -- Spritesheet URL (optional)

  -- Voice-Over Configuration (Phase 2 - Future Enhancement)
  voice_enabled boolean DEFAULT false,              -- Whether voice-over is enabled
  voice_script text,                                -- Voice-over narration script
  voice_model text,                                 -- ElevenLabs model ('eleven_flash_v2_5', etc.)
  voice_id text,                                    -- ElevenLabs voice ID
  voice_settings jsonb,                             -- Voice settings (stability, style, etc.)
  elevenlabs_audio_id text,                         -- ElevenLabs request ID
  audio_url text,                                   -- Generated audio file URL
  final_video_url text,                             -- Video with audio overlay (if voice enabled)

  -- Configuration Storage (JSON)
  video_config jsonb DEFAULT '{"size": "1280x720", "seconds": 8}'::jsonb,
  gemini_config jsonb,            -- Gemini-specific config (aspect ratio, etc.)

  -- Error Handling
  error_message text,             -- Error description if failed
  retry_count integer DEFAULT 0,  -- Number of retry attempts

  -- Metadata
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,       -- When job reached 'completed' status

  -- Constraints
  CONSTRAINT valid_mode_1_config CHECK (
    mode != 'image-to-video' OR source_image_id IS NOT NULL
  ),
  CONSTRAINT valid_mode_3_config CHECK (
    mode != 'generated-image-to-video' OR image_prompt IS NOT NULL
  )
);
```

### Indexes

```sql
-- Primary lookup by status (for polling/monitoring)
CREATE INDEX idx_social_videos_status
  ON social_media_videos(status, created_at DESC);

-- Lookup by organisation (for user queries)
CREATE INDEX idx_social_videos_org
  ON social_media_videos(organisation_id, created_at DESC);

-- Lookup by restaurant (for filtering)
CREATE INDEX idx_social_videos_restaurant
  ON social_media_videos(restaurant_id, created_at DESC);

-- Lookup by Sora video ID (for webhook/status updates)
CREATE INDEX idx_social_videos_sora_id
  ON social_media_videos(sora_video_id)
  WHERE sora_video_id IS NOT NULL;

-- Lookup by user (for user's video history)
CREATE INDEX idx_social_videos_user
  ON social_media_videos(created_by, created_at DESC);

-- Composite index for active jobs
CREATE INDEX idx_social_videos_active
  ON social_media_videos(status, updated_at DESC)
  WHERE status IN ('queued', 'in_progress');

-- Index for voice-enabled videos (Phase 2)
CREATE INDEX idx_social_videos_voice_enabled
  ON social_media_videos(voice_enabled, created_at DESC)
  WHERE voice_enabled = true;
```

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE social_media_videos ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view videos in their organization
CREATE POLICY "view_org_videos"
  ON social_media_videos
  FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can create videos in their organization
CREATE POLICY "create_org_videos"
  ON social_media_videos
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Policy: Users can update their own videos in their organization
CREATE POLICY "update_own_videos"
  ON social_media_videos
  FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Policy: Users can delete their own videos in their organization
CREATE POLICY "delete_own_videos"
  ON social_media_videos
  FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Policy: Super admins can view all videos
CREATE POLICY "superadmin_view_all"
  ON social_media_videos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'super_admin'
    )
  );
```

### Triggers

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_social_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER social_videos_updated_at
  BEFORE UPDATE ON social_media_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_social_videos_updated_at();

-- Auto-set completed_at when status changes to 'completed'
CREATE OR REPLACE FUNCTION set_social_videos_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER social_videos_completed_at
  BEFORE UPDATE ON social_media_videos
  FOR EACH ROW
  EXECUTE FUNCTION set_social_videos_completed_at();
```

## Supabase Storage Buckets

### Bucket: `social-media-videos`

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media-videos', 'social-media-videos', false);

-- Storage policies
CREATE POLICY "Users can upload to their org's folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'social-media-videos'
    AND (storage.foldername(name))[1] IN (
      SELECT organisation_id::text
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read their org's files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'social-media-videos'
    AND (storage.foldername(name))[1] IN (
      SELECT organisation_id::text
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their org's files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'social-media-videos'
    AND (storage.foldername(name))[1] IN (
      SELECT organisation_id::text
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
  );
```

### Storage Structure

```
social-media-videos/
├── {organisation_id}/
│   ├── videos/
│   │   └── {job_id}.mp4
│   ├── thumbnails/
│   │   └── {job_id}.webp
│   └── generated-images/
│       └── {job_id}.png
```

## Sample Data

### Example Records

```sql
-- Mode 1: Database Image → Video
INSERT INTO social_media_videos (
  organisation_id,
  restaurant_id,
  menu_item_id,
  mode,
  prompt,
  source_image_id,
  source_image_url,
  sora_model,
  status,
  created_by,
  video_config
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',  -- org_id
  '223e4567-e89b-12d3-a456-426614174001',  -- restaurant_id
  '323e4567-e89b-12d3-a456-426614174002',  -- menu_item_id
  'image-to-video',
  'The burger sizzles on the grill, steam rising dramatically',
  '423e4567-e89b-12d3-a456-426614174003',  -- source_image_id
  'https://storage.supabase.co/menu-images/burger.jpg',
  'sora-2',
  'queued',
  '523e4567-e89b-12d3-a456-426614174004',  -- user_id
  '{"size": "1280x720", "seconds": 8}'::jsonb
);

-- Mode 2: Text → Video
INSERT INTO social_media_videos (
  organisation_id,
  restaurant_id,
  mode,
  prompt,
  sora_model,
  status,
  created_by,
  video_config
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  '223e4567-e89b-12d3-a456-426614174001',
  'text-to-video',
  'Cozy restaurant interior, warm lighting, camera pans across tables',
  'sora-2-pro',
  'queued',
  '523e4567-e89b-12d3-a456-426614174004',
  '{"size": "1920x1080", "seconds": 12}'::jsonb
);

-- Mode 3: Generated Image → Video
INSERT INTO social_media_videos (
  organisation_id,
  restaurant_id,
  mode,
  prompt,
  image_prompt,
  sora_model,
  status,
  created_by,
  video_config,
  gemini_config
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  '223e4567-e89b-12d3-a456-426614174001',
  'generated-image-to-video',
  'Camera slowly orbits around the dish, highlighting vibrant colors',
  'Professional food photography of a taco platter with fresh ingredients',
  'sora-2',
  'queued',
  '523e4567-e89b-12d3-a456-426614174004',
  '{"size": "1280x720", "seconds": 8}'::jsonb,
  '{"aspectRatio": "16:9"}'::jsonb
);
```

## Queries

### Common Queries

```sql
-- Get all videos for a user's organization
SELECT * FROM social_media_videos
WHERE organisation_id IN (
  SELECT organisation_id FROM user_organisations
  WHERE user_id = :user_id
)
ORDER BY created_at DESC
LIMIT 50;

-- Get active (in-progress) jobs
SELECT * FROM social_media_videos
WHERE status IN ('queued', 'in_progress')
ORDER BY created_at ASC;

-- Get videos for a specific restaurant
SELECT * FROM social_media_videos
WHERE restaurant_id = :restaurant_id
  AND organisation_id = :organisation_id
ORDER BY created_at DESC;

-- Get job by Sora video ID (for webhook updates)
SELECT * FROM social_media_videos
WHERE sora_video_id = :sora_video_id;

-- Get failed jobs for retry
SELECT * FROM social_media_videos
WHERE status = 'failed'
  AND retry_count < 3
  AND organisation_id = :organisation_id
ORDER BY created_at DESC;

-- Get usage statistics
SELECT
  organisation_id,
  COUNT(*) as total_videos,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE mode = 'image-to-video') as mode1,
  COUNT(*) FILTER (WHERE mode = 'text-to-video') as mode2,
  COUNT(*) FILTER (WHERE mode = 'generated-image-to-video') as mode3
FROM social_media_videos
WHERE created_at > now() - interval '30 days'
GROUP BY organisation_id;
```

## Migration Files

### Migration: Create Social Media Videos Table

**Filename**: `20250107_create_social_media_videos.sql`

```sql
-- Create social_media_videos table
CREATE TABLE social_media_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  menu_id uuid REFERENCES menus(id) ON DELETE SET NULL,
  menu_item_id uuid,
  mode text NOT NULL CHECK (mode IN ('image-to-video', 'text-to-video', 'generated-image-to-video')),
  prompt text NOT NULL,
  image_prompt text,
  source_image_id uuid,
  source_image_url text,
  generated_image_url text,
  sora_video_id text UNIQUE,
  sora_model text NOT NULL DEFAULT 'sora-2' CHECK (sora_model IN ('sora-2', 'sora-2-pro')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  video_url text,
  thumbnail_url text,
  spritesheet_url text,
  voice_enabled boolean DEFAULT false,
  voice_script text,
  voice_model text,
  voice_id text,
  voice_settings jsonb,
  elevenlabs_audio_id text,
  audio_url text,
  final_video_url text,
  video_config jsonb DEFAULT '{"size": "1280x720", "seconds": 8}'::jsonb,
  gemini_config jsonb,
  error_message text,
  retry_count integer DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT valid_mode_1_config CHECK (mode != 'image-to-video' OR source_image_id IS NOT NULL),
  CONSTRAINT valid_mode_3_config CHECK (mode != 'generated-image-to-video' OR image_prompt IS NOT NULL)
);

-- Create indexes
CREATE INDEX idx_social_videos_status ON social_media_videos(status, created_at DESC);
CREATE INDEX idx_social_videos_org ON social_media_videos(organisation_id, created_at DESC);
CREATE INDEX idx_social_videos_restaurant ON social_media_videos(restaurant_id, created_at DESC);
CREATE INDEX idx_social_videos_sora_id ON social_media_videos(sora_video_id) WHERE sora_video_id IS NOT NULL;
CREATE INDEX idx_social_videos_user ON social_media_videos(created_by, created_at DESC);
CREATE INDEX idx_social_videos_active ON social_media_videos(status, updated_at DESC) WHERE status IN ('queued', 'in_progress');
CREATE INDEX idx_social_videos_voice_enabled ON social_media_videos(voice_enabled, created_at DESC) WHERE voice_enabled = true;

-- Enable RLS
ALTER TABLE social_media_videos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "view_org_videos" ON social_media_videos FOR SELECT USING (
  organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
);

CREATE POLICY "create_org_videos" ON social_media_videos FOR INSERT WITH CHECK (
  organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "update_own_videos" ON social_media_videos FOR UPDATE USING (
  organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "delete_own_videos" ON social_media_videos FOR DELETE USING (
  organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "superadmin_view_all" ON social_media_videos FOR SELECT USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'super_admin')
);

-- Create triggers
CREATE OR REPLACE FUNCTION update_social_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER social_videos_updated_at
  BEFORE UPDATE ON social_media_videos
  FOR EACH ROW EXECUTE FUNCTION update_social_videos_updated_at();

CREATE OR REPLACE FUNCTION set_social_videos_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER social_videos_completed_at
  BEFORE UPDATE ON social_media_videos
  FOR EACH ROW EXECUTE FUNCTION set_social_videos_completed_at();

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('social-media-videos', 'social-media-videos', false);

-- Create storage policies
CREATE POLICY "org_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'social-media-videos'
  AND (storage.foldername(name))[1] IN (
    SELECT organisation_id::text FROM user_organisations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "org_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'social-media-videos'
  AND (storage.foldername(name))[1] IN (
    SELECT organisation_id::text FROM user_organisations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "org_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'social-media-videos'
  AND (storage.foldername(name))[1] IN (
    SELECT organisation_id::text FROM user_organisations WHERE user_id = auth.uid()
  )
);
```

## Rollback Migration

**Filename**: `20250107_rollback_social_media_videos.sql`

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS social_videos_completed_at ON social_media_videos;
DROP TRIGGER IF EXISTS social_videos_updated_at ON social_media_videos;

-- Drop functions
DROP FUNCTION IF EXISTS set_social_videos_completed_at();
DROP FUNCTION IF EXISTS update_social_videos_updated_at();

-- Drop storage policies
DROP POLICY IF EXISTS "org_delete" ON storage.objects;
DROP POLICY IF EXISTS "org_read" ON storage.objects;
DROP POLICY IF EXISTS "org_upload" ON storage.objects;

-- Delete storage bucket
DELETE FROM storage.buckets WHERE id = 'social-media-videos';

-- Drop table (cascade will drop indexes and policies)
DROP TABLE IF EXISTS social_media_videos CASCADE;
```

---

## Table: `social_media_images`

### Purpose
Tracks standalone AI image generation jobs (using Google Gemini), including uploaded images and multi-source image composition.

### Schema

```sql
CREATE TABLE social_media_images (
  -- Primary Key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context & Relationships
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  menu_id uuid REFERENCES menus(id) ON DELETE SET NULL,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,

  -- Generation Configuration
  mode varchar NOT NULL CHECK (
    mode IN ('uploaded', 'text-to-image', 'reference-images')
  ),
  prompt text,                    -- User-provided text prompt (required for text-to-image, reference-images)

  -- Reference Images (for reference-images mode)
  reference_image_ids uuid[],     -- Array of image IDs (backwards compatibility)
  reference_image_sources jsonb,  -- Array of source metadata: [{ "id": "uuid", "sourceType": "menu" | "ai" | "uploaded" | "logo" }]

  -- Gemini API Job Tracking
  gemini_request_id text,         -- Gemini request ID (if applicable)
  gemini_model varchar DEFAULT 'gemini-2.5-flash-image',

  -- Configuration Storage (JSON)
  image_config jsonb NOT NULL,    -- Image configuration (aspectRatio, etc.)
  gemini_config jsonb,            -- Gemini-specific config

  -- Job Status
  status varchar NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'in_progress', 'completed', 'failed')
  ),
  progress integer DEFAULT 0,
  error_message text,
  retry_count integer DEFAULT 0,

  -- Generated Assets
  image_url text,                 -- Final image URL (Supabase Storage)
  thumbnail_url text,             -- Thumbnail URL (Supabase Storage)
  storage_path text,              -- Storage path
  width integer,                  -- Image width in pixels
  height integer,                 -- Image height in pixels
  file_size integer,              -- File size in bytes

  -- Metadata
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
```

### Indexes

```sql
-- Primary lookup by status
CREATE INDEX idx_social_images_status
  ON social_media_images(status, created_at DESC);

-- Lookup by organisation
CREATE INDEX idx_social_images_org
  ON social_media_images(organisation_id, created_at DESC);

-- Lookup by restaurant (for filtering)
CREATE INDEX idx_social_images_restaurant
  ON social_media_images(restaurant_id, created_at DESC);

-- Lookup by mode
CREATE INDEX idx_social_images_mode
  ON social_media_images(mode, created_at DESC);

-- Lookup by user
CREATE INDEX idx_social_images_user
  ON social_media_images(created_by, created_at DESC);
```

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE social_media_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view images in their organization
CREATE POLICY "view_org_images"
  ON social_media_images
  FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can create images in their organization
CREATE POLICY "create_org_images"
  ON social_media_images
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Policy: Users can update their own images
CREATE POLICY "update_own_images"
  ON social_media_images
  FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Policy: Users can delete their own images
CREATE POLICY "delete_own_images"
  ON social_media_images
  FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM user_organisations
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );
```

---

## Recent Migrations (Image Reference Unification)

### Migration 1: Add reference_image_sources to social_media_images

**Date**: 2025-10-10
**Purpose**: Enable mixed-source image composition (menu + AI + uploaded + logos)

```sql
ALTER TABLE social_media_images
ADD COLUMN reference_image_sources jsonb DEFAULT NULL;

COMMENT ON COLUMN social_media_images.reference_image_sources IS
'Array of source metadata objects for reference images. Format: [{ "id": "uuid", "sourceType": "menu" | "ai" | "uploaded" | "logo" }]. This allows mixed-source image composition (e.g., menu items + logos + AI images).';
```

### Migration 2: Add source_image_type to social_media_videos

**Date**: 2025-10-10
**Purpose**: Track source type for Mode 1 video generation (image-to-video)

```sql
ALTER TABLE social_media_videos
ADD COLUMN source_image_type text DEFAULT NULL;

ALTER TABLE social_media_videos
ADD CONSTRAINT source_image_type_check
CHECK (source_image_type IS NULL OR source_image_type IN ('menu', 'ai', 'uploaded', 'logo'));

COMMENT ON COLUMN social_media_videos.source_image_type IS
'Type of source image used in image-to-video mode: "menu" (item_images table), "ai" (social_media_images AI-generated), "uploaded" (social_media_images uploaded), "logo" (restaurants table). NULL for text-to-video and generated-image-to-video modes.';
```

### Migration 3: Consolidate Image Generation Modes

**Date**: 2025-10-10
**Purpose**: Merge 'image-reference' and 'remix' modes into unified 'reference-images' mode

```sql
-- Update existing records
UPDATE social_media_images
SET mode = 'reference-images'
WHERE mode IN ('image-reference', 'remix');

-- Update constraint
ALTER TABLE social_media_images
DROP CONSTRAINT IF EXISTS valid_mode;

ALTER TABLE social_media_images
ADD CONSTRAINT valid_mode
CHECK (mode IN ('uploaded', 'text-to-image', 'reference-images'));

COMMENT ON COLUMN social_media_images.mode IS
'Image generation mode: "uploaded" (direct file upload), "text-to-image" (AI generation from text), "reference-images" (blend multiple images from any source - replaces old "image-reference" and "remix" modes)';
```

**Migration Result**:
- ✅ 6 records migrated from 'image-reference'/'remix' to 'reference-images'
- ✅ Current modes: uploaded (4), text-to-image (7), reference-images (6)

---

Last Updated: 2025-10-10
