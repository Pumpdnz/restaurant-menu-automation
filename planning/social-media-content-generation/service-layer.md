# Service Layer Architecture

## Overview

The service layer consists of four main services that handle video generation orchestration, external API integration, and data persistence.

```
VideoGenerationService
         │
         ├─── SoraService
         ├─── GeminiImageService
         └─── SocialStorageService
```

## 1. VideoGenerationService

**Location**: `UberEats-Image-Extractor/src/services/social-media/video-generation-service.js`

### Purpose
Main orchestrator that coordinates between all services, handles different generation modes, and manages the async job lifecycle.

### Dependencies
```javascript
const SoraService = require('./sora-service');
const GeminiImageService = require('./gemini-image-service');
const SocialStorageService = require('./social-storage-service');
const ElevenLabsService = require('./elevenlabs-service');  // Phase 2
const VideoProcessingService = require('./video-processing-service');  // Phase 2
const db = require('../database-service');
```

### Class Structure

```javascript
class VideoGenerationService {
  constructor() {
    this.soraService = new SoraService();
    this.geminiService = new GeminiImageService();
    this.storageService = new SocialStorageService();
    this.elevenLabsService = new ElevenLabsService();  // Phase 2
    this.videoProcessingService = new VideoProcessingService();  // Phase 2
  }

  // Main methods
  async generateVideo(request)
  async pollJobCompletion(jobId, soraVideoId)
  async getJobStatus(jobId)
  async listVideos(filters)
  async refreshJobStatus(jobId)
  async deleteVideo(jobId)

  // Helper methods
  async downloadImageForSora(imageUrl)
  async handleMode1(inputSource)    // Database image
  async handleMode2()               // Text only
  async handleMode3(imagePrompt)    // Generated image
  async handleVoiceOver(jobId, voiceConfig)  // Phase 2
}
```

### Method: generateVideo(request)

**Purpose**: Main entry point for video generation

**Parameters**:
```javascript
{
  mode: 'image-to-video' | 'text-to-video' | 'generated-image-to-video',
  prompt: string,
  imagePrompt?: string,
  inputSource?: { type: 'database', imageId: string },
  organisationId: string,
  restaurantId?: string,
  menuId?: string,
  menuItemId?: string,
  userId: string,
  soraModel: 'sora-2' | 'sora-2-pro',
  videoConfig: { size: string, seconds: number }
}
```

**Flow**:
```javascript
async generateVideo(request) {
  // 1. Create initial job record (status: queued)
  const job = await this.storageService.createJob({...});

  try {
    let inputReference = null;

    // 2. Handle mode-specific input preparation
    switch (request.mode) {
      case 'image-to-video':
        // Fetch image from database
        inputReference = await this.handleMode1(request.inputSource);
        break;

      case 'text-to-video':
        // No input reference needed
        break;

      case 'generated-image-to-video':
        // Generate image with Gemini
        inputReference = await this.handleMode3(request.imagePrompt);
        break;
    }

    // 3. Create Sora video generation job
    const soraJob = await this.soraService.createVideo({
      model: request.soraModel,
      prompt: request.prompt,
      inputReference,
      ...request.videoConfig
    });

    // 4. Update job with Sora video ID
    await this.storageService.updateJob(job.id, {
      sora_video_id: soraJob.id,
      status: soraJob.status,
      progress: soraJob.progress || 0
    });

    // 5. Start background polling
    this.pollJobCompletion(job.id, soraJob.id);

    return { id: job.id, sora_video_id: soraJob.id, status: soraJob.status };

  } catch (error) {
    // Update job with error
    await this.storageService.updateJob(job.id, {
      status: 'failed',
      error_message: error.message
    });
    throw error;
  }
}
```

### Method: handleVoiceOver(jobId, voiceConfig) - Phase 2

**Purpose**: Generate voice-over audio and overlay it onto the completed video

```javascript
async handleVoiceOver(jobId, voiceConfig) {
  try {
    // Generate audio with ElevenLabs
    const audioBuffer = await this.elevenLabsService.textToSpeech({
      text: voiceConfig.script,
      voiceId: voiceConfig.voiceId,
      modelId: voiceConfig.voiceModel,
      voiceSettings: voiceConfig.voiceSettings,
      language: voiceConfig.language
    });

    // Upload audio to storage
    const audioUrl = await this.storageService.uploadAudio(audioBuffer, jobId);

    // Update job with audio URL
    await this.storageService.updateJob(jobId, {
      audio_url: audioUrl,
      elevenlabs_audio_id: `audio_${jobId}`
    });

    // Wait for video to complete
    const job = await this.storageService.getJob(jobId);
    if (job.status !== 'completed' || !job.video_url) {
      throw new Error('Video must be completed before adding voice-over');
    }

    // Download the completed video
    const videoBuffer = await this.downloadVideoBuffer(job.video_url);

    // Overlay audio on video using FFmpeg
    const finalVideoBuffer = await this.videoProcessingService.overlayAudio(
      videoBuffer,
      audioBuffer,
      jobId
    );

    // Upload final video with voice-over
    const finalVideoUrl = await this.storageService.uploadVideo(
      finalVideoBuffer,
      jobId,
      'final'
    );

    // Update job with final video URL
    await this.storageService.updateJob(jobId, {
      final_video_url: finalVideoUrl,
      status: 'completed'
    });

    return finalVideoUrl;

  } catch (error) {
    console.error('Voice-over processing failed:', error);
    await this.storageService.updateJob(jobId, {
      error_message: `Voice-over failed: ${error.message}`
    });
    throw error;
  }
}
```

