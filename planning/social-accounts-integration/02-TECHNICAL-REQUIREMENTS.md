# Technical Requirements: Instagram & Facebook Integration

## Platform Requirements

### Instagram

#### Account Prerequisites
- **Required**: Instagram Business Account OR Instagram Creator Account
- **Required**: Account must be linked to a Facebook Page
- **NOT Supported**: Personal Instagram accounts

#### Account Setup Instructions (For Restaurant Clients)
```
1. Convert Instagram account to Business/Creator:
   - Open Instagram app
   - Go to Settings > Account
   - Select "Switch to Professional Account"
   - Choose "Business" or "Creator"

2. Link to Facebook Page:
   - Settings > Account > Linked Accounts
   - Select Facebook
   - Choose or create a Facebook Page
```

### Facebook

#### Account Prerequisites
- **Required**: Facebook Page (not personal profile)
- **Required**: User must be Page Admin or Editor
- **Recommended**: Business Manager account for organization management

### Meta Developer Platform

#### Developer Account Requirements
- **Required**: Facebook Developer Account (free)
- **Required**: Business verification (if publishing >10,000 posts/day)
- **Required**: App configured with Instagram and Facebook products
- **Required**: App approved via App Review process

## API Access

### Graph API Version
- **Current Stable**: v22.0 (as of January 2025)
- **Recommended**: Use latest stable version
- **Update Cycle**: New versions every ~3 months, 2-year deprecation timeline

### Required Permissions

| Permission | Scope | Purpose |
|------------|-------|---------|
| `instagram_basic` | Instagram | Read basic Instagram account info |
| `instagram_content_publish` | Instagram | Publish content to Instagram |
| `pages_read_engagement` | Facebook | Read Page engagement data |
| `pages_manage_posts` | Facebook | Create and manage Page posts |
| `pages_show_list` | Facebook | List Pages user manages |

### Optional Permissions (For Analytics - Phase 3)
| Permission | Purpose |
|------------|---------|
| `instagram_manage_insights` | Read Instagram post insights |
| `pages_read_user_content` | Read content posted by Page |
| `read_insights` | Read Page insights and analytics |

## Content Specifications

### Instagram Content Requirements

#### Feed Posts
| Aspect | Requirement | Your Content |
|--------|-------------|--------------|
| **Image Format** | JPG, PNG | ✅ Compatible |
| **Image Size** | Max 8MB | ✅ Compatible |
| **Image Ratio** | 4:5 (portrait), 1:1 (square), 1.91:1 (landscape) | ✅ Compatible |
| **Video Format** | MP4, MOV (H.264 codec) | ✅ Compatible (Sora outputs MP4) |
| **Video Size** | Max 100MB, recommended <50MB | ✅ Compatible (4-12s videos ~5-15MB) |
| **Video Duration** | 3s - 60s | ✅ Compatible (4-12s) |
| **Video Resolution** | Min 600x600, max 1920x1920 | ✅ Compatible (720p, 1080p) |
| **Caption Length** | 2,200 characters | ✅ Compatible |
| **Hashtags** | Up to 30 | ✅ Can implement |

#### Instagram Reels
| Aspect | Requirement | Your Content |
|--------|-------------|--------------|
| **Format** | MP4, MOV (H.264 codec) | ✅ Compatible |
| **Duration** | 3s - 90s (some accounts 60s) | ✅ Compatible (4-12s) |
| **Aspect Ratio** | 9:16 (portrait) recommended | ✅ Compatible (720x1280, 1080x1920) |
| **Resolution** | Min 500x888 | ✅ Compatible |
| **Size** | Max 1GB | ✅ Compatible |
| **Caption Length** | 2,200 characters | ✅ Compatible |
| **Audio** | Optional | 🔮 Future (Phase 5 voice-over) |

