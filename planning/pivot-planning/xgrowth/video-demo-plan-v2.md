# xGrowth GTM Engineer Video Demo - Comprehensive Plan v2

## Overview
**Target length:** 5-7 minutes (expanded to show depth properly)
**Format:** Screen recording with voiceover, live demo of real system
**What to show:** End-to-end automated list building, multi-source enrichment, account-intel generation, and automated onboarding

---

## Why This Demo Will Stand Out

Based on my analysis of your codebase, here's what makes your system exceptional:

1. **Multi-layer validation with dynamic search termination** - Your system doesn't just scrape; it validates and knows when to stop
2. **Complex data normalization** - Midnight-crossing hours, NZ phone formats, multi-slot business hours
3. **Intelligent fallback chains** - Google Search → Platform-specific extraction → Manual edit
4. **Premium extraction with deduplication** - SHA-256 hashing for option set deduplication
5. **Parallel Playwright automation** - Multiple scripts running simultaneously with headless=false
6. **Human-in-the-loop design** - Evolved from fully-automated Claude Code subagents to UI-driven control
7. **Email infrastructure automation** - Programmatic Cloudflare zone creation + AWS SES domain verification
8. **End-to-end data flow** - Enriched data flows into customer-facing onboarding UI with prefilled fields

---

## Video Structure (12 Parts, ~9 minutes full / 6-7 minutes trimmed)

### Part 1: Opening & Problem Statement (30 seconds)

**Script:**
"Hi Shahin, I'm Gianni. This is my version of a Clay workflow—built before I knew Clay existed. It takes a Meta lead form submission and outputs a fully enriched account record with menu data, branding assets, and business intel, then automates the entire customer onboarding process.

The problem I was solving: I needed to research hundreds of restaurants, but manual research was taking 30-45 minutes per account. I needed their menu, logo, business hours, delivery platforms, competitive intel, and contact info. Then I needed to set up their account on our platform—which was another 2-4 hours of manual work per customer. I built this system to do both automatically."

---

### Part 2: Lead Capture Flow (45 seconds)

**What to show:** Meta Ads form → Pabbly automation → CRM record creation

**Script:**
"Let me show you how leads enter the system. We run Meta ads targeting restaurant owners. When someone fills out our lead form, they provide minimal data: restaurant name, contact name, phone, email, weekly UberEats sales volume, and city.

[Show Pabbly workflow diagram or describe]

That form submission triggers a Pabbly automation that:
1. Creates a Google Calendar task for follow-up
2. Creates a contact and company in HubSpot
3. Creates a deal in the 'New Lead' stage
4. Fires an API request to our Supabase database

So within seconds of form submission, we have a CRM record ready for enrichment."

**Show on screen:**
- The Meta lead form fields
- The new restaurant record in your CRM (RestaurantDetail page)
- Highlight: minimal data in, ready for enrichment

---

### Part 3: Multi-Source Data Enrichment (90 seconds)

**What to show:** The "Google Search" button triggering Firecrawl scraping

**Script:**
"Now here's where it gets interesting. I click one button—'Google Search'—and the system does intelligent multi-source scraping.

[Click the Google Search button, show loading state]

What's happening behind the scenes:
1. It searches for the restaurant across multiple platforms: UberEats, DoorDash, Facebook, Instagram, and their direct website
2. It extracts data from each source with platform-specific validation
3. It tracks which fields are still missing and dynamically chooses the next search term
4. Once all required fields are found, it stops—no wasted API calls

[Show the data populating in the UI]

The system just found: their physical address, phone number, opening hours, and links to 5 different platforms they're on."

**Technical details to mention:**
"The validation is rigorous. For example, addresses get rejected if they're just numbers. Phone numbers get validated against NZ-specific patterns and formatted to international format. And business hours—this is where it gets complex."

---

### Part 4: Hours Parsing & Midnight Crossing (45 seconds)

**What to show:** The opening_hours field with properly formatted data

**Script:**
"Let me show you something that took a while to get right: business hours parsing.

Restaurants have complicated hours. They might have lunch and dinner services. They might close at 2am. They might have different hours on different days.

[Show the hours in the UI or database]

The system handles all of this:
- Multiple time slots per day (lunch 11-2, dinner 4-10)
- 24-hour time formatting
- And critically: midnight-crossing detection

If a restaurant closes at 2am on Saturday, the system splits that into two entries: Friday 4pm-11:59pm, then Saturday 12am-2am. This is essential because our onboarding automation needs to enter these hours into forms that don't understand midnight crossings."

