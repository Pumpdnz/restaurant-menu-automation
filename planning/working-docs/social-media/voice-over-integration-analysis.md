# Voice-Over Integration Analysis (ElevenLabs)

## Executive Summary

**Recommendation**: **Architect for extensibility NOW, implement in Phase 2**

We should design the database schema and UI structure from the start to support voice-overs, but implement the actual ElevenLabs integration as a Phase 2 enhancement after the core video generation is working.

**Why this approach:**
- ✅ Future-proof architecture (no database migrations later)
- ✅ No rework of UI components
- ✅ Can collect user preferences early
- ✅ Doesn't slow down MVP delivery
- ✅ Easy to enable when ready

---

## ElevenLabs Capabilities Overview

### Text-to-Speech Models

| Model | Best For | Latency | Languages | Character Limit | Cost |
|-------|----------|---------|-----------|-----------------|------|
| **Eleven v3** | Emotional content, audiobooks | High | 70+ | 3,000 | Higher |
| **Multilingual v2** | High quality, professional | Medium | 29 | 10,000 | Medium |
| **Flash v2.5** | Real-time, speed | ~75ms | 32 | 40,000 | Lower |
| **Turbo v2.5** | Balanced quality/speed | ~250ms | 32 | 40,000 | Lower |

**For Social Media**: **Flash v2.5** or **Turbo v2.5** are ideal for short-form content

### Key Features

1. **Voice Selection**
   - Pre-built voices (default, community)
   - Custom voice cloning
   - Voice library with 1000+ options
   - Personal voice uploads

2. **Voice Settings**
   - Stability (0.0 - 1.0)
   - Similarity boost (0.0 - 1.0)
   - Style (0.0 - 1.0)
   - Speaker boost (boolean)

3. **Output Formats**
   - MP3 (multiple bitrates)
   - PCM (various sample rates)
   - μ-law (for Twilio)

4. **Advanced Features**
   - Language enforcement
   - Pronunciation dictionaries
   - Text normalization
   - Multi-speaker dialogue (v3)

---

## Integration with Video Generation

### Current State: Sora 2 Already Generates Audio

**Important Context**: Sora 2 videos already include synchronized audio:
- Sound effects (sizzling, ambient noise)
- Music/background audio
- Natural scene sounds

**ElevenLabs would add**:
- **Voice-over narration** on top of Sora's audio
- **Scripted dialogue** for marketing content
- **Multilingual narration** for international markets

### Two Integration Approaches

#### Approach 1: Pre-Video Audio Generation
```
User Script → ElevenLabs → Audio File → Combine with Video
```

**Pros**:
- Can preview audio before video generation
- Separate audio file for reuse
- Easy to regenerate just audio

**Cons**:
- Requires audio/video merging step
- May lose Sora's native audio
- More complex pipeline

#### Approach 2: Post-Video Audio Overlay
```
Video Generated → ElevenLabs → Overlay Audio → Final Video
```

**Pros**:
- Preserves Sora's sound effects
- Audio timing based on video length
- Can layer multiple audio tracks

**Cons**:
- Requires video editing/encoding
- More processing time
- Larger file handling

**Recommendation**: **Approach 2** - Overlay after video generation

---

## Proposed Architecture Changes

### Database Schema Additions

Add to `social_media_videos` table:

```sql
-- Voice-over fields (all nullable for backward compatibility)
ALTER TABLE social_media_videos ADD COLUMN voice_enabled boolean DEFAULT false;
ALTER TABLE social_media_videos ADD COLUMN voice_script text;
ALTER TABLE social_media_videos ADD COLUMN voice_model text;  -- 'eleven_flash_v2_5', etc.
ALTER TABLE social_media_videos ADD COLUMN voice_id text;     -- ElevenLabs voice ID
ALTER TABLE social_media_videos ADD COLUMN voice_settings jsonb;  -- stability, style, etc.
ALTER TABLE social_media_videos ADD COLUMN elevenlabs_audio_id text;  -- ElevenLabs request ID
ALTER TABLE social_media_videos ADD COLUMN audio_url text;    -- Generated audio file URL
ALTER TABLE social_media_videos ADD COLUMN final_video_url text;  -- Video with audio overlay

-- Index for voice-enabled videos
CREATE INDEX idx_social_videos_voice_enabled
  ON social_media_videos(voice_enabled, created_at DESC)
  WHERE voice_enabled = true;
```

