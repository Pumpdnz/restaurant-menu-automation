# API Specification

## Base URL

```
http://localhost:3007/api/social-media
```

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

The token must include:
- `user.id`: User UUID
- `user.organisationId`: Organization UUID

## Endpoints

### 1. Generate Video

Create a new video generation job.

**Endpoint**: `POST /api/social-media/generate`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "mode": "image-to-video | text-to-video | generated-image-to-video",
  "prompt": "string (required)",
  "imagePrompt": "string (required for mode 3)",
  "inputSource": {
    "imageId": "uuid (required for mode 1)",
    "sourceType": "menu | ai | uploaded | logo (required for mode 1)"
  },
  "restaurantId": "uuid (optional)",
  "menuId": "uuid (optional)",
  "menuItemId": "uuid (optional)",
  "soraModel": "sora-2 | sora-2-pro (default: sora-2)",
  "videoConfig": {
    "size": "1280x720 | 1920x1080 | 720x1280 | 1080x1920 (default: 1280x720)",
    "seconds": 4 | 8 | 12 (default: 8)
  },
  "geminiConfig": {
    "aspectRatio": "16:9 | 1:1 | 9:16 | 4:3 | 3:4 (default: auto-detected from videoConfig.size)"
  },
  "voiceConfig": {
    "enabled": "boolean (optional, default: false)",
    "script": "string (required if enabled)",
    "voiceId": "string (required if enabled)",
    "voiceModel": "eleven_flash_v2_5 | eleven_turbo_v2_5 | eleven_multilingual_v2 (default: eleven_flash_v2_5)",
    "voiceSettings": {
      "stability": "number 0.0-1.0 (default: 0.5)",
      "similarity_boost": "number 0.0-1.0 (default: 0.75)",
      "style": "number 0.0-1.0 (default: 0.0)",
      "use_speaker_boost": "boolean (default: true)"
    },
    "language": "string ISO 639-1 code (optional)"
  }
}
```

**Example Request - Mode 1 (Menu Image → Video)**:
```json
{
  "mode": "image-to-video",
  "prompt": "The burger sizzles on the grill, steam rising dramatically, camera slowly zooms in",
  "inputSource": {
    "imageId": "423e4567-e89b-12d3-a456-426614174003",
    "sourceType": "menu"
  },
  "restaurantId": "223e4567-e89b-12d3-a456-426614174001",
  "menuItemId": "323e4567-e89b-12d3-a456-426614174002",
  "soraModel": "sora-2",
  "videoConfig": {
    "size": "1280x720",
    "seconds": 8
  }
}
```

**Example Request - Mode 1 (AI-Generated Image → Video)**:
```json
{
  "mode": "image-to-video",
  "prompt": "The taco platter spins slowly, ingredients glistening under warm light",
  "inputSource": {
    "imageId": "523e4567-e89b-12d3-a456-426614174009",
    "sourceType": "ai"
  },
  "restaurantId": "223e4567-e89b-12d3-a456-426614174001",
  "soraModel": "sora-2",
  "videoConfig": {
    "size": "1280x720",
    "seconds": 8
  }
}
```

**Example Request - Mode 1 (Logo → Video)**:
```json
{
  "mode": "image-to-video",
  "prompt": "The logo glows and pulses gently, camera zooms in slowly",
  "inputSource": {
    "imageId": "223e4567-e89b-12d3-a456-426614174001",
    "sourceType": "logo"
  },
  "restaurantId": "223e4567-e89b-12d3-a456-426614174001",
  "soraModel": "sora-2",
  "videoConfig": {
    "size": "1280x720",
    "seconds": 8
  }
}
```

**Example Request - Mode 2 (Text → Video)**:
```json
{
  "mode": "text-to-video",
  "prompt": "Cozy restaurant interior with warm lighting, customers enjoying meals, camera slowly pans across tables",
  "restaurantId": "223e4567-e89b-12d3-a456-426614174001",
  "soraModel": "sora-2-pro",
  "videoConfig": {
    "size": "1920x1080",
    "seconds": 12
  }
}
```

**Example Request - Mode 3 (Generated Image → Video - Landscape)**:
```json
{
  "mode": "generated-image-to-video",
  "imagePrompt": "Professional food photography of a vibrant taco platter with fresh ingredients, garnished with cilantro and lime",
  "prompt": "Camera slowly orbits around the dish, highlighting the vibrant colors and textures",
  "restaurantId": "223e4567-e89b-12d3-a456-426614174001",
  "soraModel": "sora-2",
  "videoConfig": {
    "size": "1280x720",
    "seconds": 8
  }
}
```

**Example Request - Mode 3 (Portrait Video for Instagram Stories/TikTok)**:
```json
{
  "mode": "generated-image-to-video",
  "imagePrompt": "Vertical portrait photo of a delicious milkshake with whipped cream and toppings, studio lighting",
  "prompt": "The milkshake glass rotates slowly, camera tilts up from bottom to top, whipped cream glistens",
  "restaurantId": "223e4567-e89b-12d3-a456-426614174001",
  "soraModel": "sora-2",
  "videoConfig": {
    "size": "720x1280",
    "seconds": 4
  }
}
```

**Example Request - Mode 2 (Portrait Video for Reels - Full HD)**:
```json
{
  "mode": "text-to-video",
  "prompt": "Vertical view inside a busy restaurant kitchen, chefs preparing dishes, camera pans from top to bottom",
  "restaurantId": "223e4567-e89b-12d3-a456-426614174001",
  "soraModel": "sora-2-pro",
  "videoConfig": {
    "size": "1080x1920",
    "seconds": 12
  }
}
```

**Example Request - Mode 1 with Voice-Over (Phase 2)**:
```json
{
  "mode": "image-to-video",
  "prompt": "The burger sizzles on the grill, steam rising dramatically",
  "inputSource": {
    "imageId": "423e4567-e89b-12d3-a456-426614174003",
    "sourceType": "menu"
  },
  "restaurantId": "223e4567-e89b-12d3-a456-426614174001",
  "soraModel": "sora-2",
  "videoConfig": {
    "size": "1280x720",
    "seconds": 8
  },
  "voiceConfig": {
    "enabled": true,
    "script": "Try our signature burger! Fresh ingredients, grilled to perfection. Available now at participating locations!",
    "voiceId": "21m00Tcm4TlvDq8ikWAM",
    "voiceModel": "eleven_flash_v2_5",
    "voiceSettings": {
      "stability": 0.5,
      "similarity_boost": 0.75,
      "style": 0.2,
      "use_speaker_boost": true
    }
  }
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "job": {
    "id": "723e4567-e89b-12d3-a456-426614174005",
    "sora_video_id": "video_68d7512d07848190b3e45da0ecbebcde004da08e1e0678d5",
    "status": "queued",
    "mode": "image-to-video",
    "prompt": "The burger sizzles on the grill...",
    "created_at": "2025-10-07T12:00:00Z"
  }
}
```

**Error Responses**:

- **400 Bad Request**: Missing required fields
  ```json
  {
    "success": false,
    "error": "mode and prompt are required"
  }
  ```

- **400 Bad Request**: Invalid mode
  ```json
  {
    "success": false,
    "error": "Invalid mode. Must be one of: image-to-video, text-to-video, generated-image-to-video"
  }
  ```

- **400 Bad Request**: Mode-specific validation
  ```json
  {
    "success": false,
    "error": "inputSource.imageId is required for image-to-video mode"
  }
  ```

- **400 Bad Request**: Missing source type
  ```json
  {
    "success": false,
    "error": "inputSource.sourceType is required (menu, ai, uploaded, or logo)"
  }
  ```

- **400 Bad Request**: Invalid source type
  ```json
  {
    "success": false,
    "error": "Invalid sourceType: unknown. Must be one of: menu, ai, uploaded, logo"
  }
  ```

- **401 Unauthorized**: Missing or invalid auth token
  ```json
  {
    "success": false,
    "error": "Authentication required"
  }
  ```

- **404 Not Found**: Image not found
  ```json
  {
    "success": false,
    "error": "Source image not found"
  }
  ```

- **500 Internal Server Error**: API failure
  ```json
  {
    "success": false,
    "error": "OpenAI API error: Rate limit exceeded"
  }
  ```

---

### 2. Get Video Status

Get the current status of a video generation job.

**Endpoint**: `GET /api/social-media/videos/:jobId/status`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `jobId` (uuid): The video job ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "status": {
    "id": "723e4567-e89b-12d3-a456-426614174005",
    "sora_video_id": "video_68d7512d07848190b3e45da0ecbebcde004da08e1e0678d5",
    "status": "in_progress",
    "progress": 45,
    "mode": "image-to-video",
    "prompt": "The burger sizzles...",
    "sora_model": "sora-2",
    "video_url": null,
    "thumbnail_url": null,
    "error_message": null,
    "created_at": "2025-10-07T12:00:00Z",
    "updated_at": "2025-10-07T12:02:30Z",
    "completed_at": null
  }
}
```