#### Instagram Stories
| Aspect | Requirement | Your Content |
|--------|-------------|--------------|
| **Format** | JPG, PNG, MP4, MOV | ✅ Compatible |
| **Duration** | Video: 15s max per story | ⚠️ Videos need trimming if >15s |
| **Aspect Ratio** | 9:16 (portrait) required | ✅ Compatible (720x1280, 1080x1920) |
| **Resolution** | 1080x1920 recommended | ✅ Compatible |
| **Size** | Image max 8MB, Video max 100MB | ✅ Compatible |

### Facebook Content Requirements

#### Page Posts (Photos)
| Aspect | Requirement | Your Content |
|--------|-------------|--------------|
| **Format** | JPG, PNG, GIF | ✅ Compatible |
| **Size** | Max 4MB per image | ✅ Compatible |
| **Count** | Up to 10 images per post | ✅ Compatible |
| **Resolution** | Recommended 1200x630+ | ✅ Compatible |

#### Page Posts (Videos)
| Aspect | Requirement | Your Content |
|--------|-------------|--------------|
| **Format** | MP4, MOV | ✅ Compatible |
| **Size** | Max 10GB (recommended <1GB) | ✅ Compatible |
| **Duration** | Max 240 minutes | ✅ Compatible (4-12s) |
| **Resolution** | Min 600x315 | ✅ Compatible |
| **Aspect Ratio** | 9:16 to 16:9 | ✅ Compatible |

#### Facebook Reels
| Aspect | Requirement | Your Content |
|--------|-------------|--------------|
| **Format** | MP4, MOV | ✅ Compatible |
| **Duration** | 3s - 90s | ✅ Compatible |
| **Aspect Ratio** | 9:16 recommended | ✅ Compatible |
| **Resolution** | 1080x1920 recommended | ✅ Compatible |

## API Rate Limits

### Instagram Content Publishing API

| Limit Type | Value | Scope |
|------------|-------|-------|
| **Posts per 24h** | 50 posts | Per Instagram account |
| **API Calls** | 200 calls/hour | Per user access token |
| **Concurrent Requests** | 25 concurrent | Per app |
| **Creation Retry** | 3-5 minutes | Between failed attempts |

### Facebook Pages API

| Limit Type | Value | Scope |
|------------|-------|-------|
| **API Calls** | 200 calls/hour | Per user access token |
| **Posts** | No strict daily limit | Rate limited by API calls |
| **Concurrent Requests** | 25 concurrent | Per app |

### Rate Limit Headers

Monitor these HTTP response headers:
```
X-Business-Use-Case-Usage: {"instagram":{"call_count":45,"total_cputime":120,"total_time":180}}
X-App-Usage: {"call_count":15,"total_cputime":40,"total_time":60}
```

**When to throttle**:
- `call_count` > 80: Slow down requests
- `call_count` > 95: Stop new requests, wait for reset
- `total_time` or `total_cputime` near 100: Approaching limit

## API Endpoints

### Instagram Content Publishing

#### 1. Create Container (Image)
```http
POST https://graph.facebook.com/v22.0/{ig-user-id}/media
Content-Type: application/json

{
  "image_url": "https://your-cdn.com/image.jpg",
  "caption": "Delicious burger! #foodie #restaurant",
  "location_id": "123456789" // Optional
}

Response:
{
  "id": "17895695668004550" // Container ID
}
```

#### 2. Create Container (Video)
```http
POST https://graph.facebook.com/v22.0/{ig-user-id}/media
Content-Type: application/json

{
  "video_url": "https://your-cdn.com/video.mp4",
  "media_type": "VIDEO",
  "caption": "Watch our chef in action! #cooking",
  "thumb_offset": "5000" // Thumbnail at 5s (milliseconds)
}

Response:
{
  "id": "17895695668004551"
}
```

#### 3. Create Container (Reel)
```http
POST https://graph.facebook.com/v22.0/{ig-user-id}/media
Content-Type: application/json

{
  "video_url": "https://your-cdn.com/reel.mp4",
  "media_type": "REELS",
  "caption": "Our signature dish! #reels #foodporn",
  "share_to_feed": true // Also post to feed
}

Response:
{
  "id": "17895695668004552"
}
```