---

### Method: pollJobCompletion(jobId, soraVideoId)

**Purpose**: Background polling for job completion

**Configuration**:
```javascript
const POLL_INTERVAL = 10000;  // 10 seconds
const MAX_POLLS = 360;         // 1 hour timeout
```

**Flow**:
```javascript
async pollJobCompletion(jobId, soraVideoId) {
  let polls = 0;

  const poll = async () => {
    if (polls >= MAX_POLLS) {
      await this.storageService.updateJob(jobId, {
        status: 'failed',
        error_message: 'Timeout: Video generation took too long'
      });
      return;
    }

    polls++;

    try {
      // Check status from Sora API
      const status = await this.soraService.checkStatus(soraVideoId);

      // Update progress
      await this.storageService.updateJob(jobId, {
        status: status.status,
        progress: status.progress || 0
      });

      if (status.status === 'completed') {
        // Download assets
        const videoBuffer = await this.soraService.downloadVideo(soraVideoId);
        const thumbnailBuffer = await this.soraService.downloadThumbnail(soraVideoId);

        // Upload to Supabase
        const videoUrl = await this.storageService.uploadVideo(videoBuffer, jobId);
        const thumbnailUrl = await this.storageService.uploadThumbnail(thumbnailBuffer, jobId);

        // Update job
        await this.storageService.updateJob(jobId, {
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          completed_at: new Date().toISOString()
        });

      } else if (status.status === 'failed') {
        await this.storageService.updateJob(jobId, {
          error_message: status.error?.message || 'Video generation failed'
        });

      } else {
        // Continue polling
        setTimeout(poll, POLL_INTERVAL);
      }

    } catch (error) {
      console.error('Polling error:', error);
      setTimeout(poll, POLL_INTERVAL);  // Retry on error
    }
  };

  // Start polling after initial delay
  setTimeout(poll, POLL_INTERVAL);
}
```

---

## 2. SoraService

**Location**: `UberEats-Image-Extractor/src/services/social-media/sora-service.js`

### Purpose
Wraps the OpenAI Sora 2 API, handling video creation, status checks, and asset downloads.

### Dependencies
```javascript
import OpenAI from 'openai';
```

### Class Structure

```javascript
class SoraService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async createVideo({ model, prompt, inputReference, size, seconds })
  async checkStatus(videoId)
  async downloadVideo(videoId)
  async downloadThumbnail(videoId)
  async downloadSpritesheet(videoId)
  async deleteVideo(videoId)
}
```

### Method: createVideo()

```javascript
async createVideo({ model, prompt, inputReference, size, seconds }) {
  const params = {
    model,           // 'sora-2' or 'sora-2-pro'
    prompt,          // User's video generation prompt
    size,            // '1280x720' or '1920x1080'
    seconds          // 4, 8, or 12
  };

  // Add input_reference if provided (Mode 1 & 3)
  if (inputReference) {
    params.input_reference = inputReference;  // File buffer or path
  }

  try {
    const video = await this.client.videos.create(params);

    return {
      id: video.id,              // e.g., "video_68d7512d..."
      status: video.status,      // 'queued', 'in_progress', 'completed', 'failed'
      model: video.model,
      progress: video.progress   // 0-100
    };

  } catch (error) {
    throw new Error(`Sora API error: ${error.message}`);
  }
}
```

### Method: checkStatus()

```javascript
async checkStatus(videoId) {
  try {
    const video = await this.client.videos.retrieve(videoId);

    return {
      id: video.id,
      status: video.status,
      progress: video.progress,
      error: video.error || null
    };

  } catch (error) {
    throw new Error(`Failed to check status: ${error.message}`);
  }
}
```

### Method: downloadVideo()

```javascript
async downloadVideo(videoId) {
  try {
    const content = await this.client.videos.downloadContent(videoId);
    const arrayBuffer = await content.arrayBuffer();
    return Buffer.from(arrayBuffer);

  } catch (error) {
    throw new Error(`Failed to download video: ${error.message}`);
  }
}
```

### Method: downloadThumbnail()

