# Implementation Phase Roadmap

## Overview

This document outlines a phased approach to implementing Instagram and Facebook integration, broken down into manageable milestones with clear deliverables and timelines.

## Phase Overview

| Phase | Focus | Duration | Status |
|-------|-------|----------|--------|
| **Phase 0** | Setup & Preparation | 2-3 days | Not Started |
| **Phase 1** | MVP - Instagram Feed Posting | 2-3 weeks | Not Started |
| **Phase 2** | Enhanced Posting Features | 2-3 weeks | Not Started |
| **Phase 3** | Analytics & Insights | 2-3 weeks | Not Started |
| **Phase 4** | Advanced Features | 3-4 weeks | Future |

**Total MVP to Launch**: 3-5 weeks (Phase 0 + Phase 1)
**Full Feature Set**: 8-12 weeks (All phases)

---

## Phase 0: Setup & Preparation

**Duration**: 2-3 days
**Goal**: Configure Meta app and prepare infrastructure

### Tasks

#### 1. Meta Developer Setup (4 hours)

- [ ] Create Facebook Developer account
- [ ] Create new Facebook App
- [ ] Configure app settings
  - [ ] Add Instagram product
  - [ ] Add Facebook Login product
  - [ ] Configure OAuth settings
- [ ] Set up test users (3-5 test accounts)
- [ ] Create test Instagram Business account
- [ ] Create test Facebook Page
- [ ] Link test Instagram to test Page

#### 2. Documentation Preparation (4 hours)

- [ ] Write Privacy Policy section for social media
- [ ] Create Data Deletion Instructions page
- [ ] Prepare Terms of Service updates
- [ ] Create app icon (1024x1024px)
- [ ] Document test account credentials

#### 3. Environment Setup (2 hours)

- [ ] Add environment variables
  - [ ] `META_APP_ID`
  - [ ] `META_APP_SECRET`
  - [ ] `META_GRAPH_API_VERSION`
  - [ ] `OAUTH_REDIRECT_URI`
  - [ ] `ENCRYPTION_KEY` (32 bytes for AES-256)
- [ ] Set up encryption utilities
- [ ] Configure OAuth redirect endpoint

#### 4. Database Preparation (2 hours)

- [ ] Review database schema (see 04-DATABASE-SCHEMA.md)
- [ ] Create migration scripts
- [ ] Test migrations on staging database
- [ ] Apply migrations to development database

### Deliverables

✅ Facebook app configured and in development mode
✅ Test accounts created and verified
✅ Privacy policy and data deletion pages published
✅ Database schema deployed
✅ Environment variables configured

---

## Phase 1: MVP - Instagram Feed Posting

**Duration**: 2-3 weeks (including Meta app review time)
**Goal**: Enable basic Instagram feed posting functionality

### Week 1: Core Implementation

#### Backend Development (3 days)

**OAuth Flow Implementation**

- [ ] Create OAuth routes
  - [ ] `GET /api/auth/social/connect/:platform`
  - [ ] `GET /auth/meta/callback`
  - [ ] `DELETE /api/social/accounts/:accountId`
- [ ] Implement state parameter generation and validation
- [ ] Implement token exchange logic
- [ ] Implement token encryption/decryption
- [ ] Create token refresh service
- [ ] Implement account discovery and saving

**Instagram Publishing Service** (see 06-OAUTH-FLOW.md)

- [ ] Create `InstagramPublishService` class
- [ ] Implement `createContainer()` method
- [ ] Implement `publishContainer()` method
- [ ] Implement `checkStatus()` method
- [ ] Add retry logic for transient failures
- [ ] Add rate limit handling

**API Routes**

- [ ] Create social accounts routes
  - [ ] `GET /api/social/accounts` - List connected accounts
  - [ ] `GET /api/social/accounts/:id` - Get account details
  - [ ] `PUT /api/social/accounts/:id` - Update account
- [ ] Create social posts routes
  - [ ] `POST /api/social/posts` - Create new post
  - [ ] `GET /api/social/posts` - List posts
  - [ ] `GET /api/social/posts/:id` - Get post details
  - [ ] `DELETE /api/social/posts/:id` - Delete post

#### Frontend Development (2 days)

**Social Accounts UI**

- [ ] Create "Social Accounts" settings page
- [ ] Add "Connect Instagram" button
- [ ] Implement OAuth popup/redirect flow
- [ ] Display connected accounts list
- [ ] Add "Disconnect" functionality
- [ ] Show account status (active/expired/error)

