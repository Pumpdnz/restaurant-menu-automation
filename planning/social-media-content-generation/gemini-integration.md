# Google Gemini 2.5 Flash Image API Integration

## Overview

Google Gemini 2.5 Flash Image (nicknamed "Nano Banana") is an AI image generation model that creates high-quality images from text prompts. This document covers the specific implementation details for integrating Gemini 2.5 Flash Image into Mode 3 of our system.

---

## API Basics

### Model Name
```
gemini-2.5-flash-image
```

### Authentication
API Key in request or environment variable:
```javascript
const client = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);
```

### Official Documentation
- **Main Guide**: https://ai.google.dev/gemini-api/docs/image-generation
- **API Reference**: https://ai.google.dev/api/generate-content
- **Getting Started**: https://ai.google.dev/gemini-api/docs/get-started/tutorial
- **Google AI Studio**: https://aistudio.google.com

---

## Installation

```bash
npm install @google/generative-ai
```

---

## Basic Usage

### Initialize Client

```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-image'
});
```

### Generate Image

```javascript
async function generateImage(prompt) {
  const result = await model.generateContent([
    {
      text: prompt
    }
  ]);

  const response = await result.response;

  // Extract image from response
  const imagePart = response.candidates[0].content.parts.find(
    part => part.inlineData
  );

  if (!imagePart) {
    throw new Error('No image generated');
  }

  return {
    mimeType: imagePart.inlineData.mimeType,  // 'image/png'
    data: imagePart.inlineData.data,          // base64 string
    buffer: Buffer.from(imagePart.inlineData.data, 'base64')
  };
}
```

---

## Supported Features

### Aspect Ratios

| Ratio | Use Case |
|-------|----------|
| 1:1 | Square (Instagram posts) |
| 16:9 | Widescreen (YouTube, landscape Sora videos) |
| 9:16 | Vertical (Stories, TikTok, portrait Sora videos) |
| 4:3 | Classic (Facebook) |
| 3:4 | Portrait |
| 21:9 | Ultra-wide cinematic |

**For Sora Integration**:
- Use **16:9** for landscape videos (`1280x720`, `1920x1080`)
- Use **9:16** for portrait videos (`720x1280`, `1080x1920`)
- The aspect ratio is automatically selected based on `videoConfig.size`

### Image Editing

Gemini 2.5 Flash Image also supports:
- **Image-to-Image**: Modify existing images
- **Multi-Image Composition**: Blend multiple images ✅ **Used in Step 4.8**
- **Style Transfer**: Apply artistic styles
- **Inpainting**: Edit specific regions

**For Our Use Case**:
- ✅ Text-to-image generation (Mode: 'text-to-image')
- ✅ Multi-image composition (Modes: 'image-reference' and 'remix' in Step 4.8)

---

## Prompting Best Practices

### Structure

Good prompts include:
1. **Subject**: What to generate
2. **Style**: Photography, art style, etc.
3. **Details**: Colors, composition, mood
4. **Quality**: Professional, high-res, etc.

### Examples

**Poor Prompt**:
```
"A taco"
```

**Good Prompt**:
```
"Professional food photography of a taco platter with fresh ingredients"
```

**Excellent Prompt**:
```
"Professional food photography of a vibrant taco platter.
Three street tacos with grilled chicken, topped with fresh
cilantro, diced onions, and lime wedges. Colorful presentation
on a rustic wooden board. Warm, natural lighting. Shallow
depth of field. High resolution. Restaurant-quality presentation."
```

### Prompting for Sora

When generating images that will be animated with Sora:

1. **Static Composition**: Avoid action words
2. **Clear Subject**: Well-defined main subject
3. **Stable Elements**: Objects that can be animated
4. **Professional Style**: Food photography style

**Example for Food**:
```
"Professional overhead shot of a burger with fries on a slate
plate. Perfect lighting, vibrant colors, garnished with herbs.
High resolution commercial photography."
```

**Example for Restaurant**:
```
"Wide angle shot of a modern restaurant interior. Empty dining
room with wooden tables and warm ambient lighting. Professional
architectural photography."
```

---

## Response Format

### Success Response Structure

