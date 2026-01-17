# Social Media Content Generation System

## Overview

This system integrates AI-powered video generation capabilities into the UberEats Image Extractor application, enabling automated creation of social media content from restaurant menu data and images.

## Key Technologies

### OpenAI Sora 2
- **Purpose**: Video generation from text prompts and/or images
- **Models**:
  - `sora-2`: Fast, flexible, ideal for social media content
  - `sora-2-pro`: High quality, production-grade output
- **API Documentation**: https://platform.openai.com/docs/guides/video-generation
- **Status**: Fully available via API

### Google Gemini 2.5 Flash Image (Nano Banana)
- **Purpose**: AI image generation from text prompts
- **Model ID**: `gemini-2.5-flash-image`
- **API Documentation**: https://ai.google.dev/gemini-api/docs/image-generation
- **Pricing**: $0.039 per image (1290 tokens @ $30/1M tokens)

### ElevenLabs Voice-Over (Phase 2)
- **Purpose**: AI voice generation for video narration
- **Models**: Flash v2.5 (fast), Turbo v2.5 (balanced), Multilingual v2 (quality)
- **API Documentation**: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- **Status**: Architecture ready, implementation planned for Phase 2
- **Features**: 70+ languages, 1000+ voices, natural-sounding speech

## Generation Modes

### Mode 1: Database Image → Video
Generate videos using existing menu item images from the database as the first frame.

**Use Cases**:
- Animate dish photos with steam, sizzle effects
- Add camera movements to static product shots
- Create dynamic presentations of existing assets

### Mode 2: Text → Video
Generate videos entirely from text descriptions without image references.

**Use Cases**:
- Restaurant ambiance and interior scenes
- Conceptual marketing content
- Brand story videos

### Mode 3: Generated Image → Video
Use Gemini to generate an image first, then animate it with Sora.

**Use Cases**:
- Create entirely new visual content
- Generate stylized or artistic representations
- Produce consistent branded imagery

## Core Principles

1. **User-Controlled Prompts**: All prompts are input by users via UI text fields, never hardcoded
2. **Extensible Architecture**: Easy to add new generation modes or AI services
3. **Template Support**: Optional templates can be added later without changing core architecture
4. **Async Processing**: All generation jobs are asynchronous with proper status tracking
5. **Integration First**: Built within UberEats-Image-Extractor for seamless UI integration

## Project Structure

```
planning/social-media-content-generation/
├── README.md                              # This file - overview
├── architecture.md                        # System architecture details
├── database-schema.md                     # Database design and migrations
├── api-specification.md                   # REST API endpoints
├── service-layer.md                       # Service implementations
├── ui-components.md                       # UI/UX component design
├── implementation-roadmap.md              # Step-by-step implementation guide
├── openai-sora-integration.md            # Sora API integration details
├── gemini-integration.md                 # Gemini API integration details
└── voice-over-integration-analysis.md    # ElevenLabs voice-over (Phase 2)
```

## Implementation Location

All code will be implemented within:
```
UberEats-Image-Extractor/
├── .env (new API keys)
├── server.js (route mounting)
└── src/
    ├── services/social-media/
    ├── routes/social-media-routes.js
    ├── pages/ (new video generation pages)
    └── components/social-media/
```

## Quick Start Guide

1. **Review Documentation**
   - Read `architecture.md` for system design
   - Review `api-specification.md` for endpoints
   - Check `implementation-roadmap.md` for build order

2. **Setup Environment**
   - Obtain OpenAI API key
   - Obtain Google Gemini API key
   - Add to `.env` file

3. **Database Setup**
   - Run migration from `database-schema.md`
   - Verify RLS policies

4. **Implementation Phases**
   - Phase 1: Core Services (Sora, Gemini, Storage)
   - Phase 2: API Layer (Routes, Endpoints)
   - Phase 3: UI Integration (Components, Pages)
   - Phase 4: Testing and Refinement
   - Phase 5: Voice-Over Integration (ElevenLabs) - Optional Enhancement

## Related Documentation

### Core Video Generation
- [OpenAI Sora 2 System Card](https://openai.com/index/sora-2-system-card/)
- [OpenAI Video API Reference](https://platform.openai.com/docs/api-reference/videos)
- [Gemini 2.5 Flash Image Documentation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Sora 2 Prompting Guide](https://cookbook.openai.com/examples/sora/sora2_prompting_guide)

### Voice-Over (Phase 2)
- [ElevenLabs API Documentation](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
- [ElevenLabs Models Overview](https://elevenlabs.io/docs/models)
- [ElevenLabs Voices API](https://elevenlabs.io/docs/api-reference/voices/search)

## Status

**Planning Phase**: Complete
**Implementation Phase**: Not Started
**Testing Phase**: Not Started
**Production Ready**: No

## Next Steps

1. Review all planning documents
2. Set up API credentials
3. Begin Phase 1 implementation (Core Services)
4. Create database migration
5. Test each service independently

---

Last Updated: 2025-10-07