#### 4. Publish Container
```http
POST https://graph.facebook.com/v22.0/{ig-user-id}/media_publish
Content-Type: application/json

{
  "creation_id": "17895695668004550"
}

Response:
{
  "id": "17895695668004560" // Published Media ID
}
```

#### 5. Check Container Status
```http
GET https://graph.facebook.com/v22.0/{container-id}
  ?fields=status_code,status

Response:
{
  "status_code": "FINISHED", // or "IN_PROGRESS", "ERROR"
  "status": "PUBLISHED"
}
```

### Facebook Pages Publishing

#### 1. Post Photo
```http
POST https://graph.facebook.com/v22.0/{page-id}/photos
Content-Type: application/json

{
  "url": "https://your-cdn.com/image.jpg",
  "caption": "Try our new menu item!",
  "published": true
}

Response:
{
  "id": "123456789012345",
  "post_id": "987654321098765_123456789012345"
}
```

#### 2. Post Video
```http
POST https://graph.facebook.com/v22.0/{page-id}/videos
Content-Type: application/json

{
  "file_url": "https://your-cdn.com/video.mp4",
  "description": "Check out this delicious burger!",
  "published": true
}

Response:
{
  "id": "123456789012345"
}
```

#### 3. Post Multiple Photos
```http
# Step 1: Upload photos unpublished
POST https://graph.facebook.com/v22.0/{page-id}/photos
{
  "url": "https://your-cdn.com/image1.jpg",
  "published": false
}
// Repeat for each photo, collect photo IDs

# Step 2: Create multi-photo post
POST https://graph.facebook.com/v22.0/{page-id}/feed
{
  "message": "Our menu highlights!",
  "attached_media": [
    {"media_fbid": "photo_id_1"},
    {"media_fbid": "photo_id_2"},
    {"media_fbid": "photo_id_3"}
  ]
}
```

## Access Token Management

### Token Types

| Token Type | Lifespan | Use Case |
|------------|----------|----------|
| **Short-lived User Token** | 1-2 hours | Initial OAuth response |
| **Long-lived User Token** | 60 days | Exchanged from short-lived |
| **Page Access Token** | 60 days | Derived from user token |
| **Long-lived Page Token** | Never expires* | Exchange with long-lived user token |

*Never expires as long as:
- User doesn't change password
- User doesn't revoke app permissions
- App isn't deleted
- User remains Page admin

### Token Exchange Flow

```http
# 1. Exchange code for short-lived user token
GET https://graph.facebook.com/v22.0/oauth/access_token
  ?client_id={app-id}
  &client_secret={app-secret}
  &code={authorization-code}
  &redirect_uri={redirect-uri}

Response:
{
  "access_token": "short_lived_user_token",
  "token_type": "bearer"
}

# 2. Exchange for long-lived user token
GET https://graph.facebook.com/v22.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={app-id}
  &client_secret={app-secret}
  &fb_exchange_token={short-lived-token}

Response:
{
  "access_token": "long_lived_user_token",
  "token_type": "bearer",
  "expires_in": 5183999 // ~60 days
}

# 3. Get Page access token
GET https://graph.facebook.com/v22.0/{page-id}
  ?fields=access_token
  &access_token={long-lived-user-token}

Response:
{
  "access_token": "page_access_token",
  "id": "{page-id}"
}

# 4. Get long-lived Page token
GET https://graph.facebook.com/v22.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={app-id}
  &client_secret={app-secret}
  &fb_exchange_token={page-access-token}

Response:
{
  "access_token": "long_lived_page_token",
  "token_type": "bearer"
  // No expiration!
}
```

## Error Handling

### Common Error Codes

