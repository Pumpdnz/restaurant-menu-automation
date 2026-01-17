# Implementation Guide: Instagram & Facebook Integration

## Overview

This comprehensive guide walks through implementing Instagram and Facebook posting integration into the Pumpd platform, from initial setup to production deployment.

## Prerequisites

Before starting implementation:

- [ ] Node.js backend (Express.js or similar)
- [ ] React/TypeScript frontend
- [ ] Supabase database access
- [ ] Domain with HTTPS
- [ ] Meta Developer account

## Part 1: Initial Setup

### 1.1 Create Meta App

**Navigate to**: https://developers.facebook.com/apps/

1. Click "Create App"
2. Select "Business" as app type
3. Fill in app details:
   - **App Name**: "Pumpd Social Integration"
   - **App Contact Email**: Your support email
   - **Business Account**: Select or create
4. Click "Create App"

### 1.2 Configure App

**App Settings > Basic**:

```yaml
App Display Name: Pumpd Social Integration
App Domains: pumpd.co.nz, admin.pumpd.co.nz
Privacy Policy URL: https://pumpd.co.nz/privacy
Terms of Service URL: https://pumpd.co.nz/terms
Data Deletion Instructions: https://pumpd.co.nz/data-deletion
App Icon: Upload 1024x1024px PNG
Category: Business and Pages
```

**Save changes**

### 1.3 Add Products

**Dashboard > Add Products**:

1. Click "Set Up" on **Instagram**
   - Product: Instagram
   - Features: Instagram API with Instagram Login

2. Click "Set Up" on **Facebook Login**
   - Use default settings
   - Valid OAuth Redirect URIs:
     ```
     https://admin.pumpd.co.nz/auth/meta/callback
     http://localhost:3000/auth/meta/callback (for development)
     ```

### 1.4 Get App Credentials

**Settings > Basic**:

```
App ID: 123456789012345
App Secret: [click "Show" to reveal]
```

Save these securely - you'll need them for environment variables.

### 1.5 Create Test Accounts

**Roles > Test Users**:

1. Click "Create Test Users"
2. Create 2-3 test users
3. For each test user:
   - Log in as test user
   - Create Instagram Business account
   - Create Facebook Page
   - Link Instagram to Page

## Part 2: Database Setup

### 2.1 Run Migrations

```bash
# Connect to your Supabase database
psql your_database_url

# Run the migration
\i migrations/001_create_social_media_tables.sql
```

**Migration file**: See `04-DATABASE-SCHEMA.md` for complete SQL

### 2.2 Verify Tables Created

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'social_media%';

-- Expected output:
-- social_media_accounts
-- social_media_posts
```

### 2.3 Test RLS Policies

```sql
-- As authenticated user, should work
SELECT * FROM social_media_accounts;

-- As anonymous, should fail
SET ROLE anon;
SELECT * FROM social_media_accounts;
RESET ROLE;
```

## Part 3: Backend Implementation

### 3.1 Environment Variables

**.env**:

```bash
# Meta/Facebook
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_GRAPH_API_VERSION=v22.0

# OAuth
OAUTH_REDIRECT_URI=https://admin.pumpd.co.nz/auth/meta/callback
OAUTH_STATE_SECRET=generate_random_32_char_string

# Encryption (generate 32-byte key)
ENCRYPTION_KEY=generate_64_char_hex_string

# Supabase (existing)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Generate keys**:

```bash
# OAUTH_STATE_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.2 Install Dependencies

```bash
npm install --save axios redis ioredis
```

### 3.3 Create Encryption Utilities

**utils/encryption.js**:

```javascript
const crypto = require('crypto');

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

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

module.exports = { encrypt, decrypt };
```

### 3.4 Create OAuth Service

**services/oauth-service.js**:

See complete implementation in `06-OAUTH-FLOW.md`

Key methods:
- `generateAuthUrl(platform, organisationId, userId)`
- `handleCallback(code, state)`
- `refreshToken(accountId)`

### 3.5 Create Instagram Publish Service

**services/instagram-publish-service.js**:

```javascript
const axios = require('axios');

