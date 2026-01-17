# Service Architecture: Instagram & Facebook Integration

## Overview

This document defines the backend service architecture for Instagram and Facebook integration, including service responsibilities, API endpoints, and interaction patterns.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐│
│  │ Social Accounts│  │ Post to Social │  │  Posts Mgmt   ││
│  │   Settings     │  │     Modal      │  │   Dashboard    ││
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘│
└───────────┼──────────────────────┼──────────────────────┼────┘
            │                      │                      │
            │ HTTPS               │ HTTPS                │ HTTPS
            ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway / Express                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Authentication Middleware             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  OAuth       │  │  Social      │  │  Social      │    │
│  │  Routes      │  │  Accounts    │  │  Posts       │    │
│  │              │  │  Routes      │  │  Routes      │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  OAuth Service   │  │  Token Refresh   │               │
│  │                  │  │  Service         │               │
│  │ - generateAuthUrl│  │ - checkExpiring  │               │
│  │ - handleCallback │  │ - refreshToken   │               │
│  │ - disconnect     │  │ - notify         │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Instagram       │  │  Facebook        │               │
│  │  Publish Service │  │  Publish Service │               │
│  │                  │  │                  │               │
│  │ - createContainer│  │ - postPhoto      │               │
│  │ - checkStatus    │  │ - postVideo      │               │
│  │ - publish        │  │ - postMultiple   │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Analytics       │  │  Post Queue      │               │
│  │  Service         │  │  Service         │               │
│  │                  │  │                  │               │
│  │ - syncInsights   │  │ - enqueue        │               │
│  │ - getMetrics     │  │ - process        │               │
│  │ - schedule       │  │ - retry          │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Supabase        │  │  Redis           │               │
│  │  PostgreSQL      │  │  Cache           │               │
│  │                  │  │                  │               │
│  │ - social_media_  │  │ - oauth_states   │               │
│  │   accounts       │  │ - post_queue     │               │
│  │ - social_media_  │  │ - rate_limits    │               │
│  │   posts          │  │                  │               │
│  │ - social_media_  │  │                  │               │
│  │   analytics      │  │                  │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Meta Graph API  │  │  Supabase        │               │
│  │  v22.0           │  │  Storage         │               │
│  │                  │  │                  │               │
│  │ - OAuth          │  │ - Video/image    │               │
│  │ - Publishing     │  │   hosting        │               │
│  │ - Insights       │  │                  │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Responsibilities

### 1. OAuth Service

**Purpose**: Handle social media account connection and authentication

**Responsibilities**:
- Generate OAuth authorization URLs
- Handle OAuth callbacks
- Exchange authorization codes for tokens
- Store encrypted tokens in database
- Disconnect accounts
- Validate state parameters (CSRF protection)

**Key Methods**:
```typescript
interface OAuthService {
  generateAuthUrl(platform: Platform, orgId: string, userId: string): Promise<string>;
  handleCallback(code: string, state: string): Promise<void>;
  disconnectAccount(accountId: string, orgId: string): Promise<void>;
  validateState(state: string): Promise<StateData>;
}
```

**Dependencies**:
- Redis (state storage)
- Supabase (account storage)
- Encryption utilities
- Meta Graph API

**File**: `services/oauth-service.js`

---

### 2. Token Refresh Service

**Purpose**: Maintain valid access tokens for connected accounts

**Responsibilities**:
- Check for expiring tokens daily
- Refresh tokens before expiry
- Handle refresh failures
- Notify users when reconnection needed
- Update token expiry timestamps

**Key Methods**:
```typescript
interface TokenRefreshService {
  checkExpiringTokens(): Promise<void>;
  refreshToken(account: Account): Promise<void>;
  notifyTokenExpiry(account: Account): Promise<void>;
  validateTokenHealth(accountId: string): Promise<HealthStatus>;
}
```

**Dependencies**:
- Supabase (account queries)
- Meta Graph API
- Notification service
- Encryption utilities

**Scheduling**: Daily cron job at 2 AM

**File**: `services/token-refresh-service.js`

---

### 3. Instagram Publish Service

**Purpose**: Publish content to Instagram Business accounts

**Responsibilities**:
- Create media containers (image, video, Reels, Stories)
- Poll container status until ready
- Publish containers to Instagram
- Handle publishing errors
- Return published media URLs

**Key Methods**:
```typescript
interface InstagramPublishService {
  createContainer(params: ContainerParams): Promise<string>;
  checkContainerStatus(containerId: string, token: string): Promise<Status>;
  publishContainer(igUserId: string, containerId: string, token: string): Promise<string>;
  publish(params: PublishParams): Promise<PublishResult>;
}
```