**Success Response - Completed Job**:
```json
{
  "success": true,
  "status": {
    "id": "723e4567-e89b-12d3-a456-426614174005",
    "status": "completed",
    "progress": 100,
    "video_url": "https://storage.supabase.co/social-media-videos/org-id/videos/job-id.mp4",
    "thumbnail_url": "https://storage.supabase.co/social-media-videos/org-id/thumbnails/job-id.webp",
    "completed_at": "2025-10-07T12:05:00Z"
  }
}
```

**Success Response - Failed Job**:
```json
{
  "success": true,
  "status": {
    "id": "723e4567-e89b-12d3-a456-426614174005",
    "status": "failed",
    "error_message": "Content policy violation: Copyrighted character detected",
    "retry_count": 1
  }
}
```

**Error Responses**:

- **404 Not Found**: Job not found
  ```json
  {
    "success": false,
    "error": "Video job not found"
  }
  ```

---

### 3. Refresh Video Status

Manually refresh the status of a video job from Sora API.

**Endpoint**: `POST /api/social-media/videos/:jobId/refresh`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `jobId` (uuid): The video job ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "job": {
    "id": "723e4567-e89b-12d3-a456-426614174005",
    "status": "in_progress",
    "progress": 67,
    "updated_at": "2025-10-07T12:03:45Z"
  }
}
```

**Error Responses**:

- **404 Not Found**: Job not found
- **400 Bad Request**: No Sora video ID
  ```json
  {
    "success": false,
    "error": "No Sora video ID found for this job"
  }
  ```

---

### 4. List Videos

List all video generation jobs for the authenticated user's organization.

**Endpoint**: `GET /api/social-media/videos`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
- `restaurantId` (uuid, optional): Filter by restaurant
- `status` (string, optional): Filter by status (queued, in_progress, completed, failed)
- `mode` (string, optional): Filter by generation mode
- `limit` (integer, optional, default: 50): Number of results
- `offset` (integer, optional, default: 0): Pagination offset

**Example Request**:
```
GET /api/social-media/videos?restaurantId=223e4567-e89b-12d3-a456-426614174001&status=completed&limit=20
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "videos": [
    {
      "id": "723e4567-e89b-12d3-a456-426614174005",
      "restaurant_id": "223e4567-e89b-12d3-a456-426614174001",
      "mode": "image-to-video",
      "prompt": "The burger sizzles...",
      "status": "completed",
      "sora_model": "sora-2",
      "video_url": "https://storage.supabase.co/...",
      "thumbnail_url": "https://storage.supabase.co/...",
      "created_at": "2025-10-07T12:00:00Z",
      "completed_at": "2025-10-07T12:05:00Z"
    },
    {
      "id": "823e4567-e89b-12d3-a456-426614174006",
      "restaurant_id": "223e4567-e89b-12d3-a456-426614174001",
      "mode": "text-to-video",
      "prompt": "Cozy restaurant interior...",
      "status": "completed",
      "sora_model": "sora-2-pro",
      "video_url": "https://storage.supabase.co/...",
      "thumbnail_url": "https://storage.supabase.co/...",
      "created_at": "2025-10-07T11:00:00Z",
      "completed_at": "2025-10-07T11:15:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 42
  }
}
```

---

### 5. Delete Video

Delete a video job and all associated resources.

**Endpoint**: `DELETE /api/social-media/videos/:jobId`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `jobId` (uuid): The video job ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Video deleted successfully"
}
```