class InstagramPublishService {
  constructor() {
    this.baseUrl = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION}`;
  }

  async createContainer({ igUserId, mediaUrl, caption, mediaType = 'IMAGE', accessToken }) {
    const payload = {
      access_token: accessToken,
      caption: caption
    };

    if (mediaType === 'IMAGE') {
      payload.image_url = mediaUrl;
    } else if (mediaType === 'VIDEO') {
      payload.video_url = mediaUrl;
      payload.media_type = 'VIDEO';
    } else if (mediaType === 'REELS') {
      payload.video_url = mediaUrl;
      payload.media_type = 'REELS';
      payload.share_to_feed = true;
    }

    const response = await axios.post(
      `${this.baseUrl}/${igUserId}/media`,
      payload
    );

    return response.data.id; // Container ID
  }

  async checkContainerStatus(containerId, accessToken) {
    const response = await axios.get(
      `${this.baseUrl}/${containerId}`,
      {
        params: {
          fields: 'status_code,status',
          access_token: accessToken
        }
      }
    );

    return response.data;
  }

  async publishContainer(igUserId, containerId, accessToken) {
    const response = await axios.post(
      `${this.baseUrl}/${igUserId}/media_publish`,
      {
        creation_id: containerId,
        access_token: accessToken
      }
    );

    return response.data.id; // Published media ID
  }

  async publish({ igUserId, mediaUrl, caption, mediaType, accessToken }) {
    // Step 1: Create container
    const containerId = await this.createContainer({
      igUserId,
      mediaUrl,
      caption,
      mediaType,
      accessToken
    });

    // Step 2: Poll for completion
    let status = 'IN_PROGRESS';
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max

    while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusData = await this.checkContainerStatus(containerId, accessToken);
      status = statusData.status_code;
      attempts++;
    }

    if (status !== 'FINISHED') {
      throw new Error(`Container not ready. Status: ${status}`);
    }

    // Step 3: Publish
    const mediaId = await this.publishContainer(igUserId, containerId, accessToken);

    return {
      mediaId,
      containerId,
      permalink: `https://www.instagram.com/p/${mediaId}/`
    };
  }
}

module.exports = new InstagramPublishService();
```

### 3.6 Create API Routes

**routes/social-auth-routes.js**:

```javascript
const express = require('express');
const router = express.Router();
const oauthService = require('../services/oauth-service');
const { requireAuth } = require('../middleware/auth');

// Initiate OAuth flow
router.get('/api/auth/social/connect/:platform', requireAuth, async (req, res) => {
  try {
    const { platform } = req.params;
    const { organisationId, id: userId } = req.user;

    const authUrl = await oauthService.generateAuthUrl(platform, organisationId, userId);

    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OAuth callback
router.get('/auth/meta/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`/settings/social-accounts?error=${encodeURIComponent(error)}`);
    }

    await oauthService.handleCallback(code, state);

    res.redirect('/settings/social-accounts?success=connected');
  } catch (error) {
    res.redirect(`/settings/social-accounts?error=${encodeURIComponent(error.message)}`);
  }
});