**Post to Instagram UI**

- [ ] Add "Post to Instagram" button to videos
- [ ] Create post creation modal
  - [ ] Account selector dropdown
  - [ ] Caption textarea (2,200 char limit)
  - [ ] Hashtag input
  - [ ] Post type selector (Feed only in Phase 1)
- [ ] Show posting progress
- [ ] Display success/error messages
- [ ] Add "View on Instagram" link after success

### Week 2: Testing & App Review Submission

#### Testing (2 days)

- [ ] Unit tests for services
  - [ ] OAuth flow
  - [ ] Token management
  - [ ] Instagram publishing
- [ ] Integration tests
  - [ ] End-to-end posting flow
  - [ ] Error handling
  - [ ] Token refresh
- [ ] Manual testing with test accounts
- [ ] Test token expiry and refresh
- [ ] Test error scenarios

#### App Review Preparation (1 day)

- [ ] Record screen recordings (30-120 seconds each)
  - [ ] Complete OAuth connection flow
  - [ ] Post to Instagram feed flow
  - [ ] Show final result on Instagram
- [ ] Write detailed descriptions for each permission
- [ ] Prepare step-by-step testing instructions
- [ ] Verify all URLs are HTTPS and accessible
- [ ] Double-check test account credentials

#### Submit for App Review (1 day)

- [ ] Submit `instagram_basic` permission
- [ ] Submit `instagram_content_publish` permission
- [ ] Submit `pages_show_list` permission
- [ ] Submit `pages_read_engagement` permission
- [ ] Submit `pages_manage_posts` permission
- [ ] Monitor submission status daily

### Week 3: Polish & Documentation

**While Waiting for App Review** (3-7 days)

- [ ] Write user documentation
  - [ ] How to convert to Business account
  - [ ] How to connect Instagram
  - [ ] How to post content
  - [ ] Troubleshooting common issues
- [ ] Add help tooltips in UI
- [ ] Implement error tracking and logging
- [ ] Create admin dashboard for monitoring
  - [ ] Connected accounts count
  - [ ] Posts published count
  - [ ] Error rate
- [ ] Set up monitoring alerts

**Post-Approval Tasks** (1-2 days)

- [ ] Switch app to production mode
- [ ] Update environment variables
- [ ] Deploy to production
- [ ] Test with real accounts
- [ ] Announce feature to beta users

### Phase 1 Deliverables

✅ Users can connect Instagram Business accounts via OAuth
✅ Users can post videos to Instagram feed
✅ Users can add captions and hashtags
✅ Users can see posting status and errors
✅ Users can disconnect accounts
✅ Meta app approved for production use
✅ Feature deployed to production

### Phase 1 Success Metrics

- [ ] 50%+ of active clients connect Instagram
- [ ] 20+ posts published in first 30 days
- [ ] <5% connection failure rate
- [ ] <10% post failure rate
- [ ] Average time to connect: <2 minutes

---

## Phase 2: Enhanced Posting Features

**Duration**: 2-3 weeks
**Goal**: Add scheduling, multi-platform, and Reels support

### Week 1: Scheduling & Facebook

#### Post Scheduling (2 days)

- [ ] Update `social_media_posts` table
- [ ] Implement scheduling service
  - [ ] Queue management
  - [ ] Background job processing
- [ ] Add scheduling UI
  - [ ] Date/time picker
  - [ ] Timezone handling
  - [ ] "Schedule" vs "Publish Now" options
- [ ] Create scheduled posts view
  - [ ] Show upcoming scheduled posts
  - [ ] Allow editing scheduled posts
  - [ ] Allow canceling scheduled posts

#### Facebook Pages Publishing (2 days)

- [ ] Create `FacebookPublishService` class
- [ ] Implement photo posting
- [ ] Implement video posting
- [ ] Implement multiple photo posting
- [ ] Add Facebook to account selector
- [ ] Test Facebook posting flow

### Week 2: Instagram Reels & Stories

#### Instagram Reels (2 days)

- [ ] Update container creation for Reels
- [ ] Add "share_to_feed" option
- [ ] Update UI to support Reels
- [ ] Add Reel-specific validation
  - [ ] Check aspect ratio (9:16 recommended)
  - [ ] Check duration (90s max)
- [ ] Test Reels publishing