**Error Responses**:

- **404 Not Found**: Job not found
- **403 Forbidden**: Not authorized to delete
  ```json
  {
    "success": false,
    "error": "You do not have permission to delete this video"
  }
  ```

---

### 6. Get Video by ID (Full Details)

Get complete details of a video job.

**Endpoint**: `GET /api/social-media/videos/:jobId`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `jobId` (uuid): The video job ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "video": {
    "id": "723e4567-e89b-12d3-a456-426614174005",
    "organisation_id": "123e4567-e89b-12d3-a456-426614174000",
    "restaurant_id": "223e4567-e89b-12d3-a456-426614174001",
    "menu_id": null,
    "menu_item_id": "323e4567-e89b-12d3-a456-426614174002",
    "mode": "image-to-video",
    "prompt": "The burger sizzles on the grill, steam rising dramatically",
    "image_prompt": null,
    "source_image_id": "423e4567-e89b-12d3-a456-426614174003",
    "source_image_type": "menu",
    "source_image_url": "https://storage.supabase.co/menu-images/burger.jpg",
    "generated_image_url": null,
    "sora_video_id": "video_68d7512d07848190b3e45da0ecbebcde004da08e1e0678d5",
    "sora_model": "sora-2",
    "status": "completed",
    "progress": 100,
    "video_url": "https://storage.supabase.co/social-media-videos/.../video.mp4",
    "thumbnail_url": "https://storage.supabase.co/social-media-videos/.../thumb.webp",
    "spritesheet_url": null,
    "voice_enabled": false,
    "voice_script": null,
    "voice_model": null,
    "voice_id": null,
    "voice_settings": null,
    "elevenlabs_audio_id": null,
    "audio_url": null,
    "final_video_url": null,
    "video_config": {
      "size": "1280x720",
      "seconds": 8
    },
    "gemini_config": null,
    "error_message": null,
    "retry_count": 0,
    "created_by": "523e4567-e89b-12d3-a456-426614174004",
    "created_at": "2025-10-07T12:00:00Z",
    "updated_at": "2025-10-07T12:05:00Z",
    "completed_at": "2025-10-07T12:05:00Z"
  }
}
```

---

### 7. Get Available Voices (Phase 2)

Get a list of all available ElevenLabs voices for voice-over generation.

**Endpoint**: `GET /api/social-media/voices`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "voices": [
    {
      "voice_id": "21m00Tcm4TlvDq8ikWAM",
      "name": "Rachel",
      "labels": {
        "accent": "american",
        "gender": "female",
        "age": "young"
      },
      "preview_url": "https://storage.googleapis.com/..."
    },
    {
      "voice_id": "AZnzlk1XvdvUeBnXmlld",
      "name": "Domi",
      "labels": {
        "accent": "american",
        "gender": "female",
        "age": "young"
      },
      "preview_url": "https://storage.googleapis.com/..."
    }
  ]
}
```