```javascript
{
  candidates: [
    {
      content: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: "iVBORw0KGgoAAAANS..." // base64 encoded
            }
          }
        ]
      },
      finishReason: "STOP"
    }
  ]
}
```

### Extract Image Data

```javascript
async function extractImage(result) {
  const response = await result.response;

  // Get first candidate
  const candidate = response.candidates[0];

  if (!candidate) {
    throw new Error('No candidates in response');
  }

  // Find image part
  const imagePart = candidate.content.parts.find(
    part => part.inlineData
  );

  if (!imagePart) {
    throw new Error('No image data in response');
  }

  const { mimeType, data } = imagePart.inlineData;

  return {
    mimeType,                                // 'image/png'
    base64: data,                            // base64 string
    buffer: Buffer.from(data, 'base64')      // Buffer for file operations
  };
}
```

---

## Implementation for Mode 3

### Service Method

```javascript
class GeminiImageService {
  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);
    this.model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash-image'
    });
  }

  async generateImage(prompt, config = {}) {
    const { aspectRatio = '16:9' } = config;

    try {
      // Generate image
      const result = await this.model.generateContent([
        {
          text: this.enhancePrompt(prompt, aspectRatio)
        }
      ]);

      const response = await result.response;

      // Extract image
      const imagePart = response.candidates[0]?.content.parts.find(
        part => part.inlineData
      );

      if (!imagePart) {
        throw new Error('No image generated');
      }

      const imageData = imagePart.inlineData;

      return {
        buffer: Buffer.from(imageData.data, 'base64'),
        mimeType: imageData.mimeType,
        aspectRatio
      };

    } catch (error) {
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  enhancePrompt(userPrompt, aspectRatio) {
    // Add aspect ratio hint and quality modifiers
    return `${userPrompt}. Aspect ratio: ${aspectRatio}. High quality, professional photography.`;
  }
}
```

### Upload Generated Image

After generating, upload to Supabase:

```javascript
async uploadGeneratedImage(imageBuffer, jobId) {
  const job = await this.getJob(jobId);
  const orgId = job.organisation_id;

  const path = `${orgId}/generated-images/${jobId}.png`;

  const { error } = await this.supabase.storage
    .from('social-media-videos')
    .upload(path, imageBuffer, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

  const { data } = this.supabase.storage
    .from('social-media-videos')
    .getPublicUrl(path);

  return data.publicUrl;
}
```

### Pass to Sora

```javascript
// After generating and uploading image
const generatedImageUrl = await this.storageService.uploadGeneratedImage(
  imageBuffer,
  jobId
);

// Update job with generated image URL
await this.storageService.updateJob(jobId, {
  generated_image_url: generatedImageUrl
});

// Use the image buffer directly with Sora
const soraJob = await this.soraService.createVideo({
  model: 'sora-2',
  prompt: videoPrompt,
  inputReference: imageBuffer,  // Pass buffer directly
  size: '1280x720',
  seconds: 8
});
```

---

## Error Handling

### Error Types

| Error Type | Cause | Action |
|------------|-------|--------|
| `INVALID_ARGUMENT` | Bad prompt or parameters | Fix input |
| `PERMISSION_DENIED` | Invalid API key | Check credentials |
| `RESOURCE_EXHAUSTED` | Quota exceeded | Wait or upgrade |
| `INTERNAL` | Server error | Retry with backoff |
| `SAFETY` | Content policy violation | Modify prompt |

### Error Handling Code