#### Instagram Stories (1 day)

- [ ] Implement Stories publishing
- [ ] Add 15-second duration check
- [ ] Update UI for Stories
- [ ] Test Stories publishing

#### Draft Posts (1 day)

- [ ] Implement draft saving
- [ ] Create drafts view in UI
- [ ] Allow editing drafts
- [ ] Allow publishing drafts

### Week 3: Management & Polish

#### Posts Management UI (2 days)

- [ ] Enhance "Posts" tab in Social Media dashboard
- [ ] Add filtering
  - [ ] By status (draft/scheduled/published/failed)
  - [ ] By platform
  - [ ] By account
  - [ ] By date range
- [ ] Add bulk actions
  - [ ] Delete multiple
  - [ ] Reschedule multiple
- [ ] Show post thumbnails
- [ ] Add "View on Platform" links

#### Multi-Account Support (1 day)

- [ ] Support posting to multiple accounts simultaneously
- [ ] Add "Select All Accounts" option
- [ ] Show per-account status for multi-posts

### Phase 2 Deliverables

✅ Post scheduling functionality
✅ Facebook Pages posting support
✅ Instagram Reels support
✅ Instagram Stories support
✅ Draft posts saving
✅ Enhanced posts management UI
✅ Multi-account posting

### Phase 2 Success Metrics

- [ ] 10+ scheduled posts per client per month
- [ ] 70%+ of clients using posting feature
- [ ] 30%+ of posts are Reels
- [ ] <3% scheduled post failure rate

---

## Phase 3: Analytics & Insights

**Duration**: 2-3 weeks
**Goal**: Sync and display post performance metrics

### Week 1: Analytics Sync Service

#### Instagram Insights API (2 days)

- [ ] Implement Instagram insights fetching
- [ ] Support metrics:
  - [ ] Likes
  - [ ] Comments
  - [ ] Shares
  - [ ] Saves
  - [ ] Reach
  - [ ] Impressions
  - [ ] Plays (for videos)
- [ ] Handle accounts <1,000 followers (limited insights)
- [ ] Implement analytics sync service
- [ ] Schedule daily sync (cron job)

#### Facebook Insights API (1 day)

- [ ] Implement Facebook post insights
- [ ] Support similar metrics to Instagram
- [ ] Add Facebook-specific metrics (reactions breakdown)

#### Historical Snapshots (1 day)

- [ ] Implement snapshot creation
- [ ] Schedule snapshot capture (daily/weekly)
- [ ] Create analytics trends view

### Week 2: Performance Dashboard

#### "Performance" Tab UI (3 days)

- [ ] Overview cards
  - [ ] Total posts this month
  - [ ] Total engagement
  - [ ] Average engagement rate
  - [ ] Top performing post
- [ ] Engagement chart
  - [ ] Timeline of engagement
  - [ ] Filter by platform
  - [ ] Filter by post type
- [ ] Top posts section
  - [ ] Sort by engagement rate
  - [ ] Sort by reach
  - [ ] Show thumbnails and metrics
- [ ] Best time to post recommendations
  - [ ] Analyze historical data
  - [ ] Show day/time heatmap

#### Individual Post Analytics (1 day)

- [ ] Add analytics section to post detail view
- [ ] Show metric trends over time
- [ ] Compare to account average
- [ ] Add export to CSV option

### Week 3: Insights & Recommendations

#### Content Performance Analysis (2 days)

- [ ] Analyze which content types perform best
  - [ ] Portrait vs landscape
  - [ ] Video length correlation
  - [ ] Caption length impact
  - [ ] Hashtag effectiveness
- [ ] Generate insights dashboard
- [ ] Provide actionable recommendations

#### Reporting (1 day)

- [ ] Create weekly/monthly email reports
- [ ] Show highlights
  - [ ] Best performing content
  - [ ] Growth metrics
  - [ ] Engagement trends
- [ ] Add PDF export option

### Phase 3 Deliverables

✅ Automatic analytics sync from Instagram/Facebook
✅ Performance dashboard with charts
✅ Post-level analytics view
✅ Content performance insights
✅ Best time to post recommendations
✅ Automated email reports

### Phase 3 Success Metrics

- [ ] 80%+ of clients check analytics weekly
- [ ] Measurable engagement improvement (10%+)
- [ ] <5% analytics sync error rate

---

## Phase 4: Advanced Features (Future)