**Show the JSON structure:**
```json
{"day": "Friday", "hours": {"open": "16:00", "close": "23:59"}}
{"day": "Saturday", "hours": {"open": "00:00", "close": "02:00"}}
```

---

### Part 5: Fallback Mechanisms (30 seconds)

**What to show:** The "Get Details" fallback button and manual edit option

**Script:**
"Sometimes the initial scrape isn't perfect—maybe the address came from an outdated source, or the hours aren't quite right.

I built a three-level fallback system:

1. **Primary:** The Google Search aggregates from best available sources
2. **Fallback:** If data is missing, I can click 'Get Details' on a specific platform URL—say UberEats—and re-scrape just the missing fields
3. **Manual:** If all else fails, there's always an 'Edit Details' button for human override

Each platform has specific capabilities: UberEats can provide address and hours, DoorDash only provides hours reliably, and websites can provide all three plus phone number."

---

### Part 6: Logo Extraction & Processing (60 seconds)

**What to show:** Logo candidates with probability ratings, then processed versions

**Script:**
"Next, branding assets. I click 'Extract Logo' and the system scrapes their website for logo candidates.

[Show the logo candidates returning with confidence scores]

Firecrawl returns multiple candidates, each with a probability rating. The system checks for logo indicators in filenames and class names, validates aspect ratios, and ranks them. I select the correct one—or paste a URL if it missed it.

[Select a logo and show processing]

Now watch what happens: the system processes this into multiple formats using Sharp image processing:
- Standard 500x500 for web
- Background removed using the RemoveBG API
- Favicon size
- And four different thermal printer versions—different contrast algorithms to ensure at least one works well for receipt printing

It also extracts 5 brand colors using Vibrant.js and determines if they use a light or dark theme. This all feeds into the automated website configuration later."

---

### Part 7: Menu Extraction - Standard vs Premium (90 seconds)

**What to show:** Menu extraction from UberEats, then the premium extraction with option sets

**Script:**
"Now the most impressive feature: full menu extraction.

**Standard Extraction:**
[Click extract on a platform URL]

The system pulls their entire menu: categories, items, prices, descriptions, and images. This works for UberEats, DoorDash, and several other platforms.

**Premium Extraction (UberEats only):**
This is where it gets sophisticated. When I select 'Premium Extract':

1. It extracts menu items with their modal dialog IDs
2. Cleans those into direct item page URLs
3. Scrapes each item individually for detailed option sets
4. Then—and this is the clever part—deduplicates option sets using SHA-256 hashing

[Show the deduplication stats]

Why deduplication? Many items share the same option sets. 'Choose your size' applies to 40 items. Instead of storing 40 copies, the system creates one master option set and links items via a junction table. This saved significant storage and makes data management cleaner.

[Show the menu editor UI]

All of this data is editable in a nice UI before we do anything with it. Once I'm satisfied, I click 'Upload Images to CDN' and the system uploads all menu images and returns CDN IDs for the CSV export."

---

### Part 8: Automated Onboarding - Parallel Playwright (90 seconds)

**What to show:** Multiple Playwright browsers running simultaneously with headless=false

**Script:**
"Here's where it all comes together. I've gathered all the data—now I need to set up their account on our platform. This used to take 2-4 hours manually. Now watch.

[Navigate to the Pumpd Registration tab, show the step buttons]

I can run these steps in sequence or in parallel. Let me click several at once.

[Click 3-4 buttons simultaneously, show multiple browser windows opening]

What you're seeing:
- One browser is registering the user account
- Another is configuring item tags on the menu
- A third is uploading the CSV menu data
- A fourth is applying the website settings—logo, colors, SEO metadata, and those custom code injections we generated from the brand colors

[Show the browsers automating in parallel]

Each of these Playwright scripts handles complex form interactions:
- Multi-step hours entry with the midnight-crossing splits we discussed earlier
- Dropdown selections
- File uploads
- Color pickers
- Tabbed interfaces

When they finish, I have a fully configured restaurant account with their branding, their full menu, and their business hours—all in about 3 minutes instead of 3 hours."

---

### Part 9: Email Domain Infrastructure (30-45 seconds)

**What to show:** Super admin domain management UI, Cloudflare zone creation, AWS SES verification

**Script:**
"One more piece of infrastructure worth mentioning: email deliverability.

When a deal closes and we're ready to send marketing campaigns on their behalf, I need to set up their domain properly. This is critical for ABM—if your emails hit spam folders, your campaigns fail.

[Show super admin domain management UI]

