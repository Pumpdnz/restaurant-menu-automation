# Gianni's Career Transition: Comprehensive Overview

## Executive Summary

Gianni is a 24-year-old solo founder transitioning from building Pump'd (a white-labeled restaurant online ordering and marketing platform in New Zealand) toward opportunities in Business Process Automation (BPA), Go-To-Market Engineering (GTME), and AI implementation. Over 16+ months, he taught himself to code using AI tools and built sophisticated automation systems that demonstrate enterprise-level technical capabilities. He's now seeking to leverage these skills in higher-growth sectors while potentially maintaining Pump'd as a case study and passive income source.

**Core Goal:** Earn $500M by age 50 (26 years to achieve)

**Current Status:** Exploring transition to GTME/AI implementation roles while running Pump'd in a sales-focused mode with minimal development.

---

## Personal Background & Character

### Achievements Demonstrating Grit & Capability

- **Athletics:** South Island Golden Gloves Boxing Champion - demonstrates competitive drive and discipline
- **Education:** Psychology degree from University of Otago with Council Commendation for exceptional achievement
- **Resilience:** Recovered from broken femur (skiing accident, near-death experience):
  - Back in gym within 3 weeks of surgery
  - Matched 180kg deadlift PB within 12 months
  - Skiing again on opening day of following season

### Professional Experience Pre-Pump'd

- **First SDR hire** at fast-paced NZ hospitality tech startup
- **Exceeded quota 6 consecutive quarters** during challenging GTM conditions as company found PMF for Australia
- **Being trained for AE role** when he left to start Pump'd
- Took **$100K+ pay cut** from sales job to build technical and business skills

---

## Pump'd Business Overview

### What Pump'd Does

Pump'd is a New Zealand-based restaurant technology company providing:
1. **White-labeled online ordering** (using CloudWaitress platform, rebranded as "Pump'd")
2. **SMS and email marketing automation**
3. **Customer loyalty programs**
4. **AI-powered content generation** (images, video for marketing)

### Business Model

| Revenue Stream | Pricing |
|----------------|---------|
| Monthly subscription | $98 + GST |
| SMS messages | $0.15 + GST per message |
| Delivery commission | 5% |
| Pickup commission | 2% |
| Email & media generation | In testing (pricing TBD) |

### Cost Structure

| Cost Item | Amount |
|-----------|--------|
| Infrastructure | ~$100/month |
| CloudWaitress commission share | 50% of first $500, 40% of next $500, 20% of $1000+ |
| SMS (Kudosity) | $0.083 incl. GST per message + $298/month short code |
| Email | ~$1 per 10,000 emails |
| AI content generation | $0.09/image, $0.20/second video |

### Current Metrics (as of late 2025)

- **20 paying customers** (some with multiple venues)
- **26 total subscriptions** across locations
- **24 actively receiving orders** (2 delayed in setup)
- **2-4 expected expansions** in near future
- **5 churned** over 16 months (~20% historical churn)
- **2-3 expected churn** in next 3 months (low volume)
- **~$40K ARR** (subscriptions + commissions)

### Recent Sales Performance (Last 2 Months)

- Closed **3 new customers**
- Expanded **1 existing customer** to 3rd venue
- **67% outreach-to-demo-booked rate** (exceptional)
- All-time low bug reports requiring customer communication
- Building healthy sales pipeline from 4 months of uncontacted leads

### Strategic Challenges

**CloudWaitress Platform Limitations:**
- No POS integrations (staff must manually enter orders, inventory disrupted)
- Don't own menu data (can't build centralized menu management)
- Don't own delivery integrations (can't switch between own drivers and Uber Direct)
- Can't fix bugs quickly (12+ months for minor fixes historically)
- Can't integrate with promo code system (must use generic codes vs. personalized)
- Can't integrate with login system (no unified "Pump'd account" for customers)
- Must duplicate menu data and images across systems
- Restaurant owners manage two dashboards (admin.pumpd.co.nz + manage.pumpd.co.nz)
- Can't create landing pages with cart API integration
- Can't build agentic ordering processes
- Locked to 2.7% + $0.30 Stripe fees

**Market Challenges:**
- Competition from larger online ordering providers
- Original value proposition (white-label CloudWaitress) has been commoditized
- Switching restaurants from current direct ordering platforms is difficult without POS integration
- Restaurant industry has low profit margins (limits pricing power)

---

## Technical Systems Built

### 1. Email & SMS Marketing Platform

**Core Capabilities:**
- GrapesJS-based visual email editor
- Asset upload and management system
- System email templates with dynamic brand color/logo replacement
- Customer segmentation and filtering for campaigns
- Activity-based trigger rules
- CRON-based rule evaluation engine
- Multi-tenanted subscription opt-out handling