**Dependencies**:
- Meta Graph API
- Polling utilities
- Error handling utilities

**API Calls**:
- `POST /{ig-user-id}/media` - Create container
- `GET /{container-id}?fields=status_code` - Check status
- `POST /{ig-user-id}/media_publish` - Publish

**File**: `services/instagram-publish-service.js`

---

### 4. Facebook Publish Service

**Purpose**: Publish content to Facebook Pages

**Responsibilities**:
- Post photos to Pages
- Post videos to Pages
- Post multiple photos (carousels)
- Handle publishing errors
- Return post URLs

**Key Methods**:
```typescript
interface FacebookPublishService {
  postPhoto(params: PhotoParams): Promise<string>;
  postVideo(params: VideoParams): Promise<string>;
  postMultiplePhotos(params: MultiPhotoParams): Promise<string>;
  publish(params: PublishParams): Promise<PublishResult>;
}
```

**Dependencies**:
- Meta Graph API
- Error handling utilities

**API Calls**:
- `POST /{page-id}/photos` - Post photo
- `POST /{page-id}/videos` - Post video
- `POST /{page-id}/feed` - Post with multiple photos

**File**: `services/facebook-publish-service.js`

---

### 5. Post Queue Service

**Purpose**: Queue and process social media posts

**Responsibilities**:
- Add posts to queue
- Process queue in background
- Handle rate limiting
- Retry failed posts
- Update post status in database

**Key Methods**:
```typescript
interface PostQueueService {
  enqueue(post: Post): Promise<void>;
  process(): Promise<void>;
  retry(postId: string): Promise<void>;
  getQueueStatus(): Promise<QueueStatus>;
}
```

**Dependencies**:
- Redis (queue storage)
- Supabase (post updates)
- Instagram/Facebook publish services

**Processing**:
- Background worker process
- Processes 1 post every 2 seconds
- Exponential backoff for retries
- Max 3 retry attempts

**File**: `services/post-queue-service.js`

---

### 6. Analytics Service (Phase 3)

**Purpose**: Sync post analytics from Instagram and Facebook

**Responsibilities**:
- Fetch post insights from platforms
- Store metrics in database
- Calculate engagement rates
- Schedule periodic syncs
- Handle analytics snapshots

**Key Methods**:
```typescript
interface AnalyticsService {
  syncPostInsights(postId: string): Promise<void>;
  syncAllPosts(accountId: string): Promise<void>;
  getPostMetrics(postId: string): Promise<Metrics>;
  createSnapshot(postId: string): Promise<void>;
  scheduleSync(accountId: string): Promise<void>;
}
```

**Dependencies**:
- Meta Graph API
- Supabase (metrics storage)

**API Calls**:
- `GET /{media-id}/insights` - Instagram insights
- `GET /{post-id}?fields=reactions,comments,shares` - Facebook insights

**Scheduling**: Daily at 3 AM

**File**: `services/analytics-service.js`

---

## API Endpoints

### OAuth Endpoints

#### Initiate Connection

```
GET /api/auth/social/connect/:platform

Parameters:
  - platform: 'instagram' | 'facebook'

Headers:
  - Authorization: Bearer {jwt}

Response:
  {
    "authUrl": "https://www.facebook.com/v22.0/dialog/oauth?..."
  }

Status Codes:
  - 200: Success
  - 401: Unauthorized
  - 500: Server error
```

#### OAuth Callback

```
GET /auth/meta/callback

Parameters:
  - code: string (authorization code)
  - state: string (CSRF token)
  - error?: string (if OAuth failed)

Response:
  - Redirect to /settings/social-accounts?success=connected
  - OR redirect with error parameter

Status Codes:
  - 302: Redirect
```

---

### Social Accounts Endpoints

#### List Accounts

```
GET /api/social/accounts

Headers:
  - Authorization: Bearer {jwt}

Query Parameters:
  - platform?: 'instagram' | 'facebook'
  - status?: 'active' | 'expired' | 'disconnected'

Response:
  {
    "accounts": [
      {
        "id": "uuid",
        "platform": "instagram",
        "username": "restaurant_name",
        "profile_picture_url": "https://...",
        "status": "active",
        "connected_at": "2025-01-10T12:00:00Z",
        "can_publish_feed": true,
        "can_publish_stories": true,
        "can_publish_reels": true
      }
    ]
  }

Status Codes:
  - 200: Success
  - 401: Unauthorized
```

#### Get Account Details