### API Request Schema

Extend generation request:

```javascript
{
  mode: 'image-to-video',
  prompt: 'The burger sizzles...',

  // Video config (existing)
  soraModel: 'sora-2',
  videoConfig: { size: '1280x720', seconds: 8 },

  // NEW: Voice-over config (optional)
  voiceConfig?: {
    enabled: boolean,
    script: string,                    // Voice-over script
    voiceModel: 'eleven_flash_v2_5',  // ElevenLabs model
    voiceId: string,                   // Selected voice ID
    voiceSettings?: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
    },
    language?: string                  // ISO 639-1 code
  }
}
```

### UI Component Additions

#### New Component: VoiceConfigForm

```typescript
interface VoiceConfigFormProps {
  enabled: boolean;
  script: string;
  voiceId: string;
  voiceModel: string;
  voiceSettings: VoiceSettings;
  onEnabledChange: (enabled: boolean) => void;
  onScriptChange: (script: string) => void;
  onVoiceChange: (voiceId: string) => void;
  onModelChange: (model: string) => void;
  onSettingsChange: (settings: VoiceSettings) => void;
}

export function VoiceConfigForm(props: VoiceConfigFormProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <Label>Add Voice-Over</Label>
        <Switch checked={props.enabled} onChange={props.onEnabledChange} />
      </div>

      {props.enabled && (
        <>
          <Textarea
            label="Voice-Over Script"
            value={props.script}
            onChange={props.onScriptChange}
            placeholder="Enter the narration script..."
            rows={6}
          />

          <VoiceSelector
            value={props.voiceId}
            onChange={props.onVoiceChange}
          />

          <ModelSelector
            value={props.voiceModel}
            onChange={props.onModelChange}
            options={['eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_multilingual_v2']}
          />

          <VoiceSettings
            settings={props.voiceSettings}
            onChange={props.onSettingsChange}
          />
        </>
      )}
    </Card>
  );
}
```

#### Voice Selector Component

```typescript
export function VoiceSelector({ value, onChange }: VoiceSelectorProps) {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchVoices();
  }, []);

  const fetchVoices = async () => {
    setLoading(true);
    const response = await fetch('/api/social-media/voices');
    const data = await response.json();
    setVoices(data.voices);
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <Label>Select Voice</Label>
      <Select value={value} onChange={onChange}>
        <option value="">Choose a voice...</option>
        {voices.map(voice => (
          <option key={voice.voice_id} value={voice.voice_id}>
            {voice.name} - {voice.labels?.accent} {voice.labels?.gender}
          </option>
        ))}
      </Select>

      {/* Voice preview player */}
      {value && (
        <audio controls src={`/api/social-media/voices/${value}/preview`} />
      )}
    </div>
  );
}
```

---

## Service Layer Architecture

### New Service: ElevenLabsService

**Location**: `src/services/social-media/elevenlabs-service.js`

```javascript
class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
  }

  // Generate audio from text
  async textToSpeech({ text, voiceId, modelId, voiceSettings, language }) {
    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: voiceSettings,
        language_code: language
      })
    });

    // Returns audio buffer
    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer);
  }

  // Get available voices
  async getVoices() {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        'xi-api-key': this.apiKey
      }
    });

    const data = await response.json();
    return data.voices;
  }

  // Get specific voice details
  async getVoice(voiceId) {
    const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
      headers: {
        'xi-api-key': this.apiKey
      }
    });

    return await response.json();
  }

  // Get voice preview
  async getVoicePreview(voiceId) {
    // Returns pre-generated preview audio
    const voice = await this.getVoice(voiceId);
    return voice.preview_url;
  }
}

module.exports = ElevenLabsService;
```

### Video Service Enhancement

Add audio overlay capability:

```javascript
class VideoProcessingService {
  constructor() {
    this.ffmpeg = require('fluent-ffmpeg');
  }

  async overlayAudio(videoBuffer, audioBuffer, jobId) {
    const videoPath = `/tmp/${jobId}-video.mp4`;
    const audioPath = `/tmp/${jobId}-audio.mp3`;
    const outputPath = `/tmp/${jobId}-final.mp4`;

    // Write buffers to temp files
    await fs.writeFile(videoPath, videoBuffer);
    await fs.writeFile(audioPath, audioBuffer);

    // Use FFmpeg to overlay audio
    return new Promise((resolve, reject) => {
      this.ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v copy',           // Copy video codec
          '-c:a aac',            // AAC audio codec
          '-map 0:v:0',          // Map video from first input
          '-map 1:a:0',          // Map audio from second input
          '-shortest'            // Match shortest input
        ])
        .on('end', () => {
          const finalBuffer = fs.readFileSync(outputPath);
          // Cleanup temp files
          fs.unlinkSync(videoPath);
          fs.unlinkSync(audioPath);
          fs.unlinkSync(outputPath);
          resolve(finalBuffer);
        })
        .on('error', reject)
        .save(outputPath);
    });
  }
}
```

### Updated VideoGenerationService

```javascript
async generateVideo(request) {
  // ... existing video generation ...

  // NEW: Add voice-over if enabled
  if (request.voiceConfig?.enabled) {
    // Generate audio with ElevenLabs
    const audioBuffer = await this.elevenLabsService.textToSpeech({
      text: request.voiceConfig.script,
      voiceId: request.voiceConfig.voiceId,
      modelId: request.voiceConfig.voiceModel,
      voiceSettings: request.voiceConfig.voiceSettings
    });

    // Upload audio to storage
    const audioUrl = await this.storageService.uploadAudio(audioBuffer, jobId);

    // Update job with audio URL
    await this.storageService.updateJob(jobId, { audio_url: audioUrl });

    // Wait for video to complete
    await this.waitForVideoCompletion(jobId);

    // Overlay audio on video
    const videoBuffer = await this.downloadVideo(videoUrl);
    const finalBuffer = await this.videoProcessingService.overlayAudio(
      videoBuffer,
      audioBuffer,
      jobId
    );

    // Upload final video
    const finalUrl = await this.storageService.uploadVideo(finalBuffer, jobId, 'final');

    // Update job
    await this.storageService.updateJob(jobId, {
      final_video_url: finalUrl,
      status: 'completed'
    });
  }

  return job;
}
```

---

## API Endpoints

### New Endpoints

```javascript
// Get available voices
GET /api/social-media/voices
Response: {
  voices: [
    {
      voice_id: 'abc123',
      name: 'Rachel',
      labels: { accent: 'american', gender: 'female', age: 'young' },
      preview_url: 'https://...'
    }
  ]
}

// Get specific voice
GET /api/social-media/voices/:voiceId
Response: { voice details }

// Preview voice with custom text
POST /api/social-media/voices/:voiceId/preview
Body: { text: 'Sample text' }
Response: { audio_url: '...' }
```

---

## UI Flow with Voice-Over

### VideoGeneration Page (Updated)

```typescript
export default function VideoGeneration() {
  // ... existing state ...

  // NEW: Voice-over state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceScript, setVoiceScript] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [voiceModel, setVoiceModel] = useState('eleven_flash_v2_5');
  const [voiceSettings, setVoiceSettings] = useState({
    stability: 0.5,
    similarity_boost: 0.75
  });

  const handleGenerate = async () => {
    await generateVideo({
      mode,
      prompt,
      // ... existing config ...

      // NEW: Voice config
      voiceConfig: voiceEnabled ? {
        enabled: true,
        script: voiceScript,
        voiceId,
        voiceModel,
        voiceSettings
      } : undefined
    });
  };

  return (
    <div className="space-y-6">
      {/* Existing components */}
      <ModeSelector />
      <PromptInput />

      {/* NEW: Voice-over section */}
      <VoiceConfigForm
        enabled={voiceEnabled}
        script={voiceScript}
        voiceId={voiceId}
        voiceModel={voiceModel}
        voiceSettings={voiceSettings}
        onEnabledChange={setVoiceEnabled}
        onScriptChange={setVoiceScript}
        onVoiceChange={setVoiceId}
        onModelChange={setVoiceModel}
        onSettingsChange={setVoiceSettings}
      />

      <Button onClick={handleGenerate}>Generate Video</Button>
    </div>
  );
}
```

