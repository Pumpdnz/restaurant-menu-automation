# Prompt Builder Implementation Options

**Created**: 2025-10-10
**Status**: Research & Planning Phase
**Reference**: Based on OpenAI Sora 2 Prompting Guide analysis

---

## Table of Contents

1. [Key Best Practices](#key-best-practices)
2. [User Context Analysis](#user-context-analysis)
3. [Implementation Options](#implementation-options)
4. [Recommended Approach](#recommended-approach)
5. [Discussion Points](#discussion-points)

---

## Key Best Practices

### Core Prompt Elements (in order of importance)

1. **Style/Look** - Sets overall aesthetic (e.g., "1970s film", "modern food photography", "Instagram Reels style")
2. **Scene Description** - What's in the shot (the food, the setting, props)
3. **Cinematography** - Camera angle, framing, lens choice
4. **Lighting** - Quality, direction, color temperature
5. **Motion** - ONE camera move + ONE subject action (critical: keep simple)
6. **Timing** - Specific beats/counts (e.g., "3 seconds of sizzling, then steam rises")
7. **Background Sound** - Ambient cues (sizzling, music, voices)

### Golden Rules

- ✅ **Shorter prompts** = creative freedom, unexpected results
- ✅ **Longer prompts** = control, consistency
- ✅ **Clarity wins**: Specific > vague ("burger rotates slowly" vs "nice shot")
- ✅ **One shot = one move**: Avoid complex actions
- ✅ **Image references** lock composition & style
- ⚠️ **Common mistakes**: Vague descriptions, too many actions, unclear framing

### Weak vs Strong Examples

| Weak | Strong |
|------|--------|
| "A beautiful street at night" | "Wet asphalt, zebra crosswalk, neon signs reflecting in puddles" |
| "Person moves quickly" | "Cyclist pedals three times, brakes, and stops at crosswalk" |
| "Cinematic look" | "Anamorphic 2.0x lens, shallow DOF, volumetric light" |
| "Actor walks across room" | "Actor takes four steps to window, pauses, pulls curtain in final second" |

---

## User Context Analysis

### Available Assets

1. **Menu Item Photos** - Burgers, tacos, drinks, desserts (high quality, professional)
2. **AI-Generated Images** - Previous Gemini creations
3. **Uploaded Images** - User content (ambiance, staff, events)
4. **Restaurant Logos** - Brand elements

### Primary Video Use Cases

1. **Menu Item Showcase** (80%) - "Try our signature burger!"
2. **Restaurant Ambiance** (10%) - Show the vibe, atmosphere
3. **Limited-Time Offers** (5%) - "New item alert!"
4. **Social Media Teasers** (3%) - Quick, engaging clips
5. **Behind-the-Scenes** (2%) - Kitchen, preparation

### User Personas

- **The Rusher** (70%): Wants results in 30 seconds, zero learning curve
- **The Customizer** (20%): Wants some control, willing to spend 2-3 minutes
- **The Creator** (10%): Wants full control, cinematography knowledge

---

## Implementation Options

### 🥇 Option 1: Smart Template System with Context Awareness

**Concept**: Pre-built prompt templates that adapt based on selected reference image and video purpose.

#### How It Works

1. User selects reference image (burger photo, logo, ambiance shot)
2. System **analyzes image** (food type, composition, colors)
3. User picks **video style** from curated list:
   - "Product Showcase" - Close-up, rotating shot
   - "Social Media Teaser" - Fast, energetic, trendy
   - "Premium/Cinematic" - Slow, dramatic lighting
   - "Behind-the-Scenes" - Casual, authentic
4. System generates **complete prompt** using template + image context
5. User can **preview/edit** prompt before generating

#### Template Structure Example

```javascript
{
  id: 'product-showcase',
  name: 'Product Showcase',
  description: 'Perfect for highlighting menu items',
  applicableImageTypes: ['menu', 'ai', 'uploaded'],

  promptBuilder: (context) => {
    const { imageType, menuItemName, restaurantStyle, brandColors } = context;

    return `
Style: Modern food photography with shallow depth of field, professional lighting

${menuItemName || 'The dish'} sits on a ${context.surfaceType || 'dark slate plate'},
garnished with ${context.garnish || 'fresh herbs'}.
${brandColors ? `Color palette: ${brandColors.join(', ')}` : ''}

Cinematography:
Camera shot: medium close-up, slow 180-degree orbit
Depth of field: shallow focus on dish, blurred background
Lighting: warm overhead key light with soft fill from side
Mood: appetizing, premium, inviting

Actions:
- Camera slowly orbits clockwise around the dish
- Steam rises gently from the ${context.hotElement || 'food'}
- ${context.specialAction || 'Garnish catches light'}

Background Sound:
Gentle sizzle, ambient restaurant atmosphere
    `.trim();
  }
}
```

#### UI Flow

```
1. [Image Selection] → Analyzes: "This is a burger photo"
2. [Style Picker] → Shows: Product Showcase, Teaser, Cinematic
3. [Quick Customization] → Optional: Change camera move, timing, mood
4. [Preview Prompt] → Shows generated prompt with "Edit" button
5. [Generate] → Creates video
```

#### Pros & Cons

**Pros**:
- ✅ Fast (30-second workflow)
- ✅ Guaranteed quality (templates tested)
- ✅ Educational (shows good prompts)
- ✅ Context-aware (adapts to image)
- ✅ Scalable (add more templates)

**Cons**:
- ⚠️ Requires image analysis (menu item detection)
- ⚠️ Initial template library creation
- ⚠️ May feel limiting for advanced users

**Implementation Effort**: 8-12 hours
- 2 hours: Template system architecture
- 3 hours: 5-8 core templates
- 2 hours: Image analysis integration
- 2 hours: UI components
- 1 hour: Testing

---

### 🥈 Option 2: Guided Prompt Builder (Structured Form)

**Concept**: Step-by-step wizard that guides users through each prompt element with visual aids.

#### Wizard Steps

**Step 1: Video Purpose**
- Radio buttons: Menu Item | Ambiance | Promo | Story

**Step 2: Style & Look** (Visual cards with examples)
- Modern Food Photography
- Cinematic/Dramatic
- Social Media/Trendy
- Casual/Authentic
- Vintage/Retro

**Step 3: Camera Setup**
- **Shot Type**: Close-up | Medium | Wide | Aerial (with icons)
- **Angle**: Eye level | Low | High | Overhead (with diagrams)
- **Movement**: Static | Orbit | Pan | Zoom | Dolly (with animations)

**Step 4: Lighting**
- **Quality**: Soft | Hard | Natural | Dramatic (with preview)
- **Direction**: Front | Side | Back | Overhead
- **Color Palette**: Warm | Cool | Neutral | Vibrant (color pickers)

**Step 5: Action & Timing** (Duration-aware)
- For 4s: 1-2 actions
- For 8s: 2-3 actions
- For 12s: 3-4 actions
- Text input: "Steam rises from burger for 3 seconds"

**Step 6: Background Sound** (Optional)
- Checkboxes: Sizzling | Music | Voices | Ambient | Silent

**Step 7: Review & Generate**
- Shows assembled prompt
- "Edit Raw Prompt" option
- Estimated cost display

#### UI Mock Structure

```typescript
<PromptBuilder>
  <ProgressIndicator steps={7} current={3} />

  {step === 1 && (
    <VideoPurposeSelector
      options={['Menu Item', 'Ambiance', 'Promo', 'Story']}
      selected={purpose}
      onChange={setPurpose}
    />
  )}

  {step === 3 && (
    <CameraSetup>
      <ShotTypeSelector
        options={shotTypes}
        visual={true}  // Shows example images
      />
      <AngleSelector diagrams={angleDiagrams} />
      <MovementSelector animations={movements} />
    </CameraSetup>
  )}

  {step === 7 && (
    <PromptReview
      prompt={assembledPrompt}
      editable={true}
      onEdit={handleEditPrompt}
      onGenerate={handleGenerate}
    />
  )}
</PromptBuilder>
```

#### Pros & Cons

**Pros**:
- ✅ Educational (teaches cinematography)
- ✅ Prevents bad prompts
- ✅ Full customization
- ✅ Visual/intuitive
- ✅ Good for intermediate users

**Cons**:
- ⚠️ 7 steps = longer workflow (2-3 minutes)
- ⚠️ Can feel tedious for simple videos
- ⚠️ More UI complexity
- ⚠️ Requires more assets (icons, diagrams, examples)

**Implementation Effort**: 10-15 hours
- 3 hours: Wizard/step framework
- 4 hours: Visual selectors for each step
- 2 hours: Prompt assembly logic
- 3 hours: UI polish (icons, diagrams, animations)
- 2 hours: Testing

---

### 🥉 Option 3: Hybrid System (Templates + Builder)

**Concept**: Start with template, allow granular customization via builder.

#### Three-Tier Structure

**Tier 1: Template Gallery** (Default view)
```
[Grid of video templates with previews]
- Product Showcase
- Sizzle & Steam
- Slow Rotate
- Overhead Pour
- Ambiance Tour

Click → Auto-fills all fields → Generate
```

**Tier 2: Quick Tweaks** (After selecting template)
```
Template: "Product Showcase" selected

Quick Adjustments:
- Camera Movement: [Orbit] [Pan] [Static] [Zoom]
- Speed: [Slow] [Medium] [Fast]
- Lighting: [Warm] [Cool] [Dramatic] [Natural]
- Duration: [4s] [8s] [12s]

[Apply Changes] [Generate]
```

**Tier 3: Advanced Builder** (For power users)
```
[Full guided builder from Option 2]
All elements customizable
```

#### Pros & Cons

**Pros**:
- ✅ Best of both worlds
- ✅ Accommodates all user levels
- ✅ Progressive disclosure (simple → advanced)
- ✅ Fast for rushers, powerful for creators
- ✅ Educational path (template → tweaks → builder)

**Cons**:
- ⚠️ Most complex to build
- ⚠️ Requires both template system AND builder
- ⚠️ UI complexity (3 modes)
- ⚠️ More testing needed

**Implementation Effort**: 15-20 hours
- All of Option 1 + Option 2
- 2 hours: Mode switching UI
- 2 hours: State management
- 3 hours: Additional testing

---

### 🎯 Option 4: AI-Powered Smart Suggestions

**Concept**: Analyze reference image, auto-generate contextual prompt suggestions.

#### How It Works

1. User selects reference image
2. System analyzes image with Gemini Vision API:
   - Food type (burger, pizza, drink, etc.)
   - Composition (close-up, overhead, styled)
   - Colors, lighting, mood
   - Background elements
3. System suggests **3 prompt variations**:
   - Conservative (close to image)
   - Creative (adds flair)
   - Dramatic (cinematic interpretation)
4. User picks one or edits

#### Example Analysis

```javascript
Input: Burger photo (close-up, warm lighting, rustic board)

AI Analysis:
{
  subject: "gourmet burger",
  composition: "close-up, centered",
  lighting: "warm, natural light from left",
  colors: ["golden brown", "green lettuce", "red tomato", "rustic wood"],
  style: "food photography, professional",
  suggestedActions: [
    "steam rises from patty",
    "cheese melts and drips",
    "camera orbits slowly"
  ]
}

Generated Prompt Variations:

1. CONSERVATIVE:
"Close-up of gourmet burger on rustic wooden board.
Warm natural lighting from left. Steam rises gently from
the hot beef patty. Camera remains static."

2. CREATIVE:
"Professional food photography of gourmet burger on rustic board.
Warm golden lighting, steam rising from patty, melted cheese glistening.
Camera slow 90-degree orbit, shallow depth of field,
background softly blurred."

3. DRAMATIC:
"Cinematic close-up of premium burger, golden sesame bun catching
warm side light. Steam billows from perfectly charred patty,
melted cheddar cascading down. Slow 180-degree tracking shot,
dramatic shadows, bokeh background. Professional food cinematography."
```

#### Pros & Cons

**Pros**:
- ✅ Zero user effort (AI does the work)
- ✅ Context-aware (understands image)
- ✅ Educational (shows 3 styles)
- ✅ Fastest workflow (one click)
- ✅ Leverages existing Gemini integration

**Cons**:
- ⚠️ Depends on AI accuracy
- ⚠️ May hallucinate details
- ⚠️ Requires Gemini Vision API costs
- ⚠️ Less user control
- ⚠️ Processing time (2-3 seconds)

**Implementation Effort**: 6-10 hours
- 3 hours: Gemini Vision integration
- 2 hours: Prompt generation logic
- 2 hours: UI for showing variations
- 1 hour: Testing/refinement

---

### 📚 Option 5: Prompt Library & Community Sharing

**Concept**: Save successful prompts, clone/remix, build organizational knowledge base.

#### How It Works

1. After generating video, option to **"Save Prompt"**
2. Prompts saved with:
   - Template name
   - Reference image thumbnail
   - Generated video preview
   - Success rating
3. **Library View**: Browse saved prompts
4. **Clone & Modify**: Start from proven prompt
5. **Organizational Sharing**: Share across team (optional)

#### UI Components

```typescript
<PromptLibrary>
  <LibraryFilters>
    <Filter by="style" options={['Showcase', 'Teaser', 'Cinematic']} />
    <Filter by="imageType" options={['Burger', 'Pizza', 'Ambiance']} />
    <Filter by="author" options={['My Prompts', 'Team', 'Templates']} />
  </LibraryFilters>

  <PromptGrid>
    {savedPrompts.map(prompt => (
      <PromptCard
        title={prompt.name}
        thumbnail={prompt.videoThumbnail}
        successRate={prompt.rating}
        actions={
          <>
            <Button onClick={() => usePrompt(prompt)}>Use This</Button>
            <Button onClick={() => remixPrompt(prompt)}>Remix</Button>
          </>
        }
      />
    ))}
  </PromptGrid>
</PromptLibrary>
```

#### Pros & Cons

**Pros**:
- ✅ Learns over time (builds knowledge)
- ✅ Shares best practices
- ✅ Organizational efficiency
- ✅ Complements other options
- ✅ Reduces trial and error

**Cons**:
- ⚠️ Takes time to build library
- ⚠️ Requires database storage
- ⚠️ Privacy/sharing considerations
- ⚠️ Not useful initially (empty library)

**Implementation Effort**: 4-6 hours
- 2 hours: Database schema for saved prompts
- 2 hours: Library UI components
- 1 hour: Clone/remix logic
- 1 hour: Filtering/search

---

## Recommended Approach

### Phase 1: Quick Win (Week 1)

**Option 1 + Option 5: Smart Template System + Prompt Library**

#### Why This Combination

- ✅ Delivers immediate value (80% of users happy)
- ✅ Fast to implement (8-12 hours for templates, 4-6 hours for library)
- ✅ Improves over time (library grows)
- ✅ Covers most use cases
- ✅ Low complexity

#### What to Build

**1. Core Templates (5-8 templates)**:

1. **Product Showcase**
   - Camera: Medium close-up, slow 180° orbit
   - Lighting: Warm overhead with soft side fill
   - Action: Steam rises, garnish catches light
   - Best for: Burgers, entrees, plated dishes

2. **Sizzle & Steam**
   - Camera: Extreme close-up, static with slight push-in
   - Lighting: Dramatic side lighting
   - Action: Active sizzling, steam billowing
   - Best for: Hot dishes, grilled items, fresh-off-grill shots

3. **Overhead Pour**
   - Camera: Directly overhead, static
   - Lighting: Bright, even lighting
   - Action: Sauce drizzle, drink pour, garnish sprinkle
   - Best for: Drinks, sauces, assembly shots

4. **Ambiance Tour**
   - Camera: Wide shot, slow pan left-to-right
   - Lighting: Warm ambient, natural restaurant lighting
   - Action: Slow reveal of dining space
   - Best for: Restaurant interior, atmosphere showcase

5. **Quick Teaser** (Social Media)
   - Camera: Dynamic - multiple quick cuts suggested
   - Lighting: High contrast, trendy
   - Action: Fast movements, energetic
   - Best for: Instagram Reels, TikTok, promotions

6. **Slow Rotate** (Premium)
   - Camera: 360° turntable orbit
   - Lighting: Cinematic, with rim lighting
   - Action: Product slowly rotates on display
   - Best for: Signature items, premium products

7. **Ingredient Hero**
   - Camera: Macro close-up
   - Lighting: Natural with bounce
   - Action: Focus on texture, details
   - Best for: Fresh ingredients, quality showcase

8. **Behind-the-Scenes**
   - Camera: Handheld, casual movement
   - Lighting: Natural kitchen lighting
   - Action: Chef hands preparing, authentic movements
   - Best for: Preparation process, authenticity

**2. Template Customization Options** (3 quick tweaks per template):
- Camera speed: Slow / Medium / Fast
- Lighting mood: Warm / Cool / Dramatic
- Action intensity: Subtle / Moderate / Dynamic

**3. Prompt Library Features**:
- Save button after successful generation
- Rating system (1-5 stars)
- Clone prompt functionality
- Search and filter
- Organizational sharing toggle

#### Timeline

- **Days 1-2**: Template system architecture + 3 core templates
- **Day 3**: 5 more templates + customization UI
- **Day 4**: Prompt library (database + UI)
- **Day 5**: Testing and refinement

**Total: 8-16 hours** (12 hours template system + 4-6 hours library)

---

### Phase 2: Power User Features (Week 2)

**Add Option 2 Elements: Guided Builder for Customization**

#### Why Add This

- ✅ Serves the 20% who want more control
- ✅ Educational component
- ✅ Completes the offering

#### What to Add

- Full builder mode (7-step wizard)
- Visual selectors with examples
- Direct prompt editing
- "Start from template" shortcut in builder

#### Timeline

**Total: 10-15 hours**

---

### Phase 3: AI Enhancement (Future)

**Option 4: Smart Suggestions based on Image Analysis**

#### Why Later

- ✅ Next-level UX
- ✅ Leverages Gemini capabilities
- ✅ Reduces user effort further
- ⚠️ Requires additional API costs (Gemini Vision)
- ⚠️ Depends on accuracy/reliability

#### Timeline

**Total: 6-10 hours**

---

## Discussion Points

### Questions for Decision Making

1. **Which option resonates most** with your vision for the feature?

2. **Phase 1 templates**: Do the 8 suggested video types cover the main use cases? Any additions/changes?

3. **UI preference**:
   - All-on-one-page with collapsible sections?
   - Multi-step wizard with progress indicator?
   - Modal/drawer interface vs dedicated page?

4. **Image analysis**:
   - Worth the Gemini Vision API cost for auto-suggestions?
   - Or rely on manual context extraction from database?

5. **Community features**:
   - Prompt sharing within organizations?
   - Privacy considerations?
   - Rating/feedback system?

6. **Advanced features priority**:
   - Which is more important: Full builder (Option 2) or AI suggestions (Option 4)?

7. **Testing strategy**:
   - Create sample videos for each template?
   - User testing with restaurant partners?

### Technical Considerations

1. **Database schema for saved prompts**:
   ```sql
   CREATE TABLE prompt_templates (
     id UUID PRIMARY KEY,
     organisation_id UUID REFERENCES organisations(id),
     created_by UUID REFERENCES auth.users(id),
     name TEXT NOT NULL,
     description TEXT,
     template_type TEXT, -- 'system' | 'user' | 'team'
     prompt_text TEXT NOT NULL,
     reference_image_id UUID,
     video_thumbnail_url TEXT,
     success_rating INTEGER CHECK (success_rating BETWEEN 1 AND 5),
     usage_count INTEGER DEFAULT 0,
     customization_options JSONB,
     applicable_image_types TEXT[],
     tags TEXT[],
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Template system architecture**:
   - Store templates as code (JSON/JS) or database records?
   - Template versioning?
   - Rollback mechanism for failed generations?

3. **Image analysis integration**:
   - Real-time vs pre-processed?
   - Cache analysis results?
   - Fallback for unsupported image types?

---

## Next Steps

1. **Review this document** and provide feedback on preferred direction
2. **Prioritize templates** - which 5-8 are most critical for Phase 1?
3. **UI mockups** - create visual designs for chosen approach
4. **Technical spike** - test Gemini Vision API for image analysis (if pursuing Option 4)
5. **Begin implementation** once direction is confirmed

---

**Document Status**: Draft - Awaiting Discussion & Decision
**Last Updated**: 2025-10-10