**Domain Management Automation:**
- Cloudflare SDK integration for DNS management
- AWS SDK integration for domain verification (SES)
- Programmatic domain addition and verification
- Integrated into onboarding dashboard (nameserver change instructions)
- Super admin dashboard with one-click DNS record configuration

**SMS System:**
- Full integration with Kudosity
- Built before email system (SMS-first approach)
- Testing with 1 customer showing "dramatic results" in order lift

### 2. CRM & Sales Automation System

**Database Schema Highlights** (from restaurants.sql):

```
Key Fields for Lead Management:
- lead_type: inbound/outbound
- lead_category: paid_ads, organic_content, warm_outreach, cold_outreach
- lead_engagement_source: 13 different sources tracked
- lead_warmth: frozen, cold, warm, hot
- lead_stage: 10 stages from uncontacted to closed_won/lost
- lead_status: active, inactive, ghosted, reengaging, closed
- icp_rating: 0-10 scale
- last_contacted: timestamp
- demo_store_built: boolean
- demo_store_url: for showing prospects their store

Business Intelligence Fields:
- weekly_uber_sales_volume
- uber_aov (average order value)
- uber_markup
- uber_profitability
- current_marketing_description
- painpoints (JSONB array)
- core_selling_points (JSONB array)
- features_to_highlight (JSONB array)
- possible_objections (JSONB array)

Platform Integrations Tracked:
- ubereats_url, doordash_url, meandyou_url, mobi2go_url
- delivereasy_url, nextorder_url, foodhub_url, ordermeal_url
```

**Sales Features:**
- Task management system
- Task sequences and templates
- Message templates
- Sequence templates
- Demo booking forms with objection/painpoint data capture
- Call scripts
- City-targeted case studies

**Lead Capture:**
- Facebook Ads integration
- Manual restaurant addition
- Comprehensive field capture

### 3. Automated Onboarding System (Crown Jewel)

**Menu & Data Scraping:**
- Firecrawl integration for structured data extraction
- Scrapes from: UberEats, DoorDash, restaurant websites, other platforms
- Extracts: menu items, prices, descriptions, images, option sets
- Extracts: opening hours (handles complex scenarios), addresses, logos
- Stores structured JSON in internal database
- Downloads images from URLs

**CloudWaitress Automation (Playwright Scripts):**

| Automation | Description |
|------------|-------------|
| Account Registration | Creates new CloudWaitress accounts with complex business hours handling (crossing midnight, multiple periods per day) |
| Multi-Restaurant Handling | Name matching to access correct account when user has multiple venues |
| Menu Upload | Generates CSVs with CDN image IDs, bulk uploads menu data |
| Logo Processing | Extracts logos, removes backgrounds with Sharp, converts to thermal printer formats |
| Website Configuration | Sets colors, uploads logos, adds SEO metadata, social links |
| Custom Code Injection | Applies CSS/JS from component template builder (welcome messages, hover effects, styling) |
| Settings Configuration | Delivery/pickup settings, auto status update times |
| Payment Setup | Stripe Connect configuration |
| Printer Configuration | Receipt printers with GST numbers |
| API & Integrations | Creates API keys, sets up Uber Direct integration |
| Option Sets | Assigns scraped option sets to correct menu items |
| Item Tags | Configures 10 tags (Popular, New, Deal, Vegan, Vegetarian, Halal, Gluten Free, Dairy Free, Nut Free, Spicy) with custom CSS styling |

**Component Template Builder:**
- UI for configuring CSS/JS injections
- Takes restaurant colors and names as inputs
- Generates: welcome messages, button styling, hover effects, menu card styling
- Accessible to users in Pump'd app

**Integration Points:**
- Main Pump'd app: registers user accounts, prepopulates onboarding records
- CloudWaitress: partial integration for account creation, CDN uploads
- Cloudflare: DNS management for custom domains

### 4. Website & Marketing Assets

- Redesigned website following conversion best practices
- Animated SVG graphics demonstrating features
- Screen recordings for social media and ads
- Ready for Meta advertising (budget/skills constraint)

---

## Skills Inventory

### Technical Skills (Self-Taught in 12 Months)

| Category | Skills |
|----------|--------|
| Languages/Frameworks | JavaScript, Typescript, React/Next.js, SQL |
| Databases | Supabase (PostgreSQL) |
| Automation | Playwright (browser automation), CRON jobs |
| APIs & SDKs | Cloudflare SDK, AWS SDK (SES), Kudosity API, Firecrawl |
| Infrastructure | DNS management, SSL certificates, domain verification |
| AI Tools | Claude Code, AI image/video generation APIs |
| Data Processing | Web scraping, JSON transformation, CSV generation, Sharp (image processing) |
| Email Systems | GrapesJS, email deliverability (SPF, DKIM, DMARC) |

### Business Skills

