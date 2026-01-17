# Meta Graph API - Quick Reference

## Base URLs

```
Production: https://graph.facebook.com/v22.0
OAuth: https://www.facebook.com/v22.0/dialog/oauth
```

## Authentication

### 1. OAuth Authorization URL

```
GET https://www.facebook.com/v22.0/dialog/oauth
  ?client_id={app-id}
  &redirect_uri={redirect-uri}
  &state={state-parameter}
  &scope=instagram_basic,instagram_content_publish,pages_manage_posts
  &response_type=code
```

### 2. Exchange Code for Token

```
GET https://graph.facebook.com/v22.0/oauth/access_token
  ?client_id={app-id}
  &client_secret={app-secret}
  &code={authorization-code}
  &redirect_uri={redirect-uri}

Response:
{
  "access_token": "short_lived_token",
  "token_type": "bearer"
}
```

### 3. Get Long-Lived Token

```
GET https://graph.facebook.com/v22.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={app-id}
  &client_secret={app-secret}
  &fb_exchange_token={short-lived-token}

Response:
{
  "access_token": "long_lived_token",
  "token_type": "bearer",
  "expires_in": 5183999
}
```

---

## Instagram Publishing

### 1. Create Container (Image)

```http
POST https://graph.facebook.com/v22.0/{ig-user-id}/media
Content-Type: application/json

{
  "image_url": "https://your-cdn.com/image.jpg",
  "caption": "Your caption here #hashtags",
  "access_token": "{access-token}"
}

Response:
{
  "id": "17895695668004550"
}
```

### 2. Create Container (Video - Feed)

```http
POST https://graph.facebook.com/v22.0/{ig-user-id}/media

{
  "video_url": "https://your-cdn.com/video.mp4",
  "media_type": "VIDEO",
  "caption": "Video caption",
  "thumb_offset": "5000",
  "access_token": "{access-token}"
}

Response:
{
  "id": "17895695668004551"
}
```

### 3. Create Container (Reel)

```http
POST https://graph.facebook.com/v22.0/{ig-user-id}/media

{
  "video_url": "https://your-cdn.com/reel.mp4",
  "media_type": "REELS",
  "caption": "Reel caption",
  "share_to_feed": true,
  "access_token": "{access-token}"
}

Response:
{
  "id": "17895695668004552"
}
```

### 4. Create Container (Story)

```http
POST https://graph.facebook.com/v22.0/{ig-user-id}/media

{
  "image_url": "https://your-cdn.com/story.jpg",
  "media_type": "STORIES",
  "access_token": "{access-token}"
}

Response:
{
  "id": "17895695668004553"
}
```

### 5. Check Container Status

```http
GET https://graph.facebook.com/v22.0/{container-id}
  ?fields=status_code,status
  &access_token={access-token}

Response:
{
  "status_code": "FINISHED",
  "status": "PUBLISHED",
  "id": "17895695668004550"
}

Status Codes:
- EXPIRED: Container expired (24 hours)
- ERROR: Error during processing
- FINISHED: Ready to publish
- IN_PROGRESS: Still processing
- PUBLISHED: Already published
```

### 6. Publish Container

```http
POST https://graph.facebook.com/v22.0/{ig-user-id}/media_publish

{
  "creation_id": "17895695668004550",
  "access_token": "{access-token}"
}

Response:
{
  "id": "17895695668004560"
}
```

### 7. Get Published Media Details

```http
GET https://graph.facebook.com/v22.0/{media-id}
  ?fields=id,caption,media_type,media_url,permalink,timestamp,username
  &access_token={access-token}

Response:
{
  "id": "17895695668004560",
  "caption": "Your caption",
  "media_type": "IMAGE",
  "media_url": "https://...",
  "permalink": "https://www.instagram.com/p/ABC123/",
  "timestamp": "2025-01-10T12:00:00+0000",
  "username": "restaurant_name"
}
```