```javascript
async function generateWithRetry(prompt, maxRetries = 3) {
  const retryableErrors = ['RESOURCE_EXHAUSTED', 'INTERNAL'];

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await geminiService.generateImage(prompt);
    } catch (error) {
      // Check if error is retryable
      const isRetryable = retryableErrors.some(
        code => error.message.includes(code)
      );

      if (!isRetryable || i === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

---

## Content Safety

### SynthID Watermarking

All images generated include a **SynthID watermark**:
- Invisible to humans
- Detectable by Google tools
- Cannot be removed
- Indicates AI-generated content

### Content Policies

Gemini enforces content policies for:
- Harmful content
- Copyrighted material
- Personal information
- Illegal activities

**For Restaurant Use Cases**: Food photography prompts are generally safe

---

## Pricing

### Cost Structure

- **$30.00 per 1 million output tokens**
- **1,290 tokens per image** (up to 1024x1024px)
- **Cost per image: $0.039** (~4 cents)

### Cost Optimization

1. **Cache prompts** if generating similar images
2. **Validate prompts** before generating
3. **Implement rate limiting** per organization
4. **Track usage** in database

### Example Costs

| Usage | Images | Cost |
|-------|--------|------|
| 10 per day | 300/month | $11.70/month |
| 50 per day | 1,500/month | $58.50/month |
| 100 per day | 3,000/month | $117/month |

---

## Testing

### Test Cases

```javascript
// Test 1: Simple food image
const test1 = await geminiService.generateImage(
  'A professional burger photo'
);
console.log('Generated:', test1.buffer.length, 'bytes');

// Test 2: With details
const test2 = await geminiService.generateImage(
  'Professional overhead shot of a taco platter with fresh ingredients, colorful presentation, warm lighting'
);

// Test 3: Restaurant interior
const test3 = await geminiService.generateImage(
  'Modern restaurant interior with wooden tables and warm ambient lighting'
);

// Test 4: Invalid prompt (should handle gracefully)
try {
  const test4 = await geminiService.generateImage(
    'Copyrighted character eating food'
  );
} catch (error) {
  console.log('Expected error:', error.message);
}
```

### Validate Generated Images

```javascript
function validateImage(imageBuffer) {
  // Check size
  if (imageBuffer.length < 1000) {
    throw new Error('Image too small, likely invalid');
  }

  // Check PNG header
  const header = imageBuffer.slice(0, 8);
  const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  if (!header.equals(pngHeader)) {
    throw new Error('Invalid PNG file');
  }

  return true;
}
```

---

## Integration Flow (Mode 3)

### Complete Workflow

```javascript
async function generateImageToVideo(imagePrompt, videoPrompt, config) {
  // Step 1: Determine aspect ratio from video dimensions
  const [width, height] = config.videoConfig.size.split('x').map(Number);
  const isPortrait = height > width;
  const aspectRatio = isPortrait ? '9:16' : '16:9';

  // Step 2: Generate image with Gemini
  console.log(`Generating ${aspectRatio} image with Gemini...`);
  const image = await geminiService.generateImage(imagePrompt, {
    aspectRatio
  });

  // Step 3: Upload to Supabase Storage
  console.log('Uploading generated image...');
  const imageUrl = await storageService.uploadGeneratedImage(
    image.buffer,
    jobId
  );

  // Step 4: Update job record
  await storageService.updateJob(jobId, {
    generated_image_url: imageUrl
  });

  // Step 5: Generate video with Sora
  console.log('Generating video with Sora...');
  const soraJob = await soraService.createVideo({
    model: config.soraModel,
    prompt: videoPrompt,
    inputReference: image.buffer,  // Use buffer directly
    size: config.size,
    seconds: config.seconds
  });

  // Step 5: Poll for completion
  await pollJobCompletion(jobId, soraJob.id);

  console.log('Complete!');
}
```

---

## Troubleshooting

### Common Issues

**Issue**: "API key not valid"
- **Solution**: Verify API key at https://aistudio.google.com/app/apikey

**Issue**: "Quota exceeded"
- **Solution**: Check quota at Google Cloud Console

**Issue**: "No image in response"
- **Solution**: Check response structure, verify model name

**Issue**: "Safety filter triggered"
- **Solution**: Modify prompt to avoid policy violations

---

## Best Practices

1. **Validate Prompts**: Check for inappropriate content before API call
2. **Handle Errors Gracefully**: Show user-friendly error messages
3. **Cache Results**: Store generated images to avoid regeneration
4. **Monitor Usage**: Track API calls and costs
5. **Test Thoroughly**: Verify images work well with Sora

---

## Resources

- **Official Docs**: https://ai.google.dev/gemini-api/docs/image-generation
- **API Reference**: https://ai.google.dev/api
- **Google AI Studio**: https://aistudio.google.com
- **Pricing**: https://ai.google.dev/pricing
- **Community**: https://discuss.ai.google.dev

---

Last Updated: 2025-10-07
