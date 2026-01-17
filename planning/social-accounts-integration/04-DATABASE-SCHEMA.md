# Database Schema: Instagram & Facebook Integration

## Overview

This document defines the database schema required to support Instagram and Facebook account connection and content publishing.

## New Tables

### 1. `social_media_accounts`

Stores connected social media accounts (Instagram Business, Facebook Pages).

```sql
CREATE TABLE social_media_accounts (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Platform information
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  account_type TEXT CHECK (account_type IN ('business', 'creator', 'page')),
  platform_account_id TEXT NOT NULL, -- Instagram User ID or Facebook Page ID
  username TEXT, -- @handle for Instagram, Page name for Facebook
  profile_picture_url TEXT,

  -- Authentication tokens (encrypted at application level)
  access_token TEXT NOT NULL, -- Should be encrypted
  token_expires_at TIMESTAMPTZ,
  refresh_token TEXT, -- For platforms that support refresh (encrypted)

  -- Facebook-specific fields
  page_id TEXT, -- Facebook Page ID (required for Instagram Business accounts)
  page_name TEXT,

  -- Connection metadata
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  last_token_refresh TIMESTAMPTZ,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disconnected', 'error')),
  error_message TEXT,
  connection_error_count INTEGER DEFAULT 0,

  -- Capabilities
  can_publish_feed BOOLEAN DEFAULT true,
  can_publish_stories BOOLEAN DEFAULT false,
  can_publish_reels BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(organisation_id, platform, platform_account_id)
);

-- Indexes for performance
CREATE INDEX idx_social_accounts_org ON social_media_accounts(organisation_id);
CREATE INDEX idx_social_accounts_platform ON social_media_accounts(platform);
CREATE INDEX idx_social_accounts_status ON social_media_accounts(status);
CREATE INDEX idx_social_accounts_token_expiry ON social_media_accounts(token_expires_at)
  WHERE status = 'active';

-- RLS Policies
ALTER TABLE social_media_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organisation's social accounts"
  ON social_media_accounts FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create social accounts for their organisation"
  ON social_media_accounts FOR INSERT
  WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their organisation's social accounts"
  ON social_media_accounts FOR UPDATE
  USING (organisation_id IN (
    SELECT organisation_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete their organisation's social accounts"
  ON social_media_accounts FOR DELETE
  USING (organisation_id IN (
    SELECT organisation_id FROM users WHERE id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON social_media_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 2. `social_media_posts`

Tracks posts (draft, scheduled, published) to social media platforms.

```sql
CREATE TABLE social_media_posts (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES social_media_accounts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),

  -- Content reference
  content_type TEXT NOT NULL CHECK (content_type IN ('video', 'image')),
  content_id UUID, -- References social_media_videos.id or future images table
  content_url TEXT NOT NULL, -- Direct URL to the content
  thumbnail_url TEXT,

  -- Post configuration
  caption TEXT CHECK (char_length(caption) <= 2200),
  post_type TEXT NOT NULL CHECK (post_type IN ('feed', 'reel', 'story', 'carousel')),
  hashtags TEXT[], -- Array of hashtags without #
  location_id TEXT, -- Instagram/Facebook location ID

  -- Publishing configuration
  share_to_feed BOOLEAN DEFAULT false, -- For Reels: also share to feed

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,

  -- Platform response
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  platform_post_id TEXT, -- Instagram Media ID or Facebook Post ID
  platform_url TEXT, -- Permalink to the post
  container_id TEXT, -- Instagram container ID (intermediate step)

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'queued', 'processing', 'published', 'failed', 'deleted')
  ),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Analytics (synced from platform)
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  plays_count INTEGER DEFAULT 0, -- For videos
  engagement_rate DECIMAL(5,2), -- Calculated percentage

  -- Analytics metadata
  last_analytics_sync TIMESTAMPTZ,
  analytics_available BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT scheduled_or_published CHECK (
    (status = 'draft' OR status = 'failed') OR
    (scheduled_for IS NOT NULL OR published_at IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_social_posts_org ON social_media_posts(organisation_id);
CREATE INDEX idx_social_posts_account ON social_media_posts(social_account_id);
CREATE INDEX idx_social_posts_status ON social_media_posts(status);
CREATE INDEX idx_social_posts_scheduled ON social_media_posts(scheduled_for)
  WHERE status IN ('draft', 'queued');
CREATE INDEX idx_social_posts_platform_id ON social_media_posts(platform_post_id)
  WHERE platform_post_id IS NOT NULL;
CREATE INDEX idx_social_posts_content ON social_media_posts(content_id);
CREATE INDEX idx_social_posts_created_at ON social_media_posts(created_at DESC);

-- RLS Policies
ALTER TABLE social_media_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organisation's posts"
  ON social_media_posts FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create posts for their organisation"
  ON social_media_posts FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM users WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their organisation's posts"
  ON social_media_posts FOR UPDATE
  USING (organisation_id IN (
    SELECT organisation_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete their organisation's posts"
  ON social_media_posts FOR DELETE
  USING (organisation_id IN (
    SELECT organisation_id FROM users WHERE id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON social_media_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 3. `social_media_analytics_snapshots` (Optional - Phase 3)

Historical snapshots of post analytics for trend analysis.

```sql
CREATE TABLE social_media_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES social_media_posts(id) ON DELETE CASCADE,

  -- Snapshot metrics
  likes_count INTEGER NOT NULL,
  comments_count INTEGER NOT NULL,
  shares_count INTEGER NOT NULL,
  saves_count INTEGER NOT NULL,
  reach INTEGER NOT NULL,
  impressions INTEGER NOT NULL,
  plays_count INTEGER,
  engagement_rate DECIMAL(5,2),

  -- Snapshot metadata
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hours_since_published INTEGER, -- For time-based analysis

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analytics_snapshots_post ON social_media_analytics_snapshots(post_id);
CREATE INDEX idx_analytics_snapshots_time ON social_media_analytics_snapshots(snapshot_at);

-- RLS Policies
ALTER TABLE social_media_analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analytics for their organisation's posts"
  ON social_media_analytics_snapshots FOR SELECT
  USING (
    post_id IN (
      SELECT id FROM social_media_posts
      WHERE organisation_id IN (
        SELECT organisation_id FROM users WHERE id = auth.uid()
      )
    )
  );
```

## Schema Modifications to Existing Tables

### Update `social_media_videos` Table

Add field to track if video has been posted to social media:

```sql
-- Add social posting tracking
ALTER TABLE social_media_videos
  ADD COLUMN posted_to_social BOOLEAN DEFAULT false,
  ADD COLUMN post_count INTEGER DEFAULT 0;

-- Index for filtering posted/unposted content
CREATE INDEX idx_social_videos_posted ON social_media_videos(posted_to_social);
```

## Helper Functions

### 1. Update Updated At Timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Calculate Engagement Rate

```sql
CREATE OR REPLACE FUNCTION calculate_engagement_rate(
  p_post_id UUID
) RETURNS DECIMAL AS $$
DECLARE
  v_engagement INTEGER;
  v_reach INTEGER;
BEGIN
  SELECT
    COALESCE(likes_count, 0) + COALESCE(comments_count, 0) +
    COALESCE(shares_count, 0) + COALESCE(saves_count, 0),
    COALESCE(reach, 0)
  INTO v_engagement, v_reach
  FROM social_media_posts
  WHERE id = p_post_id;

  IF v_reach > 0 THEN
    RETURN ROUND((v_engagement::DECIMAL / v_reach::DECIMAL) * 100, 2);
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 3. Get Account Publishing Capabilities

```sql
CREATE OR REPLACE FUNCTION get_account_capabilities(
  p_account_id UUID
) RETURNS TABLE(
  can_post_feed BOOLEAN,
  can_post_stories BOOLEAN,
  can_post_reels BOOLEAN,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    can_publish_feed,
    can_publish_stories,
    can_publish_reels,
    status = 'active'
  FROM social_media_accounts
  WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql;
```

## Data Relationships

```
organisations
    ↓ (1:N)
social_media_accounts
    ↓ (1:N)
social_media_posts
    ↓ (1:N)
social_media_analytics_snapshots

social_media_videos
    ↓ (1:N - via content_id)
social_media_posts
```

## Migration Scripts

### Migration: Create Social Media Tables

```sql
-- Migration: 001_create_social_media_tables.sql
-- Run this migration to set up social media integration

BEGIN;

-- Helper function for updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create social_media_accounts table
-- (Insert full table definition from above)

-- Create social_media_posts table
-- (Insert full table definition from above)

-- Update existing social_media_videos table
ALTER TABLE social_media_videos
  ADD COLUMN IF NOT EXISTS posted_to_social BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_social_videos_posted
  ON social_media_videos(posted_to_social);

COMMIT;
```

### Rollback Script

```sql
-- Rollback: 001_create_social_media_tables.sql
-- Run this to undo the social media integration setup

BEGIN;

-- Drop tables (cascade will remove related data)
DROP TABLE IF EXISTS social_media_analytics_snapshots CASCADE;
DROP TABLE IF EXISTS social_media_posts CASCADE;
DROP TABLE IF EXISTS social_media_accounts CASCADE;

-- Remove added columns from social_media_videos
ALTER TABLE social_media_videos
  DROP COLUMN IF EXISTS posted_to_social,
  DROP COLUMN IF EXISTS post_count;

-- Drop helper functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS calculate_engagement_rate(UUID);
DROP FUNCTION IF EXISTS get_account_capabilities(UUID);

COMMIT;
```

## Example Queries

### 1. Get Active Social Accounts for Organization

```sql
SELECT
  id,
  platform,
  username,
  profile_picture_url,
  can_publish_feed,
  can_publish_stories,
  can_publish_reels,
  connected_at,
  last_synced_at
FROM social_media_accounts
WHERE organisation_id = 'org-uuid-here'
  AND status = 'active'
ORDER BY platform, created_at;
```

### 2. Get Scheduled Posts for Next 7 Days

```sql
SELECT
  p.id,
  p.platform,
  p.post_type,
  p.caption,
  p.scheduled_for,
  p.content_url,
  a.username AS account_username
FROM social_media_posts p
JOIN social_media_accounts a ON p.social_account_id = a.id
WHERE p.organisation_id = 'org-uuid-here'
  AND p.status IN ('draft', 'queued')
  AND p.scheduled_for BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY p.scheduled_for ASC;
```

### 3. Get Post Performance Summary

```sql
SELECT
  p.id,
  p.platform,
  p.post_type,
  p.caption,
  p.published_at,
  p.likes_count,
  p.comments_count,
  p.shares_count,
  p.reach,
  p.impressions,
  p.engagement_rate,
  a.username
FROM social_media_posts p
JOIN social_media_accounts a ON p.social_account_id = a.id
WHERE p.organisation_id = 'org-uuid-here'
  AND p.status = 'published'
  AND p.published_at >= NOW() - INTERVAL '30 days'
ORDER BY p.engagement_rate DESC NULLS LAST
LIMIT 10;
```

### 4. Get Accounts Needing Token Refresh

```sql
SELECT
  id,
  organisation_id,
  platform,
  username,
  token_expires_at,
  EXTRACT(EPOCH FROM (token_expires_at - NOW())) / 86400 AS days_until_expiry
FROM social_media_accounts
WHERE status = 'active'
  AND token_expires_at IS NOT NULL
  AND token_expires_at < NOW() + INTERVAL '7 days'
ORDER BY token_expires_at ASC;
```

### 5. Get Content Not Yet Posted to Social

```sql
SELECT
  v.id,
  v.prompt,
  v.video_url,
  v.thumbnail_url,
  v.created_at,
  v.mode,
  v.status
FROM social_media_videos v
WHERE v.organisation_id = 'org-uuid-here'
  AND v.status = 'completed'
  AND v.posted_to_social = false
  AND v.video_url IS NOT NULL
ORDER BY v.created_at DESC;
```

## Data Encryption

### Fields Requiring Encryption

The following fields contain sensitive data and should be encrypted at the application level:

- `social_media_accounts.access_token`
- `social_media_accounts.refresh_token`

### Encryption Implementation Example (Node.js)

```javascript
const crypto = require('crypto');

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

## Storage Estimates

### Per Organization (1 year)

| Table | Records/Year | Storage/Record | Total |
|-------|--------------|----------------|-------|
| `social_media_accounts` | ~3 | 1 KB | 3 KB |
| `social_media_posts` | ~365 | 2 KB | 730 KB |
| `social_media_analytics_snapshots` | ~3,650 | 0.5 KB | 1.8 MB |

**Total per organization**: ~2.5 MB/year

**100 organizations**: ~250 MB/year

Very manageable storage requirements.

---

**Last Updated**: January 2025
**Status**: Ready for Implementation
**Next Steps**: Review schema, run migrations on staging environment