---

## Instagram Insights (Analytics)

### Get Media Insights

```http
GET https://graph.facebook.com/v22.0/{media-id}/insights
  ?metric=engagement,impressions,reach,saved,video_views
  &access_token={access-token}

Response:
{
  "data": [
    {
      "name": "engagement",
      "period": "lifetime",
      "values": [{"value": 245}],
      "title": "Engagement",
      "description": "Total number of likes and comments"
    },
    {
      "name": "impressions",
      "period": "lifetime",
      "values": [{"value": 1523}]
    },
    {
      "name": "reach",
      "period": "lifetime",
      "values": [{"value": 1205}]
    }
  ]
}

Available Metrics:
- engagement: Likes + comments + saves
- impressions: Total views
- reach: Unique accounts reached
- saved: Number of saves
- video_views: Video plays (videos only)
```

---

## Facebook Pages

### 1. Get User's Pages

```http
GET https://graph.facebook.com/v22.0/me/accounts
  ?fields=id,name,access_token,instagram_business_account
  &access_token={user-access-token}

Response:
{
  "data": [
    {
      "id": "123456789",
      "name": "Restaurant Name",
      "access_token": "page_access_token",
      "instagram_business_account": {
        "id": "987654321"
      }
    }
  ]
}
```

### 2. Post Photo to Page

```http
POST https://graph.facebook.com/v22.0/{page-id}/photos

{
  "url": "https://your-cdn.com/image.jpg",
  "caption": "Check out our new dish!",
  "published": true,
  "access_token": "{page-access-token}"
}

Response:
{
  "id": "123456789012345",
  "post_id": "987654321098765_123456789012345"
}
```

### 3. Post Video to Page

```http
POST https://graph.facebook.com/v22.0/{page-id}/videos

{
  "file_url": "https://your-cdn.com/video.mp4",
  "description": "Our chef in action!",
  "published": true,
  "access_token": "{page-access-token}"
}

Response:
{
  "id": "123456789012346"
}
```

### 4. Post Multiple Photos

```http
# Step 1: Upload photos unpublished
POST https://graph.facebook.com/v22.0/{page-id}/photos
{
  "url": "https://your-cdn.com/image1.jpg",
  "published": false,
  "access_token": "{page-access-token}"
}
# Returns: {"id": "photo_id_1"}

# Step 2: Create post with multiple photos
POST https://graph.facebook.com/v22.0/{page-id}/feed
{
  "message": "Check out our menu!",
  "attached_media": [
    {"media_fbid": "photo_id_1"},
    {"media_fbid": "photo_id_2"},
    {"media_fbid": "photo_id_3"}
  ],
  "access_token": "{page-access-token}"
}

Response:
{
  "id": "page_id_post_id"
}
```

### 5. Get Page Post

```http
GET https://graph.facebook.com/v22.0/{post-id}
  ?fields=id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true)
  &access_token={page-access-token}

Response:
{
  "id": "page_id_post_id",
  "message": "Post caption",
  "created_time": "2025-01-10T12:00:00+0000",
  "permalink_url": "https://www.facebook.com/...",
  "shares": {"count": 12},
  "reactions": {"summary": {"total_count": 145}},
  "comments": {"summary": {"total_count": 23}}
}
```

---

## Account Information

### Get Instagram Account Details

```http
GET https://graph.facebook.com/v22.0/{ig-user-id}
  ?fields=id,username,profile_picture_url,followers_count,follows_count,media_count
  &access_token={access-token}

Response:
{
  "id": "17841405309211844",
  "username": "restaurant_name",
  "profile_picture_url": "https://...",
  "followers_count": 1523,
  "follows_count": 342,
  "media_count": 187
}
```

### Get Page Details