// Disconnect account
router.delete('/api/social/accounts/:accountId', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { organisationId } = req.user;

    await oauthService.disconnectAccount(accountId, organisationId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

**routes/social-posts-routes.js**:

```javascript
const express = require('express');
const router = express.Router();
const instagramPublishService = require('../services/instagram-publish-service');
const facebookPublishService = require('../services/facebook-publish-service');
const { requireAuth } = require('../middleware/auth');
const { decrypt } = require('../utils/encryption');
const supabase = require('../lib/supabase');

// Create new post
router.post('/api/social/posts', requireAuth, async (req, res) => {
  try {
    const {
      socialAccountId,
      contentUrl,
      caption,
      postType, // 'feed', 'reel', 'story'
      platform
    } = req.body;

    const { organisationId, id: userId } = req.user;

    // Get social account
    const { data: account } = await supabase
      .from('social_media_accounts')
      .select('*')
      .eq('id', socialAccountId)
      .eq('organisation_id', organisationId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Social account not found' });
    }

    // Decrypt access token
    const accessToken = decrypt(account.access_token);

    // Create post record
    const { data: post } = await supabase
      .from('social_media_posts')
      .insert({
        organisation_id: organisationId,
        social_account_id: socialAccountId,
        created_by: userId,
        content_type: 'video',
        content_url: contentUrl,
        caption: caption,
        post_type: postType,
        platform: platform,
        status: 'processing'
      })
      .select()
      .single();

    // Publish asynchronously
    publishPost(post.id, account, accessToken, contentUrl, caption, postType, platform)
      .catch(error => console.error('Publishing error:', error));

    res.json({ postId: post.id, status: 'processing' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function publishPost(postId, account, accessToken, contentUrl, caption, postType, platform) {
  try {
    let result;

    if (platform === 'instagram') {
      const mediaType = postType === 'reel' ? 'REELS' : postType === 'story' ? 'STORIES' : 'VIDEO';

      result = await instagramPublishService.publish({
        igUserId: account.platform_account_id,
        mediaUrl: contentUrl,
        caption: caption,
        mediaType: mediaType,
        accessToken: accessToken
      });
    } else if (platform === 'facebook') {
      result = await facebookPublishService.publish({
        pageId: account.platform_account_id,
        mediaUrl: contentUrl,
        caption: caption,
        accessToken: accessToken
      });
    }

    // Update post as published
    await supabase
      .from('social_media_posts')
      .update({
        status: 'published',
        platform_post_id: result.mediaId,
        platform_url: result.permalink,
        published_at: new Date()
      })
      .eq('id', postId);

  } catch (error) {
    // Update post as failed
    await supabase
      .from('social_media_posts')
      .update({
        status: 'failed',
        error_message: error.message,
        retry_count: supabase.raw('retry_count + 1')
      })
      .eq('id', postId);

    throw error;
  }
}

// Get posts
router.get('/api/social/posts', requireAuth, async (req, res) => {
  try {
    const { organisationId } = req.user;
    const { status, platform, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('social_media_posts')
      .select(`
        *,
        social_media_accounts (
          id,
          platform,
          username
        )
      `)
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data: posts, error } = await query;

    if (error) throw error;

    res.json({ posts });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

## Part 4: Frontend Implementation

### 4.1 Create OAuth Hook

**hooks/useSocialAuth.ts**:

```typescript
import { useState } from 'react';

export function useSocialAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectAccount = async (platform: 'instagram' | 'facebook') => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/auth/social/connect/${platform}`);
      const { authUrl } = await response.json();

      // Redirect to Meta OAuth
      window.location.href = authUrl;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const disconnectAccount = async (accountId: string) => {
    try {
      setLoading(true);
      setError(null);

      await fetch(`/api/social/accounts/${accountId}`, {
        method: 'DELETE'
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  return { connectAccount, disconnectAccount, loading, error };
}
```

### 4.2 Create Social Accounts Page

**pages/SocialAccountsSettings.tsx**:

```typescript
import React, { useEffect, useState } from 'react';
import { useSocialAuth } from '@/hooks/useSocialAuth';

interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  profile_picture_url: string;
  status: string;
  connected_at: string;
}

export function SocialAccountsSettings() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const { connectAccount, disconnectAccount, loading } = useSocialAuth();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const response = await fetch('/api/social/accounts');
    const { accounts } = await response.json();
    setAccounts(accounts);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Social Media Accounts</h2>
        <p className="text-gray-600">
          Connect your Instagram and Facebook accounts to post content directly.
        </p>
      </div>

      <div className="grid gap-4">
        {accounts.map(account => (
          <div key={account.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={account.profile_picture_url}
                alt={account.username}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <div className="font-semibold">{account.username}</div>
                <div className="text-sm text-gray-500 capitalize">
                  {account.platform} • {account.status}
                </div>
              </div>
            </div>
            <button
              onClick={() => disconnectAccount(account.id)}
              disabled={loading}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded"
            >
              Disconnect
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => connectAccount('instagram')}
          disabled={loading}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90"
        >
          Connect Instagram
        </button>
        <button
          onClick={() => connectAccount('facebook')}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Connect Facebook
        </button>
      </div>
    </div>
  );
}
```

### 4.3 Create Post Modal

**components/PostToSocialModal.tsx**:

```typescript
import React, { useState, useEffect } from 'react';

interface PostToSocialModalProps {
  contentUrl: string;
  thumbnailUrl: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PostToSocialModal({
  contentUrl,
  thumbnailUrl,
  onClose,
  onSuccess
}: PostToSocialModalProps) {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [caption, setCaption] = useState('');
  const [postType, setPostType] = useState('feed');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const response = await fetch('/api/social/accounts?status=active');
    const { accounts } = await response.json();
    setAccounts(accounts);
    if (accounts.length > 0) {
      setSelectedAccount(accounts[0].id);
    }
  };

  const handlePost = async () => {
    try {
      setLoading(true);

      const account = accounts.find(a => a.id === selectedAccount);

      await fetch('/api/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socialAccountId: selectedAccount,
          contentUrl,
          caption,
          postType,
          platform: account.platform
        })
      });

      onSuccess();
      onClose();

    } catch (error) {
      console.error('Failed to post:', error);
      alert('Failed to post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h3 className="text-xl font-bold mb-4">Post to Social Media</h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <video src={contentUrl} poster={thumbnailUrl} controls className="w-full rounded" />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Account</label>
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.platform} - @{account.username}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Post Type</label>
              <select
                value={postType}
                onChange={e => setPostType(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="feed">Feed Post</option>
                <option value="reel">Instagram Reel</option>
                <option value="story">Instagram Story</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Caption ({caption.length}/2200)
              </label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={2200}
                rows={6}
                className="w-full border rounded px-3 py-2"
                placeholder="Write a caption..."
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={loading || !selectedAccount}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Posting...' : 'Publish Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Part 5: Testing

### 5.1 Unit Tests

Create tests for critical services using Jest or Mocha.

### 5.2 Manual Testing Checklist

OAuth Flow:
- [ ] Click "Connect Instagram" redirects to Meta
- [ ] Login and authorize works
- [ ] Callback returns to app successfully
- [ ] Account appears in connected accounts list

Publishing:
- [ ] Select video and click "Post to Instagram"
- [ ] Modal opens with correct video
- [ ] Can write caption
- [ ] Can select account
- [ ] Click "Publish" successfully posts
- [ ] Success message appears
- [ ] Post appears on Instagram

Error Handling:
- [ ] Expired token shows reconnect prompt
- [ ] Network errors show user-friendly message
- [ ] Invalid content shows validation error

## Part 6: App Review Submission

See detailed guide in `07-APP-REVIEW-PROCESS.md`

### Key Steps:

1. Record screen videos (30-120 seconds)
2. Write detailed descriptions
3. Prepare test credentials
4. Submit each permission
5. Monitor review status
6. Address any feedback
7. Resubmit if rejected

**Timeline**: 3-7 business days

## Part 7: Production Deployment

### 7.1 Pre-Launch Checklist

- [ ] All tests passing
- [ ] Meta app approved
- [ ] Privacy policy published
- [ ] Data deletion page published
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Monitoring set up (alerts for failures)
- [ ] Documentation written
- [ ] Support team trained

### 7.2 Deploy to Production

```bash
# Update environment variables
META_APP_MODE=production

# Deploy backend
git push production main

# Deploy frontend
npm run build
# Upload build to hosting
```

### 7.3 Beta Testing

1. Select 3-5 engaged restaurant clients
2. Enable feature for beta users only
3. Monitor usage daily
4. Collect feedback
5. Iterate on issues
6. Full launch after 1-2 weeks

## Part 8: Monitoring & Maintenance

### 8.1 Set Up Monitoring

Monitor these metrics:
- Connection success rate
- Post success rate
- API error rate
- Token refresh success rate
- User adoption rate

### 8.2 Scheduled Jobs

Set up cron jobs:
- Daily token refresh check
- Daily analytics sync (Phase 3)
- Weekly usage reports

### 8.3 Meta API Updates

- Subscribe to Meta Developer changelog
- Test on staging when new versions release
- Update API version annually

---

## Troubleshooting

### "Invalid OAuth Redirect URI"

**Solution**: Ensure exact match in Meta app settings:
- Check for trailing slashes
- Verify HTTPS in production
- Add both production and development URLs

### "Permissions Error" when posting

**Solution**:
- Verify account is Business type
- Check app permissions granted
- Ensure account is linked to Facebook Page

### Posts failing with "Media Upload Failed"

**Solution**:
- Verify media URLs are publicly accessible
- Check file format (MP4 for video, JPG/PNG for images)
- Ensure file size within limits
- Test URL in browser directly

---

**Last Updated**: January 2025
**Implementation Time**: 2-3 weeks
**Next Steps**: Begin with Part 1 - Initial Setup