```javascript
async downloadThumbnail(videoId) {
  try {
    const content = await this.client.videos.downloadContent(videoId, {
      variant: 'thumbnail'
    });
    const arrayBuffer = await content.arrayBuffer();
    return Buffer.from(arrayBuffer);

  } catch (error) {
    throw new Error(`Failed to download thumbnail: ${error.message}`);
  }
}
```

---

## 3. GeminiImageService

**Location**: `UberEats-Image-Extractor/src/services/social-media/gemini-image-service.js`

### Purpose
Wraps the Google Gemini 2.5 Flash Image API for AI image generation.

### Dependencies
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
```

### Class Structure

```javascript
class GeminiImageService {
  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);
    this.model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash-image'
    });
  }

  async generateImage(prompt, config = {})
}
```

### Method: generateImage()

```javascript
async generateImage(prompt, config = {}) {
  const { aspectRatio = '16:9' } = config;

  try {
    const result = await this.model.generateContent([
      {
        text: prompt
      }
    ]);

    const response = await result.response;

    // Extract image data from response
    // Gemini returns base64 encoded image
    const imagePart = response.candidates[0].content.parts.find(
      part => part.inlineData
    );

    if (!imagePart) {
      throw new Error('No image generated in response');
    }

    const imageData = imagePart.inlineData;

    return {
      buffer: Buffer.from(imageData.data, 'base64'),
      mimeType: imageData.mimeType,  // e.g., 'image/png'
      aspectRatio
    };

  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
  }
}
```

---

## 4. SocialStorageService

**Location**: `UberEats-Image-Extractor/src/services/social-media/social-storage-service.js`

### Purpose
Handles all database and Supabase Storage operations for social media videos.

### Dependencies
```javascript
const db = require('../database-service');
const { createClient } = require('@supabase/supabase-js');
```

### Class Structure

```javascript
class SocialStorageService {
  constructor() {
    this.supabase = db.supabase;
  }

  // Database operations
  async createJob(data)
  async updateJob(jobId, updates)
  async getJob(jobId)
  async listJobs(filters)
  async deleteJob(jobId)