```http
GET https://graph.facebook.com/v22.0/{page-id}
  ?fields=id,name,picture,fan_count,link
  &access_token={page-access-token}

Response:
{
  "id": "123456789",
  "name": "Restaurant Name",
  "picture": {"data": {"url": "https://..."}},
  "fan_count": 2341,
  "link": "https://www.facebook.com/restaurantname"
}
```

---

## Error Responses

### Error Format

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

### Common Error Codes

| Code | Type | Description | Solution |
|------|------|-------------|----------|
| **190** | OAuthException | Token invalid/expired | Refresh token or reconnect |
| **200** | Permissions | Missing permission | Check app permissions |
| **9** | API Too Many Calls | Rate limit hit | Implement backoff/retry |
| **10** | Permission Denied | User lacks permission | Check user role |
| **100** | Invalid Parameter | Bad request | Validate input |
| **368** | Temporarily Blocked | Spam detection | Wait 24h, review content |
| **2207051** | Media Upload Failed | File issue | Check format/size |

---

## Rate Limits

### Current Limits

- **API Calls**: 200 calls per hour per user token
- **Instagram Posts**: 50 per 24 hours per account
- **Facebook Posts**: No strict limit (API rate limited)

### Checking Rate Limits

Check response headers:

```
X-Business-Use-Case-Usage: {"instagram":{"call_count":45,"total_cputime":120,"total_time":180}}
X-App-Usage: {"call_count":15,"total_cputime":40,"total_time":60}
```

**Throttle when**:
- `call_count` > 80
- `total_time` or `total_cputime` > 80

---

## Webhooks (Optional)

### Subscribe to Webhooks

```http
POST https://graph.facebook.com/v22.0/{page-id}/subscribed_apps

{
  "subscribed_fields": "feed,mention,photos,videos",
  "access_token": "{page-access-token}"
}
```

### Webhook Verification (GET)

```javascript
// Express.js example
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});
```

---

## Testing with Graph API Explorer

URL: https://developers.facebook.com/tools/explorer

1. Select your app from dropdown
2. Select "User Token" and generate token
3. Add permissions
4. Make test requests
5. View responses

---

## Code Examples

### Node.js: Post to Instagram Feed

```javascript
async function postToInstagramFeed(igUserId, imageUrl, caption, accessToken) {
  // Step 1: Create container
  const containerResponse = await fetch(
    `https://graph.facebook.com/v22.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        access_token: accessToken
      })
    }
  );

  const containerData = await containerResponse.json();
  const containerId = containerData.id;

  // Step 2: Check status
  let status = 'IN_PROGRESS';
  while (status === 'IN_PROGRESS') {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s

    const statusResponse = await fetch(
      `https://graph.facebook.com/v22.0/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const statusData = await statusResponse.json();
    status = statusData.status_code;
  }

  if (status !== 'FINISHED') {
    throw new Error(`Container status: ${status}`);
  }

  // Step 3: Publish
  const publishResponse = await fetch(
    `https://graph.facebook.com/v22.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken
      })
    }
  );

  const publishData = await publishResponse.json();
  return publishData.id; // Published media ID
}
```

### Node.js: Post to Facebook Page

```javascript
async function postToFacebookPage(pageId, imageUrl, caption, pageAccessToken) {
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${pageId}/photos`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: imageUrl,
        caption: caption,
        published: true,
        access_token: pageAccessToken
      })
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.post_id;
}
```

---

## Additional Resources

- **Meta for Developers**: https://developers.facebook.com/
- **Instagram API Docs**: https://developers.facebook.com/docs/instagram-platform
- **Graph API Docs**: https://developers.facebook.com/docs/graph-api
- **API Changelog**: https://developers.facebook.com/docs/graph-api/changelog
- **Error Codes**: https://developers.facebook.com/docs/graph-api/using-graph-api/error-handling
- **Rate Limiting**: https://developers.facebook.com/docs/graph-api/overview/rate-limiting

---

**Last Updated**: January 2025
**API Version**: v22.0
**Next Version**: v23.0 (estimated April 2025)