I built tools that programmatically:
1. Create a Cloudflare zone for their domain
2. Return nameservers for them to configure at their registrar
3. Once nameservers propagate, sync DKIM and SPF records from AWS SES to Cloudflare
4. Verify domain ownership automatically

[Show the verification status or DNS records being synced]

This ensures every customer's email campaigns have proper authentication—SPF, DKIM, DMARC—so they actually reach inboxes, not spam folders. It's the kind of infrastructure work that's invisible but critical for outreach at scale."

**Technical details to mention:**
- Cloudflare API for zone management and DNS records
- AWS SES for domain verification and DKIM token generation
- Automated sync between the two systems
- Super admin UI for managing across all customers

---

### Part 10: Sales Features & Sequences (30 seconds)

**What to show:** CRM page, starting a sequence, variable replacement in messages

**Script:**
"Once the demo store is built, I use the sales features to reach out.

[Show a message template with variables]

I can enroll leads in sequences with message templates that support variable replacement. When I write '{restaurant_name}, your demo store is live at {demo_store_url}', the system substitutes actual values. I have 63 variables available—contact info, business data, even city-specific case studies for social proof.

This personalization at scale is why I'm hitting 67% outreach-to-demo conversion."

---

### Part 11: Evolution Story - Claude Code to Human-in-the-Loop (45 seconds)

**Script:**
"One more thing worth mentioning: how this system evolved.

I initially built this as a fully automated flow using Claude Code. I had AI subagents with a custom slash command for orchestration. I'd input the lead form data and the system would execute everything automatically.

The problem? When a step failed or returned imperfect data, nothing persisted. There was no easy way to intervene, correct, and continue.

So I rebuilt it with this human-in-the-loop UI. Each button is a discrete step. Data persists to the database immediately. If something fails, I can fix it and retry just that step. If the AI's extraction isn't perfect, I can edit manually.

This is the right balance between automation and control. The system does the heavy lifting—I provide the judgment calls and QA."

---

### Part 12: Results & Closing (30 seconds)

**Script:**
"The results:
- 30+ restaurants onboarded using this system
- Research time reduced from 45 minutes to 3 minutes per account
- Onboarding time reduced from 4 hours to 15 minutes
- 67% outreach-to-demo conversion because the data is clean and the personalization is specific

And all this enriched data—business hours, branding, menu—flows into a customer-facing onboarding portal where fields are prefilled. The new customer just fills in their business registration details and they're live. That's the full loop: lead capture to enrichment to automated setup to customer self-service.

This is essentially what Clay does—multi-source enrichment, validation, structured exports—but purpose-built for my vertical. I'm excited to apply this same systems thinking across different clients and industries at xGrowth.

Happy to dive deeper on any part of this. Thanks for your time."

---

## Technical Highlights to Emphasize

Throughout the demo, these technical points align with the job description:

| Job Requirement | Your Proof Point |
|-----------------|------------------|
| "Hands-on Clay experience (recipes, enrichment, exports)" | Multi-layer Firecrawl scraping, validation, CSV export to CloudWaitress |
| "Very comfortable working with LLMs" | Claude API for data extraction/summarization, evolved from Claude Code subagents |
| "Strong data hygiene mindset (normalisation, dedupe, validation, sampling)" | Phone validation patterns, hours normalization, SHA-256 option set deduplication |
| "Clear written communication; concise documentation" | The UI itself documents the workflow; each step is discrete and labeled |
| "Basic SQL and light Python for transformations" | PostgreSQL/Supabase database, JavaScript transformations |
| "ICP → accounts → buying group → enrichment → QA → export" | Lead form → enrichment → validation → parallel onboarding → outreach |
| "Understanding of email/domain hygiene and sending safety rails" | Cloudflare zone creation + AWS SES verification for SPF/DKIM/DMARC |

---

## Recording Setup

### Option A: Full Live Demo (Recommended)
- Record the entire flow on a real (or realistic test) restaurant
- Use `headless: false` for Playwright scripts so browsers are visible
- Show multiple browser windows automating simultaneously
- Have your CRM and database views ready

### Option B: Segmented Recording with Editing
- Record each section separately
- Edit together with transitions
- Allows retakes for each section
- Easier to control pacing

### Recommendation: Start with Option A
If something fails, you can show the fallback mechanism—that's actually a feature, not a bug. It demonstrates the robustness of your design.

---

## Pre-Recording Checklist

### Data Preparation
- [ ] Pick a restaurant that isn't a current customer (or use a test entry)
- [ ] Ensure the restaurant has an UberEats presence (for menu extraction demo)
- [ ] Verify their website has a visible logo (for logo extraction demo)
- [ ] Check they have complex hours (split shifts or late closing) for best demo

