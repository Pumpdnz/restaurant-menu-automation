# xGrowth GTM Engineer Video Demo - Plan & Script

## Overview
**Target length:** 2:30 - 3:00 minutes
**Format:** Screen recording with voiceover
**What to show:** Your automated list building and account-intel system (the onboarding automation)

---

## Video Structure

### Opening (15 seconds)
"Hi Shahin, I'm Gianni. I'm going to walk you through the list-building automation I built for my own company. This is essentially a Clay workflow, but I built it from scratch before I knew Clay existed. It does three things: finds accounts, enriches them with multi-source data, and generates an account-intel brief—all automatically."

### Problem Statement (20 seconds)
"The problem: I needed to reach out to hundreds of restaurants, but manually researching each one was taking 30-45 minutes per account. I needed their menu, logo, business hours, delivery platforms they use, tech stack, and contact info. Doing this manually would have killed my velocity."

---

## Demo Flow (2 minutes)

### Part 1: Show the Input (15 seconds)
**What to show:** Your CRM interface or lead entry point

**Script:**
"Here's where it starts. I give it minimal input—just a restaurant name and city. Sometimes I add a UberEats URL if I have one. That's it."

**Show on screen:**
- Lead entry form with just: Restaurant Name, City, (optional URL)
- Example: "Base Pizza, Christchurch"

---

### Part 2: The Automation Running (45 seconds)
**What to show:** Playwright scripts running with headless=false (multiple browser windows)

**Script:**
"When I hit 'run', here's what happens automatically:

First, it scrapes their public data. [Show Firecrawl or Playwright opening UberEats/website]
- Menu items with prices and descriptions
- Business hours, including complex stuff like multiple periods per day
- Their logo and menu images
- Social media links
- Phone number and address

Second, it enriches across multiple sources. [Show parallel browser windows]
- Checks DoorDash, Delivereasy, other platforms
- Downloads images and processes them
- Normalises data formats

Third, it structures everything into a clean schema. [Show database or structured JSON]
- 80+ fields per account
- ICP scoring
- Competitive intel
- Pain point identification"

**Technical note to emphasise:**
"I'm using Playwright for browser automation, Firecrawl for intelligent scraping, and Claude API for data extraction and summarisation. Everything feeds into a PostgreSQL database with validation rules."

---

### Part 3: The Output (30 seconds)
**What to show:** The final account-intel brief or CRM record

**Script:**
"Here's what comes out: a complete account profile ready for outreach.

[Show the structured output - your CRM record or account brief]

You can see:
- Full menu with images already uploaded to our CDN
- Business hours properly formatted
- All their delivery platforms
- Their branding extracted and processed
- Pain points identified based on their setup
- ICP rating scored automatically

This used to take me 45 minutes. Now it runs in 3 minutes with QA checks."

**Show a specific example:**
- Point to fields in your database
- Show the logo processing (original → background removed → thermal format)
- Show the menu CSV ready for import

---

### Part 4: The Results (20 seconds)
**What to show:** Either the conversion metrics or the scale impact

**Script:**
"The results: I've used this to onboard 30+ restaurants. Because the data is clean and the research is thorough, I'm hitting 67% outreach-to-demo conversion. That's the power of good list building."

---

### Technical Decisions Explained (30 seconds)

**Script:**
"Quick note on why I built it this way:

One: I used Playwright instead of just APIs because many sources don't have APIs, and I needed to handle complex interactions like pagination and JavaScript-rendered content.

Two: I built my own enrichment pipeline instead of using a service because I needed domain-specific data that standard enrichment tools don't capture—like which delivery platforms they use or their menu pricing strategy.

Three: I keep the human in the loop for final QA, but automate all the data gathering and initial structuring. That's where the time savings come from.

This is essentially what Clay does, but purpose-built for my vertical. I'm excited to work with your recipes across different clients and industries."

---

## Closing (10 seconds)
**Script:**
"That's the system. Happy to dive deeper on any part of this. Thanks for your time."

---

## Technical Setup

### Recording Options:
1. **Loom** (easiest): Free, good quality, shareable link
2. **Screen recording + voiceover**: Mac QuickTime or OBS
3. **iPhone screen record**: Good for quick demos if needed

### What to Record:

**Option A: Live Demo (Recommended)**
- Record your actual system running on a test case
- Show real Playwright automation with `headless: false`
- Pull up your actual CRM database
- This is most impressive—shows it's real, working code