```
GET /api/social/accounts/:accountId

Headers:
  - Authorization: Bearer {jwt}

Response:
  {
    "id": "uuid",
    "platform": "instagram",
    "username": "restaurant_name",
    "profile_picture_url": "https://...",
    "status": "active",
    "connected_at": "2025-01-10T12:00:00Z",
    "last_synced_at": "2025-01-10T14:00:00Z",
    "last_token_refresh": "2025-01-09T12:00:00Z",
    "token_expires_at": "2025-03-10T12:00:00Z",
    "can_publish_feed": true,
    "can_publish_stories": true,
    "can_publish_reels": true
  }

Status Codes:
  - 200: Success
  - 401: Unauthorized
  - 404: Account not found
```

#### Disconnect Account

```
DELETE /api/social/accounts/:accountId

Headers:
  - Authorization: Bearer {jwt}

Response:
  {
    "success": true
  }

Status Codes:
  - 200: Success
  - 401: Unauthorized
  - 404: Account not found
```

---

### Social Posts Endpoints

#### Create Post

```
POST /api/social/posts

Headers:
  - Authorization: Bearer {jwt}
  - Content-Type: application/json

Body:
  {
    "socialAccountId": "uuid",
    "contentType": "video" | "image",
    "contentUrl": "https://...",
    "thumbnailUrl": "https://...",
    "caption": "Post caption with #hashtags",
    "postType": "feed" | "reel" | "story",
    "platform": "instagram" | "facebook",
    "scheduledFor": "2025-01-15T10:00:00Z" // Optional
  }

Response:
  {
    "postId": "uuid",
    "status": "processing" | "queued",
    "message": "Post is being published"
  }

Status Codes:
  - 200: Success
  - 400: Invalid input
  - 401: Unauthorized
  - 404: Account not found
```

#### List Posts

```
GET /api/social/posts

Headers:
  - Authorization: Bearer {jwt}

Query Parameters:
  - status?: 'draft' | 'queued' | 'processing' | 'published' | 'failed'
  - platform?: 'instagram' | 'facebook'
  - limit?: number (default: 50, max: 100)
  - offset?: number (default: 0)

Response:
  {
    "posts": [
      {
        "id": "uuid",
        "platform": "instagram",
        "post_type": "feed",
        "caption": "Caption text",
        "content_url": "https://...",
        "thumbnail_url": "https://...",
        "status": "published",
        "published_at": "2025-01-10T12:00:00Z",
        "platform_url": "https://instagram.com/p/...",
        "likes_count": 45,
        "comments_count": 12,
        "shares_count": 3,
        "reach": 1205,
        "engagement_rate": 4.97,
        "social_account": {
          "id": "uuid",
          "platform": "instagram",
          "username": "restaurant_name"
        }
      }
    ],
    "total": 123
  }

Status Codes:
  - 200: Success
  - 401: Unauthorized
```

#### Get Post Details

```
GET /api/social/posts/:postId

Headers:
  - Authorization: Bearer {jwt}

Response:
  {
    "id": "uuid",
    "platform": "instagram",
    "post_type": "feed",
    "caption": "Caption text",
    "content_url": "https://...",
    "thumbnail_url": "https://...",
    "status": "published",
    "created_at": "2025-01-10T11:00:00Z",
    "published_at": "2025-01-10T12:00:00Z",
    "platform_post_id": "17895695668004560",
    "platform_url": "https://instagram.com/p/ABC123/",
    "likes_count": 45,
    "comments_count": 12,
    "shares_count": 3,
    "reach": 1205,
    "impressions": 1523,
    "engagement_rate": 4.97,
    "last_analytics_sync": "2025-01-10T14:00:00Z",
    "error_message": null
  }

Status Codes:
  - 200: Success
  - 401: Unauthorized
  - 404: Post not found
```

#### Delete Post

```
DELETE /api/social/posts/:postId

Headers:
  - Authorization: Bearer {jwt}

Response:
  {
    "success": true
  }

Status Codes:
  - 200: Success
  - 401: Unauthorized
  - 404: Post not found
```

---

### Analytics Endpoints (Phase 3)

#### Get Account Analytics

```
GET /api/social/analytics/:accountId

Headers:
  - Authorization: Bearer {jwt}

Query Parameters:
  - startDate: ISO date string
  - endDate: ISO date string

Response:
  {
    "totalPosts": 45,
    "totalEngagement": 2341,
    "averageEngagementRate": 5.23,
    "totalReach": 45231,
    "totalImpressions": 67342,
    "topPost": {
      "id": "uuid",
      "caption": "...",
      "engagement_rate": 8.45
    },
    "engagementTrend": [
      {"date": "2025-01-01", "engagement": 234},
      {"date": "2025-01-02", "engagement": 312}
    ]
  }

Status Codes:
  - 200: Success
  - 401: Unauthorized
  - 404: Account not found
```

---

## File Structure