---

### 8. Get Specific Voice (Phase 2)

Get details for a specific voice.

**Endpoint**: `GET /api/social-media/voices/:voiceId`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `voiceId` (string): The ElevenLabs voice ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "voice": {
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "name": "Rachel",
    "labels": {
      "accent": "american",
      "gender": "female",
      "age": "young",
      "use_case": "narration"
    },
    "description": "A young American female voice perfect for narration",
    "preview_url": "https://storage.googleapis.com/...",
    "category": "professional"
  }
}
```

---

### 9. Preview Voice with Custom Text (Phase 2)

Generate a preview of a voice with custom text to test how it sounds.

**Endpoint**: `POST /api/social-media/voices/:voiceId/preview`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters**:
- `voiceId` (string): The ElevenLabs voice ID

**Request Body**:
```json
{
  "text": "Try our signature burger! Fresh ingredients, grilled to perfection."
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "audio_url": "https://storage.supabase.co/social-media-videos/previews/temp-preview.mp3",
  "expires_at": "2025-10-07T13:00:00Z"
}
```

---

## Image Generation Endpoints

### 10. Generate AI Image

Create a new AI-generated image or upload an image.

**Endpoint**: `POST /api/social-media/images/generate`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "mode": "uploaded | text-to-image | reference-images",
  "prompt": "string (required for text-to-image, reference-images)",
  "referenceSources": [
    {
      "id": "uuid",
      "sourceType": "menu | ai | uploaded | logo"
    }
  ],
  "restaurantId": "uuid (optional)",
  "menuId": "uuid (optional)",
  "menuItemId": "uuid (optional)",
  "imageConfig": {
    "aspectRatio": "16:9 | 9:16 | 1:1 | 4:3 | 3:4 (required)"
  },
  "geminiConfig": {
    // Optional Gemini-specific config
  }
}
```