| Code | Type | Description | Resolution |
|------|------|-------------|------------|
| **190** | OAuthException | Access token expired/invalid | Prompt user to reconnect account |
| **200** | Permissions | Missing required permission | Check app permissions |
| **9** | API Too Many Calls | Rate limit exceeded | Implement backoff, retry after reset |
| **10** | Permission Denied | User/Page permission issue | Check user role, Page access |
| **100** | Invalid Parameter | Bad request format | Validate input before sending |
| **368** | Temporarily Blocked | Spam detection triggered | Wait 24h, review content quality |
| **2207051** | Media Upload Failed | File too large/wrong format | Validate file before upload |

### Error Response Format

```json
{
  "error": {
    "message": "Invalid OAuth access token.",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 463,
    "fbtrace_id": "AXvG8_9fK-8"
  }
}
```

## Environment Variables Required

```bash
# Meta/Facebook
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_GRAPH_API_VERSION=v22.0

# OAuth
OAUTH_REDIRECT_URI=https://admin.pumpd.co.nz/auth/meta/callback
OAUTH_STATE_SECRET=random_32_char_string

# Supabase (existing)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Webhook for real-time updates
META_WEBHOOK_VERIFY_TOKEN=random_verification_token
```

## Infrastructure Requirements

### Storage Requirements
- **Token Storage**: Encrypted database fields for access tokens
- **Media Hosting**: Publicly accessible URLs (existing Supabase Storage ✅)
- **Media Expiry**: URLs must be valid for at least 24 hours

### Network Requirements
- **Outbound HTTPS**: Access to graph.facebook.com
- **Webhook Endpoint**: HTTPS endpoint for Meta callbacks (optional)
- **SSL Certificate**: Required for OAuth redirect URI

### Processing Requirements
- **Async Processing**: Queue-based posting (recommended)
- **Retry Logic**: Exponential backoff for failed requests
- **Timeout Handling**: 30-60 second timeout per API call

## Compatibility Matrix

### Your Generated Content vs Platform Requirements

| Your Content | Instagram Feed | Instagram Reels | Instagram Stories | Facebook Posts |
|--------------|----------------|-----------------|-------------------|----------------|
| **Videos (720x1280, 4-12s)** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Videos (1080x1920, 4-12s)** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Videos (1280x720, 4-12s)** | ✅ Yes | ⚠️ Crop to 9:16 | ⚠️ Crop to 9:16 | ✅ Yes |
| **Videos (1920x1080, 4-12s)** | ✅ Yes | ⚠️ Crop to 9:16 | ⚠️ Crop to 9:16 | ✅ Yes |
| **AI Images (PNG/JPG)** | ✅ Yes | ❌ No (video only) | ✅ Yes | ✅ Yes |

### Recommended Default Settings

```javascript
const PLATFORM_DEFAULTS = {
  instagram_feed: {
    aspectRatio: '1:1', // Square
    videoLength: 8, // seconds
    useReels: false
  },
  instagram_reels: {
    aspectRatio: '9:16', // Portrait
    videoLength: 8,
    shareToFeed: true // Also post to feed
  },
  instagram_stories: {
    aspectRatio: '9:16', // Portrait
    videoLength: 8 // 8s max for better engagement
  },
  facebook_feed: {
    aspectRatio: '16:9', // Landscape
    videoLength: 12
  }
};
```

## Security Considerations

### Token Security
- ✅ Store access tokens encrypted at rest
- ✅ Never log full access tokens
- ✅ Use HTTPS for all API calls
- ✅ Implement token rotation before expiry
- ✅ Revoke tokens on user disconnect

### API Request Security
- ✅ Validate user input before API calls
- ✅ Rate limit requests per user
- ✅ Implement CSRF protection for OAuth
- ✅ Validate OAuth state parameter
- ✅ Use app secret for sensitive operations

### Data Privacy
- ✅ Only request necessary permissions
- ✅ Provide clear privacy policy
- ✅ Implement data deletion on request
- ✅ Don't store unnecessary user data
- ✅ Comply with GDPR/privacy regulations

---

**Last Updated**: January 2025
**API Version**: Graph API v22.0
**Next Review**: Before implementation begins