```
backend/
├── routes/
│   ├── social-auth-routes.js          # OAuth endpoints
│   ├── social-accounts-routes.js      # Account management
│   ├── social-posts-routes.js         # Post creation/listing
│   └── social-analytics-routes.js     # Analytics (Phase 3)
│
├── services/
│   ├── oauth-service.js               # OAuth flow handling
│   ├── token-refresh-service.js       # Token management
│   ├── instagram-publish-service.js   # Instagram publishing
│   ├── facebook-publish-service.js    # Facebook publishing
│   ├── post-queue-service.js          # Queue management
│   └── analytics-service.js           # Analytics sync (Phase 3)
│
├── utils/
│   ├── encryption.js                  # Token encryption
│   ├── meta-api.js                    # Meta API client wrapper
│   └── validation.js                  # Input validation
│
├── middleware/
│   ├── auth.js                        # JWT authentication
│   ├── rate-limit.js                  # API rate limiting
│   └── error-handler.js               # Global error handling
│
├── jobs/
│   ├── token-refresh-job.js           # Daily token refresh
│   ├── analytics-sync-job.js          # Daily analytics sync
│   └── queue-processor-job.js         # Post queue processing
│
└── lib/
    ├── supabase.js                    # Supabase client
    ├── redis.js                       # Redis client
    └── logger.js                      # Logging utility
```

---

## Data Flow Examples

### Posting to Instagram

```
1. User clicks "Post to Instagram"
   ↓
2. Frontend sends POST /api/social/posts
   ↓
3. API validates request and user permissions
   ↓
4. Create post record in database (status: "processing")
   ↓
5. Return postId immediately to user
   ↓
6. Background: publishPost() function runs
   ↓
7. Get account details from database
   ↓
8. Decrypt access token
   ↓
9. Call InstagramPublishService.publish()
   ↓
10. Create container via Meta API
    ↓
11. Poll container status (2s intervals)
    ↓
12. Container status = "FINISHED"
    ↓
13. Publish container via Meta API
    ↓
14. Update post record (status: "published", platform_post_id, platform_url)
    ↓
15. User sees success notification
```

### Token Refresh Flow

```
1. Cron job runs daily at 2 AM
   ↓
2. Query accounts expiring in 7 days
   ↓
3. For each account:
   a. Decrypt access token
   b. Call Meta API to exchange token
   c. If success: Update with new token + expiry
   d. If failure: Mark as "expired" + notify user
   ↓
4. Send notification emails to users with expired accounts
```

---

## Error Handling

### Service-Level Error Handling

```typescript
class InstagramPublishService {
  async publish(params) {
    try {
      return await this._publish(params);
    } catch (error) {
      // Log error
      logger.error('Instagram publish failed', {
        error: error.message,
        params: params,
        accountId: params.accountId
      });

      // Classify error
      if (error.code === 190) {
        throw new TokenExpiredError('Access token expired');
      } else if (error.code === 9) {
        throw new RateLimitError('Rate limit exceeded');
      } else if (error.code === 2207051) {
        throw new MediaUploadError('Media upload failed');
      }

      // Generic error
      throw new PublishError(error.message);
    }
  }
}
```

### API-Level Error Handling

```typescript
app.use((error, req, res, next) => {
  logger.error('API error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  if (error instanceof TokenExpiredError) {
    return res.status(401).json({
      error: 'token_expired',
      message: 'Your social media account needs to be reconnected',
      action: 'reconnect'
    });
  }

  if (error instanceof RateLimitError) {
    return res.status(429).json({
      error: 'rate_limit',
      message: 'Too many posts. Please try again later.',
      retryAfter: '1h'
    });
  }

  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'validation_error',
      message: error.message,
      fields: error.fields
    });
  }

  // Generic error
  res.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred. Please try again.'
  });
});
```

---

## Security Considerations

### Token Encryption

```javascript
// Always encrypt before storing
const encryptedToken = encrypt(accessToken);

await supabase
  .from('social_media_accounts')
  .insert({ access_token: encryptedToken });

// Always decrypt before using
const { data: account } = await supabase
  .from('social_media_accounts')
  .select('access_token')
  .eq('id', accountId)
  .single();

const accessToken = decrypt(account.access_token);
```

### OAuth State Validation

```javascript
// Generate and store state
const state = crypto.randomBytes(32).toString('hex');
await redis.setex(`oauth_state:${state}`, 600, JSON.stringify(data));

// Validate on callback
const storedData = await redis.get(`oauth_state:${state}`);
if (!storedData) {
  throw new Error('Invalid or expired state');
}
await redis.del(`oauth_state:${state}`); // Use once
```

### API Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
});

app.use('/api/', limiter);
```

---

**Last Updated**: January 2025
**Status**: Ready for Implementation
**Next Steps**: Begin service implementation following this architecture