**Example Request - Text to Image**:
```json
{
  "mode": "text-to-image",
  "prompt": "Professional food photography of a gourmet burger with fresh ingredients on a rustic wooden board, warm lighting, shallow depth of field",
  "restaurantId": "223e4567-e89b-12d3-a456-426614174001",
  "imageConfig": {
    "aspectRatio": "16:9"
  }
}
```

**Example Request - Reference Images (Mixed Sources)**:
```json
{
  "mode": "reference-images",
  "prompt": "Create a vibrant composition blending the burger, logo, and uploaded design elements with professional food photography style",
  "referenceSources": [
    {
      "id": "423e4567-e89b-12d3-a456-426614174003",
      "sourceType": "menu"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "sourceType": "logo"
    },
    {
      "id": "623e4567-e89b-12d3-a456-426614174008",
      "sourceType": "ai"
    },
    {
      "id": "723e4567-e89b-12d3-a456-426614174009",
      "sourceType": "uploaded"
    }
  ],
  "restaurantId": "223e4567-e89b-12d3-a456-426614174001",
  "imageConfig": {
    "aspectRatio": "1:1"
  }
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "image": {
    "id": "823e4567-e89b-12d3-a456-426614174010",
    "status": "completed",
    "image_url": "https://storage.supabase.co/social-media-videos/.../image.png",
    "thumbnail_url": "https://storage.supabase.co/social-media-videos/.../thumb.webp"
  }
}
```

**Error Responses**:

- **400 Bad Request**: Invalid mode
  ```json
  {
    "success": false,
    "error": "Invalid mode. Must be one of: uploaded, text-to-image, reference-images"
  }
  ```

- **400 Bad Request**: Missing reference sources
  ```json
  {
    "success": false,
    "error": "referenceSources array is required for reference-images mode (min: 1 image)"
  }
  ```

- **400 Bad Request**: Invalid source structure
  ```json
  {
    "success": false,
    "error": "referenceSources[0] must have both 'id' and 'sourceType' properties"
  }
  ```

- **400 Bad Request**: Invalid source type
  ```json
  {
    "success": false,
    "error": "referenceSources[0].sourceType must be one of: menu, ai, uploaded, logo"
  }
  ```

---

### 11. Upload Image

Upload an existing image directly (mode: uploaded).

**Endpoint**: `POST /api/social-media/images/upload`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Form Data**:
- `image` (File, required): The image file
- `restaurantId` (string, optional): Restaurant UUID
- `menuId` (string, optional): Menu UUID
- `menuItemId` (string, optional): Menu item UUID
- `aspectRatio` (string, required): Aspect ratio (16:9, 9:16, 1:1, 4:3, 3:4)