### System Preparation
- [ ] Test the Google Search flow once to ensure Firecrawl API is responding
- [ ] Test the logo extraction on the target restaurant
- [ ] Have the menu extraction ready (or pre-run to save recording time)
- [ ] Prepare the Playwright scripts in a state ready to run
- [ ] Set all scripts to `headless: false`
- [ ] Clear browser cache/cookies for clean Playwright runs

### Technical Setup
- [ ] Close unnecessary applications
- [ ] Set browser zoom to 100%
- [ ] Arrange windows for good screen composition
- [ ] Use a good microphone (headset or external mic)
- [ ] Record in a quiet environment
- [ ] Test recording for 10 seconds first

### Script Preparation
- [ ] Practice once—aim for conversational, not memorized
- [ ] Speak slightly slower than normal
- [ ] Pause briefly when switching screens
- [ ] Point with cursor to specific items you're discussing

---

## Pacing Guide

| Section | Duration | Key Moments |
|---------|----------|-------------|
| Opening & Problem | 30s | Hook with "Clay workflow built from scratch" |
| Lead Capture | 45s | Show Pabbly flow, minimal input |
| Multi-Source Enrichment | 90s | Click "Google Search", explain validation |
| Hours Parsing | 45s | Show midnight crossing JSON |
| Fallback Mechanisms | 30s | Quick mention of three levels |
| Logo Extraction | 60s | Show candidates, processing formats |
| Menu Extraction | 90s | Standard vs Premium, deduplication stats |
| Parallel Playwright | 90s | **KEY VISUAL** - multiple browsers |
| Email Domain Infrastructure | 30-45s | Cloudflare + AWS SES, deliverability |
| Sales Features | 30s | Variable replacement, sequences |
| Evolution Story | 45s | Claude Code → human-in-the-loop |
| Results & Closing | 30s | 67% conversion, mention prefilled onboarding UI |
| **Total** | **~9 min** | Trim where needed |

If you need to cut to 6-7 minutes:
- Shorten Logo Extraction to 30s (just mention it processes into formats)
- Shorten Email Domain to 20s (just mention Cloudflare + SES integration)
- Skip the detailed hours JSON—just mention midnight handling
- Combine Evolution Story into Results section

If you need to cut to 5 minutes:
- Skip Email Domain Infrastructure entirely (mention in closing instead)
- Shorten Logo Extraction to 20s
- Skip Evolution Story (save for interview follow-up)

---

## What They're Really Evaluating

Based on the job description:

1. **Technical chops** - Can you actually build this? → Show Playwright automation running live
2. **Systems thinking** - Do you think in workflows? → The entire demo IS a workflow
3. **Data hygiene** - Do you care about quality? → Validation rules, deduplication, normalization
4. **LLM comfort** - Do you use AI effectively? → Claude Code evolution story
5. **Communication** - Can you explain technical decisions? → The "why I built it this way" moments
6. **ABM/GTM understanding** - Do you get the domain? → Lead → enrichment → outreach → conversion
7. **Email deliverability** - Do you understand infrastructure? → Cloudflare + AWS SES for proper authentication

---

## Response Message to Shahin

After recording, send:

```
Hi Shahin,

Here's the video: [link]

I walk through my end-to-end GTM automation system:
- Lead capture via Meta ads → Pabbly → Supabase
- Multi-source enrichment with Firecrawl (dynamic search termination, validation)
- Complex data normalization (midnight-crossing hours, NZ phone formats)
- Logo extraction with multiple processed formats (Sharp, RemoveBG)
- Full menu extraction with option set deduplication
- Parallel Playwright automation for account setup
- Email infrastructure automation (Cloudflare zone creation + AWS SES verification)
- Sales sequences with 63-variable personalization
- Customer-facing onboarding UI with prefilled data

The result: 67% outreach-to-demo conversion from clean, enriched data.

I also explain how this evolved from fully-automated Claude Code subagents to a human-in-the-loop UI—which I think is relevant to how xGrowth might think about balancing automation with operator judgment.

Happy to discuss any part of this in more detail.

Cheers,
Gianni
```

---

## Final Notes

**Confidence level: Very high.**

Most candidates will talk about Clay experience. You can SHOW a production system that does the same thing—multi-source enrichment, validation, deduplication, exports—running on real data with real results.

The visual of multiple Playwright browsers automating simultaneously is memorable. The 67% conversion stat is the proof. The evolution story shows you think critically about automation design.

This demo will differentiate you significantly.