**Option B: Walkthrough with Screenshots**
- Prepare slides with screenshots of each stage
- Talk through the flow with visual aids
- Easier to control timing, but less impressive

**Recommendation: Go with Option A** - The visual of multiple browser windows automating account research simultaneously is visceral and memorable.

---

## Pre-Recording Checklist

### Prepare your demo environment:
- [ ] Pick a clean test account (not a current customer)
- [ ] Clear browser cache/cookies for clean demo
- [ ] Have your CRM/database view ready
- [ ] Test the automation flow once to ensure it works
- [ ] Close unnecessary tabs/applications
- [ ] Set browser zoom to 100% for clarity

### Script notes:
- [ ] Practice once—aim for conversational, not memorised
- [ ] Speak slightly slower than normal
- [ ] Pause briefly when switching screens
- [ ] Point with cursor to specific items you're discussing
- [ ] Smile when you talk (it comes through in voice)

### Technical quality:
- [ ] Use headphones with mic (better audio than laptop mic)
- [ ] Record in a quiet room
- [ ] Good lighting if showing your face
- [ ] Test recording for 10 seconds to check audio/video

---

## Pro Tips

**Energy level:** Be enthusiastic but not over-the-top. This is a technical demo—show you're excited about the problem you solved.

**Pacing:** Don't rush. 3 minutes feels short, but it's enough time to show the flow clearly.

**Cursor work:** When showing database fields or code, hover your cursor over what you're talking about. This helps viewers follow along.

**Technical depth:** They want to see you think technically, but don't get lost in code. Focus on "what" and "why", not "how" at the implementation level.

**End strong:** The 67% conversion rate is your mic drop moment. Save it for the end.

---

## What They're Really Evaluating

Based on the role description, they're assessing:

1. **Technical chops** - Can you actually build this stuff? (Show real automation running)
2. **Systems thinking** - Do you think in workflows? (Explain ICP → accounts → enrichment → QA → export)
3. **Communication** - Can you explain technical decisions clearly? (The "why I built it this way" section)
4. **Data hygiene mindset** - Do you care about quality? (Mention validation, QA checks, normalisation)
5. **Genuine interest** - Did you just click apply or do you actually build this stuff? (Real working system answers this)

---

## Alternative: If You Can't Show the Full Automation

If for some reason you can't show the Playwright automation running, you could show:

**Plan B: Database + Results Focus**
- Show the CRM database with enriched records
- Walk through a single account record showing all the fields
- Show before/after (empty lead → fully enriched account)
- Explain the automation that populated it
- Show the results (conversion rate, time saved)

This is less visually impressive but still demonstrates the system thinking.

---

## Sample Opening Lines (Pick Your Style)

**Option 1 (Direct):**
"Hi Shahin, I'm Gianni. Let me show you the list-building automation that got me a 67% outreach-to-demo conversion rate."

**Option 2 (Problem-first):**
"Hi Shahin, I'm Gianni. When I started my company, I was spending 45 minutes manually researching each prospect. Here's how I automated that down to 3 minutes."

**Option 3 (Systems-thinking):**
"Hi Shahin, I'm Gianni. This is my version of a Clay workflow—built before I knew Clay existed. It takes a restaurant name and outputs a complete account-intel brief. Let me show you how."

**Recommendation: Option 3** - It directly references their world (Clay) and positions your work as equivalent.

---

## After Recording

### Before sending:
1. Watch it once yourself
2. Check audio quality
3. Verify the link is publicly accessible
4. Consider adding a title/description to the video file

### In your message back to Shahin:
```
Hi Shahin,

Here's the video: [link]

Quick summary: I walk through my automated list-building system that scrapes multi-source data, enriches accounts, and generates intel briefs. It's essentially a custom Clay workflow I built for restaurant prospecting—same principles, different vertical.

The result: 67% outreach-to-demo conversion from clean, enriched data.

Happy to discuss any part of this in more detail.

Cheers,
Gianni
```

---

## Final Thoughts

This is a huge advantage for you. Most candidates will struggle to show real working systems. You have production code that's been running for months and driving actual business results.

The visual of Playwright automating multiple browser windows simultaneously is going to be memorable. It shows you don't just talk about automation—you build it.

**Confidence level: Very high.** This demo will differentiate you significantly from other applicants.