  // Storage operations
  async uploadVideo(buffer, jobId)
  async uploadThumbnail(buffer, jobId)
  async uploadGeneratedImage(buffer, jobId)
  async getMenuItemImage(imageId)
  async deleteJobAssets(jobId)
}
```

### Method: createJob()

```javascript
async createJob(data) {
  const {
    mode,
    prompt,
    imagePrompt,
    organisationId,
    restaurantId,
    menuId,
    menuItemId,
    userId,
    soraModel,
    videoConfig,
    geminiConfig,
    sourceImageId,
    sourceImageUrl,
    status = 'queued'
  } = data;

  const { data: job, error } = await this.supabase
    .from('social_media_videos')
    .insert({
      organisation_id: organisationId,
      restaurant_id: restaurantId,
      menu_id: menuId,
      menu_item_id: menuItemId,
      mode,
      prompt,
      image_prompt: imagePrompt,
      source_image_id: sourceImageId,
      source_image_url: sourceImageUrl,
      sora_model: soraModel,
      status,
      video_config: videoConfig,
      gemini_config: geminiConfig,
      created_by: userId
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create job: ${error.message}`);

  return job;
}
```

### Method: uploadVideo()

```javascript
async uploadVideo(buffer, jobId) {
  const job = await this.getJob(jobId);
  const orgId = job.organisation_id;

  const path = `${orgId}/videos/${jobId}.mp4`;

  const { data, error } = await this.supabase.storage
    .from('social-media-videos')
    .upload(path, buffer, {
      contentType: 'video/mp4',
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  // Get public URL
  const { data: urlData } = this.supabase.storage
    .from('social-media-videos')
    .getPublicUrl(path);

  return urlData.publicUrl;
}
```

### Method: getMenuItemImage()

```javascript
async getMenuItemImage(imageId) {
  // Fetch image metadata from database
  const { data: image, error } = await this.supabase
    .from('item_images')
    .select('*')
    .eq('id', imageId)
    .single();

  if (error) throw new Error(`Image not found: ${error.message}`);

  return {
    id: image.id,
    url: image.cdn_url || image.url,
    local_path: image.local_path,
    width: image.width,
    height: image.height
  };
}
```

---

## 5. ElevenLabsService (Phase 2)

**Location**: `UberEats-Image-Extractor/src/services/social-media/elevenlabs-service.js`

### Purpose
Wraps the ElevenLabs API for text-to-speech voice generation, handling voice selection, audio generation, and voice previews.

### Dependencies
```javascript
const axios = require('axios');
```

### Class Structure

```javascript
class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
  }

  async textToSpeech({ text, voiceId, modelId, voiceSettings, language })
  async getVoices()
  async getVoice(voiceId)
  async getVoicePreview(voiceId)
}
```

### Method: textToSpeech()

```javascript
async textToSpeech({ text, voiceId, modelId = 'eleven_flash_v2_5', voiceSettings, language }) {
  try {
    const response = await axios.post(
      `${this.baseUrl}/text-to-speech/${voiceId}`,
      {
        text,
        model_id: modelId,
        voice_settings: voiceSettings || {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        },
        language_code: language
      },
      {
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    return Buffer.from(response.data);

  } catch (error) {
    throw new Error(`ElevenLabs API error: ${error.message}`);
  }
}
```

### Method: getVoices()

```javascript
async getVoices() {
  try {
    const response = await axios.get(`${this.baseUrl}/voices`, {
      headers: {
        'xi-api-key': this.apiKey
      }
    });

    return response.data.voices;

  } catch (error) {
    throw new Error(`Failed to fetch voices: ${error.message}`);
  }
}
```

### Method: getVoice()

```javascript
async getVoice(voiceId) {
  try {
    const response = await axios.get(`${this.baseUrl}/voices/${voiceId}`, {
      headers: {
        'xi-api-key': this.apiKey
      }
    });

    return response.data;

  } catch (error) {
    throw new Error(`Failed to fetch voice: ${error.message}`);
  }
}
```

---

## 6. VideoProcessingService (Phase 2)

**Location**: `UberEats-Image-Extractor/src/services/social-media/video-processing-service.js`

### Purpose
Handles video and audio processing tasks, including overlaying voice-over audio onto generated videos using FFmpeg.

### Dependencies
```javascript
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
```

### Class Structure

```javascript
class VideoProcessingService {
  constructor() {
    this.ffmpeg = require('fluent-ffmpeg');
  }

  async overlayAudio(videoBuffer, audioBuffer, jobId)
  async extractAudio(videoBuffer)
  async mixAudio(track1Buffer, track2Buffer, volume1 = 1.0, volume2 = 0.8)
}
```

### Method: overlayAudio()

Combines video with voice-over audio while preserving Sora's native audio.

```javascript
async overlayAudio(videoBuffer, audioBuffer, jobId) {
  const videoPath = `/tmp/${jobId}-video.mp4`;
  const audioPath = `/tmp/${jobId}-audio.mp3`;
  const outputPath = `/tmp/${jobId}-final.mp4`;

  try {
    // Write buffers to temp files
    await fs.writeFile(videoPath, videoBuffer);
    await fs.writeFile(audioPath, audioBuffer);

    // Use FFmpeg to overlay audio
    return new Promise((resolve, reject) => {
      this.ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v copy',           // Copy video codec (no re-encoding)
          '-c:a aac',            // AAC audio codec
          '-b:a 192k',           // Audio bitrate
          '-map 0:v:0',          // Map video from first input
          '-map 0:a:0?',         // Map original audio if exists
          '-map 1:a:0',          // Map voice-over audio
          '-filter_complex',     // Mix both audio tracks
          '[0:a:0]volume=0.3[a1];[1:a:0]volume=1.0[a2];[a1][a2]amix=inputs=2:duration=longest',
          '-shortest'            // Match shortest input
        ])
        .on('end', async () => {
          const finalBuffer = await fs.readFile(outputPath);

          // Cleanup temp files
          await fs.unlink(videoPath);
          await fs.unlink(audioPath);
          await fs.unlink(outputPath);

          resolve(finalBuffer);
        })
        .on('error', async (err) => {
          // Cleanup on error
          try {
            await fs.unlink(videoPath);
            await fs.unlink(audioPath);
            await fs.unlink(outputPath);
          } catch (e) {}
          reject(err);
        })
        .save(outputPath);
    });

  } catch (error) {
    throw new Error(`Video processing failed: ${error.message}`);
  }
}
```

---

## Error Handling

### Error Types

```javascript
class VideoGenerationError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// Usage
throw new VideoGenerationError(
  'Failed to generate image',
  'GEMINI_API_ERROR',
  { prompt, apiError: error.message }
);
```

### Retry Logic

```javascript
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

// Usage
await withRetry(() => this.soraService.checkStatus(videoId));
```

---

## Testing

### Unit Tests

```javascript
// video-generation-service.test.js
describe('VideoGenerationService', () => {
  let service;
  let mockSoraService;
  let mockStorageService;

  beforeEach(() => {
    mockSoraService = {
      createVideo: jest.fn(),
      checkStatus: jest.fn(),
      downloadVideo: jest.fn()
    };

    service = new VideoGenerationService();
    service.soraService = mockSoraService;
  });

  test('should create video job with image reference', async () => {
    // Test implementation
  });

  test('should handle polling until completion', async () => {
    // Test implementation
  });

  test('should handle API errors gracefully', async () => {
    // Test implementation
  });
});
```

---

Last Updated: 2025-10-07
