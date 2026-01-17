# OpenAI Sora 2 API Integration

## Overview

OpenAI Sora 2 is a video generation model that creates dynamic video clips from text prompts and/or reference images. This document covers the specific implementation details for integrating Sora 2 into our system.

---

## API Basics

### Base URL
```
https://api.openai.com/v1
```

### Authentication
```
Authorization: Bearer sk-proj-...
```

### Official Documentation
- **Main Guide**: https://platform.openai.com/docs/guides/video-generation
- **API Reference**: https://platform.openai.com/docs/api-reference/videos
- **Prompting Guide**: https://cookbook.openai.com/examples/sora/sora2_prompting_guide
- **System Card**: https://openai.com/index/sora-2-system-card/

---

## Models

### sora-2 (Fast Model)

**Best For**:
- Quick iterations
- Social media content
- Prototyping
- Low-fidelity needs

**Characteristics**:
- Faster generation (2-5 minutes average)
- Good quality
- Lower cost
- Ideal for Mode 1 & 2

**Use Case Example**:
```javascript
{
  model: 'sora-2',
  prompt: 'The burger sizzles on the grill',
  size: '1280x720',
  seconds: 8
}
```

### sora-2-pro (High Quality Model)

**Best For**:
- Production content
- Marketing materials
- High-resolution output
- Maximum fidelity

**Characteristics**:
- Slower generation (5-15 minutes average)
- Superior quality
- Higher cost
- Better for Mode 3

**Use Case Example**:
```javascript
{
  model: 'sora-2-pro',
  prompt: 'Cinematic shot of restaurant interior',
  size: '1920x1080',
  seconds: 12
}
```

---

## Video Configuration

### Supported Sizes

| Size | Aspect Ratio | Use Case |
|------|-------------|----------|
| 1280x720 | 16:9 | Standard HD, YouTube, Facebook |
| 1920x1080 | 16:9 | Full HD, YouTube, Website |
| 720x1280 | 9:16 | Instagram Stories, TikTok |
| 1080x1920 | 9:16 | Vertical video, Reels |

**Recommendation**: Use `1280x720` for most social media content

### Supported Durations

- **4 seconds**: Quick clips, GIF-style
- **8 seconds**: Standard social posts (recommended)
- **12 seconds**: Longer-form content

---

## API Endpoints

### 1. Create Video

**Endpoint**: `POST /v1/videos`

**Request Format**:
```javascript
{
  model: 'sora-2' | 'sora-2-pro',
  prompt: string,              // Required
  input_reference?: File,      // Optional (Mode 1 & 3)
  size: string,                // e.g., '1280x720'
  seconds: number              // 4, 8, or 12
}
```

**Example - Text Only**:
```javascript
const response = await openai.videos.create({
  model: 'sora-2',
  prompt: 'A cozy coffee shop interior with warm lighting',
  size: '1280x720',
  seconds: 8
});
```

**Example - With Image Reference**:
```javascript
const fs = require('fs');

const response = await openai.videos.create({
  model: 'sora-2',
  prompt: 'She turns and smiles, then walks out of frame',
  input_reference: fs.createReadStream('./image.jpg'),
  size: '1280x720',
  seconds: 8
});
```

**Response**:
```json
{
  "id": "video_68d7512d07848190b3e45da0ecbebcde004da08e1e0678d5",
  "object": "video",
  "created_at": 1758941485,
  "status": "queued",
  "model": "sora-2",
  "progress": 0,
  "seconds": 8,
  "size": "1280x720"
}
```

### 2. Check Status

**Endpoint**: `GET /v1/videos/{video_id}`

**Request**:
```javascript
const status = await openai.videos.retrieve('video_abc123');
```

**Response - In Progress**:
```json
{
  "id": "video_abc123",
  "object": "video",
  "status": "in_progress",
  "progress": 45,
  "model": "sora-2"
}
```

**Response - Completed**:
```json
{
  "id": "video_abc123",
  "object": "video",
  "status": "completed",
  "progress": 100,
  "model": "sora-2",
  "created_at": 1758941485,
  "completed_at": 1758941785
}
```

**Response - Failed**:
```json
{
  "id": "video_abc123",
  "object": "video",
  "status": "failed",
  "error": {
    "message": "Content policy violation",
    "code": "content_policy"
  }
}
```

### 3. Download Video

**Endpoint**: `GET /v1/videos/{video_id}/content`

**Request**:
```javascript
const content = await openai.videos.downloadContent('video_abc123');
const arrayBuffer = await content.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
```

### 4. Download Thumbnail

**Endpoint**: `GET /v1/videos/{video_id}/content?variant=thumbnail`

**Request**:
```javascript
const content = await openai.videos.downloadContent('video_abc123', {
  variant: 'thumbnail'
});
```

**Format**: WebP image

### 5. Download Spritesheet

**Endpoint**: `GET /v1/videos/{video_id}/content?variant=spritesheet`

**Format**: JPEG with multiple frames in a grid

### 6. Delete Video

**Endpoint**: `DELETE /v1/videos/{video_id}`

**Request**:
```javascript
await openai.videos.del('video_abc123');
```

---

## Content Restrictions

### Guardrails

Sora API enforces these content restrictions:

1. **Age-Appropriate Content**
   - Only U18-suitable content allowed
   - (Future: setting to bypass this restriction)

2. **Copyrighted Characters**
   - No copyrighted characters (e.g., Mario, SpongeBob)
   - No brand mascots

3. **Copyrighted Music**
   - No copyrighted audio in prompts

4. **Real People**
   - Cannot generate real people
   - Including public figures