---

## Use Cases

### 1. Restaurant Promotional Videos

**Scenario**: Generate a 10-second video with voice-over for Instagram

**User Input**:
- Mode: Image-to-Video
- Image: Menu item photo
- Prompt: "Camera slowly zooms in, steam rising"
- Voice Script: "Try our signature burger! Fresh ingredients, grilled to perfection. Available now!"
- Voice: Professional female voice, upbeat

**Output**: Video with Sora's sizzling sounds + voice-over narration

### 2. Menu Item Explainers

**Scenario**: Educational content about dishes

**User Input**:
- Mode: Text-to-Video
- Prompt: "Close-up of taco preparation"
- Voice Script: "Our tacos start with handmade tortillas, topped with slow-cooked carnitas, fresh pico de gallo, and our secret salsa verde"
- Voice: Chef-style narration

### 3. Multilingual Marketing

**Scenario**: Same video, multiple languages

**Workflow**:
1. Generate video once (expensive)
2. Generate multiple voice-overs (cheap)
3. Combine for different markets

**Benefit**: Cost-effective international marketing

---

## Cost Analysis

### ElevenLabs Pricing

**Free Tier**: 10,000 characters/month (~10 minutes audio)

**Paid Tiers**:
| Plan | Characters/month | Cost | Best For |
|------|------------------|------|----------|
| Starter | 30,000 | $5/mo | Testing |
| Creator | 100,000 | $22/mo | Small business |
| Pro | 500,000 | $99/mo | Agency |
| Scale | 2,000,000 | $330/mo | Large scale |

### Cost Comparison

| Feature | Without Voice | With Voice | Difference |
|---------|---------------|------------|------------|
| **8s video** | ~$0.50 (Sora) | ~$0.50 (Sora) + ~$0.01 (audio) | +2% |
| **Processing time** | 5 min | 7 min | +40% |
| **User value** | High | Very High | Significant |

**Analysis**: Voice-overs add minimal cost but significant value

---

## Implementation Strategy

### Phase 1: Core Video Generation (Current)
- ✅ Implement all 3 video modes
- ✅ Database schema with voice fields (nullable)
- ✅ UI with voice section (initially hidden/disabled)
- ❌ Don't implement ElevenLabs service yet

### Phase 2: Voice-Over Integration (Future)
- ✅ Implement ElevenLabsService
- ✅ Add voice selector UI
- ✅ Implement audio overlay
- ✅ Enable voice config in UI
- ✅ Test and refine

**Why This Works**:
- Database already supports it (no migration)
- UI already has placeholders (just unhide)
- Service layer structured for it (plug and play)
- No rework needed

---

## Required Environment Variables

Add to `.env`:

```bash
# ElevenLabs API (Phase 2)
ELEVENLABS_API_KEY=your_key_here
```

---

## Dependencies

Add to `package.json` (Phase 2):

```json
{
  "dependencies": {
    "fluent-ffmpeg": "^2.1.2",
    "elevenlabs-node": "^1.0.0"  // Optional: official SDK
  }
}
```

System requirement: `ffmpeg` must be installed on server

---

## Conclusion

### Recommended Approach

1. **NOW (Phase 1)**:
   - Add database fields (nullable)
   - Add UI components (optional/hidden)
   - Structure services to support it
   - Document the integration

2. **LATER (Phase 2)**:
   - Obtain ElevenLabs API key
   - Implement ElevenLabsService
   - Enable UI components
   - Test audio overlay
   - Launch feature

### Benefits

✅ **Future-proof**: No schema changes needed later
✅ **Flexible**: Users can opt-in when ready
✅ **Fast MVP**: Core video features first
✅ **Easy upgrade**: Enable with feature flag
✅ **Cost-effective**: Only pay when used

### Key Considerations

⚠️ **Audio Processing**: Requires FFmpeg on server
⚠️ **Processing Time**: Adds 30-60s per video
⚠️ **Storage**: Audio files + final videos = more storage
⚠️ **Complexity**: More moving parts to debug

---

Last Updated: 2025-10-07