**Duration**: 3-4 weeks
**Goal**: Add advanced functionality and platform expansion

### Potential Features

#### Additional Platforms

- [ ] TikTok integration
- [ ] YouTube Shorts support
- [ ] Twitter/X support
- [ ] LinkedIn support

#### Content Features

- [ ] AI caption generation
- [ ] Hashtag recommendations based on content
- [ ] Auto-detect optimal post time
- [ ] A/B testing for captions
- [ ] Carousel post support (multiple images/videos)

#### Collaboration Features

- [ ] Approval workflows
- [ ] Content calendar view
- [ ] Team member roles (creator/reviewer/publisher)
- [ ] Content library organization

#### Advanced Analytics

- [ ] Competitor analysis
- [ ] Follower growth tracking
- [ ] Audience demographics
- [ ] Content performance predictions

### Phase 4 Planning

These features should be prioritized based on:
1. User feedback from Phases 1-3
2. Most requested features
3. Competitive analysis
4. Development effort vs value

---

## Resource Requirements

### Team Composition

**For Phases 1-3** (MVP to Full Feature):

| Role | Time Commitment | Duration |
|------|----------------|----------|
| **Full-Stack Developer** | 100% | 6-9 weeks |
| **Product Manager** | 25% | 6-9 weeks |
| **QA Tester** | 50% | 2-3 weeks |
| **Technical Writer** | 25% | 2-3 weeks |

**Alternative: Single Developer**
- 1 senior full-stack developer: 8-12 weeks full-time

### Infrastructure

- **Existing**: Supabase, Hosting, Domain
- **New Required**:
  - Meta Developer Account (free)
  - Monitoring/logging enhancement (optional)
  - Additional compute for background jobs (minimal)

### Budget

| Item | Phase 1 | Phases 2-3 | Total |
|------|---------|------------|-------|
| **Development** | $8,000-12,000 | $12,000-18,000 | $20,000-30,000 |
| **QA/Testing** | $1,000-2,000 | $2,000-3,000 | $3,000-5,000 |
| **Documentation** | $500-1,000 | $500-1,000 | $1,000-2,000 |
| **Buffer (20%)** | $1,900-3,000 | $2,900-4,400 | $4,800-7,400 |
| **Total** | **$11,400-18,000** | **$17,400-26,400** | **$28,800-44,400** |

---

## Risk Management

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **App Review Rejection** | Medium | High | Follow guidelines strictly, quality submissions |
| **API Rate Limits** | Low | Medium | Implement queueing, user education |
| **Token Expiry Issues** | Medium | Medium | Robust refresh logic, monitoring |
| **Platform API Changes** | Low | High | Use latest API version, monitor changelog |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Low User Adoption** | Medium | High | Beta test with engaged clients first |
| **Support Burden** | Medium | Medium | Comprehensive documentation, clear error messages |
| **Account Setup Friction** | High | Medium | Clear guides on converting to Business account |

---

## Go-Live Checklist

### Before Phase 1 Launch

- [ ] Meta app approved for production
- [ ] All tests passing
- [ ] Error tracking configured
- [ ] Monitoring and alerts set up
- [ ] Documentation published
- [ ] Support team trained
- [ ] Beta users selected (3-5 restaurants)
- [ ] Feedback collection mechanism ready

### Phase 1 Beta Launch

- [ ] Enable for beta users only
- [ ] Daily check-ins for first week
- [ ] Collect feedback
- [ ] Fix critical bugs immediately
- [ ] Iterate on UI based on feedback

### Phase 1 Full Launch

- [ ] All beta feedback addressed
- [ ] <2% error rate achieved
- [ ] Documentation finalized
- [ ] Announce to all users
- [ ] Monitor usage closely for first 2 weeks

---

## Success Definition

### MVP Success (Phase 1)

The MVP is successful if:
- 50%+ of active restaurant clients connect Instagram
- 20+ posts published in first month
- 4+ star average satisfaction rating
- <5% critical bug rate
- Positive feedback from beta users

### Full Feature Success (Phases 1-3)

Full feature set is successful if:
- 70%+ of active clients using posting feature regularly
- 10+ posts per client per month average
- Measurable time savings (10+ minutes per post)
- Positive impact on client retention (+5-10%)
- Feature becomes key differentiator in sales

---

**Last Updated**: January 2025
**Status**: Planning Phase
**Next Step**: Phase 0 - Setup & Preparation