| Category | Skills |
|----------|--------|
| Sales | SDR/AE experience, quota achievement, demo calls, objection handling |
| Marketing | Email campaigns, SMS marketing, Meta ads (basic), content creation |
| Operations | Customer onboarding, support, multi-tenant SaaS management |
| Product | 0-1 product development, feature prioritization, UX design |
| Strategy | Market analysis, pricing, competitive positioning |

### Unique Value Proposition

**"I can take a manual, time-intensive business process and automate it end-to-end using AI tools, web scraping, browser automation, and API integrations—without a traditional CS background."**

Proof points:
- Built full CRM with 80+ fields and complex lead management
- Automated entire restaurant onboarding (hours → minutes)
- Created multi-tenant email/SMS marketing platform
- Achieved 67% outreach-to-demo conversion with automated, personalized outreach

---

## Career Transition Options Analysis

### Option 1: Start BPA/GTME Agency

**Description:** Offer consulting and implementation services for AI automation, workflow automation, and go-to-market engineering.

| Pros | Cons |
|------|------|
| Continue building something owned | No immediate income security |
| Freedom and autonomy | Starting from zero again |
| Love the hustle | Brand building takes time |
| Higher medium-term upside from ownership | No break from 80-100 hour weeks |
| Learn marketing side better | Only credibility is self-built case study |
| | Limited experience in diverse contexts |
| | Less exposure to enterprise problems |

**Viability Assessment:** Medium. Would need to land 2-3 clients quickly to validate. Pump'd serves as strong case study but narrow industry focus.

### Option 2: Internal Role (GTME / AI Implementation / FDE)

**Description:** Join established company in go-to-market engineering, AI implementation specialist, or forward-deployed engineer role.

| Pros | Cons |
|------|------|
| Immediate income jump and security | Hurts entrepreneurial identity |
| Reduced hours (40-50 vs 80-100) | No CS degree (may limit options) |
| Team collaboration and learning | Limited "traditional" AI experience (RAG, chatbots) |
| Exposure to enterprise problems | |
| Credibility building for future ventures | |
| Potential path to management experience | |
| Learn from established playbooks | |

**Viability Assessment:** High. Skills in automation, sales, and technical implementation are in demand. Pump'd serves as compelling portfolio piece.

### Option 3: Approach Other Online Ordering Providers

**Description:** Offer automation system to competitors like Bite, GloriaFood, or others.

| Pros | Cons |
|------|------|
| Existing credibility in niche | Competitor "Bite" may have similar solution |
| Could continue same problem | Boxes into low-margin industry |
| Could be internal role OR agency | May seem suspicious as competitor |
| | Value only applicable to software company, not their customers |
| | No CS degree barrier |
| | Limited "traditional" AI experience |

**Viability Assessment:** Low-Medium. Risky approach given competitive dynamics and industry economics.

### Recommended Path: Option 2 (Internal Role) with Agency as Fallback

**Rationale:**
1. Immediate income stability after 16+ months of bootstrapping
2. Exposure to enterprise-scale problems and solutions
3. Credibility building for eventual $500M goal
4. Skills are highly marketable (automation + sales + technical)
5. Agency can be built later with more diverse experience
6. Pump'd can run in maintenance mode generating case study content

---

## Current Assets for Job Search

### Portfolio Pieces

1. **Pump'd Platform** - Live SaaS product with paying customers
2. **Onboarding Automation System** - Playwright scripts (can demo with headless=false)
3. **CRM/Sales System** - Comprehensive lead management
4. **Email/SMS Marketing Platform** - Multi-tenant system with domain automation
5. **Website & Marketing Assets** - Conversion-optimized design

### Demonstrable Outcomes

- Built production SaaS with 20+ paying customers as solo founder
- Achieved 67% outreach-to-demo conversion rate
- Reduced restaurant onboarding from days to minutes
- Learned to code from zero using AI tools in 12 months
- Exceeded sales quota 6 consecutive quarters in prior role

### Target Role Types

1. **Go-To-Market Engineer** - Automation for sales/marketing processes
2. **AI Implementation Specialist** - Deploying AI solutions in business contexts
3. **Forward-Deployed Engineer** - Technical implementation at customer sites
4. **Revenue Operations** - Systems and automation for revenue teams
5. **Solutions Engineer** - Technical sales and implementation

### Target Company Types

- B2B SaaS companies with complex onboarding
- Companies investing in AI/automation tooling
- Startups needing GTM automation
- Agencies building automation for clients

---

## Appendix: Key Dates & Timeline

| Date | Milestone |
|------|-----------|
| ~Q2 2024 | Started Pump'd, left sales job |
| ~Q2 2024 | First customer sign-up |
| 2024-2025 | Built SMS marketing system |
| 2024-2025 | Built email marketing system |
| 2024-2025 | Built CRM and onboarding automation |
| Q4 2025 | Began focusing on sales again |
| Q4 2025 | Closed 3 new customers, 1 expansion |
| Late 2025 | Career transition consideration begins |

---

*Document created for use in Claude Project as central reference for career transition planning.*