5. **Faces in Input Images**
   - Input images with human faces are rejected
   - Use for food/products only

### Content Policy Error Example

```json
{
  "error": {
    "message": "Content policy violation: Copyrighted character detected in prompt",
    "type": "invalid_request_error",
    "param": "prompt",
    "code": "content_policy"
  }
}
```

---

## Prompting Best Practices

### Structure

Good prompts describe:
1. **Shot Type**: Wide, close-up, tracking, etc.
2. **Subject**: Main focus of the video
3. **Action**: What happens in the scene
4. **Setting**: Environment/location
5. **Lighting**: Mood, time of day

### Examples

**Poor Prompt**:
```
"A burger"
```

**Good Prompt**:
```
"Close-up shot of a gourmet burger on a wooden board,
steam rising from the hot patty, camera slowly zooms
in to reveal melted cheese, warm restaurant lighting"
```

**Excellent Prompt**:
```
"Slow tracking shot moving around a freshly grilled
burger on a rustic wooden board. Steam rises from the
hot beef patty. Melted cheddar cheese cascades down
the sides. Golden sesame seed bun glistens. Warm,
soft lighting from above. Shallow depth of field with
blurred background. Professional food cinematography."
```

### Image-to-Video Prompts

When using an input reference image, the prompt should describe:
- **Motion**: What moves and how
- **Camera**: Camera movement
- **Effects**: Additional visual effects

**Example**:
```javascript
{
  prompt: "She turns around and smiles, then slowly walks out of frame",
  input_reference: portrait_image.jpg
}
```

---

## Error Handling

### Error Types

| Error Code | Meaning | Action |
|------------|---------|--------|
| `invalid_request_error` | Bad parameters | Fix request format |
| `authentication_error` | Invalid API key | Check credentials |
| `rate_limit_error` | Too many requests | Implement backoff |
| `content_policy` | Policy violation | Modify prompt |
| `server_error` | OpenAI server issue | Retry later |

### Retry Strategy

```javascript
async function createVideoWithRetry(params, maxRetries = 3) {
  const retryableErrors = ['rate_limit_error', 'server_error'];

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await openai.videos.create(params);
    } catch (error) {
      if (!retryableErrors.includes(error.code)) {
        throw error;  // Don't retry content policy errors
      }

      if (i === maxRetries - 1) throw error;

      // Exponential backoff
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

---

## Polling Strategy

### Recommended Approach

```javascript
const POLL_INTERVAL = 10000;  // 10 seconds
const MAX_POLLS = 360;         // 1 hour timeout

async function pollUntilComplete(videoId) {
  for (let i = 0; i < MAX_POLLS; i++) {
    const status = await openai.videos.retrieve(videoId);

    if (status.status === 'completed') {
      return status;
    }

    if (status.status === 'failed') {
      throw new Error(status.error.message);
    }

    await sleep(POLL_INTERVAL);
  }

  throw new Error('Video generation timeout');
}
```

### Helper Function

```javascript
const openai = new OpenAI();

// Convenience method that handles polling automatically
const video = await openai.videos.createAndPoll({
  model: 'sora-2',
  prompt: 'A spinning cube',
  size: '1280x720',
  seconds: 8
});

if (video.status === 'completed') {
  console.log('Video ready!');
}
```

---

## Webhooks (Future)

### Event Types

- `video.completed`: Video generation succeeded
- `video.failed`: Video generation failed

### Setup

1. Configure webhook in OpenAI Dashboard
2. Implement webhook endpoint:

```javascript
app.post('/api/social-media/webhooks/sora', (req, res) => {
  const event = req.body;

  if (event.type === 'video.completed') {
    // Download and store video
  }

  if (event.type === 'video.failed') {
    // Update job status
  }

  res.sendStatus(200);
});
```

---

## Cost Optimization

### Strategies

1. **Use sora-2 for iterations**
   - Cheaper and faster
   - Good for testing prompts

2. **Use sora-2-pro for final output**
   - Only when needed
   - Higher quality worth the cost

3. **Minimize video duration**
   - Use 4-8 seconds when possible
   - 12 seconds only if necessary

4. **Cache generated videos**
   - Store in database
   - Reuse when possible

5. **Implement rate limiting**
   - Prevent accidental mass generation
   - Control costs per organization

---

## Testing

### Test Cases

```javascript
// Test 1: Simple text-to-video
const test1 = await openai.videos.create({
  model: 'sora-2',
  prompt: 'A spinning red cube on a white background',
  size: '1280x720',
  seconds: 4
});

// Test 2: Image-to-video
const test2 = await openai.videos.create({
  model: 'sora-2',
  prompt: 'The dish spins slowly, steam rises',
  input_reference: fs.createReadStream('./burger.jpg'),
  size: '1280x720',
  seconds: 8
});

// Test 3: High quality
const test3 = await openai.videos.create({
  model: 'sora-2-pro',
  prompt: 'Cinematic shot of cozy restaurant',
  size: '1920x1080',
  seconds: 12
});

// Test 4: Content policy (should fail)
const test4 = await openai.videos.create({
  model: 'sora-2',
  prompt: 'Mario jumping on a mushroom',  // Copyrighted
  size: '1280x720',
  seconds: 4
});
```

---

## Resources

- **Official Docs**: https://platform.openai.com/docs/guides/video-generation
- **Cookbook**: https://cookbook.openai.com/examples/sora/sora2_prompting_guide
- **Community Forum**: https://community.openai.com
- **Pricing**: https://openai.com/api/pricing
- **Status Page**: https://status.openai.com

---

Last Updated: 2025-10-07