**Success Response** (201 Created):
```json
{
  "success": true,
  "image": {
    "id": "923e4567-e89b-12d3-a456-426614174011",
    "status": "completed",
    "image_url": "https://storage.supabase.co/social-media-videos/.../image.png",
    "thumbnail_url": "https://storage.supabase.co/social-media-videos/.../thumb.webp"
  }
}
```

---

### 12. List Images

List all images for the authenticated user's organization.

**Endpoint**: `GET /api/social-media/images`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
- `restaurantId` (uuid, optional): Filter by restaurant
- `status` (string, optional): Filter by status (queued, in_progress, completed, failed)
- `mode` (string, optional): Filter by generation mode (uploaded, text-to-image, reference-images)
- `limit` (integer, optional, default: 50, max: 100): Number of results
- `offset` (integer, optional, default: 0): Pagination offset

**Success Response** (200 OK):
```json
{
  "success": true,
  "images": [
    {
      "id": "823e4567-e89b-12d3-a456-426614174010",
      "mode": "text-to-image",
      "prompt": "Professional food photography...",
      "status": "completed",
      "image_url": "https://storage.supabase.co/.../image.png",
      "thumbnail_url": "https://storage.supabase.co/.../thumb.webp",
      "width": 1280,
      "height": 720,
      "created_at": "2025-10-07T12:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 15
  }
}
```

---

### 13. Get Image Status

Get the current status of an image generation job.

**Endpoint**: `GET /api/social-media/images/:imageId/status`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `imageId` (uuid): The image job ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "status": {
    "id": "823e4567-e89b-12d3-a456-426614174010",
    "mode": "reference-images",
    "prompt": "Create a vibrant composition...",
    "status": "completed",
    "progress": 100,
    "image_url": "https://storage.supabase.co/.../image.png",
    "thumbnail_url": "https://storage.supabase.co/.../thumb.webp",
    "reference_image_ids": ["uuid1", "uuid2", "uuid3"],
    "reference_image_sources": [
      { "id": "uuid1", "sourceType": "menu" },
      { "id": "uuid2", "sourceType": "logo" },
      { "id": "uuid3", "sourceType": "ai" }
    ],
    "width": 1024,
    "height": 1024,
    "file_size": 245678,
    "created_at": "2025-10-07T12:00:00Z",
    "completed_at": "2025-10-07T12:00:30Z"
  }
}
```

---

### 14. Get Image Details

Get complete details of an image job.

**Endpoint**: `GET /api/social-media/images/:imageId`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `imageId` (uuid): The image job ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "image": {
    "id": "823e4567-e89b-12d3-a456-426614174010",
    "organisation_id": "123e4567-e89b-12d3-a456-426614174000",
    "restaurant_id": "223e4567-e89b-12d3-a456-426614174001",
    "menu_id": null,
    "menu_item_id": null,
    "mode": "reference-images",
    "prompt": "Create a vibrant composition...",
    "reference_image_ids": ["uuid1", "uuid2"],
    "reference_image_sources": [
      { "id": "uuid1", "sourceType": "menu" },
      { "id": "uuid2", "sourceType": "logo" }
    ],
    "gemini_model": "gemini-2.5-flash-image",
    "status": "completed",
    "progress": 100,
    "image_url": "https://storage.supabase.co/.../image.png",
    "thumbnail_url": "https://storage.supabase.co/.../thumb.webp",
    "width": 1280,
    "height": 720,
    "file_size": 345678,
    "error_message": null,
    "created_at": "2025-10-07T12:00:00Z",
    "completed_at": "2025-10-07T12:00:25Z"
  }
}
```

---

### 15. Delete Image

Delete an image job and all associated resources.

**Endpoint**: `DELETE /api/social-media/images/:imageId`

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `imageId` (uuid): The image job ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

**Error Responses**:

- **404 Not Found**: Image job not found
- **403 Forbidden**: Not authorized to delete
  ```json
  {
    "success": false,
    "error": "You do not have permission to delete this image"
  }
  ```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200  | OK - Request successful |
| 201  | Created - Resource created successfully |
| 400  | Bad Request - Invalid parameters |
| 401  | Unauthorized - Authentication required |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource not found |
| 422  | Unprocessable Entity - Content policy violation |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error - Server error |
| 503  | Service Unavailable - External API unavailable |

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE (optional)",
  "details": {} // Optional additional details
}
```

## Rate Limits

- **Generate Video**: 10 requests per minute per organization
- **Get Status**: 60 requests per minute per organization
- **List Videos**: 30 requests per minute per organization

Rate limit headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1633024800
```

## Webhooks (Future)

### Webhook Events

**Event**: `video.completed`
```json
{
  "id": "evt_abc123",
  "object": "event",
  "created_at": 1758941485,
  "type": "video.completed",
  "data": {
    "id": "video_abc123",
    "job_id": "723e4567-e89b-12d3-a456-426614174005"
  }
}
```

**Event**: `video.failed`
```json
{
  "id": "evt_abc124",
  "object": "event",
  "created_at": 1758941485,
  "type": "video.failed",
  "data": {
    "id": "video_abc123",
    "job_id": "723e4567-e89b-12d3-a456-426614174005",
    "error": {
      "message": "Content policy violation",
      "code": "content_policy"
    }
  }
}
```

### Webhook Endpoint

**Endpoint**: `POST /api/social-media/webhooks/sora` (Future)

---

## Example Usage Flow

### Complete Flow: Image → Video

```bash
# 1. Generate video
curl -X POST https://api.example.com/api/social-media/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "image-to-video",
    "prompt": "The pizza comes out of the oven, cheese bubbling",
    "inputSource": {
      "imageId": "image-uuid",
      "sourceType": "menu"
    },
    "restaurantId": "restaurant-uuid",
    "soraModel": "sora-2"
  }'

# Response: { "success": true, "job": { "id": "job-uuid", "status": "queued" } }

# 2. Poll for status (every 10 seconds)
curl https://api.example.com/api/social-media/videos/job-uuid/status \
  -H "Authorization: Bearer <token>"

# Response: { "status": "in_progress", "progress": 45 }

# 3. Get completed video
curl https://api.example.com/api/social-media/videos/job-uuid/status \
  -H "Authorization: Bearer <token>"

# Response: {
#   "status": "completed",
#   "video_url": "https://storage.supabase.co/...",
#   "thumbnail_url": "https://storage.supabase.co/..."
# }

# 4. List all videos
curl https://api.example.com/api/social-media/videos?limit=10 \
  -H "Authorization: Bearer <token>"
```

---

### Complete Flow: Multi-Source Image Generation → Video

```bash
# 1. Generate image from multiple sources (menu + logo + AI)
curl -X POST https://api.example.com/api/social-media/images/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "reference-images",
    "prompt": "Combine these elements into a cohesive marketing image",
    "referenceSources": [
      { "id": "menu-image-uuid", "sourceType": "menu" },
      { "id": "restaurant-uuid", "sourceType": "logo" },
      { "id": "ai-image-uuid", "sourceType": "ai" }
    ],
    "restaurantId": "restaurant-uuid",
    "imageConfig": {
      "aspectRatio": "16:9"
    }
  }'

# Response: { "success": true, "image": { "id": "generated-image-uuid", "status": "completed" } }

# 2. Use generated image for video
curl -X POST https://api.example.com/api/social-media/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "image-to-video",
    "prompt": "Camera pans slowly across the composition, highlighting each element",
    "inputSource": {
      "imageId": "generated-image-uuid",
      "sourceType": "ai"
    },
    "restaurantId": "restaurant-uuid",
    "soraModel": "sora-2",
    "videoConfig": {
      "size": "1280x720",
      "seconds": 8
    }
  }'

# Response: { "success": true, "job": { "id": "video-job-uuid", "status": "queued" } }

# 3. Poll for video completion
curl https://api.example.com/api/social-media/videos/video-job-uuid/status \
  -H "Authorization: Bearer <token>"

# Response: { "status": "completed", "video_url": "https://...", "thumbnail_url": "https://..." }
```

---

Last Updated: 2025-10-10
